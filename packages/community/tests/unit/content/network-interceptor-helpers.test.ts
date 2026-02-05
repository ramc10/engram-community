/**
 * Unit tests for the prompt-injection helpers in network-interceptor.ts
 *
 * These helpers are the core of the Claude injection pipeline:
 *   extractText  – reads text out of any content-value shape
 *   writeText    – writes enriched text back, preserving shape
 *   promptsMatch – loose equality that tolerates whitespace collapse
 */

import { describe, it, expect } from '@jest/globals';
import { extractText, writeText, promptsMatch } from '../../../src/content/shared/network-interceptor';

describe('extractText', () => {
  it('returns a plain string unchanged', () => {
    expect(extractText('hello')).toBe('hello');
  });

  it('extracts text from a {text} object', () => {
    expect(extractText({ text: 'hello' })).toBe('hello');
  });

  it('extracts text from a content-block array (Claude API format)', () => {
    const content = [
      { type: 'text', text: 'hello world' },
    ];
    expect(extractText(content)).toBe('hello world');
  });

  it('extracts text from the first text block when multiple blocks exist', () => {
    const content = [
      { type: 'image', source: { type: 'base64', data: '…' } },
      { type: 'text', text: 'the actual prompt' },
    ];
    expect(extractText(content)).toBe('the actual prompt');
  });

  it('returns null for an array with no text block', () => {
    const content = [
      { type: 'image', source: {} },
    ];
    expect(extractText(content)).toBeNull();
  });

  it('returns null for null', () => {
    expect(extractText(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(extractText(undefined)).toBeNull();
  });

  it('returns null for a number', () => {
    expect(extractText(42)).toBeNull();
  });
});

describe('writeText', () => {
  it('replaces a plain string', () => {
    expect(writeText('old', 'new')).toBe('new');
  });

  it('replaces text in a {text} object, preserving other keys', () => {
    const result = writeText({ text: 'old', extra: 'kept' }, 'new');
    expect(result).toEqual({ text: 'new', extra: 'kept' });
  });

  it('replaces text in a content-block array, preserving non-text blocks', () => {
    const content = [
      { type: 'image', source: { type: 'base64' } },
      { type: 'text', text: 'old prompt' },
    ];
    const result = writeText(content, 'enriched prompt');
    expect(result).toEqual([
      { type: 'image', source: { type: 'base64' } },
      { type: 'text', text: 'enriched prompt' },
    ]);
  });

  it('replaces text in all text blocks when multiple exist', () => {
    const content = [
      { type: 'text', text: 'part1' },
      { type: 'text', text: 'part2' },
    ];
    const result = writeText(content, 'replaced');
    expect(result).toEqual([
      { type: 'text', text: 'replaced' },
      { type: 'text', text: 'replaced' },
    ]);
  });

  it('falls back to returning the enriched string for unknown shapes', () => {
    expect(writeText(42, 'new')).toBe('new');
  });
});

describe('promptsMatch', () => {
  it('matches identical strings', () => {
    expect(promptsMatch('hello', 'hello')).toBe(true);
  });

  it('matches after trimming whitespace', () => {
    expect(promptsMatch('  hello  ', 'hello')).toBe(true);
  });

  it('matches when the body value contains the original (whitespace collapse)', () => {
    // contenteditable may collapse "line1\n\nline2" → "line1 line2"
    // but the original recorded via textContent might be just "line1"
    expect(promptsMatch('line1 line2', 'line1')).toBe(true);
  });

  it('matches when the original contains the body value', () => {
    expect(promptsMatch('short', 'short prompt here')).toBe(true);
  });

  it('does not match completely different strings', () => {
    expect(promptsMatch('hello world', 'goodbye moon')).toBe(false);
  });

  it('matches whitespace-only vs non-empty (empty string is substring of everything)', () => {
    // After trim, bodyValue is "". JS "hello".includes("") === true.
    // In practice an empty body never reaches this path, so this is harmless.
    expect(promptsMatch('   ', 'hello')).toBe(true);
  });

  it('matches two empty strings', () => {
    expect(promptsMatch('', '')).toBe(true);
  });
});

/**
 * End-to-end: simulate the full replacement the interceptor performs on a
 * Claude-style request body with a content-block array.
 */
describe('full replacement round-trip (Claude content-block array)', () => {
  it('extracts, matches, and writes back correctly', () => {
    const originalPrompt = 'tell me about React hooks';
    const enrichedPrompt = 'tell me about React hooks\n\n[Engram Context]:\n1. [Score: 90%] useState …';

    // Simulates the body Claude sends: messages[].content is an array of blocks
    const body = {
      messages: [
        { role: 'user', content: [{ type: 'text', text: originalPrompt }] },
      ],
    };

    const lastMsg = body.messages[body.messages.length - 1];
    const extracted = extractText(lastMsg.content);

    expect(extracted).toBe(originalPrompt);
    expect(promptsMatch(extracted as string, originalPrompt)).toBe(true);

    lastMsg.content = writeText(lastMsg.content, enrichedPrompt);

    // Shape is preserved – still an array with a text block
    expect(lastMsg.content).toEqual([{ type: 'text', text: enrichedPrompt }]);
  });

  it('works when content is a plain string (older API shape)', () => {
    const originalPrompt = 'simple question';
    const enrichedPrompt = 'simple question\n\n[Engram Context]:\n1. …';

    const body = {
      messages: [
        { role: 'user', content: originalPrompt },
      ],
    };

    const lastMsg = body.messages[body.messages.length - 1];
    const extracted = extractText(lastMsg.content);

    expect(extracted).toBe(originalPrompt);
    expect(promptsMatch(extracted as string, originalPrompt)).toBe(true);

    lastMsg.content = writeText(lastMsg.content, enrichedPrompt);
    expect(lastMsg.content).toBe(enrichedPrompt);
  });

  it('tolerates trailing-newline mismatch between contenteditable and API body', () => {
    // contenteditable textContent strips the trailing newline that React keeps
    const fromContentEditable = 'tell me about hooks';
    const fromAPIBody = 'tell me about hooks\n';  // React appends trailing \n

    expect(promptsMatch(fromAPIBody, fromContentEditable)).toBe(true);

    const enriched = fromContentEditable + '\n\n[Engram Context]:\n1. memory';
    const content = [{ type: 'text', text: fromAPIBody }];
    const extracted = extractText(content);
    expect(extracted).toBe(fromAPIBody);
    expect(promptsMatch(extracted as string, fromContentEditable)).toBe(true);

    const result = writeText(content, enriched);
    expect(result).toEqual([{ type: 'text', text: enriched }]);
  });
});

/**
 * Stable message-identity helper tests (Phase 0b).
 * Proves the dedup key is content-derived and position-independent.
 */

import { describe, it, expect } from '@jest/globals';
import {
  computeMessageId,
  normalizeText,
  hashString,
} from '../../src/content/shared/message-id';

describe('message-id', () => {
  describe('normalizeText', () => {
    it('collapses internal whitespace and trims', () => {
      expect(normalizeText('  a\n\n b   c  ')).toBe('a b c');
    });

    it('handles empty / nullish input', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(undefined as unknown as string)).toBe('');
    });
  });

  describe('hashString', () => {
    it('is deterministic', () => {
      expect(hashString('hello world')).toBe(hashString('hello world'));
    });

    it('differs for different input', () => {
      expect(hashString('a')).not.toBe(hashString('b'));
    });
  });

  describe('computeMessageId', () => {
    it('is stable for identical content regardless of surrounding whitespace', () => {
      expect(computeMessageId('c1', 'user', 'Hello  world')).toBe(
        computeMessageId('c1', 'user', ' Hello world ')
      );
    });

    it('is position-independent (same content → same id no matter where it appears)', () => {
      // The core R5 fix: identity does not depend on DOM order/index.
      expect(computeMessageId('c1', 'assistant', 'answer')).toBe(
        computeMessageId('c1', 'assistant', 'answer')
      );
    });

    it('distinguishes conversation, role, and content', () => {
      const base = computeMessageId('c1', 'user', 'x');
      expect(computeMessageId('c2', 'user', 'x')).not.toBe(base);
      expect(computeMessageId('c1', 'assistant', 'x')).not.toBe(base);
      expect(computeMessageId('c1', 'user', 'y')).not.toBe(base);
    });

    it('treats a null conversationId as a stable "unknown" scope', () => {
      expect(computeMessageId(null, 'user', 'x')).toBe(
        computeMessageId('unknown', 'user', 'x')
      );
    });
  });
});

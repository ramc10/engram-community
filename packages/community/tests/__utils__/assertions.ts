/**
 * Custom Jest matchers for Engram testing
 * Provides domain-specific assertions for memories, encryption, etc.
 */

import { Memory, MemoryWithMemA } from '@engram/core';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeEncrypted(): R;
      toHaveValidEncryptedBlob(): R;
      toBeEnriched(): R;
      toHaveKeywords(): R;
      toHaveTags(): R;
      toHaveContext(): R;
      toHaveEmbedding(): R;
      toHaveLinks(): R;
      toHaveEvolution(): R;
      toBeValidMemory(): R;
      toHavePlaintextContent(): R;
    }
  }
}

/**
 * Custom matcher: check if memory is encrypted
 */
function toBeEncrypted(this: jest.MatcherContext, received: Memory) {
  const pass =
    received.content.text === '[ENCRYPTED]' &&
    received.encryptedContent !== undefined &&
    received.encryptedContent !== null;

  if (pass) {
    return {
      message: () =>
        `Expected memory NOT to be encrypted\n` +
        `  content.text: ${received.content.text}\n` +
        `  encryptedContent: ${received.encryptedContent ? 'present' : 'missing'}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected memory to be encrypted\n` +
        `  content.text: ${received.content.text} (expected "[ENCRYPTED]")\n` +
        `  encryptedContent: ${received.encryptedContent ? 'present' : 'missing'} (expected present)`,
      pass: false,
    };
  }
}

/**
 * Custom matcher: check if encrypted blob is valid
 */
function toHaveValidEncryptedBlob(this: jest.MatcherContext, received: Memory) {
  const blob = received.encryptedContent;

  if (!blob) {
    return {
      message: () => `Expected memory to have encrypted content`,
      pass: false,
    };
  }

  const hasVersion = blob.version === 1;
  const hasAlgorithm = blob.algorithm === 'XChaCha20-Poly1305';
  const hasNonce = blob.nonce !== undefined && blob.nonce.length > 0;
  const hasCiphertext = blob.ciphertext !== undefined && blob.ciphertext.length > 0;

  const pass = hasVersion && hasAlgorithm && hasNonce && hasCiphertext;

  if (pass) {
    return {
      message: () => `Expected memory NOT to have valid encrypted blob`,
      pass: true,
    };
  } else {
    const issues: string[] = [];
    if (!hasVersion) issues.push('version is not 1');
    if (!hasAlgorithm) issues.push('algorithm is not XChaCha20-Poly1305');
    if (!hasNonce) issues.push('nonce is missing or empty');
    if (!hasCiphertext) issues.push('ciphertext is missing or empty');

    return {
      message: () =>
        `Expected memory to have valid encrypted blob\n` +
        `  Issues: ${issues.join(', ')}\n` +
        `  Blob: ${JSON.stringify(blob, null, 2)}`,
      pass: false,
    };
  }
}

/**
 * Custom matcher: check if memory is enriched with all metadata
 */
function toBeEnriched(this: jest.MatcherContext, received: MemoryWithMemA) {
  const hasKeywords = received.keywords !== undefined && received.keywords.length > 0;
  const hasTags = received.tags !== undefined && received.tags.length > 0;
  const hasContext = received.context !== undefined && received.context.length > 0;

  const pass = hasKeywords && hasTags && hasContext;

  if (pass) {
    return {
      message: () => `Expected memory NOT to be enriched`,
      pass: true,
    };
  } else {
    const missing: string[] = [];
    if (!hasKeywords) missing.push('keywords');
    if (!hasTags) missing.push('tags');
    if (!hasContext) missing.push('context');

    return {
      message: () =>
        `Expected memory to be enriched with keywords, tags, and context\n` +
        `  Missing: ${missing.join(', ')}`,
      pass: false,
    };
  }
}

/**
 * Custom matcher: check if memory has keywords
 */
function toHaveKeywords(this: jest.MatcherContext, received: MemoryWithMemA) {
  const pass = received.keywords !== undefined && received.keywords.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have keywords`
        : `Expected memory to have keywords, but found: ${received.keywords}`,
    pass,
  };
}

/**
 * Custom matcher: check if memory has tags
 */
function toHaveTags(this: jest.MatcherContext, received: MemoryWithMemA) {
  const pass = received.tags !== undefined && received.tags.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have tags`
        : `Expected memory to have tags, but found: ${received.tags}`,
    pass,
  };
}

/**
 * Custom matcher: check if memory has context
 */
function toHaveContext(this: jest.MatcherContext, received: MemoryWithMemA) {
  const pass = received.context !== undefined && received.context.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have context`
        : `Expected memory to have context, but found: ${received.context}`,
    pass,
  };
}

/**
 * Custom matcher: check if memory has embedding
 */
function toHaveEmbedding(this: jest.MatcherContext, received: MemoryWithMemA) {
  const pass =
    received.embedding !== undefined &&
    received.embedding instanceof Float32Array &&
    received.embedding.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have embedding`
        : `Expected memory to have embedding (Float32Array), but found: ${typeof received.embedding}`,
    pass,
  };
}

/**
 * Custom matcher: check if memory has links
 */
function toHaveLinks(this: jest.MatcherContext, received: MemoryWithMemA) {
  const pass = received.links !== undefined && received.links.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have links`
        : `Expected memory to have links, but found: ${received.links}`,
    pass,
  };
}

/**
 * Custom matcher: check if memory has evolution history
 */
function toHaveEvolution(this: jest.MatcherContext, received: MemoryWithMemA) {
  const pass =
    received.evolution !== undefined &&
    received.evolution.history !== undefined &&
    received.evolution.history.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have evolution history`
        : `Expected memory to have evolution history, but found: ${JSON.stringify(received.evolution)}`,
    pass,
  };
}

/**
 * Custom matcher: check if object is a valid memory
 */
function toBeValidMemory(this: jest.MatcherContext, received: any) {
  const hasId = typeof received.id === 'string';
  const hasConversationId = typeof received.conversationId === 'string';
  const hasPlatform = ['chatgpt', 'claude', 'perplexity'].includes(received.platform);
  const hasContent = received.content !== undefined;
  const hasTimestamp = typeof received.timestamp === 'number';
  const hasDeviceId = typeof received.deviceId === 'string';
  const hasSyncStatus = ['pending', 'synced', 'failed'].includes(received.syncStatus);

  const pass =
    hasId && hasConversationId && hasPlatform && hasContent && hasTimestamp && hasDeviceId && hasSyncStatus;

  if (pass) {
    return {
      message: () => `Expected object NOT to be a valid memory`,
      pass: true,
    };
  } else {
    const issues: string[] = [];
    if (!hasId) issues.push('id is missing or invalid');
    if (!hasConversationId) issues.push('conversationId is missing or invalid');
    if (!hasPlatform) issues.push('platform is not one of: chatgpt, claude, perplexity');
    if (!hasContent) issues.push('content is missing');
    if (!hasTimestamp) issues.push('timestamp is missing or not a number');
    if (!hasDeviceId) issues.push('deviceId is missing or invalid');
    if (!hasSyncStatus) issues.push('syncStatus is not one of: pending, synced, failed');

    return {
      message: () =>
        `Expected object to be a valid memory\n` +
        `  Issues: ${issues.join(', ')}\n` +
        `  Received: ${JSON.stringify(received, null, 2)}`,
      pass: false,
    };
  }
}

/**
 * Custom matcher: check if memory has plaintext content (not encrypted)
 */
function toHavePlaintextContent(this: jest.MatcherContext, received: Memory) {
  const pass =
    received.content.text !== '[ENCRYPTED]' &&
    received.content.text !== undefined &&
    received.content.text.length > 0;

  return {
    message: () =>
      pass
        ? `Expected memory NOT to have plaintext content`
        : `Expected memory to have plaintext content, but found: "${received.content.text}"`,
    pass,
  };
}

/**
 * Export custom matchers
 */
export const customMatchers = {
  toBeEncrypted,
  toHaveValidEncryptedBlob,
  toBeEnriched,
  toHaveKeywords,
  toHaveTags,
  toHaveContext,
  toHaveEmbedding,
  toHaveLinks,
  toHaveEvolution,
  toBeValidMemory,
  toHavePlaintextContent,
};

/**
 * Register custom matchers with Jest
 */
export function registerCustomMatchers(): void {
  expect.extend(customMatchers);
}

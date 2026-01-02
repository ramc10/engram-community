/**
 * Jest setup file for extension tests
 */

import { jest } from '@jest/globals';

// Mock chrome API
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
} as any;

// Mock crypto for Node.js environment
const nodeCrypto = require('crypto');
const { webcrypto } = nodeCrypto;

// Polyfill Web Crypto API (including subtle)
// Force override global.crypto with webcrypto for full Web Crypto API support
(global as any).crypto = {
  subtle: webcrypto.subtle,
  randomUUID: webcrypto.randomUUID.bind(webcrypto),
  getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
};

// Polyfill structuredClone for Node.js < 17 (required by fake-indexeddb)
if (typeof global.structuredClone === 'undefined') {
  (global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Polyfill TextEncoder and TextDecoder for Node.js environments
if (typeof global.TextEncoder === 'undefined') {
  const util = require('util');
  (global as any).TextEncoder = util.TextEncoder;
  (global as any).TextDecoder = util.TextDecoder;
}

// Use fake-indexeddb for realistic IndexedDB testing
// This allows Dexie to work with an in-memory IndexedDB implementation
require('fake-indexeddb/auto');

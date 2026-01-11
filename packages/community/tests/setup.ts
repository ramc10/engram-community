/**
 * Jest setup file for extension tests
 */

import { jest } from '@jest/globals';

// Mock chrome API with comprehensive coverage
(global as any).chrome = {
  runtime: {
    id: 'test-extension-id',
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListeners: jest.fn(() => true),
    },
    onInstalled: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn((message: any, callback?: (response: any) => void) => {
      // Default mock behavior - can be overridden in tests
      const response = { success: true };
      if (callback) {
        callback(response);
      }
      return Promise.resolve(response);
    }),
    lastError: undefined,
    getManifest: jest.fn(() => ({
      manifest_version: 3,
      name: 'Engram Test',
      version: '1.0.0',
    })),
  },
  storage: {
    local: {
      get: jest.fn((keys) => {
        // Returns empty object by default
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: undefined });
        }
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            result[key] = undefined;
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items) => Promise.resolve()),
      remove: jest.fn((keys) => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
      getBytesInUse: jest.fn(() => Promise.resolve(0)),
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    session: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  sidePanel: {
    setPanelBehavior: jest.fn(() => Promise.resolve()),
    setOptions: jest.fn(() => Promise.resolve()),
    open: jest.fn(() => Promise.resolve()),
    getOptions: jest.fn(() => Promise.resolve({})),
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    query: jest.fn(() => Promise.resolve([])),
    get: jest.fn(() => Promise.resolve({})),
    create: jest.fn(() => Promise.resolve({})),
    update: jest.fn(() => Promise.resolve({})),
    remove: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve()),
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    setIcon: jest.fn(() => Promise.resolve()),
    setBadgeText: jest.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
  },
  identity: {
    getRedirectURL: jest.fn(() => 'https://test-extension-id.chromiumapp.org/'),
    launchWebAuthFlow: jest.fn((options) => {
      // Mock OAuth flow - return redirect URL with tokens
      return Promise.resolve(
        'https://test-extension-id.chromiumapp.org/#access_token=test-token&refresh_token=test-refresh'
      );
    }),
  },
  windows: {
    get: jest.fn(() => Promise.resolve({})),
    create: jest.fn(() => Promise.resolve({})),
    update: jest.fn(() => Promise.resolve({})),
    remove: jest.fn(() => Promise.resolve()),
    getCurrent: jest.fn(() => Promise.resolve({ id: 1 })),
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

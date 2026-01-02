/**
 * Crypto API polyfill for Jest tests
 * Sets up Web Crypto API in Node.js environment
 */

import { webcrypto } from 'crypto';

// Polyfill Web Crypto API
if (!global.crypto) {
  (global as any).crypto = {
    subtle: webcrypto.subtle,
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    randomUUID: webcrypto.randomUUID.bind(webcrypto),
  };
}

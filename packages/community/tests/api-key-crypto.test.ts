/**
 * Tests for API Key Encryption
 * Covers encryption, decryption, key management, and error handling
 */

// Ensure TextEncoder/TextDecoder are available before imports
import { TextEncoder, TextDecoder } from 'util';
if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { encryptApiKey, decryptApiKey, isEncrypted } from '../src/lib/api-key-crypto';

// Mock chrome.storage.local
const mockStorage: Record<string, any> = {};

// Create mock functions
const mockGet = jest.fn((keys: string | string[]) => {
  if (typeof keys === 'string') {
    return Promise.resolve({ [keys]: mockStorage[keys] });
  }
  const result: Record<string, any> = {};
  for (const key of keys) {
    if (mockStorage[key] !== undefined) {
      result[key] = mockStorage[key];
    }
  }
  return Promise.resolve(result);
});

const mockSet = jest.fn((items: Record<string, any>) => {
  Object.assign(mockStorage, items);
  return Promise.resolve();
});

global.chrome = {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
    },
  } as any,
} as any;

describe('API Key Encryption', () => {
  beforeEach(() => {
    // Clear mockStorage object
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    // Only clear mock call history, not implementations
    mockGet.mockClear();
    mockSet.mockClear();
  });

  afterEach(() => {
    // Don't reset mocks here - it would clear the implementations
    // mockClear() in beforeEach is sufficient
  });

  describe('encryptApiKey', () => {
    it('should encrypt an OpenAI API key', async () => {
      const apiKey = 'sk-test-openai-key-1234567890';
      const encrypted = await encryptApiKey(apiKey);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(apiKey);
      expect(encrypted.length).toBeGreaterThan(apiKey.length);
    });

    it('should encrypt an Anthropic API key', async () => {
      const apiKey = 'sk-ant-test-anthropic-key-1234567890';
      const encrypted = await encryptApiKey(apiKey);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(apiKey);
      expect(encrypted.length).toBeGreaterThan(apiKey.length);
    });

    it('should produce different ciphertexts for the same key on multiple encryptions', async () => {
      const apiKey = 'sk-test-key';

      // Clear storage to force new encryption key generation
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      const encrypted1 = await encryptApiKey(apiKey);

      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      const encrypted2 = await encryptApiKey(apiKey);

      // Different encryption keys should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty API key', async () => {
      await expect(encryptApiKey('')).rejects.toThrow('API key cannot be empty');
    });

    it('should throw error for whitespace-only API key', async () => {
      await expect(encryptApiKey('   ')).rejects.toThrow('API key cannot be empty');
    });

    it('should store encryption key in chrome.storage.local', async () => {
      const apiKey = 'sk-test-key';
      await encryptApiKey(apiKey);

      expect(mockStorage['engram_api_key_encryption_key']).toBeDefined();
    });
  });

  describe('decryptApiKey', () => {
    it('should decrypt an encrypted API key', async () => {
      const originalKey = 'sk-test-openai-key-1234567890';
      const encrypted = await encryptApiKey(originalKey);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(originalKey);
    });

    it('should decrypt an Anthropic API key correctly', async () => {
      const originalKey = 'sk-ant-api-key-xyz789';
      const encrypted = await encryptApiKey(originalKey);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(originalKey);
    });

    it('should handle long API keys', async () => {
      const originalKey = 'sk-' + 'a'.repeat(200);
      const encrypted = await encryptApiKey(originalKey);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(originalKey);
    });

    it('should throw error for empty encrypted string', async () => {
      await expect(decryptApiKey('')).rejects.toThrow('Encrypted API key cannot be empty');
    });

    it('should throw error for invalid encrypted data', async () => {
      await expect(decryptApiKey('invalid-encrypted-data')).rejects.toThrow(
        'Failed to decrypt API key'
      );
    });

    it('should use the same encryption key for multiple operations', async () => {
      const key1 = 'sk-test-key-1';
      const key2 = 'sk-test-key-2';

      const encrypted1 = await encryptApiKey(key1);
      const encrypted2 = await encryptApiKey(key2);

      // Should decrypt correctly with the same stored encryption key
      const decrypted1 = await decryptApiKey(encrypted1);
      const decrypted2 = await decryptApiKey(encrypted2);

      expect(decrypted1).toBe(key1);
      expect(decrypted2).toBe(key2);
    });
  });

  describe('isEncrypted', () => {
    it('should return false for plain OpenAI API keys', () => {
      expect(isEncrypted('sk-test-key')).toBe(false);
      expect(isEncrypted('sk-proj-1234567890')).toBe(false);
    });

    it('should return false for plain Anthropic API keys', () => {
      expect(isEncrypted('sk-ant-test-key')).toBe(false);
      expect(isEncrypted('sk-ant-api03-xyz')).toBe(false);
    });

    it('should return true for encrypted data', async () => {
      const apiKey = 'sk-test-key';
      const encrypted = await encryptApiKey(apiKey);

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for short strings', () => {
      expect(isEncrypted('abc')).toBe(false);
      expect(isEncrypted('short')).toBe(false);
    });

    it('should return true for long base64-like strings', () => {
      const longBase64 = 'A'.repeat(150);
      expect(isEncrypted(longBase64)).toBe(true);
    });

    it('should return false for strings with non-base64 characters', () => {
      const longString = 'invalid@chars#here!' + 'x'.repeat(100);
      expect(isEncrypted(longString)).toBe(false);
    });
  });

  describe('Round-trip encryption/decryption', () => {
    const testCases = [
      { name: 'OpenAI key', value: 'sk-test-openai-1234567890' },
      { name: 'Anthropic key', value: 'sk-ant-test-anthropic-xyz' },
      { name: 'Long key', value: 'sk-' + 'x'.repeat(500) },
      { name: 'Key with special chars', value: 'sk-test_key-with/special+chars=' },
      { name: 'Unicode key', value: 'sk-test-🔑-unicode-key' },
    ];

    testCases.forEach(({ name, value }) => {
      it(`should correctly encrypt and decrypt ${name}`, async () => {
        const encrypted = await encryptApiKey(value);
        const decrypted = await decryptApiKey(encrypted);

        expect(decrypted).toBe(value);
        expect(isEncrypted(encrypted)).toBe(true);
        expect(isEncrypted(value)).toBe(false);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle chrome.storage.local errors gracefully on encrypt', async () => {
      // Mock chrome.storage.local.set to fail
      (global.chrome.storage.local.set as jest.Mock).mockRejectedValueOnce(
        new Error('Storage quota exceeded')
      );

      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(
        'Failed to encrypt API key'
      );
    });

    it('should handle chrome.storage.local errors gracefully on decrypt', async () => {
      const apiKey = 'sk-test-key';
      const encrypted = await encryptApiKey(apiKey);

      // Mock chrome.storage.local.get to fail
      (global.chrome.storage.local.get as jest.Mock).mockRejectedValueOnce(
        new Error('Storage unavailable')
      );

      await expect(decryptApiKey(encrypted)).rejects.toThrow(
        'Failed to decrypt API key'
      );
    });

    it('should handle corrupted encryption key in storage', async () => {
      const apiKey = 'sk-test-key';
      const encrypted = await encryptApiKey(apiKey);

      // Corrupt the encryption key in storage
      mockStorage['engram_api_key_encryption_key'] = 'corrupted-key!!!';

      await expect(decryptApiKey(encrypted)).rejects.toThrow(
        'Failed to decrypt API key'
      );
    });
  });

  describe('Key persistence', () => {
    it('should reuse existing encryption key if available', async () => {
      const apiKey1 = 'sk-test-key-1';
      const apiKey2 = 'sk-test-key-2';

      // First encryption creates the key
      await encryptApiKey(apiKey1);
      const encryptionKeyAfterFirst = mockStorage['engram_api_key_encryption_key'];

      // Second encryption should reuse the key
      await encryptApiKey(apiKey2);
      const encryptionKeyAfterSecond = mockStorage['engram_api_key_encryption_key'];

      expect(encryptionKeyAfterFirst).toBe(encryptionKeyAfterSecond);
    });

    it('should generate new key if storage is cleared', async () => {
      const apiKey = 'sk-test-key';

      // First encryption
      const encrypted1 = await encryptApiKey(apiKey);
      const key1 = mockStorage['engram_api_key_encryption_key'];

      // Clear storage
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

      // Second encryption should generate new key
      const encrypted2 = await encryptApiKey(apiKey);
      const key2 = mockStorage['engram_api_key_encryption_key'];

      expect(key1).not.toBe(key2);
      expect(encrypted1).not.toBe(encrypted2);
    });
  });
});

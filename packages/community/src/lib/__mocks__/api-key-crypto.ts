/**
 * Mock implementation of api-key-crypto module for testing
 * Avoids ESM module resolution issues with @noble packages
 */

import { jest } from '@jest/globals';

/**
 * Mock encrypt function - returns a fake encrypted string
 */
export const encryptApiKey = jest.fn<any>().mockImplementation(async (apiKey: string): Promise<string> => {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key cannot be empty');
  }
  // Return a fake encrypted blob (base64-like string > 100 chars)
  return `encrypted_${btoa(apiKey)}_${Date.now()}_mock_blob_padding_to_exceed_100_chars_for_isEncrypted_heuristic`;
});

/**
 * Mock decrypt function - returns the original API key from the mock encrypted format
 */
export const decryptApiKey = jest.fn<any>().mockImplementation(async (encryptedApiKey: string): Promise<string> => {
  if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
    throw new Error('Encrypted API key cannot be empty');
  }
  // Extract the original key from our mock format: encrypted_{base64}_{timestamp}_...
  const match = encryptedApiKey.match(/^encrypted_([A-Za-z0-9+/=]+)_/);
  if (match) {
    return atob(match[1]);
  }
  // If called with a real encrypted blob (in tests), just return a mock key
  return 'mock-decrypted-api-key';
});

/**
 * Mock isEncrypted function - checks if string matches our mock encrypted format or heuristic
 */
export const isEncrypted = jest.fn<any>().mockImplementation((value: string): boolean => {
  if (!value || value.length === 0) return false;

  // Check for plain-text API key formats
  const isPlainOpenAI = value.startsWith('sk-');
  const isPlainAnthropic = value.startsWith('sk-ant-');

  if (isPlainOpenAI || isPlainAnthropic) {
    return false;
  }

  // Check for our mock encrypted format or base64-like strings > 100 chars
  return value.startsWith('encrypted_') || (value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value));
});

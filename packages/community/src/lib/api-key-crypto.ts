/**
 * API Key Encryption Module
 * Provides secure encryption/decryption for LLM provider API keys
 */

// Import CryptoService from local lib (not from @engram/core to avoid bundling issues)
import { CryptoService } from './crypto-service';

const ENCRYPTION_KEY_STORAGE_KEY = 'engram_api_key_encryption_key';

/**
 * Get or create the encryption key for API keys.
 *
 * This key is stored in chrome.storage.local and used to encrypt/decrypt API keys.
 * If no key exists, a new 256-bit random key is generated and stored.
 *
 * **Security Note:** The encryption key is stored alongside the encrypted data,
 * providing defense-in-depth but not zero-knowledge encryption. An attacker with
 * chrome.storage.local access could decrypt the API keys.
 *
 * @returns {Promise<Uint8Array>} The 256-bit encryption key
 * @throws {Error} If chrome.storage.local is unavailable or key generation fails
 *
 * @example
 * ```typescript
 * const key = await getOrCreateEncryptionKey();
 * // key is a Uint8Array of length 32 (256 bits)
 * ```
 */
async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  try {
    // Try to retrieve existing key
    const result = await chrome.storage.local.get(ENCRYPTION_KEY_STORAGE_KEY);

    if (result[ENCRYPTION_KEY_STORAGE_KEY]) {
      // Convert base64 stored key back to Uint8Array
      const base64Key = result[ENCRYPTION_KEY_STORAGE_KEY];
      const binaryString = atob(base64Key);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    // Generate new encryption key
    const cryptoService = new CryptoService();
    await cryptoService.initialize();
    const newKey = cryptoService.generateEncryptionKey();

    // Store the key as base64
    const base64Key = btoa(String.fromCharCode(...Array.from(newKey)));
    await chrome.storage.local.set({
      [ENCRYPTION_KEY_STORAGE_KEY]: base64Key,
    });

    return newKey;
  } catch (error) {
    console.error('[API Key Crypto] Failed to get/create encryption key:', error);
    throw new Error('Failed to initialize API key encryption');
  }
}

/**
 * Encrypt an API key before storage using XChaCha20-Poly1305 AEAD encryption.
 *
 * The API key is encrypted with a randomly generated 256-bit key that is stored
 * in chrome.storage.local. Each encryption operation uses a unique random nonce
 * for semantic security.
 *
 * @param {string} apiKey - The plain-text API key to encrypt (e.g., "sk-..." for OpenAI)
 * @returns {Promise<string>} Base64-encoded encrypted blob containing ciphertext and metadata
 * @throws {Error} If apiKey is empty or encryption fails
 *
 * @example
 * ```typescript
 * const plainKey = "sk-proj-abc123...";
 * const encrypted = await encryptApiKey(plainKey);
 * // encrypted is a base64 string, much longer than the original
 * // Safe to store in chrome.storage.local
 * ```
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key cannot be empty');
  }

  try {
    const encryptionKey = await getOrCreateEncryptionKey();
    const cryptoService = new CryptoService();
    await cryptoService.initialize();

    const encrypted = await cryptoService.encryptString(apiKey, encryptionKey);
    return encrypted;
  } catch (error) {
    console.error('[API Key Crypto] Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt an API key after retrieval from storage.
 *
 * Decrypts an API key that was previously encrypted with {@link encryptApiKey}.
 * Uses the encryption key stored in chrome.storage.local.
 *
 * @param {string} encryptedApiKey - Base64-encoded encrypted blob from {@link encryptApiKey}
 * @returns {Promise<string>} The decrypted plain-text API key
 * @throws {Error} If encryptedApiKey is empty, invalid, or decryption fails
 *
 * @example
 * ```typescript
 * const encrypted = await chrome.storage.local.get('enrichmentConfig');
 * if (encrypted.apiKey) {
 *   const plainKey = await decryptApiKey(encrypted.apiKey);
 *   // plainKey is the original API key, e.g., "sk-proj-abc123..."
 * }
 * ```
 */
export async function decryptApiKey(encryptedApiKey: string): Promise<string> {
  if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
    throw new Error('Encrypted API key cannot be empty');
  }

  try {
    const encryptionKey = await getOrCreateEncryptionKey();
    const cryptoService = new CryptoService();
    await cryptoService.initialize();

    const decrypted = await cryptoService.decryptString(encryptedApiKey, encryptionKey);
    return decrypted;
  } catch (error) {
    console.error('[API Key Crypto] Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Check if a string appears to be encrypted using heuristic analysis.
 *
 * This function uses pattern matching to determine if a string looks like an
 * encrypted blob versus a plain-text API key. It checks for:
 * - Known plain-text prefixes (sk-, sk-ant-)
 * - Length (encrypted blobs are >100 chars)
 * - Character set (base64 for encrypted data)
 *
 * **Note:** This is a heuristic check and may have false positives/negatives.
 * Used for backward compatibility with existing plain-text API keys.
 *
 * @param {string} value - The string to check
 * @returns {boolean} `true` if the string appears encrypted, `false` if it looks like plain text
 *
 * @example
 * ```typescript
 * isEncrypted('sk-proj-abc123');  // false - recognizes OpenAI format
 * isEncrypted('sk-ant-api-xyz');  // false - recognizes Anthropic format
 * isEncrypted('dGVzdA==');        // false - too short for encrypted blob
 * isEncrypted(encryptedBlob);     // true - long base64 string
 * ```
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length === 0) return false;

  // Check if it looks like a base64-encoded encrypted blob
  // Encrypted strings will be longer and contain base64 characters
  // Plain API keys typically start with specific prefixes
  const isPlainOpenAI = value.startsWith('sk-');
  const isPlainAnthropic = value.startsWith('sk-ant-');

  if (isPlainOpenAI || isPlainAnthropic) {
    return false;
  }

  // If it's not a known plain format and is base64-like, assume encrypted
  // This is a heuristic - encrypted values are much longer than plain API keys
  return value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value);
}

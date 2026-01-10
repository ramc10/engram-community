/**
 * Device Key Manager
 *
 * Manages device-specific encryption key for master key persistence.
 * The device key is used to encrypt the master key so it can be stored
 * in chrome.storage.local and restored after extension reload.
 *
 * Security Model:
 * - Device key is generated once per installation and stored in chrome.storage.local
 * - Master key is encrypted with device key before storage
 * - This is device-bound encryption - master key cannot be moved to another device
 * - Trade-off: Weaker than password-only but better UX (no re-login on every reload)
 */

import { MasterKey } from '@engram/core';

// Declare chrome for TypeScript
declare const chrome: any;

const DEVICE_KEY_STORAGE_KEY = 'device_encryption_key';
const ENCRYPTED_MASTER_KEY_STORAGE_KEY = 'encrypted_master_key';

/**
 * Encrypted master key format for storage
 */
export interface EncryptedMasterKey {
  ciphertext: string;      // Base64-encoded encrypted master key data
  nonce: string;           // Base64-encoded AES-GCM nonce (IV)
  salt: string;            // Base64-encoded salt from master key derivation
  derivedAt: number;       // When key was derived
  version: number;         // Encryption version (for future compatibility)
}

/**
 * JWK format for device key storage
 */
interface DeviceKeyJWK {
  key: JsonWebKey;
  timestamp: number;
}

/**
 * Device Key Manager
 *
 * Handles generation, storage, and usage of device-specific encryption keys
 */
export class DeviceKeyManager {
  private deviceKey: CryptoKey | null = null;

  /**
   * Get or create device encryption key
   *
   * This key is used to encrypt the master key for persistence.
   * Generated once per device and stored in chrome.storage.local.
   */
  async getOrCreateDeviceKey(): Promise<CryptoKey> {
    // Return cached key if available
    if (this.deviceKey) {
      return this.deviceKey;
    }

    try {
      // Try to load existing key from storage
      const stored = await chrome.storage.local.get(DEVICE_KEY_STORAGE_KEY);

      if (stored[DEVICE_KEY_STORAGE_KEY]) {
        console.log('[DeviceKeyManager] Loading existing device key');
        const deviceKeyData = stored[DEVICE_KEY_STORAGE_KEY] as DeviceKeyJWK;

        // Import the stored JWK
        this.deviceKey = await crypto.subtle.importKey(
          'jwk',
          deviceKeyData.key,
          { name: 'AES-GCM', length: 256 },
          true, // extractable
          ['encrypt', 'decrypt']
        );

        return this.deviceKey;
      }
    } catch (error) {
      console.error('[DeviceKeyManager] Error loading device key:', error);
      // Fall through to generate new key
    }

    // Generate new device key
    console.log('[DeviceKeyManager] Generating new device key');
    this.deviceKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable (needed for storage)
      ['encrypt', 'decrypt']
    );

    // Export and store the key
    try {
      const exportedKey = await crypto.subtle.exportKey('jwk', this.deviceKey);
      const deviceKeyData: DeviceKeyJWK = {
        key: exportedKey,
        timestamp: Date.now(),
      };

      await chrome.storage.local.set({
        [DEVICE_KEY_STORAGE_KEY]: deviceKeyData,
      });

      console.log('[DeviceKeyManager] Device key generated and stored');
    } catch (error) {
      console.error('[DeviceKeyManager] Error storing device key:', error);
      throw new Error('Failed to store device encryption key');
    }

    return this.deviceKey;
  }

  /**
   * Encrypt master key for storage
   *
   * @param masterKey - Master key to encrypt
   * @returns Encrypted master key data
   */
  async encryptMasterKey(masterKey: MasterKey): Promise<EncryptedMasterKey> {
    const deviceKey = await this.getOrCreateDeviceKey();

    try {
      // Serialize master key (only the key bytes, not salt)
      const masterKeyBytes = masterKey.key;

      // Generate random nonce (96 bits for AES-GCM)
      const nonce = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt master key with device key
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
        },
        deviceKey,
        masterKeyBytes as BufferSource
      );

      // Convert to base64 for storage
      const encrypted: EncryptedMasterKey = {
        ciphertext: this.arrayBufferToBase64(ciphertext),
        nonce: this.arrayBufferToBase64(nonce),
        salt: this.arrayBufferToBase64(masterKey.salt),
        derivedAt: masterKey.derivedAt,
        version: 1,
      };

      return encrypted;
    } catch (error) {
      console.error('[DeviceKeyManager] Error encrypting master key:', error);
      throw new Error('Failed to encrypt master key');
    }
  }

  /**
   * Decrypt master key from storage
   *
   * @param encrypted - Encrypted master key data
   * @returns Decrypted master key
   */
  async decryptMasterKey(encrypted: EncryptedMasterKey): Promise<MasterKey> {
    const deviceKey = await this.getOrCreateDeviceKey();

    try {
      // Convert from base64
      const ciphertext = this.base64ToArrayBuffer(encrypted.ciphertext);
      const nonce = this.base64ToArrayBuffer(encrypted.nonce);
      const salt = this.base64ToArrayBuffer(encrypted.salt);

      // Decrypt master key with device key
      const decryptedBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(nonce),
        },
        deviceKey,
        ciphertext
      );

      // Convert back to Uint8Array for MasterKey
      const masterKeyBytes = new Uint8Array(decryptedBytes);
      const saltBytes = new Uint8Array(salt);

      const masterKey: MasterKey = {
        key: masterKeyBytes,
        salt: saltBytes,
        derivedAt: encrypted.derivedAt,
      };

      return masterKey;
    } catch (error) {
      console.error('[DeviceKeyManager] Error decrypting master key:', error);
      throw new Error('Failed to decrypt master key - key may be corrupted');
    }
  }

  /**
   * Store encrypted master key in chrome.storage.local
   *
   * @param encrypted - Encrypted master key to store
   */
  async storeMasterKey(encrypted: EncryptedMasterKey): Promise<void> {
    try {
      await chrome.storage.local.set({
        [ENCRYPTED_MASTER_KEY_STORAGE_KEY]: encrypted,
      });
      console.log('[DeviceKeyManager] Encrypted master key stored');
    } catch (error) {
      console.error('[DeviceKeyManager] Error storing encrypted master key:', error);
      throw new Error('Failed to store encrypted master key');
    }
  }

  /**
   * Load encrypted master key from chrome.storage.local
   *
   * @returns Encrypted master key or null if not found
   */
  async loadMasterKey(): Promise<EncryptedMasterKey | null> {
    try {
      const stored = await chrome.storage.local.get(ENCRYPTED_MASTER_KEY_STORAGE_KEY);

      if (stored[ENCRYPTED_MASTER_KEY_STORAGE_KEY]) {
        return stored[ENCRYPTED_MASTER_KEY_STORAGE_KEY] as EncryptedMasterKey;
      }

      return null;
    } catch (error) {
      console.error('[DeviceKeyManager] Error loading encrypted master key:', error);
      return null;
    }
  }

  /**
   * Clear encrypted master key from storage
   *
   * Called on logout or when key is corrupted
   */
  async clearMasterKey(): Promise<void> {
    try {
      await chrome.storage.local.remove(ENCRYPTED_MASTER_KEY_STORAGE_KEY);
      console.log('[DeviceKeyManager] Encrypted master key cleared');
    } catch (error) {
      console.error('[DeviceKeyManager] Error clearing encrypted master key:', error);
    }
  }

  /**
   * Clear device key from storage
   *
   * WARNING: This will make any encrypted master keys unrecoverable
   * Only use during uninstall or full reset
   */
  async clearDeviceKey(): Promise<void> {
    try {
      await chrome.storage.local.remove(DEVICE_KEY_STORAGE_KEY);
      this.deviceKey = null;
      console.log('[DeviceKeyManager] Device key cleared');
    } catch (error) {
      console.error('[DeviceKeyManager] Error clearing device key:', error);
    }
  }

  /**
   * Utility: Convert ArrayBuffer or Uint8Array to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

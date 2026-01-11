/**
 * Cryptography service implementation using Noble crypto libraries
 * Service worker compatible - no libsodium dependencies
 * Implements zero-knowledge encryption with E2E security
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { ed25519 } from '@noble/curves/ed25519';
import { blake2b } from '@noble/hashes/blake2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { argon2id } from 'hash-wasm';

/**
 * Generate cryptographically secure random bytes using Web Crypto API
 */
function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

import {
  ICryptoService,
  MasterKey,
  DeviceKeyPair,
  EncryptedBlob,
  SearchTag,
  KeyDerivationConfig,
  CRYPTO_CONFIG,
  uint8ArrayToBase64,
  base64ToUint8Array,
  stringToUint8Array,
  uint8ArrayToString,
} from '@engram/core';

/**
 * Key derivation configuration matching spec
 */
const KEY_DERIVATION_CONFIG: KeyDerivationConfig = {
  algorithm: 'Argon2id',
  saltBytes: 16,
  iterations: 4, // Time cost
  memoryKiB: 65536, // 64 MB
  parallelism: 1,
  outputKeyBytes: 32, // 256-bit key
};

/**
 * CryptoService implementation using Noble libraries
 */
export class CryptoService implements ICryptoService {
  private initialized = false;

  /**
   * Initialize crypto service (Noble libraries don't need async initialization)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[CryptoService] Initialized with Noble crypto libraries');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CryptoService not initialized. Call initialize() first.');
    }
  }

  /**
   * Derive a master key from a passphrase using Argon2id
   */
  async deriveKey(passphrase: string, salt?: Uint8Array): Promise<MasterKey> {
    this.ensureInitialized();

    // Generate salt if not provided
    const keySalt = salt || this.generateSalt();

    // Derive key using Argon2id
    const keyHex = await argon2id({
      password: passphrase,
      salt: keySalt,
      parallelism: KEY_DERIVATION_CONFIG.parallelism,
      iterations: KEY_DERIVATION_CONFIG.iterations,
      memorySize: KEY_DERIVATION_CONFIG.memoryKiB, // Already in KiB
      hashLength: KEY_DERIVATION_CONFIG.outputKeyBytes,
      outputType: 'hex',
    });

    // Convert hex string to Uint8Array
    const key = new Uint8Array(
      keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return {
      key,
      salt: keySalt,
      derivedAt: Date.now(),
    };
  }

  /**
   * Generate Ed25519 key pair for device signing
   */
  async generateDeviceKeyPair(): Promise<DeviceKeyPair> {
    this.ensureInitialized();

    // Generate 32 random bytes for Ed25519 private key
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = ed25519.getPublicKey(privateKey);

    return {
      publicKey: uint8ArrayToBase64(publicKey),
      privateKey,
      algorithm: 'Ed25519',
    };
  }

  /**
   * Encrypt data using XChaCha20-Poly1305
   */
  async encrypt(data: Uint8Array | string, key: Uint8Array): Promise<EncryptedBlob> {
    this.ensureInitialized();

    // Validate key length
    if (key.length !== CRYPTO_CONFIG.KEY_SIZE) {
      throw new Error(
        `Invalid key size. Expected ${CRYPTO_CONFIG.KEY_SIZE} bytes, got ${key.length}`
      );
    }

    // Convert string to Uint8Array if needed
    const plaintext = typeof data === 'string' ? stringToUint8Array(data) : data;

    // Generate nonce (XChaCha20 uses 24-byte nonce)
    const nonce = this.generateNonce();

    // Encrypt with XChaCha20-Poly1305
    const cipher = xchacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(plaintext);

    // Extract auth tag (last 16 bytes)
    const authTag = ciphertext.slice(-16);

    return {
      version: 1,
      algorithm: 'XChaCha20-Poly1305',
      nonce,
      ciphertext,
      authTag,
    };
  }

  /**
   * Decrypt data using XChaCha20-Poly1305
   */
  async decrypt(blob: EncryptedBlob, key: Uint8Array): Promise<Uint8Array> {
    this.ensureInitialized();

    // Validate key length
    if (key.length !== CRYPTO_CONFIG.KEY_SIZE) {
      throw new Error(
        `Invalid key size. Expected ${CRYPTO_CONFIG.KEY_SIZE} bytes, got ${key.length}`
      );
    }

    // Validate version
    if (blob.version !== 1) {
      throw new Error(`Unsupported encryption version: ${blob.version}`);
    }

    // Validate algorithm
    if (blob.algorithm !== 'XChaCha20-Poly1305') {
      throw new Error(`Unsupported algorithm: ${blob.algorithm}`);
    }

    try {
      // Decrypt with XChaCha20-Poly1305
      const cipher = xchacha20poly1305(key, blob.nonce);
      const plaintext = cipher.decrypt(blob.ciphertext);

      return plaintext;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sign data with Ed25519 private key
   */
  async sign(data: Uint8Array, privateKey: Uint8Array): Promise<string> {
    this.ensureInitialized();

    // Create signature
    const signature = ed25519.sign(data, privateKey);

    // Return as base64
    return uint8ArrayToBase64(signature);
  }

  /**
   * Verify Ed25519 signature
   */
  async verify(data: Uint8Array, signature: string, publicKey: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const signatureBytes = base64ToUint8Array(signature);
      const publicKeyBytes = base64ToUint8Array(publicKey);

      // Verify signature
      return ed25519.verify(signatureBytes, data, publicKeyBytes);
    } catch (error) {
      // Invalid signature format or verification failed
      return false;
    }
  }

  /**
   * Generate searchable encryption tag using HMAC
   */
  async generateSearchTag(keyword: string, searchKey: Uint8Array): Promise<SearchTag> {
    this.ensureInitialized();

    // Normalize keyword (lowercase, trim)
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Generate HMAC-SHA256 tag
    const keywordBytes = stringToUint8Array(normalizedKeyword);
    const tag = hmac(sha256, searchKey, keywordBytes);

    return {
      tag: uint8ArrayToBase64(tag),
      algorithm: 'HMAC-SHA256',
    };
  }

  /**
   * Generate random salt for key derivation
   */
  generateSalt(): Uint8Array {
    this.ensureInitialized();
    return randomBytes(KEY_DERIVATION_CONFIG.saltBytes);
  }

  /**
   * Generate random nonce for encryption
   */
  generateNonce(): Uint8Array {
    this.ensureInitialized();
    return randomBytes(CRYPTO_CONFIG.NONCE_SIZE);
  }

  /**
   * Hash data using BLAKE2b (fast, secure hash)
   */
  async hash(data: Uint8Array): Promise<string> {
    this.ensureInitialized();

    // Use BLAKE2b-256 (32 bytes output)
    const hash = blake2b(data, { dkLen: 32 });
    return uint8ArrayToBase64(hash);
  }

  /**
   * Encrypt a string and return base64-encoded result
   */
  async encryptString(text: string, key: Uint8Array): Promise<string> {
    const blob = await this.encrypt(text, key);

    // Serialize blob to JSON then base64
    const serialized = JSON.stringify({
      v: blob.version,
      a: blob.algorithm,
      n: uint8ArrayToBase64(blob.nonce),
      c: uint8ArrayToBase64(blob.ciphertext),
    });

    return uint8ArrayToBase64(stringToUint8Array(serialized));
  }

  /**
   * Decrypt a base64-encoded encrypted string
   */
  async decryptString(encrypted: string, key: Uint8Array): Promise<string> {
    // Decode from base64
    const serialized = uint8ArrayToString(base64ToUint8Array(encrypted));
    const parsed = JSON.parse(serialized);

    // Reconstruct blob
    const blob: EncryptedBlob = {
      version: parsed.v,
      algorithm: parsed.a,
      nonce: base64ToUint8Array(parsed.n),
      ciphertext: base64ToUint8Array(parsed.c),
      authTag: new Uint8Array(16), // Will be extracted from ciphertext
    };

    const plaintext = await this.decrypt(blob, key);
    return uint8ArrayToString(plaintext);
  }

  /**
   * Generate a random encryption key
   */
  generateEncryptionKey(): Uint8Array {
    this.ensureInitialized();
    return randomBytes(CRYPTO_CONFIG.KEY_SIZE);
  }

  /**
   * Derive a search key from the master key
   * Uses BLAKE2b with a context string for key derivation
   */
  async deriveSearchKey(masterKey: Uint8Array): Promise<Uint8Array> {
    this.ensureInitialized();

    // Use BLAKE2b with a context string for key derivation
    const context = stringToUint8Array('engram-search-key');
    const combinedInput = new Uint8Array(masterKey.length + context.length);
    combinedInput.set(masterKey);
    combinedInput.set(context, masterKey.length);

    return blake2b(combinedInput, { dkLen: 32 });
  }
}

/**
 * Global singleton instance
 */
let cryptoServiceInstance: CryptoService | null = null;

/**
 * Get the global CryptoService instance
 */
export async function getCryptoService(): Promise<CryptoService> {
  if (!cryptoServiceInstance) {
    cryptoServiceInstance = new CryptoService();
    await cryptoServiceInstance.initialize();
  }
  return cryptoServiceInstance;
}

/**
 * Export singleton for direct use
 */
export const cryptoService = new CryptoService();

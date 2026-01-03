/**
 * Cryptography types and interfaces
 * Based on MVP Implementation Specification Phase 1.3
 */

import { Timestamp } from './memory';

/**
 * Supported encryption algorithms
 */
export type EncryptionAlgorithm = 'XChaCha20-Poly1305';
export type SearchAlgorithm = 'AES-SIV';
export type SignatureAlgorithm = 'Ed25519';
export type KeyDerivationAlgorithm = 'Argon2id';
export type SearchTagAlgorithm = 'HMAC-SHA256';

/**
 * Key derivation configuration
 */
export interface KeyDerivationConfig {
  algorithm: KeyDerivationAlgorithm;
  saltBytes: number; // 32
  iterations: number; // Time cost (4)
  memoryKiB: number; // 64 MB (65536)
  parallelism: number; // 1
  outputKeyBytes: number; // 256-bit key (32)
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  contentAlgorithm: EncryptionAlgorithm;
  searchAlgorithm: SearchAlgorithm; // For deterministic search tags
  signatureAlgorithm: SignatureAlgorithm;
}

/**
 * Master key derived from passphrase
 */
export interface MasterKey {
  key: Uint8Array; // Never persisted
  salt: Uint8Array; // Stored locally
  derivedAt: Timestamp;
}

/**
 * Device key pair for signing
 */
export interface DeviceKeyPair {
  publicKey: string; // Base64 encoded, shared with server
  privateKey: Uint8Array; // Never leaves device
  algorithm: SignatureAlgorithm;
}

/**
 * Encrypted blob format
 */
export interface EncryptedBlob {
  version: 1; // For future algorithm changes
  algorithm: EncryptionAlgorithm;
  nonce: Uint8Array; // 24 bytes
  ciphertext: Uint8Array;
  authTag: Uint8Array; // Included in ciphertext by Poly1305
}

/**
 * Searchable encryption tag
 */
export interface SearchTag {
  tag: string; // HMAC(searchKey, keyword)
  algorithm: SearchTagAlgorithm;
}

/**
 * Crypto service interface
 */
export interface ICryptoService {
  // Key derivation
  deriveKey(passphrase: string, salt?: Uint8Array): Promise<MasterKey>;

  // Key pair generation
  generateDeviceKeyPair(): Promise<DeviceKeyPair>;

  // Encryption/Decryption
  encrypt(data: Uint8Array, key: Uint8Array): Promise<EncryptedBlob>;
  decrypt(blob: EncryptedBlob, key: Uint8Array): Promise<Uint8Array>;

  // Signing/Verification
  sign(data: Uint8Array, privateKey: Uint8Array): Promise<string>;
  verify(data: Uint8Array, signature: string, publicKey: string): Promise<boolean>;

  // Search tags
  generateSearchTag(keyword: string, searchKey: Uint8Array): Promise<SearchTag>;

  // Utilities
  generateSalt(): Uint8Array;
  generateNonce(): Uint8Array;
  hash(data: Uint8Array): Promise<string>;
}

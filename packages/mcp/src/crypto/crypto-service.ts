/**
 * Crypto service for Engram MCP server
 * Port of the community extension's CryptoService using the same Noble libraries
 * Ensures encrypted data is interoperable between extension and MCP server
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { ed25519 } from '@noble/curves/ed25519';
import { blake2b } from '@noble/hashes/blake2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { argon2id } from 'hash-wasm';
import {
  CRYPTO_CONFIG,
  uint8ArrayToBase64,
  base64ToUint8Array,
  stringToUint8Array,
  uint8ArrayToString,
} from '@engram/core';
import type {
  ICryptoService,
  MasterKey,
  DeviceKeyPair,
  EncryptedBlob,
  SearchTag,
  KeyDerivationConfig,
} from '@engram/core';

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

const KEY_DERIVATION_CONFIG: KeyDerivationConfig = {
  algorithm: 'Argon2id',
  saltBytes: 16,
  iterations: 4,
  memoryKiB: 65536,
  parallelism: 1,
  outputKeyBytes: 32,
};

export class CryptoService implements ICryptoService {
  async deriveKey(passphrase: string, salt?: Uint8Array): Promise<MasterKey> {
    const keySalt = salt || this.generateSalt();

    const keyHex = await argon2id({
      password: passphrase,
      salt: keySalt,
      parallelism: KEY_DERIVATION_CONFIG.parallelism,
      iterations: KEY_DERIVATION_CONFIG.iterations,
      memorySize: KEY_DERIVATION_CONFIG.memoryKiB,
      hashLength: KEY_DERIVATION_CONFIG.outputKeyBytes,
      outputType: 'hex',
    });

    const key = new Uint8Array(
      keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return { key, salt: keySalt, derivedAt: Date.now() };
  }

  async generateDeviceKeyPair(): Promise<DeviceKeyPair> {
    const privateKey = randomBytes(32);
    const publicKey = ed25519.getPublicKey(privateKey);
    return {
      publicKey: uint8ArrayToBase64(publicKey),
      privateKey,
      algorithm: 'Ed25519',
    };
  }

  async encrypt(data: Uint8Array, key: Uint8Array): Promise<EncryptedBlob> {
    if (key.length !== CRYPTO_CONFIG.KEY_SIZE) {
      throw new Error(`Invalid key size. Expected ${CRYPTO_CONFIG.KEY_SIZE}, got ${key.length}`);
    }

    const nonce = this.generateNonce();
    const cipher = xchacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(data);
    const authTag = ciphertext.slice(-16);

    return {
      version: 1,
      algorithm: 'XChaCha20-Poly1305',
      nonce,
      ciphertext,
      authTag,
    };
  }

  async decrypt(blob: EncryptedBlob, key: Uint8Array): Promise<Uint8Array> {
    if (key.length !== CRYPTO_CONFIG.KEY_SIZE) {
      throw new Error(`Invalid key size. Expected ${CRYPTO_CONFIG.KEY_SIZE}, got ${key.length}`);
    }
    if (blob.version !== 1) {
      throw new Error(`Unsupported encryption version: ${blob.version}`);
    }

    try {
      const cipher = xchacha20poly1305(key, blob.nonce);
      return cipher.decrypt(blob.ciphertext);
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async sign(data: Uint8Array, privateKey: Uint8Array): Promise<string> {
    const signature = ed25519.sign(data, privateKey);
    return uint8ArrayToBase64(signature);
  }

  async verify(data: Uint8Array, signature: string, publicKey: string): Promise<boolean> {
    try {
      const signatureBytes = base64ToUint8Array(signature);
      const publicKeyBytes = base64ToUint8Array(publicKey);
      return ed25519.verify(signatureBytes, data, publicKeyBytes);
    } catch {
      return false;
    }
  }

  async generateSearchTag(keyword: string, searchKey: Uint8Array): Promise<SearchTag> {
    const normalizedKeyword = keyword.toLowerCase().trim();
    const keywordBytes = stringToUint8Array(normalizedKeyword);
    const tag = hmac(sha256, searchKey, keywordBytes);
    return { tag: uint8ArrayToBase64(tag), algorithm: 'HMAC-SHA256' };
  }

  generateSalt(): Uint8Array {
    return randomBytes(KEY_DERIVATION_CONFIG.saltBytes);
  }

  generateNonce(): Uint8Array {
    return randomBytes(CRYPTO_CONFIG.NONCE_SIZE);
  }

  async hash(data: Uint8Array): Promise<string> {
    const h = blake2b(data, { dkLen: 32 });
    return uint8ArrayToBase64(h);
  }

  /**
   * Encrypt a string and return the EncryptedBlob
   */
  async encryptString(text: string, key: Uint8Array): Promise<EncryptedBlob> {
    const plaintext = stringToUint8Array(text);
    return this.encrypt(plaintext, key);
  }

  /**
   * Decrypt an EncryptedBlob and return the plaintext string
   */
  async decryptToString(blob: EncryptedBlob, key: Uint8Array): Promise<string> {
    const plaintext = await this.decrypt(blob, key);
    return uint8ArrayToString(plaintext);
  }
}

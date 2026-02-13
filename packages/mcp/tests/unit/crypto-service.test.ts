/**
 * Unit tests for CryptoService
 */

import { CryptoService } from '../../src/crypto/crypto-service';
import { stringToUint8Array, uint8ArrayToString } from '@engram/core';

describe('CryptoService', () => {
  let crypto: CryptoService;

  beforeEach(() => {
    crypto = new CryptoService();
  });

  describe('deriveKey', () => {
    it('should derive a key from passphrase', async () => {
      const result = await crypto.deriveKey('test-passphrase');
      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32);
      expect(result.salt).toBeInstanceOf(Uint8Array);
      expect(result.salt.length).toBe(16);
      expect(result.derivedAt).toBeGreaterThan(0);
    });

    it('should produce same key for same passphrase and salt', async () => {
      const result1 = await crypto.deriveKey('test-passphrase');
      const result2 = await crypto.deriveKey('test-passphrase', result1.salt);
      expect(Buffer.from(result1.key).toString('hex')).toBe(
        Buffer.from(result2.key).toString('hex')
      );
    });

    it('should produce different keys for different passphrases', async () => {
      const salt = crypto.generateSalt();
      const result1 = await crypto.deriveKey('passphrase-1', salt);
      const result2 = await crypto.deriveKey('passphrase-2', salt);
      expect(Buffer.from(result1.key).toString('hex')).not.toBe(
        Buffer.from(result2.key).toString('hex')
      );
    });
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt data', async () => {
      const { key } = await crypto.deriveKey('test');
      const plaintext = stringToUint8Array('Hello, World!');

      const encrypted = await crypto.encrypt(plaintext, key);
      expect(encrypted.version).toBe(1);
      expect(encrypted.algorithm).toBe('XChaCha20-Poly1305');
      expect(encrypted.nonce.length).toBe(24);

      const decrypted = await crypto.decrypt(encrypted, key);
      expect(uint8ArrayToString(decrypted)).toBe('Hello, World!');
    });

    it('should fail decryption with wrong key', async () => {
      const { key: key1 } = await crypto.deriveKey('key-1');
      const { key: key2 } = await crypto.deriveKey('key-2');

      const plaintext = stringToUint8Array('Secret data');
      const encrypted = await crypto.encrypt(plaintext, key1);

      await expect(crypto.decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should reject invalid key size', async () => {
      const shortKey = new Uint8Array(16);
      const plaintext = stringToUint8Array('test');

      await expect(crypto.encrypt(plaintext, shortKey)).rejects.toThrow('Invalid key size');
    });
  });

  describe('encryptString / decryptToString', () => {
    it('should round-trip a string', async () => {
      const { key } = await crypto.deriveKey('test');
      const original = 'This is a secret message with unicode: ✅';

      const blob = await crypto.encryptString(original, key);
      const decrypted = await crypto.decryptToString(blob, key);

      expect(decrypted).toBe(original);
    });
  });

  describe('hash', () => {
    it('should produce consistent hashes', async () => {
      const data = stringToUint8Array('test data');
      const hash1 = await crypto.hash(data);
      const hash2 = await crypto.hash(data);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await crypto.hash(stringToUint8Array('data1'));
      const hash2 = await crypto.hash(stringToUint8Array('data2'));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSalt / generateNonce', () => {
    it('should generate unique salts', () => {
      const salt1 = crypto.generateSalt();
      const salt2 = crypto.generateSalt();
      expect(Buffer.from(salt1).toString('hex')).not.toBe(
        Buffer.from(salt2).toString('hex')
      );
    });

    it('should generate 24-byte nonces', () => {
      const nonce = crypto.generateNonce();
      expect(nonce.length).toBe(24);
    });
  });

  describe('sign / verify', () => {
    it('should sign and verify data', async () => {
      const keyPair = await crypto.generateDeviceKeyPair();
      const data = stringToUint8Array('message to sign');

      const signature = await crypto.sign(data, keyPair.privateKey);
      const isValid = await crypto.verify(data, signature, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should reject tampered data', async () => {
      const keyPair = await crypto.generateDeviceKeyPair();
      const data = stringToUint8Array('original message');

      const signature = await crypto.sign(data, keyPair.privateKey);
      const tampered = stringToUint8Array('tampered message');
      const isValid = await crypto.verify(tampered, signature, keyPair.publicKey);
      expect(isValid).toBe(false);
    });
  });
});

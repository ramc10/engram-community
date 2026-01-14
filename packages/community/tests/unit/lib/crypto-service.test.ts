/**
 * Comprehensive unit tests for CryptoService
 * Target coverage: 95% (as per jest.config.js)
 *
 * Tests cover:
 * - Service initialization
 * - Key derivation (Argon2id)
 * - Encryption/Decryption (XChaCha20-Poly1305)
 * - Digital signatures (Ed25519)
 * - Search tag generation (HMAC)
 * - Utility functions (salt, nonce, hash generation)
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CryptoService, getCryptoService } from '../../../src/lib/crypto-service';
import {
  CRYPTO_CONFIG,
  uint8ArrayToBase64,
  base64ToUint8Array,
  stringToUint8Array,
  uint8ArrayToString,
} from '@engram/core';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(async () => {
    cryptoService = new CryptoService();
    await cryptoService.initialize();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const service = new CryptoService();
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should allow multiple initialization calls without error', async () => {
      await cryptoService.initialize();
      await cryptoService.initialize();
      // Should not throw - idempotent
    });

    it('should throw error when methods are called before initialization', async () => {
      const uninitializedService = new CryptoService();

      await expect(
        uninitializedService.deriveKey('password')
      ).rejects.toThrow('CryptoService not initialized');
    });

    it('should work with getCryptoService singleton', async () => {
      const instance = await getCryptoService();
      expect(instance).toBeInstanceOf(CryptoService);

      // Should return same instance
      const instance2 = await getCryptoService();
      expect(instance2).toBe(instance);
    });
  });

  describe('Key Derivation (deriveKey)', () => {
    it('should derive a master key from passphrase', async () => {
      const passphrase = 'test-passphrase-123';
      const masterKey = await cryptoService.deriveKey(passphrase);

      expect(masterKey).toBeDefined();
      expect(masterKey.key).toBeInstanceOf(Uint8Array);
      expect(masterKey.key.length).toBe(CRYPTO_CONFIG.KEY_SIZE);
      expect(masterKey.salt).toBeInstanceOf(Uint8Array);
      expect(masterKey.salt.length).toBe(16); // 16 bytes salt
      expect(masterKey.derivedAt).toBeGreaterThan(0);
    });

    it('should generate different keys for different passphrases', async () => {
      const key1 = await cryptoService.deriveKey('password1');
      const key2 = await cryptoService.deriveKey('password2');

      expect(uint8ArrayToBase64(key1.key)).not.toBe(uint8ArrayToBase64(key2.key));
    });

    it('should generate different keys with different salts', async () => {
      const passphrase = 'same-passphrase';
      const key1 = await cryptoService.deriveKey(passphrase);
      const key2 = await cryptoService.deriveKey(passphrase);

      // Different salts should produce different keys
      expect(uint8ArrayToBase64(key1.salt)).not.toBe(uint8ArrayToBase64(key2.salt));
      expect(uint8ArrayToBase64(key1.key)).not.toBe(uint8ArrayToBase64(key2.key));
    });

    it('should derive same key when using same passphrase and salt', async () => {
      const passphrase = 'deterministic-test';
      const firstDerivation = await cryptoService.deriveKey(passphrase);

      // Use same salt for second derivation
      const secondDerivation = await cryptoService.deriveKey(
        passphrase,
        firstDerivation.salt
      );

      expect(uint8ArrayToBase64(firstDerivation.key)).toBe(
        uint8ArrayToBase64(secondDerivation.key)
      );
    });

    it('should handle long passphrases', async () => {
      const longPassphrase = 'a'.repeat(1000);
      const masterKey = await cryptoService.deriveKey(longPassphrase);

      expect(masterKey.key.length).toBe(CRYPTO_CONFIG.KEY_SIZE);
    });

    it('should handle special characters in passphrase', async () => {
      const specialPassphrase = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const masterKey = await cryptoService.deriveKey(specialPassphrase);

      expect(masterKey.key.length).toBe(CRYPTO_CONFIG.KEY_SIZE);
    });

    it('should handle unicode characters in passphrase', async () => {
      const unicodePassphrase = '密码🔐パスワード';
      const masterKey = await cryptoService.deriveKey(unicodePassphrase);

      expect(masterKey.key.length).toBe(CRYPTO_CONFIG.KEY_SIZE);
    });
  });

  describe('Device Key Pair Generation (generateDeviceKeyPair)', () => {
    it('should generate Ed25519 key pair', async () => {
      const keyPair = await cryptoService.generateDeviceKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.algorithm).toBe('Ed25519');
      expect(keyPair.publicKey).toBeDefined();
      expect(typeof keyPair.publicKey).toBe('string');
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey.length).toBe(32); // Ed25519 private key size
    });

    it('should generate unique key pairs', async () => {
      const keyPair1 = await cryptoService.generateDeviceKeyPair();
      const keyPair2 = await cryptoService.generateDeviceKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(uint8ArrayToBase64(keyPair1.privateKey)).not.toBe(
        uint8ArrayToBase64(keyPair2.privateKey)
      );
    });
  });

  describe('Encryption (encrypt)', () => {
    let testKey: Uint8Array;

    beforeEach(() => {
      testKey = cryptoService.generateEncryptionKey();
    });

    it('should encrypt Uint8Array data', async () => {
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      expect(encrypted).toBeDefined();
      expect(encrypted.version).toBe(1);
      expect(encrypted.algorithm).toBe('XChaCha20-Poly1305');
      expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
      expect(encrypted.nonce.length).toBe(CRYPTO_CONFIG.NONCE_SIZE);
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.ciphertext.length).toBeGreaterThan(plaintext.length);
      expect(encrypted.authTag).toBeInstanceOf(Uint8Array);
      expect(encrypted.authTag.length).toBe(16); // Poly1305 tag size
    });

    it('should encrypt string data', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      expect(encrypted).toBeDefined();
      expect(encrypted.algorithm).toBe('XChaCha20-Poly1305');
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
    });

    it('should produce different ciphertexts for same plaintext', async () => {
      const plaintext = 'Same plaintext';
      const encrypted1 = await cryptoService.encrypt(plaintext, testKey);
      const encrypted2 = await cryptoService.encrypt(plaintext, testKey);

      // Different nonces should produce different ciphertexts
      expect(uint8ArrayToBase64(encrypted1.nonce)).not.toBe(
        uint8ArrayToBase64(encrypted2.nonce)
      );
      expect(uint8ArrayToBase64(encrypted1.ciphertext)).not.toBe(
        uint8ArrayToBase64(encrypted2.ciphertext)
      );
    });

    it('should encrypt empty data', async () => {
      const plaintext = new Uint8Array([]);
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      expect(encrypted.ciphertext.length).toBeGreaterThan(0); // Auth tag included
    });

    it('should encrypt large data', async () => {
      const plaintext = new Uint8Array(1024 * 100); // 100 KB
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      expect(encrypted.ciphertext.length).toBeGreaterThan(plaintext.length);
    });

    it('should throw error for invalid key size', async () => {
      const invalidKey = new Uint8Array(16); // Wrong size
      const plaintext = 'test data';

      await expect(
        cryptoService.encrypt(plaintext, invalidKey)
      ).rejects.toThrow(/Invalid key size/);
    });

    it('should handle unicode strings', async () => {
      const plaintext = 'Hello 世界 🌍';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      expect(encrypted).toBeDefined();
    });
  });

  describe('Decryption (decrypt)', () => {
    let testKey: Uint8Array;

    beforeEach(() => {
      testKey = cryptoService.generateEncryptionKey();
    });

    it('should decrypt previously encrypted data', async () => {
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await cryptoService.encrypt(plaintext, testKey);
      const decrypted = await cryptoService.decrypt(encrypted, testKey);

      expect(decrypted).toEqual(plaintext);
    });

    it('should decrypt string data', async () => {
      const plaintext = 'Test message';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);
      const decrypted = await cryptoService.decrypt(encrypted, testKey);
      const decryptedString = uint8ArrayToString(decrypted);

      expect(decryptedString).toBe(plaintext);
    });

    it('should decrypt unicode strings correctly', async () => {
      const plaintext = 'Hello 世界 🌍 Привет';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);
      const decrypted = await cryptoService.decrypt(encrypted, testKey);
      const decryptedString = uint8ArrayToString(decrypted);

      expect(decryptedString).toBe(plaintext);
    });

    it('should throw error for invalid key', async () => {
      const plaintext = 'secret data';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      const wrongKey = cryptoService.generateEncryptionKey();

      await expect(
        cryptoService.decrypt(encrypted, wrongKey)
      ).rejects.toThrow(/Decryption failed/);
    });

    it('should throw error for invalid key size', async () => {
      const plaintext = 'test data';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      const invalidKey = new Uint8Array(16); // Wrong size

      await expect(
        cryptoService.decrypt(encrypted, invalidKey)
      ).rejects.toThrow(/Invalid key size/);
    });

    it('should throw error for unsupported version', async () => {
      const plaintext = 'test data';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      // Modify version to unsupported value
      (encrypted as any).version = 99;

      await expect(
        cryptoService.decrypt(encrypted, testKey)
      ).rejects.toThrow(/Unsupported encryption version/);
    });

    it('should throw error for unsupported algorithm', async () => {
      const plaintext = 'test data';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      // Modify algorithm
      (encrypted as any).algorithm = 'AES-256-GCM';

      await expect(
        cryptoService.decrypt(encrypted, testKey)
      ).rejects.toThrow(/Unsupported algorithm/);
    });

    it('should throw error for tampered ciphertext', async () => {
      const plaintext = 'secret data';
      const encrypted = await cryptoService.encrypt(plaintext, testKey);

      // Tamper with ciphertext
      encrypted.ciphertext[0] ^= 1;

      await expect(
        cryptoService.decrypt(encrypted, testKey)
      ).rejects.toThrow(/Decryption failed/);
    });

    it('should decrypt empty data', async () => {
      const plaintext = new Uint8Array([]);
      const encrypted = await cryptoService.encrypt(plaintext, testKey);
      const decrypted = await cryptoService.decrypt(encrypted, testKey);

      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('Digital Signatures (sign/verify)', () => {
    let keyPair: Awaited<ReturnType<typeof cryptoService.generateDeviceKeyPair>>;

    beforeEach(async () => {
      keyPair = await cryptoService.generateDeviceKeyPair();
    });

    it('should sign data with private key', async () => {
      const data = stringToUint8Array('test message');
      const signature = await cryptoService.sign(data, keyPair.privateKey);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should verify valid signature', async () => {
      const data = stringToUint8Array('test message');
      const signature = await cryptoService.sign(data, keyPair.privateKey);

      const isValid = await cryptoService.verify(data, signature, keyPair.publicKey);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const data = stringToUint8Array('test message');
      const signature = await cryptoService.sign(data, keyPair.privateKey);

      // Modify data
      const tamperedData = stringToUint8Array('tampered message');
      const isValid = await cryptoService.verify(tamperedData, signature, keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong public key', async () => {
      const data = stringToUint8Array('test message');
      const signature = await cryptoService.sign(data, keyPair.privateKey);

      // Generate different key pair
      const otherKeyPair = await cryptoService.generateDeviceKeyPair();
      const isValid = await cryptoService.verify(data, signature, otherKeyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should handle invalid signature format', async () => {
      const data = stringToUint8Array('test message');
      const invalidSignature = 'invalid-signature!!!';

      const isValid = await cryptoService.verify(data, invalidSignature, keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should sign empty data', async () => {
      const data = new Uint8Array([]);
      const signature = await cryptoService.sign(data, keyPair.privateKey);
      const isValid = await cryptoService.verify(data, signature, keyPair.publicKey);

      expect(isValid).toBe(true);
    });

    it('should sign large data', async () => {
      const data = new Uint8Array(1024 * 100); // 100 KB
      const signature = await cryptoService.sign(data, keyPair.privateKey);
      const isValid = await cryptoService.verify(data, signature, keyPair.publicKey);

      expect(isValid).toBe(true);
    });
  });

  describe('Search Tag Generation (generateSearchTag)', () => {
    let searchKey: Uint8Array;

    beforeEach(() => {
      searchKey = cryptoService.generateEncryptionKey();
    });

    it('should generate search tag for keyword', async () => {
      const keyword = 'test-keyword';
      const searchTag = await cryptoService.generateSearchTag(keyword, searchKey);

      expect(searchTag).toBeDefined();
      expect(searchTag.tag).toBeDefined();
      expect(typeof searchTag.tag).toBe('string');
      expect(searchTag.algorithm).toBe('HMAC-SHA256');
    });

    it('should generate consistent tags for same keyword', async () => {
      const keyword = 'consistent-keyword';
      const tag1 = await cryptoService.generateSearchTag(keyword, searchKey);
      const tag2 = await cryptoService.generateSearchTag(keyword, searchKey);

      expect(tag1.tag).toBe(tag2.tag);
    });

    it('should normalize keywords (case-insensitive)', async () => {
      const tag1 = await cryptoService.generateSearchTag('KEYWORD', searchKey);
      const tag2 = await cryptoService.generateSearchTag('keyword', searchKey);
      const tag3 = await cryptoService.generateSearchTag('KeYwOrD', searchKey);

      expect(tag1.tag).toBe(tag2.tag);
      expect(tag2.tag).toBe(tag3.tag);
    });

    it('should trim whitespace from keywords', async () => {
      const tag1 = await cryptoService.generateSearchTag('  keyword  ', searchKey);
      const tag2 = await cryptoService.generateSearchTag('keyword', searchKey);

      expect(tag1.tag).toBe(tag2.tag);
    });

    it('should generate different tags for different keywords', async () => {
      const tag1 = await cryptoService.generateSearchTag('keyword1', searchKey);
      const tag2 = await cryptoService.generateSearchTag('keyword2', searchKey);

      expect(tag1.tag).not.toBe(tag2.tag);
    });

    it('should generate different tags with different search keys', async () => {
      const keyword = 'same-keyword';
      const searchKey2 = cryptoService.generateEncryptionKey();

      const tag1 = await cryptoService.generateSearchTag(keyword, searchKey);
      const tag2 = await cryptoService.generateSearchTag(keyword, searchKey2);

      expect(tag1.tag).not.toBe(tag2.tag);
    });

    it('should handle unicode keywords', async () => {
      const keyword = '検索キーワード';
      const searchTag = await cryptoService.generateSearchTag(keyword, searchKey);

      expect(searchTag.tag).toBeDefined();
    });

    it('should handle empty keyword', async () => {
      const keyword = '';
      const searchTag = await cryptoService.generateSearchTag(keyword, searchKey);

      expect(searchTag.tag).toBeDefined();
    });
  });

  describe('Salt Generation (generateSalt)', () => {
    it('should generate salt of correct size', () => {
      const salt = cryptoService.generateSalt();

      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16); // 16 bytes as per config
    });

    it('should generate unique salts', () => {
      const salt1 = cryptoService.generateSalt();
      const salt2 = cryptoService.generateSalt();

      expect(uint8ArrayToBase64(salt1)).not.toBe(uint8ArrayToBase64(salt2));
    });

    it('should generate cryptographically random salts', () => {
      const salts = Array.from({ length: 10 }, () => cryptoService.generateSalt());
      const uniqueSalts = new Set(salts.map(s => uint8ArrayToBase64(s)));

      expect(uniqueSalts.size).toBe(10);
    });
  });

  describe('Nonce Generation (generateNonce)', () => {
    it('should generate nonce of correct size', () => {
      const nonce = cryptoService.generateNonce();

      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(CRYPTO_CONFIG.NONCE_SIZE);
    });

    it('should generate unique nonces', () => {
      const nonce1 = cryptoService.generateNonce();
      const nonce2 = cryptoService.generateNonce();

      expect(uint8ArrayToBase64(nonce1)).not.toBe(uint8ArrayToBase64(nonce2));
    });

    it('should generate cryptographically random nonces', () => {
      const nonces = Array.from({ length: 10 }, () => cryptoService.generateNonce());
      const uniqueNonces = new Set(nonces.map(n => uint8ArrayToBase64(n)));

      expect(uniqueNonces.size).toBe(10);
    });
  });

  describe('Hashing (hash)', () => {
    it('should hash data using BLAKE2b', async () => {
      const data = stringToUint8Array('test data');
      const hash = await cryptoService.hash(data);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate consistent hashes', async () => {
      const data = stringToUint8Array('consistent data');
      const hash1 = await cryptoService.hash(data);
      const hash2 = await cryptoService.hash(data);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different data', async () => {
      const data1 = stringToUint8Array('data 1');
      const data2 = stringToUint8Array('data 2');

      const hash1 = await cryptoService.hash(data1);
      const hash2 = await cryptoService.hash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should hash empty data', async () => {
      const data = new Uint8Array([]);
      const hash = await cryptoService.hash(data);

      expect(hash).toBeDefined();
    });

    it('should hash large data', async () => {
      const data = new Uint8Array(1024 * 100); // 100 KB
      const hash = await cryptoService.hash(data);

      expect(hash).toBeDefined();
    });
  });

  describe('String Encryption/Decryption (encryptString/decryptString)', () => {
    let testKey: Uint8Array;

    beforeEach(() => {
      testKey = cryptoService.generateEncryptionKey();
    });

    it('should encrypt string and return base64', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await cryptoService.encryptString(plaintext, testKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should decrypt base64-encoded encrypted string', async () => {
      const plaintext = 'Test message';
      const encrypted = await cryptoService.encryptString(plaintext, testKey);
      const decrypted = await cryptoService.decryptString(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode strings', async () => {
      const plaintext = 'Hello 世界 🌍 Привет مرحبا';
      const encrypted = await cryptoService.encryptString(plaintext, testKey);
      const decrypted = await cryptoService.decryptString(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const encrypted = await cryptoService.encryptString(plaintext, testKey);
      const decrypted = await cryptoService.decryptString(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', async () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = await cryptoService.encryptString(plaintext, testKey);
      const decrypted = await cryptoService.decryptString(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting with wrong key', async () => {
      const plaintext = 'secret message';
      const encrypted = await cryptoService.encryptString(plaintext, testKey);

      const wrongKey = cryptoService.generateEncryptionKey();

      await expect(
        cryptoService.decryptString(encrypted, wrongKey)
      ).rejects.toThrow();
    });
  });

  describe('Encryption Key Generation (generateEncryptionKey)', () => {
    it('should generate key of correct size', () => {
      const key = cryptoService.generateEncryptionKey();

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(CRYPTO_CONFIG.KEY_SIZE);
    });

    it('should generate unique keys', () => {
      const key1 = cryptoService.generateEncryptionKey();
      const key2 = cryptoService.generateEncryptionKey();

      expect(uint8ArrayToBase64(key1)).not.toBe(uint8ArrayToBase64(key2));
    });

    it('should generate cryptographically random keys', () => {
      const keys = Array.from({ length: 10 }, () => cryptoService.generateEncryptionKey());
      const uniqueKeys = new Set(keys.map(k => uint8ArrayToBase64(k)));

      expect(uniqueKeys.size).toBe(10);
    });
  });

  describe('Search Key Derivation (deriveSearchKey)', () => {
    it('should derive search key from master key', async () => {
      const masterKey = cryptoService.generateEncryptionKey();
      const searchKey = await cryptoService.deriveSearchKey(masterKey);

      expect(searchKey).toBeInstanceOf(Uint8Array);
      expect(searchKey.length).toBe(32); // 256-bit key
    });

    it('should derive consistent search keys', async () => {
      const masterKey = cryptoService.generateEncryptionKey();
      const searchKey1 = await cryptoService.deriveSearchKey(masterKey);
      const searchKey2 = await cryptoService.deriveSearchKey(masterKey);

      expect(uint8ArrayToBase64(searchKey1)).toBe(uint8ArrayToBase64(searchKey2));
    });

    it('should derive different search keys for different master keys', async () => {
      const masterKey1 = cryptoService.generateEncryptionKey();
      const masterKey2 = cryptoService.generateEncryptionKey();

      const searchKey1 = await cryptoService.deriveSearchKey(masterKey1);
      const searchKey2 = await cryptoService.deriveSearchKey(masterKey2);

      expect(uint8ArrayToBase64(searchKey1)).not.toBe(uint8ArrayToBase64(searchKey2));
    });
  });

  describe('End-to-End Encryption Flow', () => {
    it('should complete full encryption workflow', async () => {
      // 1. Derive master key from passphrase
      const passphrase = 'user-passphrase-123';
      const masterKey = await cryptoService.deriveKey(passphrase);

      // 2. Encrypt sensitive data
      const sensitiveData = 'Top secret information';
      const encrypted = await cryptoService.encrypt(sensitiveData, masterKey.key);

      // 3. Decrypt data with master key
      const decrypted = await cryptoService.decrypt(encrypted, masterKey.key);
      const decryptedString = uint8ArrayToString(decrypted);

      expect(decryptedString).toBe(sensitiveData);
    });

    it('should complete full signing workflow', async () => {
      // 1. Generate device key pair
      const deviceKeys = await cryptoService.generateDeviceKeyPair();

      // 2. Sign data
      const data = stringToUint8Array('Important document');
      const signature = await cryptoService.sign(data, deviceKeys.privateKey);

      // 3. Verify signature
      const isValid = await cryptoService.verify(data, signature, deviceKeys.publicKey);

      expect(isValid).toBe(true);
    });

    it('should complete searchable encryption workflow', async () => {
      // 1. Derive master key
      const passphrase = 'search-test-passphrase';
      const masterKey = await cryptoService.deriveKey(passphrase);

      // 2. Derive search key from master key
      const searchKey = await cryptoService.deriveSearchKey(masterKey.key);

      // 3. Generate search tags for keywords
      const tag1 = await cryptoService.generateSearchTag('keyword1', searchKey);
      const tag2 = await cryptoService.generateSearchTag('keyword1', searchKey);
      const tag3 = await cryptoService.generateSearchTag('keyword2', searchKey);

      // Same keywords should produce same tags
      expect(tag1.tag).toBe(tag2.tag);
      // Different keywords should produce different tags
      expect(tag1.tag).not.toBe(tag3.tag);
    });
  });

  describe('Error Handling', () => {
    it('should handle crypto.getRandomValues errors gracefully', () => {
      // Mock failure (though unlikely in practice)
      const originalGetRandomValues = crypto.getRandomValues;
      (crypto as any).getRandomValues = () => {
        throw new Error('Random number generation failed');
      };

      expect(() => cryptoService.generateSalt()).toThrow();

      // Restore
      (crypto as any).getRandomValues = originalGetRandomValues;
    });

    it('should validate initialization state for all methods', async () => {
      const uninitService = new CryptoService();

      await expect(uninitService.deriveKey('pass')).rejects.toThrow('not initialized');
      await expect(uninitService.generateDeviceKeyPair()).rejects.toThrow('not initialized');
      await expect(uninitService.encrypt('data', new Uint8Array(32))).rejects.toThrow('not initialized');
      await expect(uninitService.generateSearchTag('tag', new Uint8Array(32))).rejects.toThrow('not initialized');
      expect(() => uninitService.generateSalt()).toThrow('not initialized');
      expect(() => uninitService.generateNonce()).toThrow('not initialized');
      await expect(uninitService.hash(new Uint8Array([]))).rejects.toThrow('not initialized');
      expect(() => uninitService.generateEncryptionKey()).toThrow('not initialized');
      await expect(uninitService.deriveSearchKey(new Uint8Array(32))).rejects.toThrow('not initialized');
    });
  });
});

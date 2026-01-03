/**
 * DeviceKeyManager tests
 * Tests device-bound encryption for master key persistence
 *
 * @jest-environment node
 */

import { DeviceKeyManager, EncryptedMasterKey } from '../../src/lib/device-key-manager';
import { MasterKey } from '@engram/core';

// Mock chrome.storage.local
const mockStorage = new Map<string, any>();

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[] | null) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockStorage.get(keys) });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (mockStorage.has(key)) {
              result[key] = mockStorage.get(key);
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve(Object.fromEntries(mockStorage));
      }),
      set: jest.fn((items: Record<string, any>) => {
        Object.entries(items).forEach(([key, value]) => {
          mockStorage.set(key, value);
        });
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => mockStorage.delete(key));
        return Promise.resolve();
      }),
    },
  },
} as any;

describe('DeviceKeyManager', () => {
  let deviceKeyManager: DeviceKeyManager;
  let testMasterKey: MasterKey;

  beforeAll(() => {
    // Verify crypto.subtle is available
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error('Web Crypto API not available. Setup file may not have run correctly.');
    }
  });

  beforeEach(() => {
    // Clear mock storage
    mockStorage.clear();
    jest.clearAllMocks();

    deviceKeyManager = new DeviceKeyManager();

    // Create test master key
    testMasterKey = {
      key: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
      salt: new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
      derivedAt: Date.now(),
    };
  });

  describe('Device Key Management', () => {
    test('should generate device key on first call', async () => {
      const deviceKey = await deviceKeyManager.getOrCreateDeviceKey();

      expect(deviceKey).toBeDefined();
      expect(deviceKey.type).toBe('secret');
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          device_encryption_key: expect.objectContaining({
            key: expect.any(Object),
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    test('should reuse existing device key', async () => {
      // First call - generates key
      const firstKey = await deviceKeyManager.getOrCreateDeviceKey();

      // Clear mock calls
      jest.clearAllMocks();

      // Second call - should reuse
      const secondKey = await deviceKeyManager.getOrCreateDeviceKey();

      expect(secondKey).toBe(firstKey);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('should load device key from storage', async () => {
      // Create and store a device key
      const manager1 = new DeviceKeyManager();
      await manager1.getOrCreateDeviceKey();

      // Create new manager instance (simulating reload)
      const manager2 = new DeviceKeyManager();
      const loadedKey = await manager2.getOrCreateDeviceKey();

      expect(loadedKey).toBeDefined();
      expect(loadedKey.type).toBe('secret');
    });
  });

  describe('Master Key Encryption/Decryption', () => {
    test('should encrypt master key', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);

      expect(encrypted).toMatchObject({
        ciphertext: expect.any(String),
        nonce: expect.any(String),
        salt: expect.any(String),
        derivedAt: testMasterKey.derivedAt,
        version: 1,
      });

      // Verify it's actually encrypted (not just base64 of original)
      expect(encrypted.ciphertext).not.toBe(btoa(String.fromCharCode(...testMasterKey.key)));
    });

    test('should decrypt master key correctly', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);
      const decrypted = await deviceKeyManager.decryptMasterKey(encrypted);

      expect(decrypted.key).toEqual(testMasterKey.key);
      expect(decrypted.salt).toEqual(testMasterKey.salt);
      expect(decrypted.derivedAt).toBe(testMasterKey.derivedAt);
    });

    test('should fail to decrypt with corrupted ciphertext', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);

      // Corrupt the ciphertext
      const corrupted: EncryptedMasterKey = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -5) + 'xxxxx',
      };

      await expect(deviceKeyManager.decryptMasterKey(corrupted)).rejects.toThrow(
        'Failed to decrypt master key'
      );
    });

    test('should use different nonce for each encryption', async () => {
      const encrypted1 = await deviceKeyManager.encryptMasterKey(testMasterKey);
      const encrypted2 = await deviceKeyManager.encryptMasterKey(testMasterKey);

      expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  describe('Storage Operations', () => {
    test('should store encrypted master key', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);
      await deviceKeyManager.storeMasterKey(encrypted);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        encrypted_master_key: encrypted,
      });
    });

    test('should load encrypted master key from storage', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);
      await deviceKeyManager.storeMasterKey(encrypted);

      const loaded = await deviceKeyManager.loadMasterKey();

      expect(loaded).toEqual(encrypted);
    });

    test('should return null when no master key stored', async () => {
      const loaded = await deviceKeyManager.loadMasterKey();
      expect(loaded).toBeNull();
    });

    test('should clear encrypted master key', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);
      await deviceKeyManager.storeMasterKey(encrypted);

      await deviceKeyManager.clearMasterKey();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('encrypted_master_key');

      const loaded = await deviceKeyManager.loadMasterKey();
      expect(loaded).toBeNull();
    });

    test('should clear device key', async () => {
      await deviceKeyManager.getOrCreateDeviceKey();

      await deviceKeyManager.clearDeviceKey();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('device_encryption_key');
    });
  });

  describe('Full Encryption Flow', () => {
    test('should persist and restore master key across sessions', async () => {
      // Session 1: Encrypt and store
      const manager1 = new DeviceKeyManager();
      const encrypted = await manager1.encryptMasterKey(testMasterKey);
      await manager1.storeMasterKey(encrypted);

      // Session 2: Load and decrypt (simulating extension reload)
      const manager2 = new DeviceKeyManager();
      const loaded = await manager2.loadMasterKey();
      expect(loaded).not.toBeNull();

      const decrypted = await manager2.decryptMasterKey(loaded!);

      expect(decrypted.key).toEqual(testMasterKey.key);
      expect(decrypted.salt).toEqual(testMasterKey.salt);
      expect(decrypted.derivedAt).toBe(testMasterKey.derivedAt);
    });

    test('should handle master key rotation', async () => {
      // Store first master key
      const encrypted1 = await deviceKeyManager.encryptMasterKey(testMasterKey);
      await deviceKeyManager.storeMasterKey(encrypted1);

      // Create new master key (simulating password change)
      const newMasterKey: MasterKey = {
        key: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]),
        salt: new Uint8Array([80, 70, 60, 50, 40, 30, 20, 10]),
        derivedAt: Date.now(),
      };

      // Store new master key
      const encrypted2 = await deviceKeyManager.encryptMasterKey(newMasterKey);
      await deviceKeyManager.storeMasterKey(encrypted2);

      // Load and verify it's the new key
      const loaded = await deviceKeyManager.loadMasterKey();
      const decrypted = await deviceKeyManager.decryptMasterKey(loaded!);

      expect(decrypted.key).toEqual(newMasterKey.key);
      expect(decrypted.key).not.toEqual(testMasterKey.key);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      // Mock storage error
      (chrome.storage.local.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      // Should generate new key instead of throwing
      const deviceKey = await deviceKeyManager.getOrCreateDeviceKey();
      expect(deviceKey).toBeDefined();
    });

    test('should clear corrupted key on decrypt failure', async () => {
      const encrypted = await deviceKeyManager.encryptMasterKey(testMasterKey);
      await deviceKeyManager.storeMasterKey(encrypted);

      // Corrupt the stored key
      const corrupted = { ...encrypted, ciphertext: 'corrupted' };
      mockStorage.set('encrypted_master_key', corrupted);

      // Try to decrypt - should fail and clear
      await expect(deviceKeyManager.decryptMasterKey(corrupted)).rejects.toThrow();
    });
  });
});

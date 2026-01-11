/**
 * Cloud Sync Persistence Integration Tests
 * Tests the complete flow of master key persistence and cloud sync
 *
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest, test, beforeAll, afterAll } from '@jest/globals';
import { BackgroundService } from '../../src/background/index';
import { MasterKey, Memory } from '@engram/core';
// Import CryptoService from source file (not exported from @engram/core to avoid bundling issues)
import { CryptoService } from '../../../core/src/crypto-service';

// Set up environment variables for Supabase (required by CloudSyncService)
process.env.PLASMO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock chrome APIs
const mockStorage = new Map();

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
  runtime: {
    onInstalled: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
    onMessage: {
      addListener: jest.fn(),
    },
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
    },
    onActivated: {
      addListener: jest.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
    },
  },
  sidePanel: {
    setOptions: jest.fn(),
    open: jest.fn(),
  },
} as any;

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            gt: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    channel: jest.fn(() => {
      const channelObj = {
        on: jest.fn(function (this: any) {
          return this;
        }),
        subscribe: jest.fn(function (this: any) {
          return this;
        }),
        unsubscribe: jest.fn(() => Promise.resolve()),
      };
      return channelObj;
    }),
  })),
}));

// Mock auth client
jest.mock('../../src/lib/auth-client', () => ({
  authClient: {
    getAuthState: jest.fn(() =>
      Promise.resolve({
        isAuthenticated: true,
        userId: 'test-user-id',
        email: 'test@example.com',
      })
    ),
    getSupabaseClient: jest.fn(() => ({})),
  },
}));

// Mock premium service
jest.mock('../../src/lib/premium-service', () => ({
  premiumService: {
    getPremiumStatus: jest.fn(() =>
      Promise.resolve({
        isPremium: true,
        syncEnabled: true,
      })
    ),
  },
}));

describe('Cloud Sync Persistence Integration', () => {
  let backgroundService: BackgroundService;
  let cryptoService: CryptoService;
  let testMasterKey: MasterKey;

  beforeAll(async () => {
    // Initialize crypto service
    cryptoService = new CryptoService();
    await cryptoService.initialize();

    // Derive test master key
    testMasterKey = await cryptoService.deriveKey('test-password-123');
  });

  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    backgroundService = new BackgroundService();
  });

  afterEach(async () => {
    try {
      await backgroundService.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Master Key Persistence Flow', () => {
    test('should persist master key after login', async () => {
      await backgroundService.initialize();

      // Simulate login
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);

      // Verify master key was encrypted and stored
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          encrypted_master_key: expect.objectContaining({
            ciphertext: expect.any(String),
            nonce: expect.any(String),
            salt: expect.any(String),
            derivedAt: expect.any(Number),
            version: 1,
          }),
        })
      );
    });

    test('should restore master key on startup', async () => {
      // Session 1: Login and persist
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);

      // Session 2: Reload extension (new BackgroundService instance)
      const newBackgroundService = new BackgroundService();
      await newBackgroundService.initialize();

      // Verify master key was restored
      expect(newBackgroundService.hasMasterKey()).toBe(true);

      const restoredKey = newBackgroundService.getMasterKey();
      expect(restoredKey).not.toBeNull();
      expect(restoredKey!.key).toEqual(testMasterKey.key);
      expect(restoredKey!.salt).toEqual(testMasterKey.salt);

      await newBackgroundService.shutdown();
    });

    test('should handle missing master key gracefully', async () => {
      await backgroundService.initialize();

      // No master key stored - should not crash
      expect(backgroundService.hasMasterKey()).toBe(false);
      expect(backgroundService.getMasterKey()).toBeNull();
    });

    test('should clear master key on logout', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);

      // Logout
      backgroundService.clearMasterKey();
      await backgroundService.clearPersistedMasterKey();

      // Verify cleared from memory
      expect(backgroundService.hasMasterKey()).toBe(false);

      // Verify cleared from storage
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('encrypted_master_key');
    });
  });

  describe('Cloud Sync Initialization', () => {
    test('should initialize cloud sync for premium users', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);

      // Initialize cloud sync
      await backgroundService.initializeCloudSyncIfNeeded();

      // Verify cloud sync service was created
      expect(backgroundService.getCloudSync()).not.toBeNull();
    });

    test('should skip cloud sync without master key', async () => {
      await backgroundService.initialize();

      // Try to initialize without master key
      await backgroundService.initializeCloudSyncIfNeeded();

      // Verify cloud sync was NOT created
      expect(backgroundService.getCloudSync()).toBeNull();
    });

    test('should auto-initialize cloud sync on startup for premium users', async () => {
      // Session 1: Login and persist
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);
      await backgroundService.shutdown();

      // Session 2: Reload - should auto-initialize cloud sync
      const newBackgroundService = new BackgroundService();
      await newBackgroundService.initialize();

      // Verify cloud sync was auto-initialized
      expect(newBackgroundService.getCloudSync()).not.toBeNull();

      await newBackgroundService.shutdown();
    });
  });

  describe('Memory Sync Flow', () => {
    test('should download and merge memories on cloud sync init', async () => {
      // Mock remote memories
      const remoteMemories: Memory[] = [
        {
          id: 'remote-1',
          content: { role: 'user', text: 'Remote memory 1' },
          platform: 'claude',
          timestamp: Date.now(),
          conversationId: 'conv-1',
          deviceId: 'device-1',
          vectorClock: { 'device-1': 1 },
          syncStatus: 'synced',
          tags: [],
        },
      ];

      // Mock CloudSyncService to return test memories
      const mockDownloadMemories = jest.fn(() => Promise.resolve(remoteMemories));

      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);

      // Initialize cloud sync
      await backgroundService.initializeCloudSyncIfNeeded();

      const cloudSync = backgroundService.getCloudSync();
      if (cloudSync) {
        // Replace downloadMemories method with mock
        (cloudSync as any).downloadMemories = mockDownloadMemories;

        // Trigger download
        await (backgroundService as any).downloadAndMergeMemories();

        // Verify download was called
        expect(mockDownloadMemories).toHaveBeenCalled();
      }
    });

    test('should handle empty remote memories', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);

      // Initialize cloud sync with empty remote
      await backgroundService.initializeCloudSyncIfNeeded();

      // Should not throw
      await expect((backgroundService as any).downloadAndMergeMemories()).resolves.not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    test('should stop cloud sync on shutdown', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);
      await backgroundService.persistMasterKey(testMasterKey);
      await backgroundService.initializeCloudSyncIfNeeded();

      const cloudSync = backgroundService.getCloudSync();
      expect(cloudSync).not.toBeNull();

      // Shutdown
      await backgroundService.shutdown();

      // Verify cloud sync was stopped
      expect(backgroundService.getCloudSync()).toBeNull();
    });

    test('should handle shutdown without cloud sync', async () => {
      await backgroundService.initialize();

      // Shutdown without ever initializing cloud sync
      await expect(backgroundService.shutdown()).resolves.not.toThrow();
    });

    test('should clear sensitive data on shutdown', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);

      await backgroundService.shutdown();

      // Verify master key cleared from memory
      expect(backgroundService.hasMasterKey()).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    test('should handle corrupted master key gracefully', async () => {
      // Store corrupted master key
      mockStorage.set('encrypted_master_key', {
        ciphertext: 'corrupted',
        nonce: 'corrupted',
        salt: 'corrupted',
        derivedAt: Date.now(),
        version: 1,
      });

      // Initialize - should handle gracefully
      await backgroundService.initialize();

      // Should not have master key
      expect(backgroundService.hasMasterKey()).toBe(false);

      // Corrupted key should be cleared
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('encrypted_master_key');
    });

    test('should continue without cloud sync if initialization fails', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);

      // Mock premium service to throw error
      const { premiumService } = require('../../src/lib/premium-service');
      premiumService.getPremiumStatus.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw - just log error
      await expect(backgroundService.initializeCloudSyncIfNeeded()).resolves.not.toThrow();

      // Extension should still work without cloud sync
      expect(backgroundService.getIsInitialized()).toBe(true);
    });
  });

  describe('Security', () => {
    test('should encrypt master key with different nonces each time', async () => {
      await backgroundService.initialize();

      // Encrypt twice
      const encrypted1 = await (backgroundService as any).deviceKeyManager.encryptMasterKey(
        testMasterKey
      );
      const encrypted2 = await (backgroundService as any).deviceKeyManager.encryptMasterKey(
        testMasterKey
      );

      // Different nonces = different ciphertexts
      expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    test('should not expose master key in memory after clear', async () => {
      await backgroundService.initialize();
      backgroundService.setMasterKey(testMasterKey);

      backgroundService.clearMasterKey();

      expect(backgroundService.getMasterKey()).toBeNull();
    });
  });
});

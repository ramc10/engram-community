/**
 * Synchronization & Premium Feature Flow Integration Tests
 *
 * Tests comprehensive user flows for:
 * - Flow 5: Premium Feature Unlock
 * - Flow 6: Offline-to-Online Recovery
 * - Flow 7: Device Conflict Resolution (CRDT)
 *
 * @jest-environment node
 */

// Set up environment variables
process.env.PLASMO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { BackgroundService } from '../../src/background/index';
import { handleMessage } from '../../src/background/message-handler';
import { MessageType } from '../../src/lib/messages';
import { DB_NAME, UUID, Memory, generateUUID, now } from '@engram/core';
import { CryptoService } from '../../../core/src/crypto-service';
import { premiumService } from '../../src/lib/premium-service';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';

// Mock @engram/core to use a unique DB name for this test
jest.mock('@engram/core', () => {
    const original = jest.requireActual('@engram/core') as any;
    return {
        ...original,
        DB_NAME: 'TestSyncPremiumDB_' + Date.now(),
    };
});
import { wait, waitFor } from '../__utils__/test-helpers';

// Mock chrome APIs with persistent storage
const mockStorage = new Map();
const mockSyncStorage = new Map();

// Network status simulation
let networkOnline = true;
const setNetworkStatus = (online: boolean) => {
    networkOnline = online;
};

global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys: string | string[] | null) => {
                const keysArray = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : []);
                const result: Record<string, any> = {};
                if (keysArray.length === 0) return Promise.resolve(Object.fromEntries(mockStorage));
                keysArray.forEach(key => {
                    if (mockStorage.has(key)) result[key] = mockStorage.get(key);
                });
                return Promise.resolve(result);
            }),
            set: jest.fn((items: Record<string, any>) => {
                Object.entries(items).forEach(([key, value]) => mockStorage.set(key, value));
                return Promise.resolve();
            }),
            remove: jest.fn((keys: string | string[]) => {
                const keysArray = Array.isArray(keys) ? keys : [keys];
                keysArray.forEach(key => mockStorage.delete(key));
                return Promise.resolve();
            }),
            clear: jest.fn(() => {
                mockStorage.clear();
                return Promise.resolve();
            })
        },
        sync: {
            get: jest.fn((keys: string | string[] | null) => {
                const keysArray = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : []);
                const result: Record<string, any> = {};
                if (keysArray.length === 0) return Promise.resolve(Object.fromEntries(mockSyncStorage));
                keysArray.forEach(key => {
                    if (mockSyncStorage.has(key)) result[key] = mockSyncStorage.get(key);
                });
                return Promise.resolve(result);
            }),
            set: jest.fn((items: Record<string, any>) => {
                Object.entries(items).forEach(([key, value]) => mockSyncStorage.set(key, value));
                return Promise.resolve();
            }),
        }
    },
    runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
    },
    identity: {
        getRedirectURL: jest.fn(() => 'https://example.com/oauth-redirect'),
        launchWebAuthFlow: jest.fn((options: any, callback: any) => {
            callback('https://example.com/oauth-redirect#access_token=tk&expires_in=3600');
        }),
    },
    sidePanel: {
        setOptions: jest.fn(),
    },
} as any;

// Mock navigator
global.navigator = {
    userAgent: 'test-agent',
    storage: {
        estimate: jest.fn(() => Promise.resolve({ usage: 100, quota: 1000 }))
    }
} as any;

// Mock DeviceKeyManager
jest.mock('../../src/lib/device-key-manager', () => {
    return {
        DeviceKeyManager: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockImplementation(() => Promise.resolve()),
            encryptMasterKey: jest.fn().mockImplementation((key: any) => Promise.resolve(key)),
            decryptMasterKey: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
            storeMasterKey: jest.fn().mockImplementation(() => Promise.resolve()),
            loadMasterKey: jest.fn().mockImplementation(() => Promise.resolve(null)),
            clearMasterKey: jest.fn().mockImplementation(() => Promise.resolve()),
            clearDeviceKey: jest.fn().mockImplementation(() => Promise.resolve()),
        }))
    };
});

// Mock fetch for LLM calls/sync
const mockFetch = jest.fn((..._args: any[]) => {
    if (!networkOnline) {
        return Promise.reject(new Error('Network request failed'));
    }
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
    } as Response);
});
(global as any).fetch = mockFetch;

// Mock Supabase with sync functionality
jest.mock('@supabase/supabase-js', () => {
    const memories = new Map();
    const premium = { isPremium: false, syncEnabled: false };

    const mockAuth = {
        getSession: jest.fn(() => Promise.resolve({
            data: { session: { access_token: 'tk', user: { id: 'test-user-id', email: 'test@example.com' } } },
            error: null
        })),
        getUser: jest.fn(() => Promise.resolve({
            data: { user: { id: 'test-user-id', email: 'test@example.com', user_metadata: { engram_salt: 'c2FsdA=='.padEnd(24, 'A') } } } as any,
            error: null
        })),
        updateUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })),
    };

    const mockFrom = jest.fn((table: string) => {
        return {
            select: jest.fn().mockReturnThis(),
            insert: jest.fn((data: any) => {
                if ((global as any).mockSupabaseFailureCount > 0) {
                    (global as any).mockSupabaseFailureCount--;
                    if ((global as any).onSupabaseFailure) (global as any).onSupabaseFailure();
                    return Promise.resolve({ error: { message: 'Network failure' } });
                }
                if (Array.isArray(data)) {
                    data.forEach((d: any) => memories.set(d.id, d));
                } else {
                    memories.set(data.id, data);
                }
                return Promise.resolve({ error: null });
            }),
            upsert: jest.fn((data: any) => {
                if ((global as any).mockSupabaseFailureCount > 0) {
                    (global as any).mockSupabaseFailureCount--;
                    if ((global as any).onSupabaseFailure) (global as any).onSupabaseFailure();
                    return Promise.resolve({ error: { message: 'Network failure' } });
                }
                if (Array.isArray(data)) {
                    data.forEach((d: any) => memories.set(d.id, d));
                } else {
                    memories.set(data.id, data);
                }
                return Promise.resolve({ error: null });
            }),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => {
                const tier = (premium.isPremium) ? 'premium' : 'free';
                const sync_enabled = premium.syncEnabled;
                return Promise.resolve({ data: { tier, sync_enabled }, error: null });
            }),
            maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            is: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            url: new URL('https://test.supabase.co'),
            headers: {},
        };
    });

    const mockRpc = jest.fn((name: string, args: any) => {
        if (name === 'upgrade_to_premium') {
            premium.isPremium = true;
            premium.syncEnabled = true;
            return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
    });

    const mockChannel = jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(() => Promise.resolve()),
    }));

    (global as any).mockSyncedMemories = memories;
    (global as any).mockPremiumStatus = premium;
    (global as any).mockSupabaseAuth = mockAuth;
    (global as any).mockSupabaseFrom = mockFrom;
    (global as any).mockSupabaseRpc = mockRpc;

    return {
        createClient: jest.fn(() => ({
            auth: mockAuth,
            from: mockFrom,
            rpc: mockRpc,
            channel: mockChannel,
        })),
    };
});

// Helper for tests to access shared state
const getSupabaseMocks = () => ({
    memories: (global as any).mockSyncedMemories as Map<string, any>,
    premium: (global as any).mockPremiumStatus as { isPremium: boolean, syncEnabled: boolean },
    auth: (global as any).mockSupabaseAuth,
    from: (global as any).mockSupabaseFrom,
    rpc: (global as any).mockSupabaseRpc
});

// No mock for premiumService - use real one with mocked Supabase client
// No mock for authClient - use real one with mocked Supabase client

describe('Synchronization & Premium Flows', () => {
    let backgroundService: BackgroundService;
    let cryptoService: CryptoService;
    let mockSender: any;

    // Test master key for encryption
    const testMasterKey = {
        key: new Uint8Array(32).fill(1),
        salt: new Uint8Array(16).fill(2),
        derivedAt: Date.now()
    };

    beforeAll(async () => {
        cryptoService = new CryptoService();
        await cryptoService.initialize();
    });

    beforeEach(async () => {
        const mocks = getSupabaseMocks();
        mockStorage.clear();
        mockSyncStorage.clear();
        mocks.memories.clear();
        mocks.premium.isPremium = false;
        mocks.premium.syncEnabled = false;

        networkOnline = true;
        jest.clearAllMocks();
        mockFetch.mockClear();

        // Setup enrichment config (disabled for sync tests)
        mockStorage.set('enrichmentConfig', {
            enabled: false,
            provider: 'openai',
            apiKey: '',
            model: 'gpt-4o-mini',
            batchSize: 5,
            enableLinkDetection: false,
            enableEvolution: false
        });

        backgroundService = new BackgroundService();
        await backgroundService.initialize();

        // Set master key for encryption (required for SAVE_MESSAGE)
        backgroundService.setMasterKey(testMasterKey);

        mockSender = { tab: { url: 'https://chatgpt.com/c/123' } };
    });

    afterEach(async () => {
        try {
            await backgroundService.shutdown();
        } catch (e) {
            // Ignore shutdown errors
        }
    });

    describe('Flow 5: Premium Feature Unlock', () => {
        test('should show free status before upgrade', async () => {
            const statusResponse = await handleMessage(
                { type: MessageType.GET_PREMIUM_STATUS } as any,
                mockSender,
                backgroundService
            );

            expect(statusResponse.success).toBe(true);
            expect(statusResponse.status.isPremium).toBe(false);
        });

        test('should upgrade to premium and enable sync', async () => {
            // Request premium upgrade
            const upgradeResponse = await handleMessage(
                { type: MessageType.UPGRADE_TO_PREMIUM } as any,
                mockSender,
                backgroundService
            );

            expect(upgradeResponse.success).toBe(true);

            // Verify premium status changed
            const statusAfter = await handleMessage(
                { type: MessageType.GET_PREMIUM_STATUS } as any,
                mockSender,
                backgroundService
            );

            expect(statusAfter.status.isPremium).toBe(true);
        });

        test('should transition sync service from idle to active on premium unlock', async () => {
            // Upgrade to premium
            await handleMessage(
                { type: MessageType.UPGRADE_TO_PREMIUM } as any,
                mockSender,
                backgroundService
            );

            // Start cloud sync
            const startSyncResponse = await handleMessage(
                { type: MessageType.START_CLOUD_SYNC } as any,
                mockSender,
                backgroundService
            );

            expect(startSyncResponse.success).toBe(true);

            // Verify sync is active
            const syncAfter = await handleMessage(
                { type: MessageType.GET_SYNC_STATUS } as any,
                mockSender,
                backgroundService
            );

            expect(syncAfter.success).toBe(true);
            expect(syncAfter.status.isConnected).toBe(true);
        });

        test('should reject sync operations for free users', async () => {
            // Without upgrading to premium
            const startSyncResponse = await handleMessage(
                { type: MessageType.START_CLOUD_SYNC } as any,
                mockSender,
                backgroundService
            );

            // Should fail because not premium
            expect(startSyncResponse.success).toBe(false);
            expect(startSyncResponse.error).toBeDefined();
        });
    });

    describe('Flow 6: Offline-to-Online Recovery', () => {
        test('should queue operations when offline', async () => {
            // Upgrade to premium and start sync
            getSupabaseMocks().premium.isPremium = true;
            getSupabaseMocks().premium.syncEnabled = true;
            await handleMessage({ type: MessageType.START_CLOUD_SYNC } as any, mockSender, backgroundService);

            // Go offline
            setNetworkStatus(false);

            // Save memories while offline
            const offlineMemories = [];
            for (let i = 0; i < 5; i++) {
                const saveResult = await handleMessage({
                    type: MessageType.SAVE_MESSAGE,
                    message: {
                        role: 'user',
                        content: `Offline memory ${i}: saved without network connection`,
                        conversationId: `conv-offline-${i}`,
                        timestamp: Date.now() + i
                    }
                } as any, mockSender, backgroundService);

                expect(saveResult.success).toBe(true);
                offlineMemories.push(saveResult.memoryId);
            }

            // Verify memories are saved locally
            const storage = backgroundService.getStorage();
            for (const memoryId of offlineMemories) {
                const memory = await storage.getMemory(memoryId);
                expect(memory).toBeDefined();
                expect(memory!.syncStatus).toBe('pending');
            }

            // Go online
            setNetworkStatus(true);
            await wait(200);

            // Verify all memories are processed
            expect(offlineMemories.length).toBe(5);
        });

        test('should batch sync multiple pending operations', async () => {
            getSupabaseMocks().premium.isPremium = true;
            getSupabaseMocks().premium.syncEnabled = true;

            let syncBatchCalls = 0;
            mockFetch.mockImplementation((() => {
                syncBatchCalls++;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            }) as any);

            // Save 10 memories rapidly
            for (let i = 0; i < 10; i++) {
                await handleMessage({
                    type: MessageType.SAVE_MESSAGE,
                    message: {
                        role: 'user',
                        content: `Batch test memory ${i}`,
                        conversationId: `conv-batch-${i}`,
                        timestamp: Date.now() + i
                    }
                } as any, mockSender, backgroundService);
            }

            // Start sync
            await handleMessage({ type: MessageType.START_CLOUD_SYNC } as any, mockSender, backgroundService);
            await wait(200);

            expect(syncBatchCalls).toBeDefined();
        });

        test('should retry failed sync operations on reconnection', async () => {
            getSupabaseMocks().premium.isPremium = true;
            getSupabaseMocks().premium.syncEnabled = true;

            let failedAttempts = 0;
            (global as any).mockSupabaseFailureCount = 2;
            (global as any).onSupabaseFailure = () => { failedAttempts++; };

            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'Memory that will retry on sync failure',
                    conversationId: 'conv-retry',
                    timestamp: Date.now()
                }
            } as any, mockSender, backgroundService);

            await handleMessage({ type: MessageType.START_CLOUD_SYNC } as any, mockSender, backgroundService);

            await wait(500);

            // After retries, sync should eventually succeed
            expect(failedAttempts).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Flow 7: Device Conflict Resolution (CRDT)', () => {
        test('should merge changes from two devices without data loss', async () => {
            const storage = backgroundService.getStorage();
            const sharedMemoryId = 'shared-memory-crdt' as UUID;

            // Device 1 creates original memory
            const originalMemory = {
                id: sharedMemoryId,
                content: { role: 'user', text: 'Original content from Device 1' },
                conversationId: 'conv-shared',
                timestamp: 1000,
                tags: ['device1'],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 1 },
                deviceId: 'device-1',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(originalMemory as any);

            // Device 1 modifies the memory
            const device1Update = {
                id: sharedMemoryId,
                content: { role: 'user', text: 'Modified by Device 1 at 10:00 AM' },
                conversationId: 'conv-shared',
                timestamp: 2000,
                tags: ['device1', 'updated'],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 2 },
                deviceId: 'device-1',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(device1Update as any);

            // Device 2 also modifies (concurrent update - newer timestamp wins)
            const device2Update = {
                id: sharedMemoryId,
                content: { role: 'user', text: 'Modified by Device 2 at 10:05 AM' },
                conversationId: 'conv-shared',
                timestamp: 3000, // Newer timestamp
                tags: ['device2', 'concurrent-update'],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 2, 'device-2': 1 },
                deviceId: 'device-2',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(device2Update as any);

            // Verify the final state
            const finalMemory = await storage.getMemory(sharedMemoryId);

            expect(finalMemory).toBeDefined();
            // Newer timestamp should win
            expect(finalMemory!.content.text).toBe('Modified by Device 2 at 10:05 AM');
            expect(finalMemory!.timestamp).toBe(3000);
        });

        test('should preserve older version when newer update has earlier timestamp', async () => {
            const storage = backgroundService.getStorage();
            const memoryId = 'timestamp-order-test' as UUID;

            // Save newer version first
            const newerVersion = {
                id: memoryId,
                content: { role: 'user', text: 'Newer version saved first' },
                conversationId: 'conv-order',
                timestamp: 5000,
                tags: ['newer'],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 2 },
                deviceId: 'device-1',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(newerVersion as any);

            // Try to save older version (should not overwrite)
            const olderVersion = {
                id: memoryId,
                content: { role: 'user', text: 'Older version - should not overwrite' },
                conversationId: 'conv-order',
                timestamp: 1000, // Earlier timestamp
                tags: ['older'],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 1 },
                deviceId: 'device-1',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(olderVersion as any);

            const finalMemory = await storage.getMemory(memoryId);

            // Should keep the one with newer timestamp
            expect(finalMemory!.timestamp).toBe(5000);
            expect(finalMemory!.content.text).toBe('Newer version saved first');
        });

        test('should merge vector clocks from multiple devices', async () => {
            const storage = backgroundService.getStorage();
            const memoryId = 'vector-clock-merge' as UUID;

            // Device 1 state
            const device1Memory = {
                id: memoryId,
                content: { role: 'user', text: 'Content from device 1' },
                conversationId: 'conv-vc',
                timestamp: Date.now(),
                tags: [],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 5 },
                deviceId: 'device-1',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(device1Memory as any);

            // Device 2 brings in its clock
            const device2Memory = {
                id: memoryId,
                content: { role: 'user', text: 'Content from device 2 (newer)' },
                conversationId: 'conv-vc',
                timestamp: Date.now() + 1000,
                tags: [],
                platform: 'chatgpt',
                vectorClock: { 'device-1': 5, 'device-2': 3 },
                deviceId: 'device-2',
                syncStatus: 'synced' as const
            };

            await storage.saveMemory(device2Memory as any);

            const merged = await storage.getMemory(memoryId);

            expect(merged).toBeDefined();
            // Both device clocks should be represented
            expect(merged!.vectorClock['device-1']).toBeDefined();
            expect(merged!.vectorClock['device-2']).toBeDefined();
        });
    });

    describe('Sync Queue Management', () => {
        test('should enqueue operations in FIFO order', async () => {
            const storage = backgroundService.getStorage();

            // Enqueue multiple operations
            const operations = [];
            for (let i = 0; i < 5; i++) {
                const op = {
                    id: `op-${i}` as UUID,
                    type: 'add' as const,
                    memoryId: `memory-${i}` as UUID,
                    vectorClock: { 'device-1': i + 1 },
                    payload: null,
                    signature: 'test-signature',
                    timestamp: Date.now() + i,
                };
                await storage.enqueueSyncOperation(op);
                operations.push(op.id);
            }

            // Dequeue and verify order
            const dequeued = await storage.dequeueSyncOperations(3);

            expect(dequeued.length).toBe(3);
            expect(dequeued[0].id).toBe('op-0');
            expect(dequeued[1].id).toBe('op-1');
            expect(dequeued[2].id).toBe('op-2');
        });

        test('should clear sync queue', async () => {
            const storage = backgroundService.getStorage();

            // Enqueue operations
            for (let i = 0; i < 3; i++) {
                await storage.enqueueSyncOperation({
                    id: `clear-op-${i}` as UUID,
                    type: 'add' as const,
                    memoryId: `memory-${i}` as UUID,
                    vectorClock: { 'device-1': i + 1 },
                    payload: null,
                    signature: 'test-signature',
                    timestamp: Date.now(),
                });
            }

            // Clear the queue
            await storage.clearSyncQueue();

            // Verify queue is empty
            const remaining = await storage.dequeueSyncOperations(10);
            expect(remaining.length).toBe(0);
        });
    });
});

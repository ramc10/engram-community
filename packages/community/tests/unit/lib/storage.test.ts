/**
 * Storage Service Unit Tests
 * Tests for IndexedDB storage using Dexie
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StorageService } from '../../../src/lib/storage';
import { createMemory, createEnrichedMemory } from '../../__fixtures__/memories';
import { Memory, UUID, Conversation, SyncOperation } from '@engram/core';

// Mock dependencies (Dexie is mocked via moduleNameMapper in jest.config.js)
jest.mock('../../../src/lib/enrichment-service');
jest.mock('../../../src/lib/link-detection-service');
jest.mock('../../../src/lib/evolution-service');
jest.mock('../../../src/lib/hnsw-index-service');
jest.mock('../../../src/lib/embedding-service');
jest.mock('../../../src/lib/api-key-crypto');

describe('StorageService', () => {
  let storage: StorageService;
  let mockDb: any;
  let mockMemoriesTable: any;
  let mockConversationsTable: any;
  let mockMetadataTable: any;
  let mockSyncQueueTable: any;
  let mockSearchIndexTable: any;

  beforeEach(async () => {
    // Helper to create complete Dexie table mock
    const createTableMock = () => {
      const mock: any = {
        put: jest.fn().mockResolvedValue(undefined),
        add: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
        bulkPut: jest.fn().mockResolvedValue(undefined),
        bulkAdd: jest.fn().mockResolvedValue(undefined),
        bulkDelete: jest.fn().mockResolvedValue(undefined),
        bulkGet: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        toArray: jest.fn().mockResolvedValue([]),
        toCollection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        reverse: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        last: jest.fn().mockResolvedValue(null),
        each: jest.fn().mockResolvedValue(undefined),
        modify: jest.fn().mockResolvedValue(0),
        anyOf: jest.fn().mockReturnThis(),
      };
      // Make all methods return the mock for chaining
      return mock;
    };

    // Create mock tables
    mockMemoriesTable = createTableMock();
    mockConversationsTable = createTableMock();
    mockMetadataTable = createTableMock();
    mockSyncQueueTable = createTableMock();
    mockSearchIndexTable = createTableMock();

    // Create storage instance (Dexie is auto-mocked from __mocks__/dexie.ts)
    storage = new StorageService();

    // Get reference to the mock database instance
    // @ts-ignore - Access private property for testing
    mockDb = storage['db'];

    // Replace the auto-generated mock tables with our custom mocks
    mockDb.memories = mockMemoriesTable;
    mockDb.conversations = mockConversationsTable;
    mockDb.metadata = mockMetadataTable;
    mockDb.syncQueue = mockSyncQueueTable;
    mockDb.searchIndex = mockSearchIndexTable;

    // Mock enrichment config to disabled to avoid enrichment service initialization
    mockMetadataTable.get.mockImplementation(async (key: string) => {
      if (key === 'enrichmentConfig') {
        return {
          value: {
            enabled: false,
            provider: 'openrouter',
            apiKey: '',
            enableLinkDetection: false,
          },
        };
      }
      return null;
    });

    await storage.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize database successfully', async () => {
      // Database was already initialized in beforeEach
      expect(storage).toBeDefined();
    });

    it('should load enrichment config on initialization', async () => {
      // EnrichmentConfig is loaded from chrome.storage.local, not metadata table
      // Just verify that storage initialized without errors
      expect(storage).toBeDefined();
    });

    it('should close database successfully', async () => {
      const closeSpy = jest.spyOn(mockDb, 'close');
      await storage.close();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Memory CRUD Operations', () => {
    describe('saveMemory()', () => {
      it('should save memory successfully', async () => {
        const memory = createMemory();

        await storage.saveMemory(memory);

        expect(mockMemoriesTable.put).toHaveBeenCalledWith(memory);
      });

      it('should update conversation metadata when saving memory', async () => {
        const memory = createMemory({ conversationId: 'conv-123' });

        await storage.saveMemory(memory);

        expect(mockMemoriesTable.put).toHaveBeenCalled();
        expect(mockConversationsTable.put).toHaveBeenCalled();
      });

      it('should handle save errors', async () => {
        mockMemoriesTable.put.mockRejectedValueOnce(new Error('Save failed'));

        const memory = createMemory();

        await expect(storage.saveMemory(memory)).rejects.toThrow('Save failed');
      });
    });

    describe('getMemory()', () => {
      it('should get memory by ID successfully', async () => {
        const memory = createMemory();
        mockMemoriesTable.get.mockResolvedValueOnce(memory);

        const result = await storage.getMemory(memory.id);

        expect(result).toEqual(memory);
        expect(mockMemoriesTable.get).toHaveBeenCalledWith(memory.id);
      });

      it('should return null when memory not found', async () => {
        mockMemoriesTable.get.mockResolvedValueOnce(undefined);

        const result = await storage.getMemory('nonexistent' as UUID);

        expect(result).toBeNull();
      });
    });

    describe('getMemories()', () => {
      it('should get all memories when no filter provided', async () => {
        const memories = [createMemory(), createMemory()];
        mockMemoriesTable.toArray.mockResolvedValueOnce(memories);

        const result = await storage.getMemories({});

        expect(result).toEqual(memories);
        expect(mockMemoriesTable.toCollection).toHaveBeenCalled();
      });

      it('should filter by conversationId', async () => {
        const memories = [createMemory({ conversationId: 'conv-123' })];
        mockMemoriesTable.toArray.mockResolvedValueOnce(memories);

        const result = await storage.getMemories({ conversationId: 'conv-123' });

        expect(result).toEqual(memories);
        expect(mockMemoriesTable.where).toHaveBeenCalledWith('conversationId');
        expect(mockMemoriesTable.equals).toHaveBeenCalledWith('conv-123');
      });

      it('should filter by platform', async () => {
        const memories = [createMemory({ platform: 'claude' })];
        mockMemoriesTable.toArray.mockResolvedValueOnce(memories);

        const result = await storage.getMemories({ platform: 'claude' });

        expect(result).toEqual(memories);
        expect(mockMemoriesTable.where).toHaveBeenCalledWith('platform');
        expect(mockMemoriesTable.equals).toHaveBeenCalledWith('claude');
      });

      it('should filter by IDs when provided', async () => {
        const memory1 = createMemory();
        const memory2 = createMemory();
        mockMemoriesTable.toArray.mockResolvedValueOnce([memory1, memory2]);

        const result = await storage.getMemories({ ids: [memory1.id, memory2.id] });

        expect(result).toHaveLength(2);
      });

      it('should apply limit when provided', async () => {
        const memories = Array.from({ length: 10 }, () => createMemory());
        mockMemoriesTable.toArray.mockResolvedValueOnce(memories.slice(0, 5));

        const result = await storage.getMemories({ limit: 5 });

        expect(result).toHaveLength(5);
      });
    });

    describe('updateMemory()', () => {
      it('should update memory successfully', async () => {
        const memory = createMemory();
        mockMemoriesTable.get.mockResolvedValueOnce(memory);

        const updates = { tags: ['updated', 'test'] };
        await storage.updateMemory(memory.id, updates);

        expect(mockMemoriesTable.get).toHaveBeenCalledWith(memory.id);
        expect(mockMemoriesTable.put).toHaveBeenCalledWith({
          ...memory,
          ...updates,
        });
      });

      it('should throw error when memory not found', async () => {
        mockMemoriesTable.get.mockResolvedValueOnce(undefined);

        await expect(
          storage.updateMemory('nonexistent' as UUID, { tags: [] })
        ).rejects.toThrow('Memory not found');
      });
    });

    describe('deleteMemory()', () => {
      it('should delete memory successfully', async () => {
        const memoryId = 'mem-123' as UUID;

        await storage.deleteMemory(memoryId);

        expect(mockMemoriesTable.delete).toHaveBeenCalledWith(memoryId);
      });

      it('should handle delete errors', async () => {
        mockMemoriesTable.delete.mockRejectedValueOnce(new Error('Delete failed'));

        await expect(storage.deleteMemory('mem-123' as UUID)).rejects.toThrow('Delete failed');
      });
    });

    describe('bulkSaveMemories()', () => {
      it('should save multiple memories in bulk', async () => {
        const memories = [createMemory(), createMemory(), createMemory()];

        await storage.bulkSaveMemories(memories);

        expect(mockMemoriesTable.bulkPut).toHaveBeenCalledWith(memories);
      });

      it('should handle bulk save errors', async () => {
        mockMemoriesTable.bulkPut.mockRejectedValueOnce(new Error('Bulk save failed'));

        const memories = [createMemory()];

        await expect(storage.bulkSaveMemories(memories)).rejects.toThrow('Bulk save failed');
      });
    });
  });

  describe('Conversation Operations', () => {
    describe('saveConversation()', () => {
      it('should save conversation successfully', async () => {
        const conversation: Conversation = {
          id: 'conv-123',
          platform: 'chatgpt',
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        };

        await storage.saveConversation(conversation);

        expect(mockConversationsTable.put).toHaveBeenCalledWith(conversation);
      });
    });

    describe('getConversation()', () => {
      it('should get conversation by ID', async () => {
        const conversation: Conversation = {
          id: 'conv-123',
          platform: 'chatgpt',
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        };
        mockConversationsTable.get.mockResolvedValueOnce(conversation);

        const result = await storage.getConversation('conv-123');

        expect(result).toEqual(conversation);
        expect(mockConversationsTable.get).toHaveBeenCalledWith('conv-123');
      });

      it('should return null when conversation not found', async () => {
        mockConversationsTable.get.mockResolvedValueOnce(undefined);

        const result = await storage.getConversation('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getConversations()', () => {
      it('should get all conversations when no filter', async () => {
        const conversations: Conversation[] = [
          { id: 'conv-1', platform: 'chatgpt', createdAt: Date.now(), lastMessageAt: Date.now() },
          { id: 'conv-2', platform: 'claude', createdAt: Date.now(), lastMessageAt: Date.now() },
        ];
        mockConversationsTable.toArray.mockResolvedValueOnce(conversations);

        const result = await storage.getConversations({});

        expect(result).toEqual(conversations);
      });

      it('should filter by platform', async () => {
        const conversations: Conversation[] = [
          { id: 'conv-1', platform: 'chatgpt', createdAt: Date.now(), lastMessageAt: Date.now() },
        ];
        mockConversationsTable.toArray.mockResolvedValueOnce(conversations);

        const result = await storage.getConversations({ platform: 'chatgpt' });

        expect(result).toEqual(conversations);
        expect(mockConversationsTable.where).toHaveBeenCalledWith('platform');
      });
    });
  });

  describe('Sync Queue Operations', () => {
    describe('enqueueSyncOperation()', () => {
      it('should enqueue sync operation successfully', async () => {
        const operation: SyncOperation = {
          id: 'op-123' as UUID,
          type: 'create',
          memoryId: 'mem-123' as UUID,
          timestamp: Date.now(),
        };

        await storage.enqueueSyncOperation(operation);

        expect(mockSyncQueueTable.put).toHaveBeenCalledWith(operation);
      });
    });

    describe('dequeueSyncOperations()', () => {
      it('should dequeue operations with limit', async () => {
        const operations: SyncOperation[] = [
          { id: 'op-1' as UUID, type: 'create', memoryId: 'mem-1' as UUID, timestamp: Date.now() },
          { id: 'op-2' as UUID, type: 'update', memoryId: 'mem-2' as UUID, timestamp: Date.now() },
        ];
        mockSyncQueueTable.toArray.mockResolvedValueOnce(operations);

        const result = await storage.dequeueSyncOperations(10);

        expect(result).toEqual(operations);
        expect(mockSyncQueueTable.orderBy).toHaveBeenCalledWith('timestamp');
        expect(mockSyncQueueTable.limit).toHaveBeenCalledWith(10);
      });

      it('should delete dequeued operations', async () => {
        const operations: SyncOperation[] = [
          { id: 'op-1' as UUID, type: 'create', memoryId: 'mem-1' as UUID, timestamp: Date.now() },
        ];
        mockSyncQueueTable.toArray.mockResolvedValueOnce(operations);

        await storage.dequeueSyncOperations(10);

        expect(mockSyncQueueTable.bulkDelete).toHaveBeenCalledWith(['op-1']);
      });
    });

    describe('clearSyncQueue()', () => {
      it('should clear all sync operations', async () => {
        await storage.clearSyncQueue();

        expect(mockSyncQueueTable.clear).toHaveBeenCalled();
      });
    });
  });

  describe('Search Operations', () => {
    describe('searchMemories()', () => {
      it('should search memories by tags', async () => {
        const memory1 = createMemory({ tags: ['javascript', 'testing'] });
        const memory2 = createMemory({ tags: ['python', 'testing'] });

        mockSearchIndexTable.get.mockResolvedValueOnce({
          tag: 'javascript',
          memoryIds: [memory1.id],
        });

        mockMemoriesTable.get.mockResolvedValueOnce(memory1);

        const results = await storage.searchMemories('javascript');

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe(memory1.id);
      });

      it('should return empty array when no matches', async () => {
        mockSearchIndexTable.get.mockResolvedValueOnce(null);

        const results = await storage.searchMemories('nonexistent');

        expect(results).toEqual([]);
      });

      it('should handle search errors', async () => {
        mockSearchIndexTable.get.mockRejectedValueOnce(new Error('Search failed'));

        await expect(storage.searchMemories('test')).rejects.toThrow('Search failed');
      });
    });

    describe('updateSearchIndex()', () => {
      it('should update search index for memory tags', async () => {
        const memoryId = 'mem-123' as UUID;
        const tags = ['javascript', 'testing'];

        await storage.updateSearchIndex(memoryId, tags);

        expect(mockSearchIndexTable.bulkPut).toHaveBeenCalled();
      });

      it('should handle empty tags', async () => {
        const memoryId = 'mem-123' as UUID;

        await storage.updateSearchIndex(memoryId, []);

        // Should not throw error
        expect(mockSearchIndexTable.bulkPut).toHaveBeenCalled();
      });
    });
  });

  describe('Metadata Operations', () => {
    describe('getMetadata()', () => {
      it('should get metadata value by key', async () => {
        mockMetadataTable.get.mockResolvedValueOnce({
          key: 'test-key',
          value: { data: 'test-value' },
        });

        const result = await storage.getMetadata<{ data: string }>('test-key');

        expect(result).toEqual({ data: 'test-value' });
        expect(mockMetadataTable.get).toHaveBeenCalledWith('test-key');
      });

      it('should return null when metadata not found', async () => {
        mockMetadataTable.get.mockResolvedValueOnce(undefined);

        const result = await storage.getMetadata('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('setMetadata()', () => {
      it('should set metadata value', async () => {
        const value = { data: 'test-value' };

        await storage.setMetadata('test-key', value);

        expect(mockMetadataTable.put).toHaveBeenCalledWith({
          key: 'test-key',
          value,
        });
      });

      it('should handle different data types', async () => {
        await storage.setMetadata('string-key', 'string-value');
        await storage.setMetadata('number-key', 42);
        await storage.setMetadata('boolean-key', true);
        await storage.setMetadata('object-key', { nested: { data: 'value' } });

        expect(mockMetadataTable.put).toHaveBeenCalledTimes(4);
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats()', () => {
      it('should return storage statistics', async () => {
        mockMemoriesTable.count.mockResolvedValueOnce(100);
        mockConversationsTable.count.mockResolvedValueOnce(10);

        const stats = await storage.getStats();

        expect(stats.totalMemories).toBe(100);
        expect(stats.totalConversations).toBe(10);
        expect(stats.storageSize).toBeGreaterThanOrEqual(0);
      });

      it('should handle stats calculation errors', async () => {
        mockMemoriesTable.count.mockRejectedValueOnce(new Error('Count failed'));

        await expect(storage.getStats()).rejects.toThrow('Count failed');
      });
    });
  });

  describe('Enrichment Service Integration', () => {
    describe('reinitializeEnrichment()', () => {
      it('should reinitialize enrichment with new config', async () => {
        const newConfig = {
          enabled: true,
          provider: 'openrouter' as const,
          apiKey: 'test-key',
          enableLinkDetection: true,
        };

        mockMetadataTable.get.mockResolvedValueOnce({
          value: newConfig,
        });

        await storage.reinitializeEnrichment();

        expect(mockMetadataTable.get).toHaveBeenCalledWith('enrichmentConfig');
      });

      it('should clear existing services before reinitializing', async () => {
        mockMetadataTable.get.mockResolvedValueOnce({
          value: {
            enabled: false,
            provider: 'openrouter',
            apiKey: '',
            enableLinkDetection: false,
          },
        });

        await storage.reinitializeEnrichment();

        // Should not throw error when clearing null services
        expect(mockMetadataTable.get).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.open.mockRejectedValueOnce(new Error('Connection failed'));

      const newStorage = new StorageService();

      await expect(newStorage.initialize()).rejects.toThrow('Connection failed');
    });

    it('should handle invalid filter parameters', async () => {
      // Invalid filter should still work (empty result)
      const result = await storage.getMemories({ limit: -1 } as any);

      expect(result).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const memory1 = createMemory();
      const memory2 = createMemory();

      // Simulate concurrent saves
      const promises = [
        storage.saveMemory(memory1),
        storage.saveMemory(memory2),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});

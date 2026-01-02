/**
 * Unit Tests for HNSW Index Service (Phase 4)
 * Tests end-to-end HNSW index functionality with EdgeVec mocking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { MemoryWithMemA, UUID } from 'engram-shared';
import { generateUUID, now, createVectorClock } from 'engram-shared';
import { HNSWIndexService } from '../src/lib/hnsw-index-service';

// Mock EdgeVec before importing
const mockIndex = {
  add: jest.fn(),
  remove: jest.fn(),
  search: jest.fn(),
  serialize: jest.fn(),
  deserialize: jest.fn(),
};

jest.mock('edgevec', () => ({
  Index: jest.fn().mockImplementation(() => mockIndex),
}));

// Mock Dexie database
const mockDb = {
  hnswIndex: {
    get: jest.fn(),
    bulkPut: jest.fn(),
  },
} as any;

describe('HNSWIndexService', () => {
  let service: HNSWIndexService;

  // Helper: Create test memory with embedding
  function createTestMemory(overrides?: Partial<MemoryWithMemA>): MemoryWithMemA {
    const id = generateUUID();
    return {
      id,
      conversationId: generateUUID(),
      platform: 'chatgpt',
      timestamp: now(),
      content: {
        role: 'user',
        text: 'Test message',
        modelUsed: 'gpt-4',
      },
      tags: [],
      syncStatus: { synced: true, lastSyncTime: now() },
      vectorClock: createVectorClock(id),
      deviceId: generateUUID(),
      keywords: ['test'],
      context: 'Test context',
      embedding: new Float32Array(Array(384).fill(0.5)), // 384-dim embedding
      memAVersion: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    service = new HNSWIndexService();
    jest.clearAllMocks();

    // Default mock behaviors
    mockIndex.add.mockReturnValue(undefined);
    mockIndex.remove.mockReturnValue(undefined);
    mockIndex.search.mockReturnValue([
      { id: 0, distance: 0.1 },
      { id: 1, distance: 0.2 },
      { id: 2, distance: 0.3 },
    ]);
    mockIndex.serialize.mockReturnValue({ graph: 'serialized' });
    mockIndex.deserialize.mockReturnValue(undefined);
    mockDb.hnswIndex.get.mockResolvedValue(null);
    mockDb.hnswIndex.bulkPut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with empty index', () => {
      expect(service.isReady()).toBe(false);
      expect(service.getStats().vectorCount).toBe(0);
    });

    it('should build index from memories', async () => {
      const memories = [
        createTestMemory(),
        createTestMemory(),
        createTestMemory(),
      ];

      await service.build(memories);

      expect(mockIndex.add).toHaveBeenCalledTimes(3);
      expect(service.isReady()).toBe(true);
      expect(service.getStats().vectorCount).toBe(3);
    });

    it('should handle invalid embeddings during build', async () => {
      const memories = [
        createTestMemory(),
        createTestMemory({ embedding: new Float32Array(100) }), // Wrong dimension
        createTestMemory({ embedding: undefined }), // No embedding
      ];

      await service.build(memories);

      // Only 1 valid memory should be indexed
      expect(mockIndex.add).toHaveBeenCalledTimes(1);
      expect(service.getStats().vectorCount).toBe(1);
    });
  });

  // ===== INDEX BUILDING TESTS =====

  describe('Index Building', () => {
    it('should build index from 100 vectors', async () => {
      const memories = Array(100).fill(null).map(() => createTestMemory());

      await service.build(memories);

      expect(mockIndex.add).toHaveBeenCalledTimes(100);
      expect(service.isReady()).toBe(true);
      expect(service.getStats().vectorCount).toBe(100);
    });

    it('should invoke progress callback correctly', async () => {
      const memories = Array(250).fill(null).map(() => createTestMemory());
      const progressCallback = jest.fn();

      await service.build(memories, progressCallback);

      // Progress is called when i % 100 === 0 OR i === length - 1
      // i=0: (1, 250), i=100: (101, 250), i=200: (201, 250), i=249: (250, 250)
      expect(progressCallback).toHaveBeenCalledTimes(4);
      expect(progressCallback).toHaveBeenCalledWith(1, 250);
      expect(progressCallback).toHaveBeenCalledWith(101, 250);
      expect(progressCallback).toHaveBeenCalledWith(201, 250);
      expect(progressCallback).toHaveBeenCalledWith(250, 250);
    });

    it('should handle empty input', async () => {
      await service.build([]);

      expect(mockIndex.add).not.toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
      expect(service.getStats().vectorCount).toBe(0);
    });

    it('should handle build errors gracefully', async () => {
      mockIndex.add.mockImplementation(() => {
        throw new Error('EdgeVec error');
      });

      const memories = [createTestMemory()];

      await expect(service.build(memories)).rejects.toThrow('EdgeVec error');
      expect(service.isReady()).toBe(false);
    });

    it('should prevent concurrent builds', async () => {
      const memories = [createTestMemory()];

      // Manually set building flag to simulate a build in progress
      (service as any).isBuilding = true;

      // Try to start a build while flag is set
      await expect(service.build(memories)).rejects.toThrow('Index build already in progress');

      // Verify flag is still true (wasn't modified by failed build)
      expect((service as any).isBuilding).toBe(true);

      // Reset flag for cleanup
      (service as any).isBuilding = false;
    });
  });

  // ===== CRUD OPERATIONS TESTS =====

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      // Build initial index with 3 memories
      const memories = [
        createTestMemory(),
        createTestMemory(),
        createTestMemory(),
      ];
      await service.build(memories);
      jest.clearAllMocks(); // Clear build calls
    });

    it('should add single vector', async () => {
      const memory = createTestMemory();

      await service.add(memory.id, memory.embedding!);

      expect(mockIndex.add).toHaveBeenCalledTimes(1);
      expect(mockIndex.add).toHaveBeenCalledWith(3, Array.from(memory.embedding!));
      expect(service.getStats().vectorCount).toBe(4);
    });

    it('should remove vector', async () => {
      // Add a memory and then remove it
      const memory = createTestMemory();
      await service.add(memory.id, memory.embedding!);
      jest.clearAllMocks();

      await service.remove(memory.id);

      expect(mockIndex.remove).toHaveBeenCalledTimes(1);
      expect(service.getStats().vectorCount).toBe(3); // Back to 3 (build had 3)
    });

    it('should update existing vector', async () => {
      const memory = createTestMemory();
      const newEmbedding = new Float32Array(Array(384).fill(0.9));

      // Add memory first
      await service.add(memory.id, memory.embedding!);
      jest.clearAllMocks();

      // Update with new embedding
      await service.update(memory.id, newEmbedding);

      expect(mockIndex.remove).toHaveBeenCalledTimes(1);
      expect(mockIndex.add).toHaveBeenCalledTimes(1);
      expect(mockIndex.add).toHaveBeenCalledWith(4, Array.from(newEmbedding));
    });

    it('should handle adding duplicate ID (should update)', async () => {
      const memory = createTestMemory();

      // Add twice
      await service.add(memory.id, memory.embedding!);
      await service.add(memory.id, memory.embedding!);

      // First add, then update (remove + add)
      expect(mockIndex.add).toHaveBeenCalledTimes(2);
      expect(mockIndex.remove).toHaveBeenCalledTimes(1);
    });

    it('should handle removing non-existent ID (no-op)', async () => {
      await service.remove('non-existent-id' as UUID);

      // Should not throw, just log warning
      expect(mockIndex.remove).not.toHaveBeenCalled();
    });

    it('should reject invalid embedding dimensions', async () => {
      const invalidEmbedding = new Float32Array(100); // Wrong dimension

      await expect(
        service.add('test-id' as UUID, invalidEmbedding)
      ).rejects.toThrow('Invalid embedding dimension');
    });
  });

  // ===== SEARCH TESTS =====

  describe('Search', () => {
    beforeEach(async () => {
      // Build index with known memories
      const memory1 = createTestMemory();
      const memory2 = createTestMemory();
      const memory3 = createTestMemory();

      await service.build([memory1, memory2, memory3]);
      jest.clearAllMocks();
    });

    it('should search with k=5', async () => {
      const queryEmbedding = new Float32Array(Array(384).fill(0.7));

      const results = await service.search(queryEmbedding, 5);

      expect(mockIndex.search).toHaveBeenCalledTimes(1);
      expect(mockIndex.search).toHaveBeenCalledWith(
        Array.from(queryEmbedding),
        5,
        50 // default efSearch
      );
      expect(results).toHaveLength(3); // Mock returns 3 results
    });

    it('should search with custom efSearch parameter', async () => {
      const queryEmbedding = new Float32Array(Array(384).fill(0.7));

      await service.search(queryEmbedding, 10, 100);

      expect(mockIndex.search).toHaveBeenCalledWith(
        Array.from(queryEmbedding),
        10,
        100 // custom efSearch
      );
    });

    it('should return empty results for empty index', async () => {
      const emptyService = new HNSWIndexService();
      const queryEmbedding = new Float32Array(Array(384).fill(0.7));

      const results = await emptyService.search(queryEmbedding, 5);

      expect(results).toEqual([]);
      expect(mockIndex.search).not.toHaveBeenCalled();
    });

    it('should reject invalid query embedding dimensions', async () => {
      const invalidEmbedding = new Float32Array(100); // Wrong dimension

      await expect(
        service.search(invalidEmbedding, 5)
      ).rejects.toThrow('Invalid query embedding dimension');
    });

    it('should filter out invalid vector IDs', async () => {
      // Mock returns vector IDs that don't exist in mapping
      mockIndex.search.mockReturnValue([
        { id: 0, distance: 0.1 },    // Valid
        { id: 999, distance: 0.2 },  // Invalid (not in indexToIdMap)
        { id: 1, distance: 0.3 },    // Valid
      ]);

      const queryEmbedding = new Float32Array(Array(384).fill(0.7));
      const results = await service.search(queryEmbedding, 5);

      // Should only return 2 valid results
      expect(results).toHaveLength(2);
    });

    it('should handle search errors gracefully', async () => {
      mockIndex.search.mockImplementation(() => {
        throw new Error('EdgeVec search error');
      });

      const queryEmbedding = new Float32Array(Array(384).fill(0.7));
      const results = await service.search(queryEmbedding, 5);

      expect(results).toEqual([]);
    });
  });

  // ===== PERSISTENCE TESTS =====

  describe('Persistence', () => {
    beforeEach(async () => {
      const memories = [createTestMemory(), createTestMemory()];
      await service.build(memories);
      jest.clearAllMocks();
    });

    it('should serialize and persist to IndexedDB', async () => {
      await service.persist(mockDb);

      expect(mockIndex.serialize).toHaveBeenCalledTimes(1);
      expect(mockDb.hnswIndex.bulkPut).toHaveBeenCalledTimes(1);

      const putCall = mockDb.hnswIndex.bulkPut.mock.calls[0][0];
      expect(putCall).toHaveLength(2); // graph + metadata
      expect(putCall[0].key).toBe('graph');
      expect(putCall[1].key).toBe('metadata');
      expect(putCall[0].vectorCount).toBe(2);
    });

    it('should load index from IndexedDB', async () => {
      mockDb.hnswIndex.get.mockImplementation((key: string) => {
        if (key === 'graph') {
          return Promise.resolve({
            key: 'graph',
            data: { graph: 'serialized' },
            lastUpdated: Date.now(),
            vectorCount: 2,
          });
        } else if (key === 'metadata') {
          return Promise.resolve({
            key: 'metadata',
            data: {
              vectorIdMap: [['mem1', 0], ['mem2', 1]],
              indexToIdMap: [[0, 'mem1'], [1, 'mem2']],
              nextVectorId: 2,
            },
            lastUpdated: Date.now(),
            vectorCount: 2,
          });
        }
        return Promise.resolve(null);
      });

      const newService = new HNSWIndexService();
      const loaded = await newService.load(mockDb);

      expect(loaded).toBe(true);
      expect(mockIndex.deserialize).toHaveBeenCalledTimes(1);
      expect(newService.isReady()).toBe(true);
      expect(newService.getStats().vectorCount).toBe(2);
    });

    it('should handle missing IndexedDB entries', async () => {
      mockDb.hnswIndex.get.mockResolvedValue(null);

      const newService = new HNSWIndexService();
      const loaded = await newService.load(mockDb);

      expect(loaded).toBe(false);
      expect(newService.isReady()).toBe(false);
    });

    it('should handle corrupted serialization data', async () => {
      mockDb.hnswIndex.get.mockResolvedValue({
        key: 'graph',
        data: null, // Corrupted
        lastUpdated: Date.now(),
        vectorCount: 2,
      });

      mockIndex.deserialize.mockImplementation(() => {
        throw new Error('Deserialization error');
      });

      const newService = new HNSWIndexService();
      const loaded = await newService.load(mockDb);

      expect(loaded).toBe(false);
      expect(newService.isReady()).toBe(false);
    });

    it('should skip persist if no index built', async () => {
      const emptyService = new HNSWIndexService();

      await emptyService.persist(mockDb);

      expect(mockIndex.serialize).not.toHaveBeenCalled();
      expect(mockDb.hnswIndex.bulkPut).not.toHaveBeenCalled();
    });
  });

  // ===== STATISTICS TESTS =====

  describe('Statistics', () => {
    it('should return correct stats for empty index', () => {
      const stats = service.getStats();

      expect(stats.vectorCount).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });

    it('should estimate memory usage correctly', async () => {
      const memories = Array(100).fill(null).map(() => createTestMemory());
      await service.build(memories);

      const stats = service.getStats();

      expect(stats.vectorCount).toBe(100);
      // Each vector: ~1.6 KB, 100 vectors: ~160 KB
      expect(stats.memoryUsage).toBeGreaterThan(150000);
      expect(stats.memoryUsage).toBeLessThan(170000);
    });

    it('should update stats after add/remove operations', async () => {
      const memory1 = createTestMemory();
      const memory2 = createTestMemory();

      await service.build([memory1]);
      expect(service.getStats().vectorCount).toBe(1);

      await service.add(memory2.id, memory2.embedding!);
      expect(service.getStats().vectorCount).toBe(2);

      await service.remove(memory1.id);
      expect(service.getStats().vectorCount).toBe(1);
    });
  });
});

/**
 * Unit Tests for HNSW Index Service (Phase 4)
 * Tests end-to-end HNSW index functionality with EdgeVec mocking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { MemoryWithMemA, UUID } from '@engram/core';
import { generateUUID, now, createVectorClock } from '@engram/core';
import { HNSWIndexService } from '../src/lib/hnsw-index-service';

// Mock EdgeVec before importing
var nextVectorId = 0; // Auto-incrementing vector ID (var is hoisted)
var mockLoadStatic: any; // var is hoisted
var mockIndex: any; // var is hoisted

// Initialize mock index
mockIndex = {
  insert: jest.fn(() => nextVectorId++), // Returns auto-incrementing ID
  softDelete: jest.fn(),
  search: jest.fn(),
  save: jest.fn(),
};

jest.mock('edgevec', () => {
  // Create the static load function inside the factory
  const loadFn = jest.fn();
  mockLoadStatic = loadFn; // Export to outer scope

  return {
    EdgeVec: Object.assign(
      jest.fn().mockImplementation(() => mockIndex),
      { load: loadFn }
    ),
    EdgeVecConfig: jest.fn().mockImplementation((config: any) => config),
  };
});

// Mock Dexie database
const mockDb = {
  hnswIndex: {
    get: jest.fn(),
    put: jest.fn(),
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
      },
      tags: [],
      syncStatus: 'synced',
      vectorClock: createVectorClock(),
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

    // Reset vector ID counter
    nextVectorId = 0;

    // Default mock behaviors
    mockIndex.insert.mockImplementation(() => nextVectorId++);
    mockIndex.softDelete.mockReturnValue(undefined);
    mockIndex.search.mockReturnValue([
      { id: 0, distance: 0.1 },
      { id: 1, distance: 0.2 },
      { id: 2, distance: 0.3 },
    ]);
    mockIndex.save.mockResolvedValue(undefined);
    mockLoadStatic.mockResolvedValue(mockIndex);
    mockDb.hnswIndex.get.mockResolvedValue(null);
    mockDb.hnswIndex.put.mockResolvedValue(undefined);
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

      expect(mockIndex.insert).toHaveBeenCalledTimes(3);
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
      expect(mockIndex.insert).toHaveBeenCalledTimes(1);
      expect(service.getStats().vectorCount).toBe(1);
    });
  });

  // ===== INDEX BUILDING TESTS =====

  describe('Index Building', () => {
    it('should build index from 100 vectors', async () => {
      const memories = Array(100).fill(null).map(() => createTestMemory());

      await service.build(memories);

      expect(mockIndex.insert).toHaveBeenCalledTimes(100);
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

      expect(mockIndex.insert).not.toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
      expect(service.getStats().vectorCount).toBe(0);
    });

    it('should handle build errors gracefully', async () => {
      mockIndex.insert.mockImplementation(() => {
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

      expect(mockIndex.insert).toHaveBeenCalledTimes(1);
      expect(mockIndex.insert).toHaveBeenCalledWith(memory.embedding!);
      expect(service.getStats().vectorCount).toBe(4);
    });

    it('should remove vector', async () => {
      // Add a memory and then remove it
      const memory = createTestMemory();
      await service.add(memory.id, memory.embedding!);
      jest.clearAllMocks();

      await service.remove(memory.id);

      expect(mockIndex.softDelete).toHaveBeenCalledTimes(1);
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

      expect(mockIndex.softDelete).toHaveBeenCalledTimes(1);
      expect(mockIndex.insert).toHaveBeenCalledTimes(1);
      expect(mockIndex.insert).toHaveBeenCalledWith(newEmbedding);
    });

    it('should handle adding duplicate ID (should update)', async () => {
      const memory = createTestMemory();

      // Add twice
      await service.add(memory.id, memory.embedding!);
      await service.add(memory.id, memory.embedding!);

      // First add, then update (remove + add)
      expect(mockIndex.insert).toHaveBeenCalledTimes(2);
      expect(mockIndex.softDelete).toHaveBeenCalledTimes(1);
    });

    it('should handle removing non-existent ID (no-op)', async () => {
      await service.remove('non-existent-id' as UUID);

      // Should not throw, just log warning
      expect(mockIndex.softDelete).not.toHaveBeenCalled();
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
        queryEmbedding,
        5
      );
      expect(results).toHaveLength(3); // Mock returns 3 results
    });

    it('should search with k=10', async () => {
      const queryEmbedding = new Float32Array(Array(384).fill(0.7));

      await service.search(queryEmbedding, 10);

      expect(mockIndex.search).toHaveBeenCalledWith(
        queryEmbedding,
        10
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

      expect(mockIndex.save).toHaveBeenCalledTimes(1);
      expect(mockIndex.save).toHaveBeenCalledWith('engram-hnsw-index');
      expect(mockDb.hnswIndex.put).toHaveBeenCalledTimes(1);

      const putCall = mockDb.hnswIndex.put.mock.calls[0][0];
      expect(putCall.key).toBe('metadata');
      expect(putCall.vectorCount).toBe(2);
    });

    it('should load index from IndexedDB', async () => {
      // Mock EdgeVec.load to return the mockIndex
      mockLoadStatic.mockResolvedValue(mockIndex);

      // Mock metadata from database
      mockDb.hnswIndex.get.mockImplementation((key: string) => {
        if (key === 'metadata') {
          return Promise.resolve({
            key: 'metadata',
            data: {
              vectorIdMap: [['mem1', 0], ['mem2', 1]],
              indexToIdMap: [[0, 'mem1'], [1, 'mem2']],
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
      expect(mockLoadStatic).toHaveBeenCalledTimes(1);
      expect(mockLoadStatic).toHaveBeenCalledWith('engram-hnsw-index');
      expect(newService.isReady()).toBe(true);
      expect(newService.getStats().vectorCount).toBe(2);
    });

    it('should handle missing IndexedDB entries', async () => {
      // Mock EdgeVec.load to fail (no saved index)
      mockLoadStatic.mockRejectedValue(new Error('No saved index'));
      mockDb.hnswIndex.get.mockResolvedValue(null);

      const newService = new HNSWIndexService();
      const loaded = await newService.load(mockDb);

      expect(loaded).toBe(false);
      expect(newService.isReady()).toBe(false);
    });

    it('should handle corrupted serialization data', async () => {
      // Mock EdgeVec.load to throw error
      mockLoadStatic.mockRejectedValue(new Error('Deserialization error'));

      const newService = new HNSWIndexService();
      const loaded = await newService.load(mockDb);

      expect(loaded).toBe(false);
      expect(newService.isReady()).toBe(false);
    });

    it('should skip persist if no index built', async () => {
      const emptyService = new HNSWIndexService();

      await emptyService.persist(mockDb);

      expect(mockIndex.save).not.toHaveBeenCalled();
      expect(mockDb.hnswIndex.put).not.toHaveBeenCalled();
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

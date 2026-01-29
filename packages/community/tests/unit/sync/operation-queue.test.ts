/**
 * OperationQueue Unit Tests
 * Tests for persistent sync operation queue management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OperationQueue, DEFAULT_QUEUE_CONFIG } from '../../../src/sync/operation-queue';
import { StorageService } from '../../../src/lib/storage';
import { SyncOperation } from '@engram/core';

// Mock generateUUID
jest.mock('@engram/core', () => ({
  ...jest.requireActual('@engram/core'),
  generateUUID: jest.fn(() => 'mock-uuid-' + Date.now()),
}));

// Mock storage service
const createMockStorageService = () => {
  const mockTable = {
    add: jest.fn(),
    delete: jest.fn(),
    bulkDelete: jest.fn(),
    bulkAdd: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    clear: jest.fn(),
    count: jest.fn(),
    toArray: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
  };

  // Chain methods for query building
  mockTable.where.mockReturnValue(mockTable);
  mockTable.orderBy.mockReturnValue(mockTable);
  mockTable.limit.mockReturnValue(mockTable);
  mockTable.where.mockReturnValue({
    above: jest.fn().mockReturnValue(mockTable),
    below: jest.fn().mockReturnValue(mockTable),
  });

  return {
    getSyncQueueTable: jest.fn(() => mockTable),
    mockTable,
  };
};

describe('OperationQueue', () => {
  let queue: OperationQueue;
  let mockStorage: ReturnType<typeof createMockStorageService>;
  let mockTable: any;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStorage = createMockStorageService();
    mockTable = mockStorage.mockTable;
    queue = new OperationQueue(mockStorage as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('enqueue()', () => {
    it('should add operation to queue', async () => {
      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const operation = {
        type: 'create' as const,
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: { content: 'Test memory' },
      };

      const id = await queue.enqueue(operation);

      expect(id).toBeDefined();
      expect(mockTable.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'create',
          memoryId: 'mem-123',
          id: expect.any(String),
        })
      );
    });

    it('should deduplicate operations on same entity', async () => {
      const existingOp: SyncOperation = {
        id: 'existing-op',
        type: 'update',
        memoryId: 'mem-123',
        timestamp: Date.now() - 1000,
        data: {},
      };

      mockTable.toArray.mockResolvedValue([existingOp]);
      mockTable.delete.mockResolvedValue(undefined);
      mockTable.add.mockResolvedValue('new-op');

      const operation = {
        type: 'update' as const,
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: { content: 'Updated' },
      };

      await queue.enqueue(operation);

      expect(mockTable.delete).toHaveBeenCalledWith('existing-op');
      expect(mockTable.add).toHaveBeenCalled();
    });

    it('should schedule debounced processing', async () => {
      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const callback = jest.fn();
      queue.onReadyToProcess(callback);

      await queue.enqueue({
        type: 'create',
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: {},
      });

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(DEFAULT_QUEUE_CONFIG.debounceMs);

      expect(callback).toHaveBeenCalled();
    });

    it('should reset debounce timer on new operations', async () => {
      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const callback = jest.fn();
      queue.onReadyToProcess(callback);

      await queue.enqueue({
        type: 'create',
        memoryId: 'mem-1',
        timestamp: Date.now(),
        data: {},
      });

      jest.advanceTimersByTime(DEFAULT_QUEUE_CONFIG.debounceMs - 100);

      await queue.enqueue({
        type: 'create',
        memoryId: 'mem-2',
        timestamp: Date.now(),
        data: {},
      });

      // First timer should be cancelled, callback not called yet
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(DEFAULT_QUEUE_CONFIG.debounceMs);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBatch()', () => {
    it('should return batch of operations in FIFO order', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          memoryId: 'mem-1',
          timestamp: 1000,
          data: {},
        },
        {
          id: 'op-2',
          type: 'update',
          memoryId: 'mem-2',
          timestamp: 2000,
          data: {},
        },
      ];

      mockTable.toArray.mockResolvedValue(operations);

      const batch = await queue.getBatch();

      expect(mockTable.orderBy).toHaveBeenCalledWith('timestamp');
      expect(mockTable.limit).toHaveBeenCalledWith(DEFAULT_QUEUE_CONFIG.maxBatchSize);
      expect(batch).toEqual(operations);
    });

    it('should respect max batch size', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        id: `op-${i}`,
        type: 'create' as const,
        memoryId: `mem-${i}`,
        timestamp: Date.now() + i,
        data: {},
      }));

      mockTable.toArray.mockResolvedValue(operations.slice(0, 50));

      await queue.getBatch();

      expect(mockTable.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('markProcessed()', () => {
    it('should remove operation from queue', async () => {
      mockTable.delete.mockResolvedValue(undefined);

      await queue.markProcessed('op-123');

      expect(mockTable.delete).toHaveBeenCalledWith('op-123');
    });
  });

  describe('markBatchProcessed()', () => {
    it('should remove multiple operations from queue', async () => {
      mockTable.bulkDelete.mockResolvedValue(undefined);

      const operationIds = ['op-1', 'op-2', 'op-3'];
      await queue.markBatchProcessed(operationIds);

      expect(mockTable.bulkDelete).toHaveBeenCalledWith(operationIds);
    });
  });

  describe('getSize()', () => {
    it('should return queue size', async () => {
      mockTable.count.mockResolvedValue(42);

      const size = await queue.getSize();

      expect(size).toBe(42);
    });
  });

  describe('isEmpty()', () => {
    it('should return true when queue is empty', async () => {
      mockTable.count.mockResolvedValue(0);

      const isEmpty = await queue.isEmpty();

      expect(isEmpty).toBe(true);
    });

    it('should return false when queue has operations', async () => {
      mockTable.count.mockResolvedValue(5);

      const isEmpty = await queue.isEmpty();

      expect(isEmpty).toBe(false);
    });
  });

  describe('getByEntity()', () => {
    it('should return operations for specific entity', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          memoryId: 'mem-123',
          timestamp: Date.now(),
          data: {},
        },
        {
          id: 'op-2',
          type: 'update',
          memoryId: 'mem-456',
          timestamp: Date.now(),
          data: {},
        },
        {
          id: 'op-3',
          type: 'update',
          memoryId: 'mem-123',
          timestamp: Date.now(),
          data: {},
        },
      ];

      mockTable.toArray.mockResolvedValue(operations);

      const result = await queue.getByEntity('mem-123');

      expect(result).toHaveLength(2);
      expect(result[0].memoryId).toBe('mem-123');
      expect(result[1].memoryId).toBe('mem-123');
    });
  });

  describe('clear()', () => {
    it('should remove all operations from queue', async () => {
      mockTable.clear.mockResolvedValue(undefined);

      await queue.clear();

      expect(mockTable.clear).toHaveBeenCalled();
    });
  });

  describe('getStats()', () => {
    it('should return queue statistics', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          memoryId: 'mem-1',
          timestamp: 1000,
          data: {},
        },
        {
          id: 'op-2',
          type: 'update',
          memoryId: 'mem-1',
          timestamp: 2000,
          data: {},
        },
        {
          id: 'op-3',
          type: 'create',
          memoryId: 'mem-2',
          timestamp: 3000,
          data: {},
        },
      ];

      mockTable.toArray.mockResolvedValue(operations);

      const stats = await queue.getStats();

      expect(stats.totalOperations).toBe(3);
      expect(stats.operationsByType).toEqual({
        create: 2,
        update: 1,
      });
      expect(stats.operationsByEntity).toEqual({
        'mem-1': 2,
        'mem-2': 1,
      });
      expect(stats.oldestOperation).toBe(1000);
      expect(stats.newestOperation).toBe(3000);
    });

    it('should handle empty queue', async () => {
      mockTable.toArray.mockResolvedValue([]);

      const stats = await queue.getStats();

      expect(stats.totalOperations).toBe(0);
      expect(stats.oldestOperation).toBeNull();
      expect(stats.newestOperation).toBeNull();
    });
  });

  describe('retry()', () => {
    it('should update operation timestamp to retry', async () => {
      const operation: SyncOperation = {
        id: 'op-123',
        type: 'create',
        memoryId: 'mem-123',
        timestamp: 1000,
        data: {},
      };

      mockTable.get.mockResolvedValue(operation);
      mockTable.update.mockResolvedValue(undefined);

      await queue.retry('op-123');

      expect(mockTable.get).toHaveBeenCalledWith('op-123');
      expect(mockTable.update).toHaveBeenCalledWith('op-123', {
        timestamp: expect.any(Number),
      });
    });

    it('should throw error if operation not found', async () => {
      mockTable.get.mockResolvedValue(null);

      await expect(queue.retry('nonexistent')).rejects.toThrow('Operation not found');
    });
  });

  describe('cleanupOld()', () => {
    it('should remove operations older than max age', async () => {
      const now = Date.now();
      const maxAge = 60000; // 1 minute
      const oldOperations: SyncOperation[] = [
        {
          id: 'old-1',
          type: 'create',
          memoryId: 'mem-1',
          timestamp: now - 120000, // 2 minutes old
          data: {},
        },
        {
          id: 'old-2',
          type: 'create',
          memoryId: 'mem-2',
          timestamp: now - 90000, // 1.5 minutes old
          data: {},
        },
      ];

      mockTable.toArray.mockResolvedValue(oldOperations);
      mockTable.bulkDelete.mockResolvedValue(undefined);

      const count = await queue.cleanupOld(maxAge);

      expect(count).toBe(2);
      expect(mockTable.bulkDelete).toHaveBeenCalledWith(['old-1', 'old-2']);
    });

    it('should not remove recent operations', async () => {
      mockTable.toArray.mockResolvedValue([]);

      const count = await queue.cleanupOld(60000);

      expect(count).toBe(0);
      expect(mockTable.bulkDelete).not.toHaveBeenCalled();
    });
  });

  describe('onReadyToProcess()', () => {
    it('should register callback', async () => {
      const callback = jest.fn();

      const unsubscribe = queue.onReadyToProcess(callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should allow unsubscribe', async () => {
      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const callback = jest.fn();
      const unsubscribe = queue.onReadyToProcess(callback);

      // Unsubscribe before trigger
      unsubscribe();

      await queue.enqueue({
        type: 'create',
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: {},
      });

      jest.advanceTimersByTime(DEFAULT_QUEUE_CONFIG.debounceMs);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks', async () => {
      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      queue.onReadyToProcess(callback1);
      queue.onReadyToProcess(callback2);

      await queue.enqueue({
        type: 'create',
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: {},
      });

      jest.advanceTimersByTime(DEFAULT_QUEUE_CONFIG.debounceMs);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();

      queue.onReadyToProcess(errorCallback);
      queue.onReadyToProcess(goodCallback);

      await queue.enqueue({
        type: 'create',
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: {},
      });

      jest.advanceTimersByTime(DEFAULT_QUEUE_CONFIG.debounceMs);

      // Both should be called despite error in first
      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('import/export()', () => {
    it('should export all operations', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          memoryId: 'mem-1',
          timestamp: Date.now(),
          data: {},
        },
      ];

      mockTable.toArray.mockResolvedValue(operations);

      const exported = await queue.export();

      expect(exported).toEqual(operations);
    });

    it('should import operations', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          memoryId: 'mem-1',
          timestamp: Date.now(),
          data: {},
        },
        {
          id: 'op-2',
          type: 'update',
          memoryId: 'mem-2',
          timestamp: Date.now(),
          data: {},
        },
      ];

      mockTable.bulkAdd.mockResolvedValue(undefined);

      await queue.import(operations);

      expect(mockTable.bulkAdd).toHaveBeenCalledWith(operations);
    });
  });

  describe('custom config', () => {
    it('should use custom config', async () => {
      const customConfig = {
        maxBatchSize: 10,
        debounceMs: 100,
      };

      const customQueue = new OperationQueue(mockStorage as any, customConfig);

      mockTable.toArray.mockResolvedValue([]);

      await customQueue.getBatch();

      expect(mockTable.limit).toHaveBeenCalledWith(10);
    });

    it('should use custom debounce time', async () => {
      const customConfig = {
        maxBatchSize: 50,
        debounceMs: 100,
      };

      const customQueue = new OperationQueue(mockStorage as any, customConfig);

      mockTable.toArray.mockResolvedValue([]);
      mockTable.add.mockResolvedValue('op-123');

      const callback = jest.fn();
      customQueue.onReadyToProcess(callback);

      await customQueue.enqueue({
        type: 'create',
        memoryId: 'mem-123',
        timestamp: Date.now(),
        data: {},
      });

      jest.advanceTimersByTime(50);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(callback).toHaveBeenCalled();
    });
  });
});

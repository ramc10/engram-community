/**
 * Operation Queue
 * Manages persistent queue of sync operations in IndexedDB
 *
 * Features:
 * - Persistent queue in IndexedDB (survives extension reloads)
 * - FIFO processing
 * - Batch operations (max 50 per sync)
 * - Debounce (wait 500ms for more changes)
 * - Deduplication
 */

import { SyncOperation } from '@engram/core';
import { StorageService } from '../lib/storage';
import { generateUUID } from '@engram/core';

export interface QueueConfig {
  maxBatchSize: number;
  debounceMs: number;
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxBatchSize: 50,
  debounceMs: 500,
};

export class OperationQueue {
  private debounceTimer: NodeJS.Timeout | null = null;
  private processingCallbacks: Set<() => void> = new Set();

  constructor(
    private storage: StorageService,
    private config: QueueConfig = DEFAULT_QUEUE_CONFIG
  ) {}

  /**
   * Add operation to queue
   */
  async enqueue(operation: Omit<SyncOperation, 'id'>): Promise<string> {
    const op: SyncOperation = {
      id: generateUUID(),
      ...operation,
    };

    // Check for duplicate operations (same entity, same operation type)
    const existing = await this.findDuplicate(op);
    if (existing) {
      console.log(`[OperationQueue] Duplicate operation detected, replacing: ${existing.id}`);
      await this.storage.db.syncQueue.delete(existing.id);
    }

    // Add to queue
    await this.storage.db.syncQueue.add(op);

    console.log(`[OperationQueue] Enqueued operation: ${op.operationType} ${op.entityType} ${op.entityId}`);

    // Trigger debounced processing
    this.scheduleProcessing();

    return op.id;
  }

  /**
   * Find duplicate operation in queue
   */
  private async findDuplicate(operation: SyncOperation): Promise<SyncOperation | null> {
    // Look for operations on the same entity with the same operation type
    const operations = await this.storage.db.syncQueue
      .where('timestamp')
      .above(0)
      .toArray();

    const duplicate = operations.find(
      op =>
        op.entityId === operation.entityId &&
        op.operationType === operation.operationType &&
        op.deviceId === operation.deviceId
    );

    return duplicate || null;
  }

  /**
   * Schedule debounced processing
   * Waits for more operations before processing
   */
  private scheduleProcessing(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.notifyProcessing();
    }, this.config.debounceMs);
  }

  /**
   * Notify that queue is ready for processing
   */
  private notifyProcessing(): void {
    for (const callback of this.processingCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[OperationQueue] Error in processing callback:', error);
      }
    }
  }

  /**
   * Register callback for when queue is ready to process
   */
  onReadyToProcess(callback: () => void): () => void {
    this.processingCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.processingCallbacks.delete(callback);
    };
  }

  /**
   * Get next batch of operations
   * Returns up to maxBatchSize operations in FIFO order
   */
  async getBatch(): Promise<SyncOperation[]> {
    const operations = await this.storage.db.syncQueue
      .orderBy('timestamp')
      .limit(this.config.maxBatchSize)
      .toArray();

    console.log(`[OperationQueue] Got batch of ${operations.length} operations`);

    return operations;
  }

  /**
   * Mark operation as processed and remove from queue
   */
  async markProcessed(operationId: string): Promise<void> {
    await this.storage.db.syncQueue.delete(operationId);
    console.log(`[OperationQueue] Marked processed: ${operationId}`);
  }

  /**
   * Mark multiple operations as processed
   */
  async markBatchProcessed(operationIds: string[]): Promise<void> {
    await this.storage.db.syncQueue.bulkDelete(operationIds);
    console.log(`[OperationQueue] Marked batch processed: ${operationIds.length} operations`);
  }

  /**
   * Get queue size
   */
  async getSize(): Promise<number> {
    return await this.storage.db.syncQueue.count();
  }

  /**
   * Check if queue is empty
   */
  async isEmpty(): Promise<boolean> {
    const size = await this.getSize();
    return size === 0;
  }

  /**
   * Get all operations (for debugging)
   */
  async getAll(): Promise<SyncOperation[]> {
    return await this.storage.db.syncQueue.orderBy('timestamp').toArray();
  }

  /**
   * Get operations by entity
   */
  async getByEntity(entityId: string): Promise<SyncOperation[]> {
    const operations = await this.storage.db.syncQueue.toArray();
    return operations.filter(op => op.entityId === entityId);
  }

  /**
   * Clear entire queue (use with caution!)
   */
  async clear(): Promise<void> {
    await this.storage.db.syncQueue.clear();
    console.log('[OperationQueue] Cleared all operations');
  }

  /**
   * Remove specific operation
   */
  async remove(operationId: string): Promise<void> {
    await this.storage.db.syncQueue.delete(operationId);
    console.log(`[OperationQueue] Removed operation: ${operationId}`);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    totalOperations: number;
    operationsByType: Record<string, number>;
    operationsByEntity: Record<string, number>;
    oldestOperation: number | null;
    newestOperation: number | null;
  }> {
    const operations = await this.storage.db.syncQueue.toArray();

    const operationsByType: Record<string, number> = {};
    const operationsByEntity: Record<string, number> = {};
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const op of operations) {
      // Count by type
      operationsByType[op.operationType] = (operationsByType[op.operationType] || 0) + 1;

      // Count by entity type
      operationsByEntity[op.entityType] = (operationsByEntity[op.entityType] || 0) + 1;

      // Track timestamps
      if (oldestTimestamp === null || op.timestamp < oldestTimestamp) {
        oldestTimestamp = op.timestamp;
      }
      if (newestTimestamp === null || op.timestamp > newestTimestamp) {
        newestTimestamp = op.timestamp;
      }
    }

    return {
      totalOperations: operations.length,
      operationsByType,
      operationsByEntity,
      oldestOperation: oldestTimestamp,
      newestOperation: newestTimestamp,
    };
  }

  /**
   * Retry failed operation
   * Moves operation to front of queue by updating timestamp
   */
  async retry(operationId: string): Promise<void> {
    const operation = await this.storage.db.syncQueue.get(operationId);

    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    // Update timestamp to move to front
    await this.storage.db.syncQueue.update(operationId, {
      timestamp: Date.now(),
    });

    console.log(`[OperationQueue] Retrying operation: ${operationId}`);
  }

  /**
   * Get operations older than timestamp
   */
  async getOlderThan(timestamp: number): Promise<SyncOperation[]> {
    return await this.storage.db.syncQueue
      .where('timestamp')
      .below(timestamp)
      .toArray();
  }

  /**
   * Clean up old operations (older than specified age)
   */
  async cleanupOld(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const oldOperations = await this.getOlderThan(cutoff);

    if (oldOperations.length > 0) {
      await this.storage.db.syncQueue.bulkDelete(oldOperations.map(op => op.id));
      console.log(`[OperationQueue] Cleaned up ${oldOperations.length} old operations`);
    }

    return oldOperations.length;
  }

  /**
   * Export queue for debugging
   */
  async export(): Promise<SyncOperation[]> {
    return await this.getAll();
  }

  /**
   * Import operations (for testing/recovery)
   */
  async import(operations: SyncOperation[]): Promise<void> {
    await this.storage.db.syncQueue.bulkAdd(operations);
    console.log(`[OperationQueue] Imported ${operations.length} operations`);
  }
}

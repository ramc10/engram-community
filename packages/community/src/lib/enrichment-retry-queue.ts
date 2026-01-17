/**
 * Enrichment Retry Queue
 * Manages persistent retry queue for failed enrichments
 * Stores failed enrichments in chrome.storage.local and retries with exponential backoff
 */

import type { MemoryWithMemA } from '@engram/core';
import { RetryManager, type ErrorType } from '../sync/retry-manager';

export interface EnrichmentRetryItem {
  memory: MemoryWithMemA;
  attemptCount: number;
  lastAttempt: number;
  error?: string;
  errorType?: ErrorType;
  nextRetryTime: number;
}

export interface EnrichmentRetryQueueStats {
  totalItems: number;
  pendingRetries: number;
  failedPermanently: number;
  oldestRetry?: number;
}

const STORAGE_KEY = 'enrichment-retry-queue';
const MAX_RETRY_ITEMS = 1000; // Prevent queue from growing indefinitely

/**
 * Persistent retry queue for failed enrichments
 * Uses chrome.storage.local for persistence across sessions
 */
export class EnrichmentRetryQueue {
  private retryManager: RetryManager;
  private queue: Map<string, EnrichmentRetryItem> = new Map();
  private isLoaded = false;

  constructor() {
    // Use RetryManager with enrichment-specific config
    this.retryManager = new RetryManager({
      maxRetries: 5, // More attempts for enrichments
      baseDelay: 1000,
      maxDelay: 300000, // 5 minutes max
      delays: [2000, 5000, 15000, 60000, 300000], // Progressive backoff
      jitterFactor: 0.2,
    });
  }

  /**
   * Load retry queue from storage
   */
  async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as EnrichmentRetryItem[] | undefined;

      if (stored && Array.isArray(stored)) {
        this.queue = new Map(stored.map(item => [item.memory.id, item]));
        console.log(`[EnrichmentRetryQueue] Loaded ${this.queue.size} items from storage`);
      }

      this.isLoaded = true;
    } catch (error) {
      console.error('[EnrichmentRetryQueue] Failed to load queue:', error);
      this.queue = new Map();
      this.isLoaded = true;
    }
  }

  /**
   * Save retry queue to storage
   */
  async save(): Promise<void> {
    try {
      const items = Array.from(this.queue.values());

      // Limit queue size
      const limitedItems = items.slice(-MAX_RETRY_ITEMS);

      await chrome.storage.local.set({
        [STORAGE_KEY]: limitedItems,
      });

      console.log(`[EnrichmentRetryQueue] Saved ${limitedItems.length} items to storage`);
    } catch (error) {
      console.error('[EnrichmentRetryQueue] Failed to save queue:', error);
    }
  }

  /**
   * Add failed enrichment to retry queue
   */
  async add(
    memory: MemoryWithMemA,
    error?: Error,
    errorType?: ErrorType
  ): Promise<void> {
    await this.load();

    const existing = this.queue.get(memory.id);
    const attemptCount = existing ? existing.attemptCount + 1 : 1;

    // Check if we should retry
    if (attemptCount > this.retryManager.getRetryCount()) {
      this.retryManager.recordAttempt(errorType, error?.message);
    }

    if (!this.retryManager.shouldRetry()) {
      console.warn(
        `[EnrichmentRetryQueue] Max retries exceeded for memory ${memory.id}, giving up`
      );

      // Keep in queue but mark as permanently failed
      this.queue.set(memory.id, {
        memory,
        attemptCount,
        lastAttempt: Date.now(),
        error: error?.message,
        errorType,
        nextRetryTime: -1, // -1 indicates permanent failure
      });

      await this.save();
      return;
    }

    const nextRetryDelay = this.retryManager.getRetryDelay();
    const nextRetryTime = Date.now() + nextRetryDelay;

    const item: EnrichmentRetryItem = {
      memory,
      attemptCount,
      lastAttempt: Date.now(),
      error: error?.message,
      errorType,
      nextRetryTime,
    };

    this.queue.set(memory.id, item);
    console.log(
      `[EnrichmentRetryQueue] Added memory ${memory.id} to retry queue ` +
      `(attempt ${attemptCount}, next retry in ${nextRetryDelay}ms)`
    );

    await this.save();
  }

  /**
   * Get items ready for retry
   */
  async getReadyForRetry(): Promise<EnrichmentRetryItem[]> {
    await this.load();

    const now = Date.now();
    const ready: EnrichmentRetryItem[] = [];

    for (const item of this.queue.values()) {
      // Skip permanently failed items
      if (item.nextRetryTime === -1) {
        continue;
      }

      // Check if ready for retry
      if (item.nextRetryTime <= now) {
        ready.push(item);
      }
    }

    return ready;
  }

  /**
   * Remove item from queue (after successful retry)
   */
  async remove(memoryId: string): Promise<void> {
    this.queue.delete(memoryId);
    await this.save();
    console.log(`[EnrichmentRetryQueue] Removed memory ${memoryId} from retry queue`);
  }

  /**
   * Get all failed items (including permanently failed)
   */
  async getAll(): Promise<EnrichmentRetryItem[]> {
    await this.load();
    return Array.from(this.queue.values());
  }

  /**
   * Get permanently failed items
   */
  async getPermanentlyFailed(): Promise<EnrichmentRetryItem[]> {
    await this.load();

    return Array.from(this.queue.values()).filter(
      item => item.nextRetryTime === -1
    );
  }

  /**
   * Clear all items from queue
   */
  async clear(): Promise<void> {
    this.queue.clear();
    await chrome.storage.local.remove(STORAGE_KEY);
    console.log('[EnrichmentRetryQueue] Cleared all items from queue');
  }

  /**
   * Clear only permanently failed items
   */
  async clearPermanentlyFailed(): Promise<void> {
    await this.load();

    const toRemove: string[] = [];
    for (const [id, item] of this.queue.entries()) {
      if (item.nextRetryTime === -1) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.queue.delete(id);
    }

    await this.save();
    console.log(`[EnrichmentRetryQueue] Cleared ${toRemove.length} permanently failed items`);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<EnrichmentRetryQueueStats> {
    await this.load();

    const all = Array.from(this.queue.values());
    const now = Date.now();

    const pending = all.filter(
      item => item.nextRetryTime > 0 && item.nextRetryTime > now
    );

    const permanentlyFailed = all.filter(item => item.nextRetryTime === -1);

    const oldestRetry = pending.length > 0
      ? Math.min(...pending.map(item => item.nextRetryTime))
      : undefined;

    return {
      totalItems: all.length,
      pendingRetries: pending.length,
      failedPermanently: permanentlyFailed.length,
      oldestRetry,
    };
  }

  /**
   * Export queue for debugging
   */
  async export(): Promise<string> {
    await this.load();

    const items = Array.from(this.queue.values());
    const stats = await this.getStats();

    return JSON.stringify(
      {
        stats,
        items,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }
}

// Singleton instance
let retryQueueInstance: EnrichmentRetryQueue | null = null;

/**
 * Get singleton retry queue instance
 */
export function getEnrichmentRetryQueue(): EnrichmentRetryQueue {
  if (!retryQueueInstance) {
    retryQueueInstance = new EnrichmentRetryQueue();
  }
  return retryQueueInstance;
}

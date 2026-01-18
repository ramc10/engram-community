/**
 * IndexedDB storage implementation using Dexie
 * Client-side encrypted storage for memories, conversations, and sync state
 */

import Dexie, { Table } from 'dexie';
import {
  Memory,
  Conversation,
  Device,
  SyncOperation,
  UUID,
  Timestamp,
  IStorage,
  MemoryFilter,
  ConversationFilter,
  StorageStats,
  DB_NAME,
  DB_VERSION,
  METADATA_KEYS,
  MemoryWithMemA,
  EnrichmentConfig,
} from '@engram/core';
import { EnrichmentService } from './enrichment-service';
import { LinkDetectionService } from './link-detection-service';
import { EvolutionService } from './evolution-service';
import { decryptApiKey, isEncrypted } from './api-key-crypto';
import { getEmbeddingService } from './embedding-service';
import type { HNSWIndexEntry, HNSWIndexService, HNSWStats } from './hnsw-index-service';
import { createLogger } from './logger';
import { getCryptoService } from './crypto-service';

// Declare chrome for TypeScript
declare const chrome: any;

const logger = createLogger('Storage');

/**
 * Search index entry
 */
interface SearchIndexEntry {
  tag: string; // Encrypted search tag
  memoryIds: UUID[]; // Memories with this tag
}

/**
 * Metadata entry
 */
interface MetadataEntry {
  key: string;
  value: any;
}

/**
 * Options for saveMemory
 */
interface SaveMemoryOptions {
  skipInitialSave?: boolean;      // Skip immediate save, wait for enrichment
  useAtomicTransaction?: boolean;  // Wrap final save in transaction (default: true when skipInitialSave)
}

/**
 * Dexie database class
 */
class EngramDatabase extends Dexie {
  // Typed tables
  memories!: Table<MemoryWithMemA, UUID>; // Updated to support memA fields
  conversations!: Table<Conversation, string>;
  devices!: Table<Device, UUID>;
  syncQueue!: Table<SyncOperation, UUID>;
  metadata!: Table<MetadataEntry, string>;
  searchIndex!: Table<SearchIndexEntry, string>;
  hnswIndex!: Table<HNSWIndexEntry, string>; // Phase 4: HNSW vector index

  constructor() {
    super(DB_NAME);

    // Version 1: Original schema (Week 1-3)
    this.version(1).stores({
      memories: 'id, conversationId, platform, timestamp, syncStatus, *tags',
      conversations: 'id, platform, lastMessageAt',
      devices: 'id, lastSeenAt',
      syncQueue: 'id, timestamp',
      metadata: 'key',
      searchIndex: 'tag',
    });

    // Version 2: Add HNSW vector index (Phase 4)
    this.version(2).stores({
      memories: 'id, conversationId, platform, timestamp, syncStatus, *tags',
      conversations: 'id, platform, lastMessageAt',
      devices: 'id, lastSeenAt',
      syncQueue: 'id, timestamp',
      metadata: 'key',
      searchIndex: 'tag',
      hnswIndex: 'key', // HNSW index persistence (graph, metadata)
    }).upgrade(async (tx) => {
      logger.log('Migrating to v2: Adding HNSW index table...');
      // Table is created automatically by Dexie
      // Initial index build will happen in initialize()
      logger.log('Migration to v2 complete');
    });
  }
}

// Export database type for HNSW service
export type { EngramDatabase };

/**
 * Storage service implementation
 */
export class StorageService implements IStorage {
  private db: EngramDatabase;
  private enrichmentService: EnrichmentService | null = null;
  private linkDetectionService: LinkDetectionService | null = null;
  private evolutionService: EvolutionService | null = null;
  private hnswIndexService: HNSWIndexService | null = null; // Phase 4: Vector index
  public forceEnrichmentInTests = false;
  private masterKeyProvider?: () => { key: Uint8Array } | null; // For embedding encryption

  constructor() {
    this.db = new EngramDatabase();
  }

  /**
   * Set master key provider for embedding encryption
   * Called by BackgroundService during initialization
   */
  setMasterKeyProvider(provider: () => { key: Uint8Array } | null): void {
    this.masterKeyProvider = provider;
    console.log('[Storage] Master key provider set');

    // Also configure HNSW service if it exists and has the method
    if (this.hnswIndexService && typeof this.hnswIndexService.setMasterKeyProvider === 'function') {
      this.hnswIndexService.setMasterKeyProvider(provider);
      console.log('[Storage] HNSW master key provider configured');
    }
  }

  /**
   * Get master key for embedding encryption
   */
  private getMasterKeyForEncryption(): { key: Uint8Array } | null {
    if (!this.masterKeyProvider) {
      console.warn('[Storage] Master key provider not set');
      return null;
    }
    return this.masterKeyProvider();
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    // Open the database (Dexie handles this automatically)
    await this.db.open();

    // Initialize enrichment service if configured
    const config = await this.getEnrichmentConfig();
    logger.log('Loaded enrichment config:', JSON.stringify(config));

    const hasCredentials = config.provider === 'local'
      ? !!config.localEndpoint
      : !!config.apiKey;

    logger.log(`Checking initialization: enabled=${config.enabled}, provider=${config.provider}, hasCredentials=${hasCredentials}`);

    if (config.enabled && hasCredentials) {
      this.enrichmentService = new EnrichmentService(config);

      // Set callback to persist enriched memories to IndexedDB
      // This fixes the race condition where enrichment completes but data isn't persisted
      this.enrichmentService.onEnrichmentComplete = async (memory: MemoryWithMemA) => {
        // Skip save if in atomic mode (will save at end of full pipeline)
        if (this.enrichmentService?.isAtomicMode?.()) {
          logger.log(`[Storage] Enrichment complete for ${memory.id} (deferred save)`);
          return;
        }

        try {
          // Check if a newer version exists before persisting (avoid overwriting with stale enrichment)
          const existing = await this.db.memories.get(memory.id);
          if (existing) {
            const existingWithMemA = existing as MemoryWithMemA;
            const isNewer = this.isVersionNewer(
              memory.vectorClock || {},
              memory.timestamp,
              existingWithMemA.vectorClock || {},
              existingWithMemA.timestamp
            );

            if (!isNewer) {
              logger.log(`[Storage] Skipping persist for enriched memory ${memory.id} - existing version is newer`);
              return;
            }
          }

          await this.db.memories.put(memory);
          logger.log(`[Storage] Persisted enriched memory: ${memory.id}`);
        } catch (error) {
          logger.error(`[Storage] Failed to persist enriched memory:`, error);
        }
      };

      logger.log(`Enrichment service initialized (provider: ${config.provider})`);
    } else {
      logger.log(`Enrichment service NOT initialized: enabled=${config.enabled}, hasCredentials=${hasCredentials}`);
    }

    // Initialize link detection service if configured (Phase 2)
    if (config.enabled && config.enableLinkDetection && hasCredentials) {
      this.linkDetectionService = new LinkDetectionService(config);
      logger.log(`Link detection service initialized (provider: ${config.provider})`);
    }

    // Initialize evolution service if configured (Phase 3)
    // Evolution requires link detection, so only initialize if links are enabled
    if (config.enabled && config.enableLinkDetection && hasCredentials) {
      this.evolutionService = new EvolutionService(config);
      logger.log(`Evolution service initialized (provider: ${config.provider})`);
    }

    // Initialize HNSW vector index (Phase 4)
    // Non-blocking: If HNSW fails, extension still works with basic search
    try {
      await this.initializeHNSWIndex();
    } catch (error) {
      logger.warn('HNSW index initialization failed (non-critical):', error);
      logger.warn('Extension will work with basic search instead of vector search');
      // Continue without HNSW - basic search will still work
    }
  }

  /**
   * Close the database
   */
  async close(): Promise<void> {
    this.db.close();
  }

  /**
   * Get sync queue table (for operation-queue direct access)
   */
  getSyncQueueTable() {
    return this.db.syncQueue;
  }

  /**
   * Re-initialize enrichment services with updated config
   * Called when enrichment settings are changed in the UI
   */
  async reinitializeEnrichment(): Promise<void> {
    const config = await this.getEnrichmentConfig();
    logger.log('Re-initializing enrichment with config:', JSON.stringify(config));

    // Clear existing services
    this.enrichmentService = null;
    this.linkDetectionService = null;
    this.evolutionService = null;

    // Check credentials based on provider
    const hasCredentials = config.provider === 'local'
      ? !!config.localEndpoint
      : !!config.apiKey;

    console.log(`[Storage] Re-initialization check: enabled=${config.enabled}, provider=${config.provider}, hasCredentials=${hasCredentials}`);

    // Re-initialize enrichment service if enabled
    if (config.enabled && hasCredentials) {
      this.enrichmentService = new EnrichmentService(config);

      // Set callback to persist enriched memories to IndexedDB
      this.enrichmentService.onEnrichmentComplete = async (memory: MemoryWithMemA) => {
        // Skip save if in atomic mode (will save at end of full pipeline)
        if (this.enrichmentService?.isAtomicMode?.()) {
          console.log(`[Storage] Enrichment complete for ${memory.id} (deferred save)`);
          return;
        }

        try {
          // Check if a newer version exists before persisting (avoid overwriting with stale enrichment)
          const existing = await this.db.memories.get(memory.id);
          if (existing) {
            const existingWithMemA = existing as MemoryWithMemA;
            const isNewer = this.isVersionNewer(
              memory.vectorClock || {},
              memory.timestamp,
              existingWithMemA.vectorClock || {},
              existingWithMemA.timestamp
            );

            if (!isNewer) {
              console.log(`[Storage] Skipping persist for enriched memory ${memory.id} - existing version is newer`);
              return;
            }
          }

          await this.db.memories.put(memory);
          console.log(`[Storage] Persisted enriched memory: ${memory.id}`);
        } catch (error) {
          console.error(`[Storage] Failed to persist enriched memory:`, error);
        }
      };

      console.log(`[Storage] Enrichment service re-initialized (provider: ${config.provider})`);
    } else {
      console.log(`[Storage] Enrichment service NOT re-initialized: enabled=${config.enabled}, hasCredentials=${hasCredentials}`);
    }

    // Re-initialize link detection if enabled
    if (config.enabled && config.enableLinkDetection && hasCredentials) {
      this.linkDetectionService = new LinkDetectionService(config);
      console.log(`[Storage] Link detection service re-initialized (provider: ${config.provider})`);
    }

    // Re-initialize evolution service if enabled (Phase 3)
    if (config.enabled && config.enableLinkDetection && hasCredentials) {
      this.evolutionService = new EvolutionService(config);
      console.log(`[Storage] Evolution service re-initialized (provider: ${config.provider})`);
    }
  }

  /**
   * Initialize HNSW vector index (Phase 4)
   * Loads existing index from IndexedDB or builds new one from memories
   */
  private async initializeHNSWIndex(): Promise<void> {
    // Dynamically import HNSW service to avoid build-time edgevec dependency
    const { HNSWIndexService } = await import('./hnsw-index-service');
    this.hnswIndexService = new HNSWIndexService();

    // Configure master key provider if already set
    if (this.masterKeyProvider && typeof this.hnswIndexService.setMasterKeyProvider === 'function') {
      this.hnswIndexService.setMasterKeyProvider(this.masterKeyProvider);
      console.log('[Storage] HNSW master key provider configured during init');
    }

    // Try to load existing index from IndexedDB
    const loaded = await this.hnswIndexService.load(this.db);

    if (loaded) {
      logger.log('HNSW index loaded from IndexedDB');

      // Connect to embedding service
      const embeddingService = getEmbeddingService();
      embeddingService.setHNSWIndex(this.hnswIndexService);

      return;
    }

    // Build new index if none exists
    const memories = await this.db.memories.toArray();
    const memoriesWithEmbeddings = memories.filter(
      m => (m as MemoryWithMemA).embedding || (m as any).encryptedEmbedding
    ) as MemoryWithMemA[];

    if (memoriesWithEmbeddings.length === 0) {
      logger.log('No embeddings found, skipping HNSW build');
      return;
    }

    logger.log(`Building HNSW index for ${memoriesWithEmbeddings.length} memories...`);

    // Build index with progress reporting
    await this.hnswIndexService.build(
      memoriesWithEmbeddings,
      (current, total) => {
        if (current % 100 === 0 || current === total) {
          logger.log(`HNSW build progress: ${current}/${total}`);
        }
      }
    );

    // Persist to IndexedDB
    await this.hnswIndexService.persist(this.db);

    // Connect to embedding service
    const embeddingService = getEmbeddingService();
    embeddingService.setHNSWIndex(this.hnswIndexService);

    logger.log('HNSW index built and persisted');
  }

  /**
   * Save a memory
   * @param memory Memory object with encrypted content
   * @param plaintextContent Optional plaintext content for enrichment (not persisted)
   */
  async saveMemory(
    memory: Memory,
    plaintextContent?: { role: string; text: string; metadata?: any },
    options?: SaveMemoryOptions
  ): Promise<void> {
    const memoryWithMemA = memory as MemoryWithMemA;

    // Conflict resolution: Only save if new version is actually newer
    const existing = await this.db.memories.get(memory.id);
    if (existing) {
      const existingWithMemA = existing as MemoryWithMemA;
      const isNewer = this.isVersionNewer(
        memoryWithMemA.vectorClock || {},
        memoryWithMemA.timestamp,
        existingWithMemA.vectorClock || {},
        existingWithMemA.timestamp
      );

      if (!isNewer) {
        console.log(`[Storage] Skipping save for ${memory.id} - existing version is newer or identical`);
        return;
      }
    }

    // Determine if we should enrich
    const isTestEnv = typeof (globalThis as any).process !== 'undefined' &&
                      (globalThis as any).process.env.NODE_ENV === 'test';
    const shouldEnrich = this.enrichmentService && (!isTestEnv || this.forceEnrichmentInTests);

    // Skip initial save if requested AND enrichment will happen
    if (options?.skipInitialSave && shouldEnrich && this.enrichmentService) {
      logger.log(`[Storage] Skipping initial save for ${memory.id}, will save after enrichment`);

      // Enable atomic mode on enrichment service
      this.enrichmentService.setAtomicMode(true);

      try {
        // BLOCKING: Wait for enrichment to complete
        await this.enrichInBackground(memoryWithMemA, plaintextContent, {
          useAtomicTransaction: options.useAtomicTransaction ?? true
        });
      } catch (err) {
        logger.error('Enrichment failed, falling back to base save:', err);
        // Fallback: save base memory without enrichment
        await this.db.memories.put(memoryWithMemA);
        await this.updateConversationMetadata(memory);
        // Don't re-throw - the memory was saved successfully (just without enrichment)
      } finally {
        this.enrichmentService.setAtomicMode(false);
      }
    } else {
      // Current behavior: immediate save + background enrichment
      await this.db.memories.put(memoryWithMemA);
      await this.updateConversationMetadata(memory);

      if (shouldEnrich) {
        this.enrichInBackground(memoryWithMemA, plaintextContent).catch((err) => {
          logger.error('Background enrichment failed:', err);
        });
      }
    }
  }

  /**
   * Compare two versions using vector clocks and timestamps
   */
  private isVersionNewer(
    newClock: Record<string, number>,
    newTimestamp: number,
    oldClock: Record<string, number>,
    oldTimestamp: number
  ): boolean {
    let newIsGreater = false;
    let oldIsGreater = false;

    const allDevices = new Set([...Object.keys(newClock), ...Object.keys(oldClock)]);
    for (const device of allDevices) {
      const newVal = newClock[device] || 0;
      const oldVal = oldClock[device] || 0;
      if (newVal > oldVal) newIsGreater = true;
      if (oldVal > newVal) oldIsGreater = true;
    }

    // Strictly greater
    if (newIsGreater && !oldIsGreater) return true;
    if (oldIsGreater && !newIsGreater) return false;

    // Concurrent or identical - use timestamp as tie-breaker
    return newTimestamp > oldTimestamp;
  }

  /**
   * Get a memory by ID
   */
  async getMemory(id: UUID): Promise<Memory | null> {
    const memory = await this.db.memories.get(id);
    return memory || null;
  }

  /**
   * Get memories with filters
   */
  async getMemories(filter: MemoryFilter): Promise<Memory[]> {
    let query = this.db.memories.toCollection();

    // Apply filters
    if (filter.conversationId) {
      query = this.db.memories.where('conversationId').equals(filter.conversationId);
    } else if (filter.platform) {
      query = this.db.memories.where('platform').equals(filter.platform);
    }

    let memories = await query.toArray();

    // Apply additional filters
    if (filter.startDate) {
      memories = memories.filter((m) => m.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      memories = memories.filter((m) => m.timestamp <= filter.endDate!);
    }
    if (filter.syncStatus) {
      memories = memories.filter((m) => m.syncStatus === filter.syncStatus);
    }
    if (filter.tags && filter.tags.length > 0) {
      memories = memories.filter((m) =>
        filter.tags!.some((tag) => m.tags.includes(tag))
      );
    }

    // Sort by timestamp (newest first)
    memories.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || memories.length;
    return memories.slice(offset, offset + limit);
  }

  /**
   * Update a memory
   */
  async updateMemory(id: UUID, updates: Partial<Memory>): Promise<void> {
    await this.db.memories.update(id, updates);

    // If tags or timestamp changed, update conversation metadata
    if (updates.tags || updates.timestamp) {
      const memory = await this.getMemory(id);
      if (memory) {
        await this.updateConversationMetadata(memory);
      }
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: UUID): Promise<void> {
    const memory = await this.getMemory(id);
    if (!memory) return;

    await this.db.memories.delete(id);

    // Remove from HNSW index (Phase 4)
    if (this.hnswIndexService?.isReady()) {
      await this.hnswIndexService.remove(id);
      await this.hnswIndexService.persist(this.db);
    }

    // Update conversation metadata
    await this.updateConversationMetadata(memory);
  }

  /**
   * Save a conversation
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    await this.db.conversations.put(conversation);
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    const conversation = await this.db.conversations.get(id);
    return conversation || null;
  }

  /**
   * Get conversations with filters
   */
  async getConversations(filter: ConversationFilter): Promise<Conversation[]> {
    let query = this.db.conversations.toCollection();

    if (filter.platform) {
      query = this.db.conversations.where('platform').equals(filter.platform);
    }

    let conversations = await query.toArray();

    // Apply additional filters
    if (filter.startDate) {
      conversations = conversations.filter((c) => c.createdAt >= filter.startDate!);
    }
    if (filter.endDate) {
      conversations = conversations.filter((c) => c.createdAt <= filter.endDate!);
    }

    // Sort by last message (newest first)
    conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    // Apply pagination
    const limit = filter.limit || conversations.length;
    return conversations.slice(0, limit);
  }

  /**
   * Enqueue a sync operation
   */
  async enqueueSyncOperation(op: SyncOperation): Promise<void> {
    await this.db.syncQueue.put(op);
  }

  /**
   * Dequeue sync operations (FIFO)
   */
  async dequeueSyncOperations(limit: number): Promise<SyncOperation[]> {
    const operations = await this.db.syncQueue
      .orderBy('timestamp')
      .limit(limit)
      .toArray();

    // Remove from queue
    await Promise.all(operations.map((op) => this.db.syncQueue.delete(op.id)));

    return operations;
  }

  /**
   * Clear the sync queue
   */
  async clearSyncQueue(): Promise<void> {
    await this.db.syncQueue.clear();
  }

  /**
   * Search memories by query
   */
  async searchMemories(query: string, limit: number = 100): Promise<Memory[]> {
    const normalizedQuery = query.toLowerCase().trim();

    // 1. Try semantic search if HNSW is ready (Phase 4)
    if (this.hnswIndexService?.isReady()) {
      try {
        const embeddingService = getEmbeddingService();
        const queryVector = await embeddingService.embed(normalizedQuery);
        const results = await this.hnswIndexService.search(new Float32Array(queryVector), limit);

        if (results.length > 0) {
          const memories: Memory[] = [];
          for (const res of results) {
            const memory = await this.getMemory(res.id);
            if (memory) {
              memories.push(memory);
            }
          }
          return memories;
        }
      } catch (error) {
        logger.error('Semantic search failed, falling back to keyword search:', error);
      }
    }

    // 2. Fallback: Simple keyword search on decrypted content (expensive for large DB)
    const allMemories = await this.db.memories.toArray();

    // SECURITY: Decrypt memories for keyword search
    // This is expensive but necessary since we store content encrypted
    const decryptedMemories: Memory[] = [];
    for (const memory of allMemories) {
      // Skip if no encrypted content (shouldn't happen but be safe)
      if (!(memory as any).encryptedContent) {
        decryptedMemories.push(memory);
        continue;
      }

      // Decrypt the content
      try {
        const masterKey = this.getMasterKeyForEncryption();
        if (!masterKey) {
          // No master key, can't decrypt - but still include memory for tag search
          console.warn(`[Storage] No master key for keyword search, ${memory.id} will only match on tags`);
          decryptedMemories.push(memory);
          continue;
        }

        const crypto = await getCryptoService();
        const decryptedBytes = await crypto.decrypt((memory as any).encryptedContent, masterKey.key);
        const decryptedJson = new TextDecoder().decode(decryptedBytes);
        const decryptedData = JSON.parse(decryptedJson);

        // Create decrypted memory for searching
        decryptedMemories.push({
          ...memory,
          content: {
            role: decryptedData.role,
            text: decryptedData.text,
            metadata: decryptedData.metadata || {},
          },
        });
      } catch (error) {
        console.error(`[Storage] Failed to decrypt memory ${memory.id} for keyword search:`, error);
        // Include memory anyway (without decrypted content) so tag search still works
        decryptedMemories.push(memory);
      }
    }

    const results = decryptedMemories.filter((memory) => {
      // Note: in a real extension, we would use a proper search index
      // For now, we search on content if it's already decrypted or known
      const text = memory.content?.text?.toLowerCase() || "";
      const tags = (memory.tags || []).map((t) => t.toLowerCase());

      return (
        text.includes(normalizedQuery) ||
        tags.some((tag) => tag.includes(normalizedQuery))
      );
    });

    // Sort by relevance (simple: more occurrences = more relevant)
    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const queryRegExp = new RegExp(escapedQuery, 'g');
    results.sort((a, b) => {
      const aText = a.content?.text?.toLowerCase() || "";
      const bText = b.content?.text?.toLowerCase() || "";
      const aOccurrences = (aText.match(queryRegExp) || []).length;
      const bOccurrences = (bText.match(queryRegExp) || []).length;
      return bOccurrences - aOccurrences;
    });

    return results.slice(0, limit);
  }

  /**
   * Get HNSW index service (internal use)
   */
  getHNSWIndex(): HNSWIndexService | null {
    return this.hnswIndexService;
  }

  /**
   * Get HNSW index statistics
   */
  getHNSWStats(): HNSWStats | null {
    return this.hnswIndexService?.getStats() || null;
  }

  /**
   * Update search index for a memory
   */
  async updateSearchIndex(memoryId: UUID, tags: string[]): Promise<void> {
    // Remove memory from old tags
    const allEntries = await this.db.searchIndex.toArray();
    for (const entry of allEntries) {
      if (entry.memoryIds.includes(memoryId)) {
        entry.memoryIds = entry.memoryIds.filter((id) => id !== memoryId);
        if (entry.memoryIds.length === 0) {
          await this.db.searchIndex.delete(entry.tag);
        } else {
          await this.db.searchIndex.put(entry);
        }
      }
    }

    // Add memory to new tags
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();
      const entry = await this.db.searchIndex.get(normalizedTag);

      if (entry) {
        if (!entry.memoryIds.includes(memoryId)) {
          entry.memoryIds.push(memoryId);
          await this.db.searchIndex.put(entry);
        }
      } else {
        await this.db.searchIndex.put({
          tag: normalizedTag,
          memoryIds: [memoryId],
        });
      }
    }
  }

  /**
   * Get metadata value
   */
  async getMetadata<T>(key: string): Promise<T | null> {
    const entry = await this.db.metadata.get(key);
    return entry ? (entry.value as T) : null;
  }

  /**
   * Set metadata value
   */
  async setMetadata<T>(key: string, value: T): Promise<void> {
    await this.db.metadata.put({ key, value });
  }

  /**
   * Bulk save memories
   */
  async bulkSaveMemories(memories: Memory[]): Promise<void> {
    await this.db.memories.bulkPut(memories);

    // Update conversation metadata for all affected conversations
    const conversationIds = new Set(memories.map((m) => m.conversationId));
    for (const conversationId of conversationIds) {
      const conversationMemories = memories.filter(
        (m) => m.conversationId === conversationId
      );
      if (conversationMemories.length > 0) {
        await this.updateConversationMetadata(conversationMemories[0]);
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const totalMemories = await this.db.memories.count();
    const totalConversations = await this.db.conversations.count();
    const pendingSyncOps = await this.db.syncQueue.count();

    // Get oldest and newest memory timestamps
    const allMemories = await this.db.memories.toArray();
    const timestamps = allMemories.map((m) => m.timestamp);
    const oldestMemory = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const newestMemory = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    // Estimate storage used (rough estimate)
    const storageUsedBytes = await this.estimateStorageSize();

    return {
      totalMemories,
      totalConversations,
      storageUsedBytes,
      pendingSyncOps,
      oldestMemory,
      newestMemory,
    };
  }

  /**
   * Update conversation metadata based on memories
   */
  private async updateConversationMetadata(memory: Memory): Promise<void> {
    const conversationId = memory.conversationId;

    // Get all memories for this conversation
    const memories = await this.db.memories
      .where('conversationId')
      .equals(conversationId)
      .toArray();

    if (memories.length === 0) {
      // Delete conversation if no memories
      await this.db.conversations.delete(conversationId);
      return;
    }

    // Calculate metadata
    const timestamps = memories.map((m) => m.timestamp);
    const createdAt = Math.min(...timestamps);
    const lastMessageAt = Math.max(...timestamps);
    const messageCount = memories.length;

    // Collect all tags
    const allTags = new Set<string>();
    memories.forEach((m) => (m.tags || []).forEach((tag: string) => allTags.add(tag)));

    // Get existing conversation or create new one
    let conversation = await this.getConversation(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        platform: memory.platform,
        createdAt,
        lastMessageAt,
        messageCount,
        tags: Array.from(allTags),
      };
    } else {
      conversation.lastMessageAt = lastMessageAt;
      conversation.messageCount = messageCount;
      conversation.tags = Array.from(allTags);
    }

    await this.saveConversation(conversation);
  }

  /**
   * Estimate storage size (rough estimate)
   */
  private async estimateStorageSize(): Promise<number> {
    try {
      // Use Storage API if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }

      // Fallback: rough estimate based on data
      const memories = await this.db.memories.toArray();
      const conversations = await this.db.conversations.toArray();

      const memoriesSize = JSON.stringify(memories).length;
      const conversationsSize = JSON.stringify(conversations).length;

      return memoriesSize + conversationsSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Enrich a memory in the background (non-blocking)
   */
  private async enrichInBackground(
    memory: MemoryWithMemA,
    plaintextContent?: { role: string; text: string; metadata?: any },
    options?: { useAtomicTransaction?: boolean }
  ): Promise<void> {
    if (!this.enrichmentService) return;

    // If we have plaintext content for enrichment, create a temporary memory with it
    // Otherwise use the encrypted memory (which will fail enrichment with [ENCRYPTED] placeholder)
    const memoryForEnrichment = plaintextContent ? {
      ...memory,
      content: {
        role: plaintextContent.role as 'user' | 'assistant' | 'system',
        text: plaintextContent.text,
        metadata: plaintextContent.metadata || {},
      }
    } : memory;

    logger.log('Enriching memory with content:', memoryForEnrichment.content.text.substring(0, 100) + '...');

    // Trigger enrichment (non-blocking queue processing)
    // The onEnrichmentComplete callback will handle persistence after enrichment completes
    await this.enrichmentService.enrichMemory(memoryForEnrichment);

    // IMPORTANT: When using atomic mode, wait for enrichment to complete
    // This ensures embeddings are generated with enriched metadata (keywords, tags, context)
    // Only wait if enrichment is actually enabled
    if (options?.useAtomicTransaction && this.enrichmentService && config?.enabled) {
      try {
        console.log('[Storage] Waiting for enrichment queue to complete (atomic mode)...');
        await this.enrichmentService.waitForQueue(10000); // 10 second timeout
        console.log('[Storage] Enrichment queue complete');
      } catch (err) {
        console.error('[Storage] Enrichment queue timeout:', err);
        // Continue anyway - embeddings might not be optimal but memory will still be saved
      }
    }

    // NOTE: We don't persist here anymore because enrichment is async (queued)
    // The callback (onEnrichmentComplete) will persist after enrichment actually completes
    // This fixes the race condition where unenriched data was being persisted

    // Wait for enrichment to complete and copy enriched data to memory
    // This ensures we have keywords/tags/context for embedding generation
    if (memoryForEnrichment && this.enrichmentService) {
      try {
        // Copy enriched data from memoryForEnrichment to memory
        if ((memoryForEnrichment as MemoryWithMemA).keywords) {
          (memory as MemoryWithMemA).keywords = (memoryForEnrichment as MemoryWithMemA).keywords;
        }
        if ((memoryForEnrichment as MemoryWithMemA).tags && (memoryForEnrichment as MemoryWithMemA).tags.length > 0) {
          (memory as MemoryWithMemA).tags = (memoryForEnrichment as MemoryWithMemA).tags;
        }
        if ((memoryForEnrichment as MemoryWithMemA).context) {
          (memory as MemoryWithMemA).context = (memoryForEnrichment as MemoryWithMemA).context;
        }
        if ((memoryForEnrichment as MemoryWithMemA).memAVersion) {
          (memory as MemoryWithMemA).memAVersion = (memoryForEnrichment as MemoryWithMemA).memAVersion;
        }
        console.log(`[Storage] Copied enriched data to memory ${memory.id}`);
      } catch (err) {
        console.error(`[Storage] Failed to copy enriched data:`, err);
      }
    }

    // Regenerate embedding with enhanced metadata (keywords + context + tags)
    // Use memoryForEnrichment if available (has plaintext), otherwise use memory
    try {
      const embeddingService = getEmbeddingService();
      const memoryForEmbedding = memoryForEnrichment || memory;
      const memoryWithEmbedding = await embeddingService.regenerateEmbedding(memoryForEmbedding);

      // Copy the embedding to the memory
      if (memoryWithEmbedding.embedding) {
        // SECURITY: Encrypt embedding before storage
        const embeddingFloat32 = new Float32Array(memoryWithEmbedding.embedding);
        const embeddingBytes = new Uint8Array(embeddingFloat32.buffer);

        try {
          const masterKey = this.getMasterKeyForEncryption();

          if (masterKey) {
            // Encrypt with master key
            const crypto = await getCryptoService();
            const encryptedEmbedding = await crypto.encrypt(embeddingBytes, masterKey.key);

            (memory as any).encryptedEmbedding = encryptedEmbedding;
            (memory as any).embeddingVersion = 2;

            console.log(`[Storage] Encrypted embedding for ${memory.id}`);
          } else {
            // Fallback: store unencrypted (shouldn't happen in production)
            console.warn(`[Storage] No master key, storing unencrypted embedding for ${memory.id}`);
            (memory as any).embedding = embeddingFloat32;
            (memory as any).embeddingVersion = 1;
          }
        } catch (err) {
          console.error(`[Storage] Encryption failed for ${memory.id}:`, err);
          // Fallback to unencrypted
          (memory as any).embedding = embeddingFloat32;
          (memory as any).embeddingVersion = 1;
        }

        // Update HNSW index (Phase 4)
        if (this.hnswIndexService?.isReady()) {
          await this.hnswIndexService.update(
            memory.id,
            embeddingFloat32
          );

          // Batch persist (every 10 updates to reduce I/O)
          if (Math.random() < 0.1) {
            await this.hnswIndexService.persist(this.db);
          }
        }
      }

      console.log(`[Storage] Regenerated embedding for enriched memory ${memory.id}`);
    } catch (err) {
      // Don't fail the enrichment if embedding fails
      console.error(`[Storage] Failed to regenerate embedding for memory ${memory.id}:`, err);
    }

    // Detect semantic links (Phase 2)
    if (this.linkDetectionService) {
      try {
        const allMemories = await this.db.memories.toArray();
        const links = await this.linkDetectionService.detectLinks(memory, allMemories as any);

        // Set links on source memory
        memory.links = links as any;

        // ===== Phase 3: Memory Evolution =====
        // Check if linked memories should evolve based on this new memory
        if (this.evolutionService && links.length > 0) {
          console.log(`[Storage] Checking evolution for ${links.length} linked memories`);

          // Filter: only check top 5 high-confidence links (score > 0.8)
          const topLinks = links
            .filter(link => link.score > 0.8)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          if (topLinks.length > 0) {
            console.log(`[Storage] Checking ${topLinks.length} high-confidence links for evolution`);

            // Parallel evolution checks for performance
            await Promise.all(topLinks.map(async (link) => {
              const linkedMemory = allMemories.find(m => m.id === link.memoryId);
              if (!linkedMemory) return;

              try {
                // Check if linked memory should evolve
                const evolutionCheck = await this.evolutionService!.checkEvolution(
                  linkedMemory,
                  memory
                );

                if (evolutionCheck.shouldEvolve) {
                  // Apply evolution and update metadata
                  await this.evolutionService!.applyEvolution(
                    linkedMemory,
                    evolutionCheck,
                    memory.id
                  );

                  // Regenerate embedding for evolved memory
                  try {
                    const embeddingService = getEmbeddingService();
                    const evolved = await embeddingService.regenerateEmbedding(linkedMemory);
                    if (evolved.embedding) {
                      (linkedMemory as any).embedding = new Float32Array(evolved.embedding);

                      // Update HNSW index for evolved memory (Phase 4)
                      if (this.hnswIndexService?.isReady()) {
                        await this.hnswIndexService.update(
                          linkedMemory.id,
                          new Float32Array(evolved.embedding)
                        );
                      }
                    }
                    console.log(`[Storage] Regenerated embedding for evolved memory ${linkedMemory.id}`);
                  } catch (err) {
                    console.error(`[Storage] Failed to regenerate embedding for evolved memory:`, err);
                    // Continue even if embedding regeneration fails
                  }

                  console.log(`[Storage] Memory ${linkedMemory.id} evolved (reason: ${evolutionCheck.reason})`);
                }
              } catch (err) {
                console.error(`[Storage] Error checking evolution for memory ${link.memoryId}:`, err);
                // Continue with other evolution checks even if one fails
              }
            }));
          }
        }
        // ===== End Phase 3 Evolution =====

        // Create bidirectional links
        await this.linkDetectionService.createBidirectionalLinks(memory, links, allMemories);

        // Save all updated memories (source + targets with reverse links + evolved memories)
        await this.db.memories.bulkPut(allMemories);

        // Persist HNSW index after bulk updates (Phase 4)
        if (this.hnswIndexService?.isReady()) {
          await this.hnswIndexService.persist(this.db);
        }

        console.log(`[Storage] Created ${links.length} links for memory ${memory.id}`);
      } catch (err) {
        // Don't fail enrichment if link detection fails
        console.error(`[Storage] Failed to detect links for memory ${memory.id}:`, err);
      }
    }

    // Save updated memory with enrichment, embedding, and links
    try {
      // Check if a newer version exists before persisting (avoid overwriting with stale background work)
      const existing = await this.db.memories.get(memory.id);
      if (existing) {
        const existingWithMemA = existing as MemoryWithMemA;
        const isNewer = this.isVersionNewer(
          memory.vectorClock || {},
          memory.timestamp,
          existingWithMemA.vectorClock || {},
          existingWithMemA.timestamp
        );

        if (!isNewer) {
          console.log(`[Storage] Skipping save for enriched memory ${memory.id} - existing version is newer`);
          return;
        }
      }

      // Use atomic transaction if requested
      if (options?.useAtomicTransaction) {
        await this.db.transaction('rw', [this.db.memories, this.db.conversations, this.db.hnswIndex], async () => {
          // 1. Save fully enriched memory
          await this.db.memories.put(memory);

          // 2. Update conversation metadata (must be atomic with memory)
          await this.updateConversationMetadata(memory);

          // 3. Persist HNSW index (if ready)
          if (this.hnswIndexService?.isReady()) {
            await this.hnswIndexService.persist(this.db);
          }
        });
        console.log(`[Storage] Atomically saved enriched memory ${memory.id}`);
      } else {
        // Legacy path: separate operations
        await this.db.memories.put(memory);
        console.log(`[Storage] Enriched memory ${memory.id}`);
      }
    } catch (err: any) {
      // Ignore DatabaseClosedError (happens in tests when DB is closed mid-operation)
      if (err?.name !== 'DatabaseClosedError') {
        throw err;
      }
    }
  }

  /**
   * Get enrichment configuration from chrome.storage.local
   */
  async getEnrichmentConfig(): Promise<EnrichmentConfig> {
    try {
      const result = await chrome.storage.local.get('enrichmentConfig');
      const config = result.enrichmentConfig || {
        enabled: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
        batchSize: 5,
      };

      // Decrypt API key if present and encrypted
      // Only attempt decryption if API key exists and appears encrypted
      if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.length > 0) {
        try {
          // Check if it looks encrypted (not a plain API key)
          if (isEncrypted(config.apiKey)) {
            config.apiKey = await decryptApiKey(config.apiKey);
          }
        } catch (err) {
          // Silently handle decryption errors in tests or if crypto not available
          // In production, this would log but not break the flow
          const isTestEnv = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env.NODE_ENV === 'test';
          if (!isTestEnv) {
            logger.error('Failed to decrypt API key:', err);
          }
          // Don't clear the API key - leave it as is for backward compatibility
        }
      }

      return config;
    } catch (error) {
      // Fallback if chrome.storage not available (e.g., in tests)
      return {
        enabled: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
        batchSize: 5,
      };
    }
  }

  /**
   * Rebuild HNSW index from scratch (Phase 4)
   * Useful for recovery from corruption or manual optimization
   */
  async rebuildHNSWIndex(
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    if (!this.hnswIndexService) {
      throw new Error('HNSW index service not initialized');
    }

    logger.log('Rebuilding HNSW index...');

    const memories = await this.db.memories.toArray();
    const memoriesWithEmbeddings = memories.filter(
      m => (m as MemoryWithMemA).embedding || (m as any).encryptedEmbedding
    ) as MemoryWithMemA[];

    await this.hnswIndexService.build(memoriesWithEmbeddings, onProgress);
    await this.hnswIndexService.persist(this.db);

    logger.log('HNSW index rebuilt');
  }


}

/**
 * Global singleton instance
 */
let storageInstance: StorageService | null = null;

/**
 * Get the global StorageService instance
 */
export async function getStorageService(): Promise<StorageService> {
  if (!storageInstance) {
    storageInstance = new StorageService();
    await storageInstance.initialize();
  }
  return storageInstance;
}

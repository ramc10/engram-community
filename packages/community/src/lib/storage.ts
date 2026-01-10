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
import { HNSWIndexEntry, HNSWIndexService } from './hnsw-index-service';
import { createLogger } from './logger';

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

  constructor() {
    this.db = new EngramDatabase();
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
    this.hnswIndexService = new HNSWIndexService();

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
      m => (m as MemoryWithMemA).embedding
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
  async saveMemory(memory: Memory, plaintextContent?: { role: string; text: string; metadata?: any }): Promise<void> {
    const memoryWithMemA = memory as MemoryWithMemA;
    await this.db.memories.put(memoryWithMemA);

    // Update conversation metadata
    await this.updateConversationMetadata(memory);

    // Enrich in background (non-blocking)
    // Skip background enrichment in test environments to avoid database timing issues
    const isTestEnv = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env.NODE_ENV === 'test';
    if (this.enrichmentService && !isTestEnv) {
      this.enrichInBackground(memoryWithMemA, plaintextContent).catch((err) => {
        logger.error('Background enrichment failed:', err);
      });
    }
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
  async searchMemories(query: string): Promise<Memory[]> {
    const normalizedQuery = query.toLowerCase().trim();

    // Simple full-text search (for MVP)
    // In production, this should use encrypted search tags
    const allMemories = await this.db.memories.toArray();

    const results = allMemories.filter((memory) => {
      const text = memory.content.text.toLowerCase();
      const tags = memory.tags.map((t) => t.toLowerCase());

      return (
        text.includes(normalizedQuery) ||
        tags.some((tag) => tag.includes(normalizedQuery))
      );
    });

    // Sort by relevance (simple: more occurrences = more relevant)
    results.sort((a, b) => {
      const aOccurrences = (a.content.text.toLowerCase().match(new RegExp(normalizedQuery, 'g')) || []).length;
      const bOccurrences = (b.content.text.toLowerCase().match(new RegExp(normalizedQuery, 'g')) || []).length;
      return bOccurrences - aOccurrences;
    });

    return results.slice(0, 100); // Limit to 100 results
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
    memories.forEach((m) => m.tags.forEach((tag) => allTags.add(tag)));

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
  private async enrichInBackground(memory: MemoryWithMemA, plaintextContent?: { role: string; text: string; metadata?: any }): Promise<void> {
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
    await this.enrichmentService.enrichMemory(memoryForEnrichment);

    // Regenerate embedding with enhanced metadata (keywords + context + tags)
    try {
      const embeddingService = getEmbeddingService();
      const memoryWithEmbedding = await embeddingService.regenerateEmbedding(memory);

      // Copy the embedding to the memory
      if (memoryWithEmbedding.embedding) {
        // Convert number[] to Float32Array for storage
        (memory as any).embedding = new Float32Array(memoryWithEmbedding.embedding);

        // Update HNSW index (Phase 4)
        if (this.hnswIndexService?.isReady()) {
          await this.hnswIndexService.update(
            memory.id,
            new Float32Array(memoryWithEmbedding.embedding)
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
      await this.db.memories.put(memory);
      console.log(`[Storage] Enriched memory ${memory.id}`);
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
  private async getEnrichmentConfig(): Promise<EnrichmentConfig> {
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
      m => (m as MemoryWithMemA).embedding
    ) as MemoryWithMemA[];

    await this.hnswIndexService.build(memoriesWithEmbeddings, onProgress);
    await this.hnswIndexService.persist(this.db);

    logger.log('HNSW index rebuilt');
  }

  /**
   * Get HNSW index statistics (Phase 4)
   * Returns null if index not initialized
   */
  getHNSWStats(): { vectorCount: number; memoryUsage: number } | null {
    return this.hnswIndexService?.getStats() ?? null;
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

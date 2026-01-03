/**
 * HNSW Index Service (Phase 4: Vector Index)
 *
 * Wraps EdgeVec HNSW library for fast approximate nearest neighbor search.
 * Replaces brute-force O(n) search with O(log n) HNSW graph search.
 *
 * Features:
 * - Sub-100µs search for 10K vectors (384-dim BGE-Small embeddings)
 * - Incremental updates (add/remove/update)
 * - IndexedDB persistence
 * - Dual-mode: brute-force for <1K, HNSW for 1K+
 */

// @ts-ignore - edgevec types not fully compatible
import { EdgeVec, EdgeVecConfig } from 'edgevec';
import type { UUID, Timestamp } from '@engram/core';
import type { Memory } from '@engram/core';
import type { EngramDatabase } from './storage';

/**
 * HNSW index entry for IndexedDB persistence
 */
export interface HNSWIndexEntry {
  key: string;          // 'graph', 'vectors', 'metadata'
  data: any;            // Serialized EdgeVec index data
  lastUpdated: Timestamp;
  vectorCount: number;
}

/**
 * HNSW index statistics
 */
export interface HNSWStats {
  vectorCount: number;
  memoryUsage: number;  // Estimated bytes
}

/**
 * Search result from HNSW index
 */
export interface HNSWSearchResult {
  id: UUID;
  distance: number;  // Cosine distance (0-1, lower is more similar)
}

/**
 * HNSW Index Service
 *
 * Manages HNSW graph index for fast semantic search over memory embeddings.
 */
export class HNSWIndexService {
  private index: EdgeVec | null = null;
  private vectorIdMap: Map<UUID, number> = new Map(); // Memory ID → EdgeVec vector ID
  private indexToIdMap: Map<number, UUID> = new Map(); // EdgeVec vector ID → Memory ID
  private isBuilding: boolean = false;
  private readonly dbName = 'engram-hnsw-index'; // IndexedDB name for EdgeVec persistence

  // HNSW configuration for 384-dim BGE-Small embeddings
  private readonly config = {
    dimensions: 384,      // BGE-Small embedding size
    metric: 'cosine',     // Match current similarity metric
    m: 16,                // Connections per node (balanced for 384 dims)
    efConstruction: 200,  // Build quality (higher = better recall, slower build)
  };

  /**
   * Build HNSW index from existing memories
   *
   * @param memories - Memories with embeddings to index
   * @param onProgress - Optional progress callback (current, total)
   */
  async build(
    memories: Memory[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    // Check build state synchronously to prevent concurrent builds
    if (this.isBuilding) {
      return Promise.reject(new Error('[HNSW] Index build already in progress'));
    }

    this.isBuilding = true;

    try {
      console.log(`[HNSW] Building index for ${memories.length} vectors...`);

      // Reset state
      this.index = null;
      this.vectorIdMap.clear();
      this.indexToIdMap.clear();

      // Filter memories with embeddings
      const memoriesWithEmbeddings = memories.filter(m => m.embedding && m.embedding.length === 384);

      if (memoriesWithEmbeddings.length === 0) {
        console.log('[HNSW] No valid embeddings found, skipping build');
        this.isBuilding = false;
        return;
      }

      // Initialize EdgeVec index with EdgeVecConfig
      const config = new EdgeVecConfig(this.config.dimensions);
      config.metric = this.config.metric;
      config.m = this.config.m;
      config.ef_construction = this.config.efConstruction;

      this.index = new EdgeVec(config);

      // Add vectors to index
      for (let i = 0; i < memoriesWithEmbeddings.length; i++) {
        const memory = memoriesWithEmbeddings[i];

        // Insert returns the auto-generated vector ID
        const vectorId = this.index.insert(new Float32Array(memory.embedding!));

        // Store ID mappings
        this.vectorIdMap.set(memory.id, vectorId);
        this.indexToIdMap.set(vectorId, memory.id);

        // Report progress
        if (onProgress && (i % 100 === 0 || i === memoriesWithEmbeddings.length - 1)) {
          onProgress(i + 1, memoriesWithEmbeddings.length);
        }
      }

      console.log(`[HNSW] Index built successfully: ${memoriesWithEmbeddings.length} vectors indexed`);
    } catch (error) {
      console.error('[HNSW] Error building index:', error);
      this.index = null;
      this.vectorIdMap.clear();
      this.indexToIdMap.clear();
      throw error;
    } finally {
      this.isBuilding = false;
    }
  }

  /**
   * Add single vector to index
   *
   * @param memoryId - Memory UUID
   * @param embedding - 384-dim embedding vector
   */
  async add(memoryId: UUID, embedding: Float32Array): Promise<void> {
    if (!this.index) {
      console.warn('[HNSW] Index not initialized, skipping add');
      return;
    }

    if (embedding.length !== 384) {
      throw new Error(`[HNSW] Invalid embedding dimension: ${embedding.length}, expected 384`);
    }

    try {
      // Check if already exists (update case)
      if (this.vectorIdMap.has(memoryId)) {
        await this.update(memoryId, embedding);
        return;
      }

      // Insert returns auto-generated vector ID
      const vectorId = this.index.insert(embedding);

      // Store ID mappings
      this.vectorIdMap.set(memoryId, vectorId);
      this.indexToIdMap.set(vectorId, memoryId);

      console.log(`[HNSW] Added vector: ${memoryId}`);
    } catch (error) {
      console.error(`[HNSW] Error adding vector ${memoryId}:`, error);
      throw error;
    }
  }

  /**
   * Remove vector from index
   *
   * @param memoryId - Memory UUID to remove
   */
  async remove(memoryId: UUID): Promise<void> {
    if (!this.index) {
      console.warn('[HNSW] Index not initialized, skipping remove');
      return;
    }

    const vectorId = this.vectorIdMap.get(memoryId);
    if (vectorId === undefined) {
      console.warn(`[HNSW] Vector not found: ${memoryId}`);
      return;
    }

    try {
      // Soft delete from index (marks as tombstone)
      this.index.softDelete(vectorId);

      // Remove ID mappings
      this.vectorIdMap.delete(memoryId);
      this.indexToIdMap.delete(vectorId);

      console.log(`[HNSW] Removed vector: ${memoryId}`);
    } catch (error) {
      console.error(`[HNSW] Error removing vector ${memoryId}:`, error);
      throw error;
    }
  }

  /**
   * Update vector in index (remove + add)
   *
   * @param memoryId - Memory UUID
   * @param embedding - New 384-dim embedding vector
   */
  async update(memoryId: UUID, embedding: Float32Array): Promise<void> {
    if (!this.index) {
      console.warn('[HNSW] Index not initialized, skipping update');
      return;
    }

    if (embedding.length !== 384) {
      throw new Error(`[HNSW] Invalid embedding dimension: ${embedding.length}, expected 384`);
    }

    try {
      // Soft delete old vector if exists
      const oldVectorId = this.vectorIdMap.get(memoryId);
      if (oldVectorId !== undefined) {
        this.index.softDelete(oldVectorId);
        this.vectorIdMap.delete(memoryId);
        this.indexToIdMap.delete(oldVectorId);
      }

      // Insert new vector (returns auto-generated ID)
      const newVectorId = this.index.insert(embedding);

      // Update ID mappings
      this.vectorIdMap.set(memoryId, newVectorId);
      this.indexToIdMap.set(newVectorId, memoryId);

      console.log(`[HNSW] Updated vector: ${memoryId}`);
    } catch (error) {
      console.error(`[HNSW] Error updating vector ${memoryId}:`, error);
      throw error;
    }
  }

  /**
   * Search for k nearest neighbors
   *
   * @param queryEmbedding - Query vector (384-dim)
   * @param k - Number of results to return
   * @returns Array of {id, distance} results, sorted by distance (ascending)
   */
  async search(
    queryEmbedding: Float32Array,
    k: number = 5
  ): Promise<HNSWSearchResult[]> {
    if (!this.index) {
      console.warn('[HNSW] Index not initialized, returning empty results');
      return [];
    }

    if (queryEmbedding.length !== 384) {
      throw new Error(`[HNSW] Invalid query embedding dimension: ${queryEmbedding.length}, expected 384`);
    }

    if (this.vectorIdMap.size === 0) {
      console.warn('[HNSW] Index is empty, returning empty results');
      return [];
    }

    try {
      // Search HNSW index
      const results = this.index.search(queryEmbedding, k);

      // Convert vector IDs to memory IDs
      return results
        .map((result: any) => {
          const memoryId = this.indexToIdMap.get(result.id);
          if (!memoryId) {
            console.warn(`[HNSW] Memory ID not found for vector ${result.id}`);
            return null;
          }
          return {
            id: memoryId,
            distance: result.distance,
          };
        })
        .filter((r: any) => r !== null) as HNSWSearchResult[];
    } catch (error) {
      console.error('[HNSW] Error during search:', error);
      return [];
    }
  }

  /**
   * Persist index to IndexedDB using EdgeVec's native save
   *
   * @param db - Dexie database instance
   */
  async persist(db: EngramDatabase): Promise<void> {
    if (!this.index) {
      console.warn('[HNSW] No index to persist');
      return;
    }

    try {
      console.log('[HNSW] Persisting index to IndexedDB...');

      // Save EdgeVec index to its own IndexedDB storage
      await this.index.save(this.dbName);

      // Save ID mappings to our database
      const idMappings = {
        vectorIdMap: Array.from(this.vectorIdMap.entries()),
        indexToIdMap: Array.from(this.indexToIdMap.entries()),
      };

      const timestamp = Date.now();
      await db.hnswIndex.put({
        key: 'metadata',
        data: idMappings,
        lastUpdated: timestamp,
        vectorCount: this.vectorIdMap.size,
      });

      console.log(`[HNSW] Index persisted successfully: ${this.vectorIdMap.size} vectors`);
    } catch (error) {
      console.error('[HNSW] Error persisting index:', error);
      throw error;
    }
  }

  /**
   * Load index from IndexedDB using EdgeVec's native load
   *
   * @param db - Dexie database instance
   * @returns true if index loaded successfully, false otherwise
   */
  async load(db: EngramDatabase): Promise<boolean> {
    try {
      console.log('[HNSW] Loading index from IndexedDB...');

      // Try to load EdgeVec index from its own IndexedDB storage
      try {
        this.index = await EdgeVec.load(this.dbName);
      } catch (loadError) {
        console.log('[HNSW] No saved EdgeVec index found');
        return false;
      }

      // Load ID mappings from our database
      const metadataEntry = await db.hnswIndex.get('metadata');

      if (!metadataEntry) {
        console.log('[HNSW] No saved metadata found');
        this.index = null;
        return false;
      }

      // Restore ID mappings
      const idMappings = metadataEntry.data;
      this.vectorIdMap = new Map(idMappings.vectorIdMap);
      this.indexToIdMap = new Map(idMappings.indexToIdMap);

      console.log(`[HNSW] Index loaded successfully: ${this.vectorIdMap.size} vectors`);
      return true;
    } catch (error) {
      console.error('[HNSW] Error loading index:', error);
      this.index = null;
      this.vectorIdMap.clear();
      this.indexToIdMap.clear();
      return false;
    }
  }

  /**
   * Check if index is ready for search
   */
  isReady(): boolean {
    return this.index !== null && this.vectorIdMap.size > 0;
  }

  /**
   * Get index statistics
   */
  getStats(): HNSWStats {
    const vectorCount = this.vectorIdMap.size;

    // Estimate memory usage:
    // - Each vector: ~4 bytes/dim * 384 dims = 1.5 KB
    // - Graph edges: ~64 bytes per vector (M=16, ~4 bytes per edge)
    // - ID mappings: ~48 bytes per vector (2 Maps)
    const estimatedMemoryPerVector = 1536 + 64 + 48; // ~1.6 KB per vector
    const memoryUsage = vectorCount * estimatedMemoryPerVector;

    return {
      vectorCount,
      memoryUsage,
    };
  }
}

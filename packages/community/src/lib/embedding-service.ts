/**
 * Embedding Service
 * Uses Transformers.js to generate semantic embeddings for intelligent memory matching
 *
 * **Enhanced Embeddings (memA Phase 1):**
 * Embeddings are generated from a combination of:
 * - Original message content
 * - LLM-generated keywords
 * - User/system tags
 * - LLM-generated context
 *
 * This provides better semantic search quality by incorporating enrichment metadata.
 */

import { pipeline, type Pipeline, env } from '@xenova/transformers';
import type { Memory, MemoryWithMemA } from 'engram-shared/types/memory';

// Configure Transformers.js for Chrome service worker compatibility
// Disable threading to avoid "Atomics.wait cannot be called in this context" error
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true; // Keep SIMD for performance

/**
 * Memory with embedding
 */
export interface MemoryWithEmbedding extends Memory {
  embedding?: number[];
}

/**
 * Similarity result
 */
export interface SimilarityResult {
  memory: Memory;
  score: number;
}

/**
 * Embedding service configuration
 */
const CONFIG = {
  MODEL: 'Xenova/bge-small-en-v1.5', // 130MB, excellent for semantic search/retrieval
  SIMILARITY_THRESHOLD: 0.5, // Minimum score to consider relevant (strict for high quality)
  MAX_RESULTS: 5, // Maximum memories to inject
  DEBOUNCE_MS: 500, // Debounce time for computing embeddings
};

/**
 * Embedding Service
 * Handles semantic embedding generation and similarity computation
 */
export class EmbeddingService {
  private model: Pipeline | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private memoryEmbeddings: Map<string, number[]> = new Map();
  private hnswIndex: import('./hnsw-index-service').HNSWIndexService | null = null; // Phase 4

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.model) return;
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this._initializeModel();

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async _initializeModel(): Promise<void> {
    try {
      console.log('[Engram Embeddings] Initializing model:', CONFIG.MODEL);
      console.log('[Engram Embeddings] First load will download ~130MB model (BGE-Small)...');

      // Configure Transformers.js for Chrome extension environment
      // Use CDN for model loading (not local filesystem)
      this.model = await pipeline('feature-extraction', CONFIG.MODEL, {
        // Ensure we use the remote CDN for model loading
        revision: 'main',
        // Use default cache (browser cache API)
        cache_dir: undefined,
      });

      console.log('[Engram Embeddings] Model ready! Using BGE-Small for better semantic search.');
    } catch (error) {
      console.error('[Engram Embeddings] Failed to initialize model:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      await this.initialize();
    }

    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      // Generate embedding
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert to array
      const embedding = Array.from(output.data) as number[];
      return embedding;
    } catch (error) {
      console.error('[Engram Embeddings] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Build enhanced text for embedding generation.
   *
   * Combines multiple sources of information for better semantic search:
   * - Original message content (primary signal)
   * - LLM-generated keywords (semantic concepts)
   * - Tags (categorization)
   * - LLM-generated context (summary)
   *
   * @param memory - Memory to build text from (may have memA fields)
   * @returns Enhanced text for embedding
   *
   * @example
   * ```typescript
   * // Memory with enrichment
   * const memory = {
   *   content: { text: "How do I implement OAuth 2.0?" },
   *   keywords: ["OAuth", "authentication", "security"],
   *   tags: ["technical", "web"],
   *   context: "Question about implementing OAuth 2.0 authentication"
   * };
   *
   * const text = this.buildEnhancedText(memory);
   * // Result: "How do I implement OAuth 2.0? Keywords: OAuth authentication security. Tags: technical web. Context: Question about implementing OAuth 2.0 authentication"
   * ```
   */
  private buildEnhancedText(memory: Memory | MemoryWithMemA): string {
    const parts: string[] = [];

    // 1. Original content (most important)
    parts.push(memory.content.text);

    // 2. Add keywords if available (from enrichment)
    const memWithMemA = memory as MemoryWithMemA;
    if (memWithMemA.keywords && memWithMemA.keywords.length > 0) {
      parts.push(`Keywords: ${memWithMemA.keywords.join(' ')}`);
    }

    // 3. Add tags if available
    if (memory.tags && memory.tags.length > 0) {
      parts.push(`Tags: ${memory.tags.join(' ')}`);
    }

    // 4. Add context if available (from enrichment)
    if (memWithMemA.context) {
      parts.push(`Context: ${memWithMemA.context}`);
    }

    return parts.join('. ');
  }

  /**
   * Generate embeddings for multiple memories.
   *
   * Returns updated memories with embeddings.
   *
   * **Enhanced Embeddings:** If memories have enrichment metadata (keywords, context),
   * these are combined with the original content to produce higher-quality semantic
   * embeddings for better search relevance.
   *
   * @param memories - Memories to generate embeddings for
   * @param onProgress - Optional callback for progress updates
   * @returns Memories with embeddings attached
   */
  async embedMemories(
    memories: Memory[],
    onProgress?: (current: number, total: number) => void
  ): Promise<MemoryWithEmbedding[]> {
    console.log(`[Engram Embeddings] Generating embeddings for ${memories.length} memories...`);

    const memoriesWithEmbeddings: MemoryWithEmbedding[] = [];

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];

      // Check if we already have embedding cached
      if (this.memoryEmbeddings.has(memory.id)) {
        memoriesWithEmbeddings.push({
          ...memory,
          embedding: this.memoryEmbeddings.get(memory.id),
        });

        // Report progress for cached items too
        if (onProgress) {
          onProgress(i + 1, memories.length);
        }
        continue;
      }

      try {
        // Build enhanced text combining content + enrichment metadata
        const enhancedText = this.buildEnhancedText(memory);

        // Generate embedding for enhanced text
        const embedding = await this.embed(enhancedText);

        // Cache it
        this.memoryEmbeddings.set(memory.id, embedding);

        memoriesWithEmbeddings.push({
          ...memory,
          embedding,
        });

        // Report progress
        if (onProgress) {
          onProgress(i + 1, memories.length);
        }

        // Log progress every 10 memories
        if ((i + 1) % 10 === 0 || i === memories.length - 1) {
          console.log(`[Engram Embeddings] Progress: ${i + 1}/${memories.length}`);
        }
      } catch (error) {
        console.error(`[Engram Embeddings] Failed to embed memory ${memory.id}:`, error);
        // Add without embedding
        memoriesWithEmbeddings.push(memory);

        // Report progress even on error
        if (onProgress) {
          onProgress(i + 1, memories.length);
        }
      }
    }

    console.log('[Engram Embeddings] Embedding generation complete');
    return memoriesWithEmbeddings;
  }

  /**
   * Regenerate embedding for a single memory (e.g., after enrichment).
   *
   * This should be called after a memory is enriched with keywords/context
   * to update its embedding with the new metadata.
   *
   * @param memory - Memory to regenerate embedding for
   * @returns Updated memory with new embedding
   */
  async regenerateEmbedding(memory: Memory): Promise<MemoryWithEmbedding> {
    // Remove from cache to force regeneration
    this.memoryEmbeddings.delete(memory.id);

    // Build enhanced text
    const enhancedText = this.buildEnhancedText(memory);

    // Generate new embedding
    const embedding = await this.embed(enhancedText);

    // Cache it
    this.memoryEmbeddings.set(memory.id, embedding);

    return {
      ...memory,
      embedding,
    };
  }

  /**
   * Set HNSW index for accelerated search (Phase 4)
   */
  setHNSWIndex(index: import('./hnsw-index-service').HNSWIndexService): void {
    this.hnswIndex = index;
    console.log('[Embedding] HNSW index connected for accelerated search');
  }

  /**
   * Find similar memories to a query
   */
  async findSimilar(
    query: string,
    memories: MemoryWithEmbedding[],
    options: {
      threshold?: number;
      maxResults?: number;
    } = {}
  ): Promise<SimilarityResult[]> {
    const threshold = options.threshold ?? CONFIG.SIMILARITY_THRESHOLD;
    const maxResults = options.maxResults ?? CONFIG.MAX_RESULTS;

    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Extract keywords from query (words longer than 3 chars)
    const queryKeywords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => word.replace(/[^\w]/g, ''));

    // ===== PHASE 4: DUAL-MODE SEARCH =====
    // Choose search strategy based on memory count
    let candidates: Array<{ memory: Memory; semanticScore: number }>;

    if (this.hnswIndex?.isReady() && memories.length >= 1000) {
      // ===== HNSW ACCELERATED PATH =====
      console.log(`[Embedding] Using HNSW search for ${memories.length} memories`);

      // Get top-k candidates from HNSW (3x maxResults for reranking)
      const k = maxResults * 3;
      const hnswResults = await this.hnswIndex.search(
        new Float32Array(queryEmbedding),
        k,
        50 // efSearch
      );

      // Convert HNSW results to candidates
      candidates = hnswResults
        .map(({ id, distance }) => {
          const memory = memories.find(m => m.id === id);
          if (!memory) return null;
          return {
            memory,
            semanticScore: 1 - distance, // Convert distance to similarity
          };
        })
        .filter((c): c is { memory: Memory; semanticScore: number } => c !== null);

    } else {
      // ===== BRUTE-FORCE PATH =====
      console.log(`[Embedding] Using brute-force search for ${memories.length} memories`);

      candidates = memories
        .filter(m => m.embedding)
        .map(memory => ({
          memory,
          semanticScore: this.cosineSimilarity(queryEmbedding, memory.embedding!),
        }));
    }

    // ===== HYBRID SCORING (SAME FOR BOTH PATHS) =====
    const results = candidates.map(({ memory, semanticScore }) => {
      // Keyword matching boost
      const memoryText = memory.content.text.toLowerCase();
      const keywordMatches = queryKeywords.filter(kw => memoryText.includes(kw)).length;
      const keywordScore = queryKeywords.length > 0
        ? keywordMatches / queryKeywords.length
        : 0;

      // Hybrid score: 70% semantic + 30% keyword matching
      const hybridScore = (semanticScore * 0.7) + (keywordScore * 0.3);

      return {
        memory,
        score: hybridScore,
      };
    });

    // Filter by threshold
    const filtered = results.filter(r => r.score >= threshold);

    // Sort by score (highest first)
    filtered.sort((a, b) => b.score - a.score);

    console.log(`[Embedding] Found ${filtered.length} memories above threshold ${(threshold * 100).toFixed(0)}%`);

    // Return top N
    return filtered.slice(0, maxResults);
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.memoryEmbeddings.clear();
    console.log('[Engram Embeddings] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cachedMemories: number } {
    return {
      cachedMemories: this.memoryEmbeddings.size,
    };
  }
}

/**
 * Global singleton instance
 */
let embeddingService: EmbeddingService | null = null;

/**
 * Get the global EmbeddingService instance
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}

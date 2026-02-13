/**
 * Inverted Index Service
 *
 * Provides O(1) per-word keyword lookup for memory search fallback.
 * Replaces the O(n) brute-force scan that decrypts all memories.
 *
 * Indexes: enrichment keywords, tags, context summaries, and plaintext content
 * (when available during enrichment).
 *
 * Persisted in the existing IndexedDB `searchIndex` table.
 *
 * @see https://github.com/ramc10/engram-community/issues/78
 * @module inverted-index-service
 */

import type { UUID, MemoryWithMemA } from '@engram/core';
import { createLogger } from './logger';

const logger = createLogger('InvertedIndex');

/**
 * Common English stopwords to exclude from indexing.
 * These add noise without improving search relevance.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'were',
  'been', 'are', 'am', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'has', 'have', 'had',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'what', 'which', 'who', 'whom', 'how', 'when',
  'where', 'why', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'too',
  'very', 'just', 'about', 'above', 'after', 'again', 'also', 'any',
  'because', 'before', 'between', 'during', 'into', 'its', 'me',
  'my', 'he', 'she', 'they', 'we', 'you', 'your', 'his', 'her',
  'our', 'their', 'him', 'them', 'us', 'i', 'up', 'out', 'over',
]);

/** Minimum token length to index */
const MIN_TOKEN_LENGTH = 2;

/** Persistence key for the serialized inverted index in the searchIndex table */
const INVERTED_INDEX_KEY = '__inverted_index__';

/**
 * Entry stored in the searchIndex table for the inverted index.
 * The full index is serialized as a single entry for efficient load/save.
 */
export interface InvertedIndexEntry {
  tag: string; // INVERTED_INDEX_KEY
  memoryIds: UUID[]; // Not used directly; data is in `data`
  data?: SerializedInvertedIndex;
}

/**
 * Serialized form of the inverted index for IndexedDB persistence.
 */
interface SerializedInvertedIndex {
  /** Map from token -> array of memory IDs */
  index: Record<string, string[]>;
  /** Map from memory ID -> array of tokens */
  memoryTokens: Record<string, string[]>;
  /** Timestamp of last build/update */
  lastUpdated: number;
  /** Number of indexed memories */
  memoryCount: number;
}

/**
 * Search result from the inverted index.
 */
export interface InvertedIndexSearchResult {
  memoryId: UUID;
  /** Number of query tokens that matched */
  matchCount: number;
  /** Fraction of query tokens matched (0-1) */
  score: number;
}

/**
 * Statistics about the inverted index.
 */
export interface InvertedIndexStats {
  /** Number of unique tokens in the index */
  tokenCount: number;
  /** Number of indexed memories */
  memoryCount: number;
  /** Estimated memory usage in bytes */
  estimatedBytes: number;
  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * InvertedIndexService
 *
 * Maintains an in-memory Map-based inverted index that maps
 * normalized tokens to sets of memory IDs. Supports:
 * - Tokenization with stopword removal
 * - Incremental add/remove/update
 * - Multi-token query search with relevance scoring
 * - IndexedDB persistence via the searchIndex table
 */
export class InvertedIndexService {
  /** Token -> Set of memory IDs */
  private index: Map<string, Set<UUID>> = new Map();
  /** Memory ID -> Set of tokens (for efficient removal) */
  private memoryTokens: Map<UUID, Set<string>> = new Map();
  /** Timestamp of last update */
  private lastUpdated: number = 0;
  /** Whether the index has been loaded/built */
  private ready: boolean = false;

  /**
   * Check if the index is ready for queries.
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Tokenize text into normalized, searchable tokens.
   *
   * - Splits on whitespace and punctuation
   * - Lowercases all tokens
   * - Removes stopwords
   * - Removes tokens shorter than MIN_TOKEN_LENGTH
   */
  tokenize(text: string): string[] {
    if (!text) return [];

    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // Replace punctuation with spaces (keep hyphens)
      .split(/[\s]+/)              // Split on whitespace
      .map(t => t.replace(/^-+|-+$/g, '')) // Trim leading/trailing hyphens
      .filter(t =>
        t.length >= MIN_TOKEN_LENGTH &&
        !STOPWORDS.has(t)
      );
  }

  /**
   * Extract all indexable tokens from a memory.
   *
   * Sources:
   * - Plaintext content (when provided)
   * - Enrichment keywords
   * - Tags
   * - Context summary
   */
  extractTokens(
    memory: MemoryWithMemA,
    plaintextContent?: string
  ): string[] {
    const allTokens: string[] = [];

    // 1. Plaintext content (highest value, available during enrichment)
    if (plaintextContent) {
      allTokens.push(...this.tokenize(plaintextContent));
    }

    // 2. Enrichment keywords (already curated by LLM)
    if (memory.keywords) {
      for (const keyword of memory.keywords) {
        allTokens.push(...this.tokenize(keyword));
      }
    }

    // 3. Tags (user-added + LLM-generated)
    if (memory.tags) {
      for (const tag of memory.tags) {
        allTokens.push(...this.tokenize(tag));
      }
    }

    // 4. Context summary (LLM-generated 1-sentence summary)
    if (memory.context) {
      allTokens.push(...this.tokenize(memory.context));
    }

    // Deduplicate
    return [...new Set(allTokens)];
  }

  /**
   * Add a memory to the inverted index.
   *
   * @param memoryId The memory's UUID
   * @param memory The memory object (for keywords, tags, context)
   * @param plaintextContent Optional plaintext content for full-text indexing
   */
  addMemory(
    memoryId: UUID,
    memory: MemoryWithMemA,
    plaintextContent?: string
  ): void {
    // Remove old tokens first (handles updates)
    this.removeMemory(memoryId);

    const tokens = this.extractTokens(memory, plaintextContent);

    if (tokens.length === 0) return;

    // Store the token set for this memory
    this.memoryTokens.set(memoryId, new Set(tokens));

    // Add memory to each token's posting list
    for (const token of tokens) {
      let postingList = this.index.get(token);
      if (!postingList) {
        postingList = new Set();
        this.index.set(token, postingList);
      }
      postingList.add(memoryId);
    }

    this.lastUpdated = Date.now();
  }

  /**
   * Remove a memory from the inverted index.
   *
   * @param memoryId The memory's UUID
   */
  removeMemory(memoryId: UUID): void {
    const tokens = this.memoryTokens.get(memoryId);
    if (!tokens) return;

    // Remove memory from each token's posting list
    for (const token of tokens) {
      const postingList = this.index.get(token);
      if (postingList) {
        postingList.delete(memoryId);
        // Clean up empty posting lists
        if (postingList.size === 0) {
          this.index.delete(token);
        }
      }
    }

    // Remove the memory's token set
    this.memoryTokens.delete(memoryId);
    this.lastUpdated = Date.now();
  }

  /**
   * Search the inverted index for memories matching the query.
   *
   * Returns memories sorted by relevance (number of matching tokens).
   * Uses union semantics: a memory matches if ANY query token matches.
   *
   * @param query The search query string
   * @param limit Maximum number of results to return
   * @returns Sorted search results with match scores
   */
  search(query: string, limit: number = 100): InvertedIndexSearchResult[] {
    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0) return [];

    // Count matches per memory
    const matchCounts = new Map<UUID, number>();

    for (const token of queryTokens) {
      const postingList = this.index.get(token);
      if (postingList) {
        for (const memoryId of postingList) {
          matchCounts.set(memoryId, (matchCounts.get(memoryId) || 0) + 1);
        }
      }
    }

    // Convert to results with scores
    const results: InvertedIndexSearchResult[] = [];
    for (const [memoryId, matchCount] of matchCounts) {
      results.push({
        memoryId,
        matchCount,
        score: matchCount / queryTokens.length,
      });
    }

    // Sort by match count (descending), then by memory ID for stability
    results.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return a.memoryId.localeCompare(b.memoryId);
    });

    return results.slice(0, limit);
  }

  /**
   * Build the inverted index from a batch of memories.
   * Used during initialization when no persisted index exists.
   *
   * @param memories Array of enriched memories to index
   * @param onProgress Optional progress callback
   */
  build(
    memories: MemoryWithMemA[],
    onProgress?: (current: number, total: number) => void
  ): void {
    // Clear existing index
    this.index.clear();
    this.memoryTokens.clear();

    const total = memories.length;

    for (let i = 0; i < total; i++) {
      const memory = memories[i];
      this.addMemory(memory.id, memory);

      if (onProgress && (i % 100 === 0 || i === total - 1)) {
        onProgress(i + 1, total);
      }
    }

    this.lastUpdated = Date.now();
    this.ready = true;

    logger.log(
      `Built inverted index: ${this.index.size} tokens, ${this.memoryTokens.size} memories`
    );
  }

  /**
   * Persist the inverted index to IndexedDB via the searchIndex table.
   *
   * Serializes the entire index as a single entry for fast load.
   *
   * @param db The Dexie database instance
   */
  async persist(db: any): Promise<void> {
    try {
      const serialized: SerializedInvertedIndex = {
        index: {},
        memoryTokens: {},
        lastUpdated: this.lastUpdated,
        memoryCount: this.memoryTokens.size,
      };

      // Serialize index: Map<string, Set<UUID>> -> Record<string, string[]>
      for (const [token, memoryIds] of this.index) {
        serialized.index[token] = Array.from(memoryIds);
      }

      // Serialize memoryTokens: Map<UUID, Set<string>> -> Record<string, string[]>
      for (const [memoryId, tokens] of this.memoryTokens) {
        serialized.memoryTokens[memoryId] = Array.from(tokens);
      }

      await db.searchIndex.put({
        tag: INVERTED_INDEX_KEY,
        memoryIds: [],
        data: serialized,
      });

      logger.log(
        `Persisted inverted index: ${this.index.size} tokens, ${this.memoryTokens.size} memories`
      );
    } catch (error) {
      logger.error('Failed to persist inverted index:', error);
    }
  }

  /**
   * Load the inverted index from IndexedDB.
   *
   * @param db The Dexie database instance
   * @returns true if index was loaded successfully, false otherwise
   */
  async load(db: any): Promise<boolean> {
    try {
      const entry = await db.searchIndex.get(INVERTED_INDEX_KEY);

      if (!entry?.data) {
        logger.log('No persisted inverted index found');
        return false;
      }

      const data = entry.data as SerializedInvertedIndex;

      // Deserialize index
      this.index.clear();
      for (const [token, memoryIds] of Object.entries(data.index)) {
        this.index.set(token, new Set(memoryIds as string[]));
      }

      // Deserialize memoryTokens
      this.memoryTokens.clear();
      for (const [memoryId, tokens] of Object.entries(data.memoryTokens)) {
        this.memoryTokens.set(memoryId as UUID, new Set(tokens as string[]));
      }

      this.lastUpdated = data.lastUpdated || 0;
      this.ready = true;

      logger.log(
        `Loaded inverted index: ${this.index.size} tokens, ${this.memoryTokens.size} memories`
      );
      return true;
    } catch (error) {
      logger.error('Failed to load inverted index:', error);
      return false;
    }
  }

  /**
   * Get statistics about the inverted index.
   */
  getStats(): InvertedIndexStats {
    // Estimate memory usage:
    // ~50 bytes per token entry (token string + Set overhead)
    // ~40 bytes per memory ID reference in posting lists
    let totalPostings = 0;
    for (const postingList of this.index.values()) {
      totalPostings += postingList.size;
    }

    const estimatedBytes =
      this.index.size * 50 + // Token entries
      totalPostings * 40 +   // Posting list entries
      this.memoryTokens.size * 40; // Memory token map entries

    return {
      tokenCount: this.index.size,
      memoryCount: this.memoryTokens.size,
      estimatedBytes,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Clear the entire index (used for rebuilds or testing).
   */
  clear(): void {
    this.index.clear();
    this.memoryTokens.clear();
    this.lastUpdated = 0;
    this.ready = false;
  }
}

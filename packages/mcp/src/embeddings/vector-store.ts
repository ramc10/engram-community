/**
 * In-memory vector store for brute-force cosine similarity search
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('vector-store');

export interface SearchResult {
  id: string;
  score: number;
}

export class VectorStore {
  private embeddings: Map<string, Float32Array> = new Map();

  /**
   * Add or update an embedding
   */
  set(id: string, embedding: Float32Array): void {
    this.embeddings.set(id, embedding);
  }

  /**
   * Remove an embedding
   */
  delete(id: string): void {
    this.embeddings.delete(id);
  }

  /**
   * Get an embedding by ID
   */
  getEmbedding(id: string): Float32Array | undefined {
    return this.embeddings.get(id);
  }

  /**
   * Number of embeddings stored
   */
  size(): number {
    return this.embeddings.size;
  }

  /**
   * Search for most similar vectors using cosine similarity
   */
  search(query: Float32Array, topK: number): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [id, embedding] of this.embeddings) {
      const score = this.cosineSimilarity(query, embedding);
      results.push({ id, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Load embeddings from storage
   */
  loadFromEntries(entries: { id: string; embedding: Float32Array }[]): void {
    for (const entry of entries) {
      this.embeddings.set(entry.id, entry.embedding);
    }
    logger.info(`Loaded ${entries.length} embeddings into vector store`);
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings.clear();
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

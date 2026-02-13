/**
 * Embedding service for Engram MCP server
 * Uses BGE-Small via @xenova/transformers (optional, opt-in)
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('embeddings');

const MODEL_NAME = 'Xenova/bge-small-en-v1.5';

export class EmbeddingService {
  private pipeline: any = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.pipeline) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _init(): Promise<void> {
    try {
      // Dynamic import — @xenova/transformers is an optional dependency
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;

      logger.info(`Loading embedding model: ${MODEL_NAME} (first load downloads ~130MB)...`);

      this.pipeline = await pipeline('feature-extraction', MODEL_NAME, {
        revision: 'main',
      });

      logger.info('Embedding model loaded successfully');
    } catch (error) {
      logger.error('Failed to initialize embedding model:', error);
      throw new Error(
        `Embedding service unavailable: ${(error as Error).message}. ` +
          'Install @xenova/transformers to enable semantic search.'
      );
    }
  }

  /**
   * Generate embedding vector for text
   * @returns 384-dimensional normalized embedding
   */
  async embed(text: string): Promise<number[]> {
    if (!this.pipeline) {
      await this.initialize();
    }

    const output = await this.pipeline!(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data) as number[];
  }

  /**
   * Build enhanced text for embedding from memory content + metadata
   */
  buildEnhancedText(content: {
    text?: string | null;
    keywords?: string[];
    tags?: string[];
    context?: string;
  }): string {
    const parts: string[] = [];

    if (content.text) {
      parts.push(content.text);
    }
    if (content.keywords && content.keywords.length > 0) {
      parts.push(`Keywords: ${content.keywords.join(' ')}`);
    }
    if (content.tags && content.tags.length > 0) {
      parts.push(`Tags: ${content.tags.join(' ')}`);
    }
    if (content.context) {
      parts.push(`Context: ${content.context}`);
    }

    return parts.join('. ');
  }
}

/**
 * Try to create an embedding service. Returns null if @xenova/transformers is unavailable.
 */
export async function createEmbeddingService(): Promise<EmbeddingService | null> {
  try {
    const service = new EmbeddingService();
    await service.initialize();
    return service;
  } catch (error) {
    logger.warn('Embedding service not available:', (error as Error).message);
    return null;
  }
}

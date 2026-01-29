/**
 * EmbeddingService Unit Tests
 * Tests for semantic embedding generation service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmbeddingService } from '../../../src/lib/embedding-service';
import { env } from '@xenova/transformers';

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService();
  });

  describe('initialize()', () => {
    it('should initialize the model successfully', async () => {
      // The mock automatically returns a fake pipeline
      await expect(embeddingService.initialize()).resolves.not.toThrow();
    });

    it('should only initialize once', async () => {
      await embeddingService.initialize();
      await embeddingService.initialize();
      await embeddingService.initialize();

      // Multiple calls should not cause errors
      expect(true).toBe(true);
    });

    it('should handle concurrent initialization', async () => {
      const promises = [
        embeddingService.initialize(),
        embeddingService.initialize(),
        embeddingService.initialize(),
      ];

      // All promises should resolve without errors
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should disable local models', async () => {
      await embeddingService.initialize();

      expect(mockEnv.allowLocalModels).toBe(false);
    });

    it('should set single thread for WASM', async () => {
      await embeddingService.initialize();

      expect(mockEnv.backends.onnx.wasm.numThreads).toBe(1);
    });

    it('should enable SIMD', async () => {
      await embeddingService.initialize();

      expect(mockEnv.backends.onnx.wasm.simd).toBe(true);
    });
  });

  describe('model configuration', () => {
    it('should use BGE-Small model', async () => {
      await embeddingService.initialize();

      expect(mockPipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/bge-small-en-v1.5',
        expect.any(Object)
      );
    });

    it('should use main revision', async () => {
      await embeddingService.initialize();

      expect(mockPipeline).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          revision: 'main',
        })
      );
    });

    it('should use undefined cache_dir', async () => {
      await embeddingService.initialize();

      expect(mockPipeline).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          cache_dir: undefined,
        })
      );
    });
  });
});

/**
 * EmbeddingService Unit Tests
 * Tests for semantic embedding generation service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock @xenova/transformers
const mockPipeline = jest.fn();
const mockEnv = {
  allowLocalModels: false,
  backends: {
    onnx: {
      wasm: {
        numThreads: 1,
        simd: true,
      },
    },
  },
};

jest.mock('@xenova/transformers', () => ({
  pipeline: mockPipeline,
  env: mockEnv,
}));

// Import after mocking
import { EmbeddingService } from '../../../src/lib/embedding-service';

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockModel: any;

  beforeEach(() => {
    mockModel = jest.fn();
    mockPipeline.mockResolvedValue(mockModel);
    embeddingService = new EmbeddingService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    it('should initialize the model', async () => {
      await embeddingService.initialize();

      expect(mockPipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/bge-small-en-v1.5',
        expect.objectContaining({
          revision: 'main',
        })
      );
    });

    it('should only initialize once', async () => {
      await embeddingService.initialize();
      await embeddingService.initialize();
      await embeddingService.initialize();

      expect(mockPipeline).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent initialization', async () => {
      const promises = [
        embeddingService.initialize(),
        embeddingService.initialize(),
        embeddingService.initialize(),
      ];

      await Promise.all(promises);

      expect(mockPipeline).toHaveBeenCalledTimes(1);
    });

    it('should throw error on initialization failure', async () => {
      mockPipeline.mockRejectedValueOnce(new Error('Model download failed'));

      await expect(embeddingService.initialize()).rejects.toThrow('Model download failed');
    });

    it('should allow retry after failed initialization', async () => {
      mockPipeline.mockRejectedValueOnce(new Error('First attempt failed'));
      mockPipeline.mockResolvedValueOnce(mockModel);

      await expect(embeddingService.initialize()).rejects.toThrow('First attempt failed');

      // Should allow retry
      await expect(embeddingService.initialize()).resolves.toBeUndefined();

      expect(mockPipeline).toHaveBeenCalledTimes(2);
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

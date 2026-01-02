/**
 * Mock for @xenova/transformers
 * Used in Jest tests to avoid loading the full 130MB model
 */

export interface Pipeline {
  (text: string, options?: any): Promise<{ data: number[] }>;
}

/**
 * Mock pipeline function
 * Returns a mock embedding vector instead of loading the actual model
 */
export async function pipeline(
  task: string,
  model: string,
  options?: any
): Promise<Pipeline> {
  // Return a mock pipeline that generates fake embeddings
  return async (text: string, pipelineOptions?: any) => {
    // Generate a deterministic but fake embedding based on text length
    // BGE-Small uses 384 dimensions
    const embedding = new Array(384).fill(0).map((_, i) => {
      // Use text length and index to create a pseudo-random but deterministic value
      return Math.sin(text.length + i) * 0.5;
    });

    return {
      data: embedding,
    };
  };
}

/**
 * Mock env object for Transformers.js configuration
 */
export const env = {
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

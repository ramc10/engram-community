/**
 * Mock for EdgeVec HNSW library
 */

/**
 * Mock init function for WASM initialization
 */
export async function init(): Promise<void> {
  // Mock init - no-op
  return Promise.resolve();
}

export class EdgeVecConfig {
  dimensions: number;
  metric: string = 'cosine';
  m: number = 16;
  ef_construction: number = 200;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }
}

export class EdgeVec {
  private config: EdgeVecConfig;
  private vectors: Map<number, Float32Array> = new Map();
  private nextId: number = 0;

  constructor(config: EdgeVecConfig) {
    this.config = config;
  }

  insert(vector: Float32Array): number {
    const id = this.nextId++;
    this.vectors.set(id, vector);
    return id;
  }

  softDelete(id: number): void {
    this.vectors.delete(id);
  }

  search(query: Float32Array, k: number): Array<{ id: number; distance: number }> {
    // Simple mock: return first k vectors with random distances
    const results: Array<{ id: number; distance: number }> = [];
    let count = 0;
    for (const [id] of this.vectors) {
      if (count >= k) break;
      results.push({ id, distance: Math.random() });
      count++;
    }
    return results.sort((a, b) => a.distance - b.distance);
  }

  async save(dbName: string): Promise<void> {
    // Mock save - no-op
  }

  static async load(dbName: string): Promise<EdgeVec> {
    // Mock load - throw error to simulate no saved index
    throw new Error('No saved index found');
  }
}

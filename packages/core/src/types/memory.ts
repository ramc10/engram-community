/**
 * Core memory type definitions
 * MIT Licensed - Can be used in any project
 */

export type UUID = string;
export type Platform = 'chatgpt' | 'claude' | 'perplexity';
export type Tier = 'FREE' | 'PRO' | 'ENTERPRISE';

/**
 * Base memory structure
 */
export interface Memory {
  id: UUID;
  content: string;
  platform: Platform;
  timestamp: number;
  embedding?: Float32Array;
  metadata?: {
    model?: string;
    tokens?: number;
    [key: string]: any;
  };
}

/**
 * Memory with memA enrichment metadata
 */
export interface EnrichedMemory extends Memory {
  memA?: MemAMetadata;
}

/**
 * memA metadata structure
 */
export interface MemAMetadata {
  keywords?: string[];
  tags?: string[];
  context?: string;
  links?: LinkScore[];
  evolutionHistory?: Evolution[];
  enrichedAt?: number;
  enrichedBy?: 'user' | 'premium';
}

/**
 * Link score between memories
 */
export interface LinkScore {
  targetId: UUID;
  confidence: number;
  reason: string;
  createdAt: number;
}

/**
 * Evolution history entry
 */
export interface Evolution {
  keywords: string[];
  tags: string[];
  context: string;
  timestamp: number;
  triggeredBy: UUID;
}

/**
 * Memory filter options
 */
export interface MemoryFilter {
  platform?: Platform | Platform[];
  startDate?: number;
  endDate?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  memory: EnrichedMemory;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

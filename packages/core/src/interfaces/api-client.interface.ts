/**
 * Premium API Client Interface
 * Defines contract between extension and premium API server
 */

import { Memory, EnrichedMemory, LinkScore, UUID, Tier } from '../types/memory';

/**
 * API client configuration
 */
export interface APIClientConfig {
  apiUrl: string;
  token: string;
  timeout?: number;
}

/**
 * Enrichment request/response
 */
export interface EnrichRequest {
  memory: Memory;
}

export interface EnrichResponse {
  keywords: string[];
  tags: string[];
  context: string;
  cost: number;
  processingTime: number;
}

/**
 * Link detection request/response
 */
export interface LinkDetectionRequest {
  memory: Memory;
  candidates: Array<{
    id: UUID;
    content: string;
    embedding?: number[];
  }>;
  maxLinks?: number;
}

export interface LinkDetectionResponse {
  links: LinkScore[];
  cost: number;
  processingTime: number;
}

/**
 * Evolution check request/response
 */
export interface EvolutionCheckRequest {
  oldMemory: EnrichedMemory;
  newMemory: Memory;
}

export interface EvolutionCheckResponse {
  shouldEvolve: boolean;
  newKeywords?: string[];
  newTags?: string[];
  newContext?: string;
  reason: string;
  cost: number;
  processingTime: number;
}

/**
 * Authentication request/response
 */
export interface LoginRequest {
  licenseKey: string;
}

export interface LoginResponse {
  token: string;
  tier: Tier;
  expiresAt: string;
}

export interface TokenInfo {
  valid: boolean;
  userId: string;
  tier: Tier;
  expiresAt: string;
}

/**
 * API Error
 */
export interface APIError {
  error: string;
  statusCode: number;
  endpoint: string;
  details?: any;
}

/**
 * Premium API Client Interface
 */
export interface IPremiumAPIClient {
  // Authentication
  login(licenseKey: string): Promise<LoginResponse>;
  verifyToken(): Promise<TokenInfo>;

  // Premium features
  enrichMemory(request: EnrichRequest): Promise<EnrichResponse>;
  detectLinks(request: LinkDetectionRequest): Promise<LinkDetectionResponse>;
  checkEvolution(request: EvolutionCheckRequest): Promise<EvolutionCheckResponse>;

  // Health check
  ping(): Promise<{ status: 'ok'; timestamp: number }>;
}

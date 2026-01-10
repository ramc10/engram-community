/**
 * Test fixtures for Premium API responses
 * Provides factory functions for creating mock API responses
 */

import { UUID } from '@engram/core';
import { generateTestUUID } from './memories';

/**
 * Premium API authentication response
 */
export function createAuthResponse(overrides: any = {}) {
  return {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImxpY2Vuc2UiOiJQUk8iLCJpYXQiOjE3MDAwMDAwMDB9.test-signature',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
    license: {
      key: 'ENGRAM-TEST-KEY1-KEY2-KEY3',
      tier: 'PRO',
      rateLimit: 500,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    },
    ...overrides,
  };
}

/**
 * Premium API enrichment response
 */
export function createEnrichmentResponse(overrides: any = {}) {
  return {
    keywords: [
      'technology',
      'artificial intelligence',
      'machine learning',
      'neural networks',
      'deep learning',
    ],
    tags: ['AI', 'tech', 'development', 'machine-learning'],
    context:
      'Discussion about artificial intelligence and machine learning technologies, focusing on neural networks and deep learning applications in modern software development.',
    cost: 0.0001,
    tokens: 150,
    modelUsed: 'gpt-4o-mini',
    processingTime: 245,
    ...overrides,
  };
}

/**
 * Premium API link detection response
 */
export function createLinkDetectionResponse(memoryIds: UUID[] = [], overrides: any = {}) {
  const defaultLinks = memoryIds.map((memoryId, index) => ({
    memoryId,
    confidence: 0.85 + Math.random() * 0.15, // 0.85-1.0
    relationship: ['follows_from', 'contradicts', 'expands', 'summarizes'][index % 4],
    reason: `This memory ${['builds upon', 'contradicts', 'provides more detail about', 'summarizes'][index % 4]} the linked memory`,
  }));

  return {
    links: defaultLinks,
    processingTime: 180,
    candidatesAnalyzed: memoryIds.length,
    ...overrides,
  };
}

/**
 * Premium API evolution check response
 */
export function createEvolutionCheckResponse(overrides: any = {}) {
  return {
    shouldEvolve: true,
    reason: 'New information provides additional context and expands understanding',
    updatedKeywords: ['updated', 'evolved', 'enhanced', 'refined'],
    updatedTags: ['evolution', 'updated-knowledge'],
    updatedContext:
      'Enhanced context incorporating new information from related memories, providing deeper understanding of the topic.',
    changeType: 'expansion',
    confidence: 0.92,
    ...overrides,
  };
}

/**
 * Rate limit error response
 */
export function createRateLimitError(overrides: any = {}) {
  return {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'You have exceeded your rate limit of 500 requests per hour',
    retryAfter: 60,
    limit: 500,
    remaining: 0,
    reset: Date.now() + 3600000, // 1 hour from now
    tier: 'PRO',
    ...overrides,
  };
}

/**
 * Authentication error response
 */
export function createAuthError(overrides: any = {}) {
  return {
    error: 'Authentication failed',
    code: 'AUTH_FAILED',
    message: 'Invalid license key or expired license',
    ...overrides,
  };
}

/**
 * Invalid license key error
 */
export function createInvalidLicenseError() {
  return createAuthError({
    code: 'INVALID_LICENSE_KEY',
    message: 'The provided license key is invalid',
  });
}

/**
 * Expired license error
 */
export function createExpiredLicenseError() {
  return createAuthError({
    code: 'LICENSE_EXPIRED',
    message: 'Your license has expired. Please renew to continue using Premium features.',
  });
}

/**
 * Server error response (5xx)
 */
export function createServerError(overrides: any = {}) {
  return {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
    requestId: generateTestUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * License tier information
 */
export function createLicenseTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE' = 'PRO') {
  const tierConfig = {
    FREE: {
      tier: 'FREE' as const,
      rateLimit: 10,
      features: ['basic-enrichment'],
      price: 0,
    },
    PRO: {
      tier: 'PRO' as const,
      rateLimit: 500,
      features: ['advanced-enrichment', 'link-detection', 'memory-evolution'],
      price: 9.99,
    },
    ENTERPRISE: {
      tier: 'ENTERPRISE' as const,
      rateLimit: 1000,
      features: [
        'advanced-enrichment',
        'link-detection',
        'memory-evolution',
        'priority-support',
        'custom-models',
      ],
      price: 49.99,
    },
  };

  return tierConfig[tier];
}

/**
 * Usage statistics response
 */
export function createUsageStats(overrides: any = {}) {
  return {
    period: 'current_hour',
    requestsMade: 42,
    requestsLimit: 500,
    requestsRemaining: 458,
    resetAt: new Date(Date.now() + 3600000).toISOString(),
    costAccrued: 0.0042,
    tokensUsed: 6300,
    ...overrides,
  };
}

/**
 * Batch enrichment response
 */
export function createBatchEnrichmentResponse(count: number, overrides: any = {}) {
  return {
    results: Array.from({ length: count }, (_, i) =>
      createEnrichmentResponse({
        memoryId: `memory-${i}`,
      })
    ),
    totalCost: 0.0001 * count,
    totalTokens: 150 * count,
    processingTime: 245 * count,
    batchSize: count,
    ...overrides,
  };
}

/**
 * Premium API health check response
 */
export function createHealthCheckResponse(overrides: any = {}) {
  return {
    status: 'healthy',
    version: '1.0.0',
    uptime: 123456,
    services: {
      database: 'healthy',
      llm: 'healthy',
      cache: 'healthy',
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a successful API response wrapper
 */
export function createSuccessResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  };
}

/**
 * Create an error API response wrapper
 */
export function createErrorResponse(error: any, status = 400) {
  return {
    ok: false,
    status,
    json: async () => error,
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  };
}

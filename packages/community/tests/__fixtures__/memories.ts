/**
 * Test fixtures for Memory objects
 * Provides factory functions to create consistent test data
 */

import { Memory, MemoryWithMemA, UUID } from '@engram/core';

/**
 * Generate a simple UUID for testing
 */
export function generateTestUUID(): UUID {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as UUID;
}

/**
 * Options for creating test memories
 */
export interface MemoryFactoryOptions {
  id?: UUID;
  conversationId?: UUID;
  platform?: 'chatgpt' | 'claude' | 'perplexity';
  content?: { role: string; text: string; metadata?: any };
  encrypted?: boolean;
  enriched?: boolean;
  withLinks?: boolean;
  withEvolution?: boolean;
  timestamp?: number;
  deviceId?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
  tags?: string[];
}

/**
 * Create a mock encrypted blob
 */
function createMockEncryptedBlob(plaintext: string) {
  return {
    version: 1,
    algorithm: 'XChaCha20-Poly1305' as const,
    nonce: btoa('test-nonce-' + Math.random().toString(36)),
    ciphertext: btoa(plaintext),
  };
}

/**
 * Create a basic memory object for testing
 */
export function createMemory(options: MemoryFactoryOptions = {}): Memory {
  const {
    id = generateTestUUID(),
    conversationId = generateTestUUID(),
    platform = 'chatgpt',
    content = { role: 'user', text: 'Test message content' },
    encrypted = true,
    timestamp = Date.now(),
    deviceId = 'test-device-1',
    syncStatus = 'pending',
    tags = [],
  } = options;

  const memory: Memory = {
    id,
    conversationId,
    platform,
    content: encrypted
      ? { role: content.role, text: '[ENCRYPTED]', metadata: {} }
      : { role: content.role, text: content.text, metadata: content.metadata || {} },
    timestamp,
    vectorClock: { [deviceId]: 1 },
    deviceId,
    syncStatus,
    tags,
  };

  // Add encrypted content if encrypted
  if (encrypted) {
    (memory as any).encryptedContent = createMockEncryptedBlob(
      JSON.stringify({
        role: content.role,
        text: content.text,
        metadata: content.metadata || {},
      })
    );
  }

  return memory;
}

/**
 * Create an enriched memory with LLM-generated metadata
 */
export function createEnrichedMemory(options: MemoryFactoryOptions = {}): MemoryWithMemA {
  const memory = createMemory(options);
  const { enriched = true } = options;

  const enrichedMemory: MemoryWithMemA = {
    ...memory,
    memAVersion: 1,
  };

  if (enriched) {
    enrichedMemory.keywords = ['test', 'memory', 'keyword', 'example'];
    enrichedMemory.tags = ['testing', 'unit-test', 'example'];
    enrichedMemory.context = 'This is a test memory created for unit testing purposes. It contains example data for validating memory storage and retrieval.';
    enrichedMemory.embedding = new Float32Array(384).map(() => Math.random());
  }

  return enrichedMemory;
}

/**
 * Create a memory with semantic links to other memories
 */
export function createMemoryWithLinks(
  options: MemoryFactoryOptions = {},
  linkedMemoryIds: UUID[] = []
): MemoryWithMemA {
  const memory = createEnrichedMemory(options);

  memory.links = linkedMemoryIds.map((targetId, index) => ({
    memoryId: targetId,
    score: 0.8 + Math.random() * 0.2, // Score between 0.8 and 1.0
    createdAt: Date.now() - index * 1000,
  }));

  return memory;
}

/**
 * Create a memory with evolution history
 */
export function createMemoryWithEvolution(options: MemoryFactoryOptions = {}): MemoryWithMemA {
  const memory = createEnrichedMemory(options);

  memory.evolution = {
    history: [
      {
        version: 0,
        timestamp: memory.timestamp - 86400000, // 1 day ago
        keywords: ['old', 'keyword'],
        tags: ['old-tag'],
        context: 'Original context before evolution',
        triggeredBy: generateTestUUID(),
        reason: 'Initial creation',
      },
      {
        version: 1,
        timestamp: memory.timestamp,
        keywords: memory.keywords || [],
        tags: memory.tags || [],
        context: memory.context || '',
        triggeredBy: generateTestUUID(),
        reason: 'Updated with new information from related memory',
      },
    ],
  };

  return memory;
}

/**
 * Create a batch of memories for testing
 */
export function createMemoryBatch(
  count: number,
  options: MemoryFactoryOptions = {}
): Memory[] {
  return Array.from({ length: count }, (_, i) =>
    createMemory({
      ...options,
      id: `${options.id || 'mem'}-${i}` as UUID,
      timestamp: (options.timestamp || Date.now()) + i * 1000,
    })
  );
}

/**
 * Create a batch of enriched memories
 */
export function createEnrichedMemoryBatch(
  count: number,
  options: MemoryFactoryOptions = {}
): MemoryWithMemA[] {
  return Array.from({ length: count }, (_, i) =>
    createEnrichedMemory({
      ...options,
      id: `${options.id || 'mem'}-${i}` as UUID,
      timestamp: (options.timestamp || Date.now()) + i * 1000,
    })
  );
}

/**
 * Create a conversation-specific batch of memories
 */
export function createConversationMemories(
  conversationId: UUID,
  count: number,
  options: Omit<MemoryFactoryOptions, 'conversationId'> = {}
): Memory[] {
  return createMemoryBatch(count, { ...options, conversationId });
}

/**
 * Create memory with specific platform
 */
export function createChatGPTMemory(options: Omit<MemoryFactoryOptions, 'platform'> = {}): Memory {
  return createMemory({ ...options, platform: 'chatgpt' });
}

export function createClaudeMemory(options: Omit<MemoryFactoryOptions, 'platform'> = {}): Memory {
  return createMemory({ ...options, platform: 'claude' });
}

export function createPerplexityMemory(options: Omit<MemoryFactoryOptions, 'platform'> = {}): Memory {
  return createMemory({ ...options, platform: 'perplexity' });
}

/**
 * Test fixtures for memories and conversations
 */

import type { Memory, Conversation, MemoryWithMemA } from '@engram/core';

export const TEST_DEVICE_ID = 'test-device-001';

export function createTestMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 10)}`,
    content: {
      role: 'user',
      text: 'How do I implement OAuth 2.0 in Node.js?',
    },
    conversationId: 'conv-001',
    platform: 'chatgpt',
    timestamp: Date.now(),
    vectorClock: { [TEST_DEVICE_ID]: 1 },
    deviceId: TEST_DEVICE_ID,
    syncStatus: 'pending',
    tags: ['authentication', 'nodejs'],
    ...overrides,
  };
}

export function createTestMemoryWithMemA(
  overrides: Partial<MemoryWithMemA> = {}
): MemoryWithMemA {
  return {
    ...createTestMemory(),
    keywords: ['OAuth', 'authentication', 'Node.js'],
    context: 'Question about implementing OAuth 2.0 authentication in Node.js',
    memAVersion: 1,
    ...overrides,
  };
}

export function createTestConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-001',
    platform: 'chatgpt',
    title: 'OAuth Implementation Discussion',
    createdAt: Date.now() - 3600000,
    lastMessageAt: Date.now(),
    messageCount: 5,
    tags: [],
    ...overrides,
  };
}

export function createTestMemories(count: number): Memory[] {
  const platforms = ['chatgpt', 'claude', 'perplexity', 'gemini'] as const;
  const roles = ['user', 'assistant'] as const;

  return Array.from({ length: count }, (_, i) => ({
    id: `mem-${i.toString().padStart(4, '0')}`,
    content: {
      role: roles[i % 2],
      text: `Test message ${i}: This is a test conversation about topic ${Math.floor(i / 2)}`,
    },
    conversationId: `conv-${Math.floor(i / 4).toString().padStart(3, '0')}`,
    platform: platforms[i % 4],
    timestamp: Date.now() - (count - i) * 60000,
    vectorClock: { [TEST_DEVICE_ID]: i + 1 },
    deviceId: TEST_DEVICE_ID,
    syncStatus: 'pending' as const,
    tags: i % 3 === 0 ? ['important'] : [],
  }));
}

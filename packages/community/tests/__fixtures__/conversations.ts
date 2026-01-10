/**
 * Test fixtures for Conversation objects
 * Provides factory functions for creating test conversations
 */

import { Conversation, UUID } from '@engram/core';
import { generateTestUUID } from './memories';

/**
 * Options for creating test conversations
 */
export interface ConversationFactoryOptions {
  id?: UUID;
  platform?: 'chatgpt' | 'claude' | 'perplexity';
  createdAt?: number;
  lastMessageAt?: number;
  messageCount?: number;
  tags?: string[];
}

/**
 * Create a test conversation
 */
export function createConversation(options: ConversationFactoryOptions = {}): Conversation {
  const {
    id = generateTestUUID(),
    platform = 'chatgpt',
    createdAt = Date.now() - 86400000, // 1 day ago
    lastMessageAt = Date.now(),
    messageCount = 10,
    tags = ['test', 'conversation'],
  } = options;

  return {
    id,
    platform,
    createdAt,
    lastMessageAt,
    messageCount,
    tags,
  };
}

/**
 * Create a ChatGPT conversation
 */
export function createChatGPTConversation(
  options: Omit<ConversationFactoryOptions, 'platform'> = {}
): Conversation {
  return createConversation({ ...options, platform: 'chatgpt' });
}

/**
 * Create a Claude conversation
 */
export function createClaudeConversation(
  options: Omit<ConversationFactoryOptions, 'platform'> = {}
): Conversation {
  return createConversation({ ...options, platform: 'claude' });
}

/**
 * Create a Perplexity conversation
 */
export function createPerplexityConversation(
  options: Omit<ConversationFactoryOptions, 'platform'> = {}
): Conversation {
  return createConversation({ ...options, platform: 'perplexity' });
}

/**
 * Create a batch of conversations
 */
export function createConversationBatch(
  count: number,
  options: ConversationFactoryOptions = {}
): Conversation[] {
  return Array.from({ length: count }, (_, i) => {
    const baseTime = options.createdAt || Date.now() - 86400000 * (count - i);
    return createConversation({
      ...options,
      id: `${options.id || 'conv'}-${i}` as UUID,
      createdAt: baseTime,
      lastMessageAt: baseTime + 3600000 * i, // Spread out over hours
      messageCount: (options.messageCount || 5) + i,
    });
  });
}

/**
 * Create an active conversation (recent messages)
 */
export function createActiveConversation(options: ConversationFactoryOptions = {}): Conversation {
  return createConversation({
    ...options,
    createdAt: Date.now() - 3600000, // 1 hour ago
    lastMessageAt: Date.now() - 60000, // 1 minute ago
    messageCount: 25,
  });
}

/**
 * Create an old conversation (no recent activity)
 */
export function createOldConversation(options: ConversationFactoryOptions = {}): Conversation {
  return createConversation({
    ...options,
    createdAt: Date.now() - 30 * 86400000, // 30 days ago
    lastMessageAt: Date.now() - 29 * 86400000, // 29 days ago
    messageCount: 5,
  });
}

/**
 * Create conversation with specific tags
 */
export function createTaggedConversation(
  tags: string[],
  options: Omit<ConversationFactoryOptions, 'tags'> = {}
): Conversation {
  return createConversation({ ...options, tags });
}

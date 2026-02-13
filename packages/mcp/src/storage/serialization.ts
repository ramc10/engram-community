/**
 * Serialization helpers for converting between @engram/core types and SQLite rows
 */

import type {
  Memory,
  MemoryWithMemA,
  Conversation,
  Platform,
  Role,
  SyncStatus,
  VectorClock,
  MessageMetadata,
  LinkScore,
  EvolutionMetadata,
} from '@engram/core';

/**
 * SQLite row representation of a Memory
 */
export interface MemoryRow {
  id: string;
  conversation_id: string;
  platform: string;
  content_role: string;
  content_text: string | null;
  content_metadata: string | null;
  encrypted_content: string | null;
  timestamp: number;
  vector_clock: string;
  device_id: string;
  sync_status: string;
  tags: string;
  keywords: string | null;
  context: string | null;
  links: string | null;
  evolution: string | null;
  mema_version: number | null;
  embedding: Buffer | null;
  embedding_version: number | null;
  created_at: number;
}

/**
 * SQLite row representation of a Conversation
 */
export interface ConversationRow {
  id: string;
  platform: string;
  title: string | null;
  created_at: number;
  last_message_at: number;
  message_count: number;
  tags: string;
}

/**
 * Convert a Memory object to a SQLite row
 */
export function memoryToRow(memory: Memory, deviceId: string): Omit<MemoryRow, 'created_at'> {
  const memA = memory as MemoryWithMemA;

  return {
    id: memory.id,
    conversation_id: memory.conversationId,
    platform: memory.platform,
    content_role: memory.content.role,
    content_text: memory.content.text,
    content_metadata: memory.content.metadata
      ? JSON.stringify(memory.content.metadata)
      : null,
    encrypted_content: memory.encrypted
      ? JSON.stringify({
          algorithm: memory.encrypted.algorithm,
          nonce: Buffer.from(memory.encrypted.nonce).toString('base64'),
          ciphertext: Buffer.from(memory.encrypted.ciphertext).toString('base64'),
        })
      : null,
    timestamp: memory.timestamp,
    vector_clock: JSON.stringify(memory.vectorClock),
    device_id: memory.deviceId || deviceId,
    sync_status: memory.syncStatus,
    tags: JSON.stringify(memory.tags),
    keywords: memA.keywords ? JSON.stringify(memA.keywords) : null,
    context: memA.context || null,
    links: memA.links ? JSON.stringify(memA.links) : null,
    evolution: memA.evolution ? JSON.stringify(memA.evolution) : null,
    mema_version: memA.memAVersion || null,
    embedding: memA.embedding
      ? Buffer.from(memA.embedding.buffer)
      : null,
    embedding_version: memA.embeddingVersion || null,
  };
}

/**
 * Convert a SQLite row to a Memory object
 */
export function rowToMemory(row: MemoryRow): MemoryWithMemA {
  const memory: MemoryWithMemA = {
    id: row.id,
    content: {
      role: row.content_role as Role,
      text: row.content_text,
      metadata: row.content_metadata
        ? (JSON.parse(row.content_metadata) as MessageMetadata)
        : undefined,
    },
    conversationId: row.conversation_id,
    platform: row.platform as Platform,
    timestamp: row.timestamp,
    vectorClock: JSON.parse(row.vector_clock) as VectorClock,
    deviceId: row.device_id,
    syncStatus: row.sync_status as SyncStatus,
    tags: JSON.parse(row.tags) as string[],
  };

  if (row.encrypted_content) {
    const enc = JSON.parse(row.encrypted_content);
    memory.encrypted = {
      algorithm: enc.algorithm,
      nonce: new Uint8Array(Buffer.from(enc.nonce, 'base64')),
      ciphertext: new Uint8Array(Buffer.from(enc.ciphertext, 'base64')),
    };
  }

  if (row.keywords) {
    memory.keywords = JSON.parse(row.keywords) as string[];
  }
  if (row.context) {
    memory.context = row.context;
  }
  if (row.links) {
    memory.links = JSON.parse(row.links) as LinkScore[];
  }
  if (row.evolution) {
    memory.evolution = JSON.parse(row.evolution) as EvolutionMetadata;
  }
  if (row.mema_version != null) {
    memory.memAVersion = row.mema_version;
  }
  if (row.embedding) {
    memory.embedding = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4
    );
  }
  if (row.embedding_version != null) {
    memory.embeddingVersion = row.embedding_version as 1 | 2;
  }

  return memory;
}

/**
 * Convert a Conversation object to a SQLite row
 */
export function conversationToRow(conversation: Conversation): ConversationRow {
  return {
    id: conversation.id,
    platform: conversation.platform,
    title: conversation.title || null,
    created_at: conversation.createdAt,
    last_message_at: conversation.lastMessageAt,
    message_count: conversation.messageCount,
    tags: JSON.stringify(conversation.tags),
  };
}

/**
 * Convert a SQLite row to a Conversation object
 */
export function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    platform: row.platform as Platform,
    title: row.title || undefined,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    messageCount: row.message_count,
    tags: JSON.parse(row.tags) as string[],
  };
}

/**
 * SQLite storage implementation for Engram MCP server
 * Implements the IStorage interface from @engram/core using better-sqlite3
 */

import Database from 'better-sqlite3';
import type {
  Memory,
  MemoryWithMemA,
  Conversation,
  SyncOperation,
  UUID,
  Timestamp,
  MemoryFilter,
  ConversationFilter,
  StorageStats,
  IStorage,
} from '@engram/core';
import { SCHEMA_V1, CURRENT_SCHEMA_VERSION } from './schema';
import {
  memoryToRow,
  rowToMemory,
  conversationToRow,
  rowToConversation,
  type MemoryRow,
  type ConversationRow,
} from './serialization';
import { createLogger } from '../utils/logger';

const logger = createLogger('storage');

export class SQLiteStorage implements IStorage {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly deviceId: string;
  private readonly readonly: boolean;

  constructor(dbPath: string, deviceId: string, readonly = false) {
    this.dbPath = dbPath;
    this.deviceId = deviceId;
    this.readonly = readonly;
  }

  async initialize(): Promise<void> {
    // The native host (@engram/native-host) is the single writer + schema owner.
    // The MCP server opens the same file read-only so writers and readers never
    // contend (closes the dual-writer corruption risk). Schema creation is skipped
    // in readonly mode; the file must already exist (created by the host).
    if (this.readonly) {
      this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      logger.info(`Database opened read-only at ${this.dbPath}`);
      return;
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.applyMigrations();
    logger.info(`Database initialized at ${this.dbPath}`);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  private applyMigrations(): void {
    const db = this.getDb();

    // Check if schema_version table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
      .get();

    if (!tableExists) {
      // First run — apply full schema
      db.exec(SCHEMA_V1);
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
        CURRENT_SCHEMA_VERSION,
        Date.now()
      );
      logger.info(`Applied schema v${CURRENT_SCHEMA_VERSION}`);
      return;
    }

    const currentVersion = db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number } | undefined;

    if (!currentVersion || currentVersion.version < CURRENT_SCHEMA_VERSION) {
      // Future: add migration logic here
      logger.info('Schema is up to date');
    }
  }

  // ==================== Memories ====================

  async saveMemory(memory: Memory): Promise<void> {
    const db = this.getDb();
    const row = memoryToRow(memory, this.deviceId);

    db.prepare(`
      INSERT OR REPLACE INTO memories (
        id, conversation_id, platform, content_role, content_text,
        content_metadata, encrypted_content, timestamp, vector_clock,
        device_id, sync_status, tags, keywords, context, links,
        evolution, mema_version, embedding, embedding_version
      ) VALUES (
        @id, @conversation_id, @platform, @content_role, @content_text,
        @content_metadata, @encrypted_content, @timestamp, @vector_clock,
        @device_id, @sync_status, @tags, @keywords, @context, @links,
        @evolution, @mema_version, @embedding, @embedding_version
      )
    `).run(row);

    // Auto-update conversation
    await this.upsertConversation(memory);
  }

  private async upsertConversation(memory: Memory): Promise<void> {
    const db = this.getDb();
    const existing = db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(memory.conversationId) as ConversationRow | undefined;

    if (existing) {
      db.prepare(`
        UPDATE conversations
        SET last_message_at = MAX(last_message_at, ?),
            message_count = message_count + 1
        WHERE id = ?
      `).run(memory.timestamp, memory.conversationId);
    } else {
      db.prepare(`
        INSERT INTO conversations (id, platform, created_at, last_message_at, message_count, tags)
        VALUES (?, ?, ?, ?, 1, '[]')
      `).run(memory.conversationId, memory.platform, memory.timestamp, memory.timestamp);
    }
  }

  async getMemory(id: UUID): Promise<Memory | null> {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
    return row ? rowToMemory(row) : null;
  }

  async getMemories(filter: MemoryFilter): Promise<Memory[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.conversationId) {
      conditions.push('conversation_id = ?');
      params.push(filter.conversationId);
    }
    if (filter.platform) {
      conditions.push('platform = ?');
      params.push(filter.platform);
    }
    if (filter.startDate) {
      conditions.push('timestamp >= ?');
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push('timestamp <= ?');
      params.push(filter.endDate);
    }
    if (filter.syncStatus) {
      conditions.push('sync_status = ?');
      params.push(filter.syncStatus);
    }
    if (filter.tags && filter.tags.length > 0) {
      // Use json_each to check if any of the filter tags exist in the memory's tags
      const tagPlaceholders = filter.tags.map(() => '?').join(',');
      conditions.push(
        `EXISTS (SELECT 1 FROM json_each(tags) WHERE value IN (${tagPlaceholders}))`
      );
      params.push(...filter.tags);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const rows = db
      .prepare(`SELECT * FROM memories ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as MemoryRow[];

    return rows.map(rowToMemory);
  }

  async updateMemory(id: UUID, updates: Partial<Memory>): Promise<void> {
    const db = this.getDb();
    const existing = await this.getMemory(id);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }

    const updated = { ...existing, ...updates, id };
    await this.saveMemory(updated);
  }

  async deleteMemory(id: UUID): Promise<void> {
    const db = this.getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  // ==================== Conversations ====================

  async saveConversation(conversation: Conversation): Promise<void> {
    const db = this.getDb();
    const row = conversationToRow(conversation);

    db.prepare(`
      INSERT OR REPLACE INTO conversations (id, platform, title, created_at, last_message_at, message_count, tags)
      VALUES (@id, @platform, @title, @created_at, @last_message_at, @message_count, @tags)
    `).run(row);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const db = this.getDb();
    const row = db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(id) as ConversationRow | undefined;
    return row ? rowToConversation(row) : null;
  }

  async getConversations(filter: ConversationFilter): Promise<Conversation[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.platform) {
      conditions.push('platform = ?');
      params.push(filter.platform);
    }
    if (filter.startDate) {
      conditions.push('created_at >= ?');
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push('created_at <= ?');
      params.push(filter.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 20;

    const rows = db
      .prepare(`SELECT * FROM conversations ${where} ORDER BY last_message_at DESC LIMIT ?`)
      .all(...params, limit) as ConversationRow[];

    return rows.map(rowToConversation);
  }

  // ==================== Search ====================

  async searchMemories(query: string, limit?: number): Promise<Memory[]> {
    const db = this.getDb();
    const maxResults = limit || 20;

    const rows = db
      .prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON m.id = fts.id
        WHERE memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `)
      .all(query, maxResults) as MemoryRow[];

    return rows.map(rowToMemory);
  }

  async updateSearchIndex(_memoryId: UUID, _tags: string[]): Promise<void> {
    // FTS5 is automatically maintained via triggers — no manual action needed
  }

  // ==================== Sync Queue ====================

  async enqueueSyncOperation(_op: SyncOperation): Promise<void> {
    // Not implemented for MCP server — sync is handled by the extension
  }

  async dequeueSyncOperations(_limit: number): Promise<SyncOperation[]> {
    return [];
  }

  async clearSyncQueue(): Promise<void> {
    // No-op
  }

  // ==================== Metadata ====================

  async getMetadata<T>(key: string): Promise<T | null> {
    const db = this.getDb();
    const row = db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? (JSON.parse(row.value) as T) : null;
  }

  async setMetadata<T>(key: string, value: T): Promise<void> {
    const db = this.getDb();
    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run(
      key,
      JSON.stringify(value)
    );
  }

  // ==================== Bulk Operations ====================

  async bulkSaveMemories(memories: Memory[]): Promise<void> {
    const db = this.getDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO memories (
        id, conversation_id, platform, content_role, content_text,
        content_metadata, encrypted_content, timestamp, vector_clock,
        device_id, sync_status, tags, keywords, context, links,
        evolution, mema_version, embedding, embedding_version
      ) VALUES (
        @id, @conversation_id, @platform, @content_role, @content_text,
        @content_metadata, @encrypted_content, @timestamp, @vector_clock,
        @device_id, @sync_status, @tags, @keywords, @context, @links,
        @evolution, @mema_version, @embedding, @embedding_version
      )
    `);

    const transaction = db.transaction((mems: Memory[]) => {
      for (const memory of mems) {
        const row = memoryToRow(memory, this.deviceId);
        insert.run(row);
      }
    });

    transaction(memories);

    // Update conversations for all memories
    for (const memory of memories) {
      await this.upsertConversation(memory);
    }
  }

  // ==================== Stats ====================

  async getStats(): Promise<StorageStats> {
    const db = this.getDb();

    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memories').get() as {
      count: number;
    };
    const conversationCount = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as {
      count: number;
    };
    const pendingOps = 0; // MCP server doesn't manage sync queue

    const oldest = db
      .prepare('SELECT MIN(timestamp) as ts FROM memories')
      .get() as { ts: number | null };
    const newest = db
      .prepare('SELECT MAX(timestamp) as ts FROM memories')
      .get() as { ts: number | null };

    // Estimate storage size using page count * page size
    const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number };
    const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
    const storageBytes = pageCount.page_count * pageSize.page_size;

    return {
      totalMemories: memoryCount.count,
      totalConversations: conversationCount.count,
      storageUsedBytes: storageBytes,
      pendingSyncOps: pendingOps,
      oldestMemory: oldest.ts || 0,
      newestMemory: newest.ts || 0,
    };
  }

  // ==================== Extended Methods ====================

  /**
   * Get platform breakdown statistics
   */
  async getPlatformBreakdown(): Promise<Record<string, number>> {
    const db = this.getDb();
    const rows = db
      .prepare('SELECT platform, COUNT(*) as count FROM memories GROUP BY platform')
      .all() as { platform: string; count: number }[];

    const breakdown: Record<string, number> = {};
    for (const row of rows) {
      breakdown[row.platform] = row.count;
    }
    return breakdown;
  }

  /**
   * Get all memory IDs that have embeddings
   */
  async getMemoriesWithEmbeddings(): Promise<{ id: string; embedding: Float32Array }[]> {
    const db = this.getDb();
    const rows = db
      .prepare('SELECT id, embedding FROM memories WHERE embedding IS NOT NULL')
      .all() as { id: string; embedding: Buffer }[];

    return rows.map((row) => ({
      id: row.id,
      embedding: new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4
      ),
    }));
  }

  /**
   * Update embedding for a memory
   */
  async updateEmbedding(id: UUID, embedding: Float32Array): Promise<void> {
    const db = this.getDb();
    const buffer = Buffer.from(embedding.buffer);
    db.prepare('UPDATE memories SET embedding = ?, embedding_version = 1 WHERE id = ?').run(
      buffer,
      id
    );
  }

  /**
   * Update tags for a memory (add/remove)
   */
  async modifyTags(
    id: UUID,
    addTags?: string[],
    removeTags?: string[]
  ): Promise<string[]> {
    const db = this.getDb();
    const row = db.prepare('SELECT tags FROM memories WHERE id = ?').get(id) as
      | { tags: string }
      | undefined;

    if (!row) {
      throw new Error(`Memory not found: ${id}`);
    }

    let tags = JSON.parse(row.tags) as string[];

    if (removeTags) {
      tags = tags.filter((t) => !removeTags.includes(t));
    }
    if (addTags) {
      for (const tag of addTags) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }

    db.prepare('UPDATE memories SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id);
    return tags;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(id: string, title: string): Promise<void> {
    const db = this.getDb();
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id);
  }
}

/**
 * Create a new SQLiteStorage instance. Pass readonly=true for the MCP server,
 * which reads the database the native host writes.
 */
export function createSQLiteStorage(dbPath: string, deviceId: string, readonly = false): SQLiteStorage {
  return new SQLiteStorage(dbPath, deviceId, readonly);
}

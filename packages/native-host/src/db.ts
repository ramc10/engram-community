/**
 * SQLite writer for the native host — the SINGLE writer to ~/.engram/engram.db.
 *
 * Owns schema creation and all writes; the MCP server opens this same file
 * read-only. Schema mirrors the MCP's memories model with an added `kind` column
 * for universal capture. Writes are idempotent by id (INSERT OR REPLACE) so the
 * extension can safely re-send after a service-worker restart.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { BridgePayload } from './protocol';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'chat',
  conversation_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_role TEXT,
  content_text TEXT,
  timestamp INTEGER NOT NULL,
  device_id TEXT,
  sync_status TEXT DEFAULT 'synced',
  tags TEXT DEFAULT '[]',
  keywords TEXT DEFAULT '[]',
  context TEXT
);
CREATE INDEX IF NOT EXISTS idx_memories_conversation ON memories(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind);
CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED, content_text, context, content='memories', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, id, content_text, context)
  VALUES (new.rowid, new.id, new.content_text, new.context);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content_text, context)
  VALUES ('delete', old.rowid, old.id, old.content_text, old.context);
END;
CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content_text, context)
  VALUES ('delete', old.rowid, old.id, old.content_text, old.context);
  INSERT INTO memories_fts(rowid, id, content_text, context)
  VALUES (new.rowid, new.id, new.content_text, new.context);
END;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]'
);
`;

export function defaultDbPath(): string {
  return path.join(os.homedir(), '.engram', 'engram.db');
}

export class MemoryWriter {
  private db: Database.Database;

  constructor(dbPath: string = defaultDbPath()) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(SCHEMA);
    this.db
      .prepare('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, ?)')
      .run(Date.now());
  }

  /** Upsert one memory (idempotent by id) and keep its conversation row current. */
  write(p: BridgePayload): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO memories
          (id, kind, conversation_id, platform, content_role, content_text,
           timestamp, device_id, sync_status, tags, keywords, context)
         VALUES (@id, @kind, @conversation_id, @platform, @content_role, @content_text,
           @timestamp, @device_id, 'synced', @tags, @keywords, @context)`
      )
      .run({
        id: p.id,
        kind: p.kind || 'chat',
        conversation_id: p.conversationId,
        platform: p.platform,
        content_role: p.role,
        content_text: p.text,
        timestamp: p.timestamp,
        device_id: p.deviceId,
        tags: JSON.stringify(p.tags || []),
        keywords: JSON.stringify(p.keywords || []),
        context: p.context ?? null,
      });

    const existing = this.db
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(p.conversationId);
    if (existing) {
      this.db
        .prepare(
          `UPDATE conversations
             SET last_message_at = MAX(last_message_at, ?), message_count = message_count + 1
           WHERE id = ?`
        )
        .run(p.timestamp, p.conversationId);
    } else {
      this.db
        .prepare(
          `INSERT INTO conversations (id, platform, created_at, last_message_at, message_count, tags)
           VALUES (?, ?, ?, ?, 1, '[]')`
        )
        .run(p.conversationId, p.platform, p.timestamp, p.timestamp);
    }
  }

  close(): void {
    this.db.close();
  }
}

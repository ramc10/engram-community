/**
 * SQLite schema definitions and migrations for Engram MCP server
 */

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Initial schema DDL statements
 */
export const SCHEMA_V1 = `
-- Memories table (mirrors Memory + MemoryWithMemA types from @engram/core)
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('chatgpt','claude','perplexity','gemini','generic')),
  content_role TEXT NOT NULL CHECK(content_role IN ('user','assistant','system')),
  content_text TEXT,
  content_metadata TEXT,
  encrypted_content TEXT,
  timestamp INTEGER NOT NULL,
  vector_clock TEXT NOT NULL DEFAULT '{}',
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending','synced','failed')),
  tags TEXT NOT NULL DEFAULT '[]',
  keywords TEXT,
  context TEXT,
  links TEXT,
  evolution TEXT,
  mema_version INTEGER,
  embedding BLOB,
  embedding_version INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_memories_conversation ON memories(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_platform ON memories(platform);
CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  content_text,
  keywords,
  context,
  tags,
  content='memories',
  content_rowid='rowid'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, id, content_text, keywords, context, tags)
  VALUES (new.rowid, new.id, new.content_text, new.keywords, new.context, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content_text, keywords, context, tags)
  VALUES ('delete', old.rowid, old.id, old.content_text, old.keywords, old.context, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content_text, keywords, context, tags)
  VALUES ('delete', old.rowid, old.id, old.content_text, old.keywords, old.context, old.tags);
  INSERT INTO memories_fts(rowid, id, content_text, keywords, context, tags)
  VALUES (new.rowid, new.id, new.content_text, new.keywords, new.context, new.tags);
END;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('chatgpt','claude','perplexity','gemini','generic')),
  title TEXT,
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_conversations_platform ON conversations(platform);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- Metadata key-value store
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Schema versioning
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

#!/usr/bin/env node
/**
 * Engram native-messaging host.
 *
 * Chrome launches this process and speaks length-prefixed JSON over stdio. Each
 * message is a decrypted memory payload from the extension; we write it to the
 * local SQLite store (~/.engram/engram.db) and ack it. The MCP server reads that
 * same database read-only.
 */

import { readMessages, writeMessage, type BridgePayload } from './protocol';
import { MemoryWriter, defaultDbPath } from './db';

function isPayload(msg: unknown): msg is BridgePayload {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof (msg as BridgePayload).id === 'string' &&
    typeof (msg as BridgePayload).conversationId === 'string'
  );
}

function main(): void {
  const dbPath = process.env.ENGRAM_STORAGE_PATH || defaultDbPath();
  const writer = new MemoryWriter(dbPath);

  const shutdown = () => {
    try {
      writer.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  readMessages(process.stdin, (msg) => {
    if (!isPayload(msg)) {
      writeMessage(process.stdout, { ok: false, error: 'invalid payload' });
      return;
    }
    try {
      writer.write(msg);
      writeMessage(process.stdout, { ok: true, id: msg.id });
    } catch (err) {
      writeMessage(process.stdout, { ok: false, id: msg.id, error: String(err) });
    }
  })
    .catch((err) => {
      console.error('[engram-host] stdin error:', err);
    })
    .finally(shutdown);
}

main();

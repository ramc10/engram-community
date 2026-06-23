/**
 * Native-host smoke test (run: `npm test` in packages/native-host).
 *
 * Verifies the SQLite writer + protocol framing against a temp database,
 * including the FTS5 / idempotent-upsert behaviour that a naive INSERT OR REPLACE
 * would corrupt. Plain Node assertions — no test framework needed.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PassThrough } = require('stream');

const { MemoryWriter } = require('../dist/db.js');
const { readMessages, writeMessage } = require('../dist/protocol.js');
const Database = require('better-sqlite3');

const tmpDb = path.join(os.tmpdir(), `engram-smoke-${Date.now()}.db`);
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
  if (!cond) failures++;
};

// Writer: schema + idempotent upsert (re-send must REPLACE, not duplicate).
const w = new MemoryWriter(tmpDb);
w.write({ id: 'm1', kind: 'chat', conversationId: 'c1', platform: 'claude',
  role: 'user', text: 'hello world about memory', timestamp: 1000, deviceId: 'd1', tags: ['x'] });
w.write({ id: 'm2', kind: 'page_visit', conversationId: 'generic:example.com:2026-01-02',
  platform: 'generic', role: 'capture', text: 'Example Domain', timestamp: 2000, deviceId: 'd1', tags: [] });
w.write({ id: 'm1', kind: 'chat', conversationId: 'c1', platform: 'claude',
  role: 'user', text: 'hello world about memory v2', timestamp: 1500, deviceId: 'd1', tags: ['x'] });
w.close();

// Read back via a read-only connection (as the MCP server does).
const db = new Database(tmpDb, { readonly: true, fileMustExist: true });
const rows = db.prepare('SELECT id, kind, content_text FROM memories ORDER BY id').all();
ok(rows.length === 2, `exactly 2 memories after idempotent re-send (got ${rows.length})`);
ok(rows.find((r) => r.id === 'm1').content_text === 'hello world about memory v2', 'm1 upserted (replaced) not duplicated');
ok(rows.find((r) => r.id === 'm2').kind === 'page_visit', 'm2 kind=page_visit persisted');

const hit = db.prepare("SELECT m.id AS id FROM memories m JOIN memories_fts f ON m.id=f.id WHERE memories_fts MATCH 'memory'").all();
ok(hit.some((h) => h.id === 'm1'), 'FTS5 finds m1 by "memory"');

const conv = db.prepare('SELECT id, message_count FROM conversations ORDER BY id').all();
ok(conv.length === 2, `2 conversations (got ${conv.length})`);
ok(conv.find((c) => c.id === 'c1').message_count === 1, 'conversation count accurate after re-send');
db.close();

// Protocol framing round-trips.
(async () => {
  const stream = new PassThrough();
  const received = [];
  const done = readMessages(stream, (m) => received.push(m));
  writeMessage(stream, { id: 'p1', conversationId: 'c1' });
  writeMessage(stream, { id: 'p2', conversationId: 'c2' });
  stream.end();
  await done;
  ok(received.length === 2 && received[0].id === 'p1' && received[1].id === 'p2', 'protocol framing round-trips 2 messages');

  for (const f of [tmpDb, tmpDb + '-wal', tmpDb + '-shm']) fs.rmSync(f, { force: true });
  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();

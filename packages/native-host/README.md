# @engram/native-host

The native-messaging host that bridges the Engram browser extension to the local
MCP store. It is the **single writer** to `~/.engram/engram.db`; the
[`@engram/mcp`](../mcp) server reads that same database **read-only**.

```
Extension SW ──(decrypted memory, length-prefixed JSON over stdio)──▶ native-host ──▶ ~/.engram/engram.db ◀──(read-only)── engram-mcp ──▶ Claude Desktop/Code
```

Plaintext only ever exists in transit and in this local SQLite file (mode `0600`
recommended); the extension keeps its own copy encrypted at rest.

## Install

```bash
cd packages/native-host
npm install
npm run build
node dist/install.js <your-extension-id> --browser=chrome
```

- Find `<your-extension-id>` on `chrome://extensions` (enable Developer mode).
  An unpacked/dev build has a different id than the published one — install with
  the id you actually load.
- `--browser` supports `chrome` (default), `chromium`, `edge`, `brave`.
- macOS/Linux are automated. **Windows** is registry-based; the installer prints
  the manifest path and the `HKCU\…\NativeMessagingHosts\com.engram.host` key to
  create manually.

The extension connects to `com.engram.host` and streams each saved memory; the
host upserts by id (idempotent), so re-sends after a service-worker restart are
safe.

## Status

The SQLite writer + protocol framing are verified by `npm test` (a Node smoke
test: schema creation, idempotent upsert, FTS5 search, read-only read-back,
conversation roll-up, message framing). **Not yet exercised against a live
browser**, so the real extension↔host native-messaging handshake (manifest
install + `connectNative`) still needs a manual round-trip.

## Schema

The host owns schema creation (`src/db.ts`): a `memories` table (with the
universal-capture `kind` column), an FTS5 index for search, and a `conversations`
table — mirroring what the MCP server expects to read.

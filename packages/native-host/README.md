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

> **Not yet verified end-to-end in this workspace.** The package has no installed
> dependencies here (`better-sqlite3` is native), so it has not been built or run.
> Treat the code as reviewed-but-unverified until `npm install && npm run build`
> and a real extension↔host round-trip have been exercised.

## Schema

The host owns schema creation (`src/db.ts`): a `memories` table (with the
universal-capture `kind` column), an FTS5 index for search, and a `conversations`
table — mirroring what the MCP server expects to read.

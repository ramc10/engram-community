# @engram/mcp

Model Context Protocol server for [Engram](https://github.com/antropics/engram-community) — a privacy-first AI conversation memory system.

Exposes your local conversation memory store to any MCP-compatible AI assistant (Claude Desktop, Cursor, etc.) so memories captured by the Chrome extension are available across all your AI tools.

---

## Architecture

```
Chrome Extension → IndexedDB (browser)
                        │
                   [Export JSON]
                        │
                        ▼
          import_from_extension (MCP tool)
                        │
                        ▼
              ~/.engram/engram.db  (SQLite)
                        │
                        ▼
                   MCP Server
                  /     |     \
         Claude  Cursor  ...  Any MCP client
```

The MCP server reads and writes `~/.engram/engram.db`.  The Chrome extension stores data in browser IndexedDB.  Use the `import_from_extension` tool (or the extension's **Export** button) to bridge the two stores.

---

## Quick Start

### 1. Install

```bash
npm install -g @engram/mcp
# or run without installing:
npx @engram/mcp
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "engram": {
      "command": "engram-mcp",
      "env": {}
    }
  }
}
```

If you installed via `npx` instead of `-g`:

```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["@engram/mcp"]
    }
  }
}
```

Restart Claude Desktop.  The Engram tools will appear in the tool list.

### 3. Verify

Ask Claude: *"What does my engram memory store contain?"* — it will call `get_stats` and report counts.

---

## Configuration

All configuration is optional.  The server works out of the box with sensible defaults.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENGRAM_STORAGE_PATH` | `~/.engram/engram.db` | Path to SQLite database |
| `ENGRAM_PASSPHRASE` | *(none)* | Enable at-rest encryption |
| `ENGRAM_ENABLE_EMBEDDINGS` | `false` | Enable semantic (vector) search |
| `ENGRAM_DEBUG` | `false` | Verbose logging |

### Config File

Create `~/.engram/mcp-config.json` (env vars take priority):

```json
{
  "storagePath": "/custom/path/engram.db",
  "encryptionPassphrase": "my secret phrase",
  "enableEmbeddings": true,
  "debug": false
}
```

### Device Identity

On first run the server writes a stable device ID to `~/.engram/device-id`.  This file is reused on every subsequent start to maintain vector clock consistency.  Do not delete it unless you intend to reset the device identity.

---

## Available MCP Tools

### Memory Management

| Tool | Description |
|---|---|
| `save_memory` | Save a single conversation message |
| `get_memory` | Retrieve a memory by ID |
| `list_memories` | List memories with filters (platform, date, tags) |
| `delete_memory` | Delete a memory by ID |
| `update_memory_tags` | Add or remove tags |

### Conversation Management

| Tool | Description |
|---|---|
| `list_conversations` | List conversations with filters |
| `get_conversation` | Retrieve a conversation with its messages |

### Search

| Tool | Description |
|---|---|
| `search_memories` | Full-text search (FTS5) |
| `semantic_search` | Vector similarity search (requires embeddings) |
| `fulltext_search` | Explicit FTS5 search with ranking |

### Import / Bridge

| Tool | Description |
|---|---|
| `import_conversation` | Bulk-import memories from JSON (cold-start, CI, migration) |
| `import_from_extension` | Bridge: import a JSON export from the Chrome extension |

### Analytics

| Tool | Description |
|---|---|
| `get_stats` | Memory count, storage size, platform breakdown |
| `reindex_embeddings` | Generate embeddings for memories that lack them |

---

## Bridging Chrome Extension → MCP

The Chrome extension captures conversations in IndexedDB (browser-only storage). To make those memories available in Claude Desktop:

### Option A: Export from extension (recommended)

1. Open the Engram side-panel in Chrome.
2. Go to **Settings → Export memories**.
3. Save the file to `~/.engram/extension-export.json` (or any path).
4. In Claude Desktop, ask:
   > "Import my extension memories from ~/.engram/extension-export.json"

   Claude will call `import_from_extension` with that path.

### Option B: Pass JSON directly

If you have the export data as a variable, pass it as the `data` parameter to `import_from_extension`.

### Note on encrypted memories

Memories encrypted by the extension (using the extension passphrase) have `content.text = null` in the export.  The MCP server **cannot** decrypt these because it does not have access to the browser-side key material.

To import encrypted memories:
- Disable encryption in the extension before exporting, **or**
- Decrypt in the extension and re-export.

---

## Semantic Search (Embeddings)

Enable with `ENGRAM_ENABLE_EMBEDDINGS=true`.  On first start, the BGE-Small model (~130 MB) downloads automatically.

After importing memories from the extension, run `reindex_embeddings` once to generate vectors for all imported content:

> "Reindex all embeddings in the MCP store"

Subsequent `semantic_search` calls will return results ranked by cosine similarity rather than keyword matching.

---

## Development

```bash
# From repo root
npm install
npm run build -w packages/core
npm run dev -w packages/mcp        # ts-node (no compile step)

# Tests
npm test -w packages/mcp

# Build
npm run build -w packages/mcp
```

---

## License

MIT — see [LICENSE](../../LICENSE).

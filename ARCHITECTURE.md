# Engram Architecture Documentation

## System Overview

Engram is a **local-first, privacy-preserving** memory layer for your browsing
and AI conversations. It **observes and captures** (it never injects text into
pages), stores everything **on-device, end-to-end encrypted**, and exposes that
memory to external AI agents (Claude Desktop / Claude Code) over a local
**Model Context Protocol (MCP)** bridge.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser Extension (MV3)                                              │
│                                                                        │
│  Capture (observe-only, no injection)                                 │
│   • AI platforms (ChatGPT/Claude/Perplexity/Gemini): conversation     │
│     messages via DOM adapters                                         │
│   • Every other site: generic observer — ambient page_visit metadata  │
│     (url+title) + manual "Save selection / Save page", policy-gated    │
│        │                                                               │
│        ▼                                                               │
│  Background service worker                                            │
│   • IndexedDB (E2E encrypted) = source of truth                       │
│   • holds the decrypted master key in memory                          │
│   • AI features (enrichment / link-detection / evolution) run on the   │
│     user's OWN API key (OpenAI / Anthropic / local)                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  chrome.runtime.connectNative
                                 │  (decrypted memory, plaintext over local stdio)
                                 ▼
                  ┌──────────────────────────────┐
                  │  engram-native-host (Node)    │   single writer
                  │  → ~/.engram/engram.db (SQLite)│
                  └───────────────┬───────────────┘
                                  │ read-only
                                  ▼
                  ┌──────────────────────────────┐
                  │  engram-mcp (stdio)           │ ──▶ Claude Desktop / Claude Code
                  └──────────────────────────────┘
```

Plaintext exists only in the browser's memory (transiently) and in the local
`~/.engram/engram.db`. It never leaves the device automatically and is never
written to the cloud.

---

## Packages

```
engram-community/
├── packages/
│   ├── core/          # MIT — shared types + utils (Memory, Platform, helpers)
│   ├── community/     # AGPL-3.0 — the browser extension
│   │   └── src/
│   │       ├── background/      # service worker + message handler
│   │       ├── content/         # platform adapters + capture policy (shared)
│   │       ├── contents/        # Plasmo content-script entry (runs on all sites)
│   │       ├── components/      # React UI
│   │       ├── lib/             # storage, crypto, capture-config, bridge, …
│   │       └── sidepanel.tsx    # side-panel UI
│   ├── mcp/           # MIT — read-only MCP server over ~/.engram/engram.db
│   └── native-host/   # MIT — native-messaging host, the single SQLite writer
```

---

## Capture model (hybrid, observe-only)

- **AI platforms** — DOM adapters extract conversation messages. Dedup is
  content-hash based (position-independent); SPA route changes re-initialize the
  observer and tear down the previous one.
- **Every other site** — a generic observer governed by the user's capture
  policy:
  - *Automatic*: a lightweight `page_visit` (url + title) per host, throttled to
    once an hour, skipped on a built-in sensitive-site denylist (finance, health,
    government) and any user-blocked hosts.
  - *Manual*: "Save selection" and "Save page" (readable article text) via the
    right-click menu.
- A master kill switch, an automatic-page-visit toggle, and the blocked-sites
  list live in **Settings → Web Capture**.

`Memory.kind` (`chat | page_visit | selection | article`) distinguishes captures;
generic captures use a synthetic `conversationId` of `generic:<host>:<date>`.

---

## Storage & encryption

- **IndexedDB (Dexie)** is the source of truth. Message content and embeddings
  are encrypted at rest with **XChaCha20-Poly1305** under a per-user master key.
- The master key is derived from the user's passphrase (Argon2id) or, for Google
  OAuth users, a random device-wrapped key in `chrome.storage.local`.
- **No cloud memory storage.** Supabase is retained for **authentication only**
  (login/session); memories are never uploaded.

---

## The MCP bridge

1. On save, the service worker enqueues the memory id in an on-disk **outbox**
   (ids only — never plaintext at rest).
2. It connects to the `com.engram.host` native host, loads each queued memory,
   **decrypts it in-process**, and streams the plaintext payload over local stdio.
3. The native host is the **single writer** to `~/.engram/engram.db` and upserts
   idempotently by id (safe to re-send after a service-worker restart).
4. The **MCP server opens that database read-only** — so writers and readers can
   never contend — and exposes search/read tools, resources, and prompts to any
   MCP client.

See `packages/native-host/README.md` for installing the host.

---

## AI features (user's own key)

Enrichment (keywords/tags/context), link detection, and memory evolution run
against the user's configured provider — OpenAI, Anthropic, or a local model
(Ollama / LM Studio). There is no managed/premium tier and no server-side LLM
proxy; the user supplies and pays for their own API usage.

---

## Why this architecture

- **Privacy first** — capture is observe-only and policy-gated; memories stay on
  device; sensitive sites are excluded by default.
- **Local-first** — everything works offline; the only network calls are the
  user's own LLM provider and (optional) auth.
- **Composable** — memory is exposed through the open MCP standard, so any MCP
  client can read it.

---

**Questions about architecture:** artha360.live@gmail.com

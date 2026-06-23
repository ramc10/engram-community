# Engram Production Revamp Plan — MCP-First, Universal Capture

**Status:** Proposal for review · **Date:** 2026-06-22 · **Branch target:** new `revamp/mcp-first`

## Goal (locked with product)
1. **Delete text injection.** Stop mutating AI text boxes and patching page `fetch`.
2. **Capture from every website**, observe-only (no automation).
3. **Expose memory to external MCP agents** (Claude Desktop / Claude Code) over a *live* bridge, not manual JSON export.

This plan is the synthesis of a four-domain code audit (capture/MV3, bridge/lifecycle, crypto/E2E, data-model). Every claim below is grounded in a file:line reference.

---

## 1. Current-state audit (what the code actually does)

### Injection layer (to delete)
- `content/shared/prompt-interceptor.ts` — watches input box, two injection modes: direct textarea rewrite (ChatGPT) and queued network swap (Claude).
- `contents/main-world-interceptor.ts` — **runs in page MAIN world at `document_start`, patches `window.fetch`** (Claude only). This is the single most Web-Store-hostile artifact in the codebase.
- `content/shared/network-interceptor.ts`, `inject-network-interceptor.ts`, `context-matcher.ts` — supporting cast for injection.

### Capture layer (to keep + extend)
- `content/index.ts` + `contents/index.ts` — Plasmo content entry. **`matches` hardcoded to 4 AI hosts** (`contents/index.ts:11`). `all_frames:false`.
- Platform adapters (`content/platforms/*.ts`) — DOM scrapers. Robustness concerns:
  - Selectors are hand-pinned to "Dec 2024" UI (`chatgpt-adapter.ts:5`). Break on redesign.
  - **Dedup keys on DOM position**: `getMessageId` → `${conversationId}-${index}` (`chatgpt-adapter.ts:451`). Re-render/reorder/virtualized-list recycling → wrong dedup, dropped or duplicated saves.
  - `lastProcessedMessages: Set` cleared only on init/destroy (`chatgpt-adapter.ts:51`) — unbounded growth in long sessions.
  - MutationObserver runs `subtree:true, characterData:true` (`chatgpt-adapter.ts:289`) — fires on every streaming keystroke; mitigated by a 2s debounce but CPU-heavy on big threads.
  - **SPA navigation leak**: cleanup is on `window.beforeunload` only (`content/index.ts:250`). ChatGPT/Claude are SPAs — route changes don't fire `beforeunload`, so observers/UI leak across conversations.
- `generic-adapter.ts` — **no-op**: shows the panel, observes nothing (`generic-adapter.ts:100`).

### MCP server (standalone, disconnected)
- `packages/mcp` — Node stdio server, SQLite at `~/.engram/engram.db` (`mcp/src/index.ts`, `config.ts:26`). Tools/resources/prompts well-built.
- **Only bridge today** = manual export → `import_from_extension` (`import-tools.ts:271`), which **silently drops every encrypted memory** (`text===null` → returns null, `import-tools.ts:140`). For real (encrypted) users it imports nothing.
- Dead WS plumbing exists: `SyncManager` + `WebSocketClient` to `ws://localhost:3001/ws`, created `autoConnect:false` (`background/index.ts:152`).

### Stores & parity
- **Three stores, three shapes:**
  - Extension IndexedDB (Dexie, `lib/storage.ts:78`) — writes `text:null` + out-of-type `encryptedContent` / `encryptedEmbedding` blobs via `(memory as any)` (`message-handler.ts:252`, `storage.ts:1123`).
  - MCP SQLite (`mcp/src/storage/schema.ts`) — modeled on the **plaintext** core type; **has no column/handling for `encryptedContent`/`encryptedEmbedding`**. FTS5 (`schema.ts:40`) requires plaintext to search.
  - Supabase `encrypted_memories` (`cloud-sync.ts:149`) — entire Memory JSON encrypted as **one opaque blob**; memA fields & embeddings live inside ciphertext, not columns.
- **Embeddings are portable** ✓ — both sides use `Xenova/bge-small-en-v1.5`, 384-dim, mean-pooled, normalized (`embedding-service.ts:43` ext / `mcp/.../embedding-service.ts:10`). No re-embedding needed *if the bridge carries the decrypted vector*.
- **Schema blockers for generic capture:** `conversationId` is `NOT NULL` everywhere (type + both DDLs + Dexie index); `role` is constrained to `user|assistant|system`. Page visits / selections fit neither.

### Crypto (the constraint that drives everything)
- **Two user classes:**
  - *Passphrase users* → `argon2id(t=4, m=64MiB, p=1)` + XChaCha20-Poly1305. Extension and MCP KDFs are **byte-identical** — reproducible. Only missing piece: no shared salt is exchanged.
  - *Google OAuth users* → **32 random bytes** device-wrapped in `chrome.storage.local` (`message-handler.ts:731`). **Not derivable off-device by anyone.**
- Consequence: any "MCP re-derives the master key" design **silently strands all OAuth users**. Supabase Option C hits the same wall.

---

## 2. Decisions forced by the audit

| Decision | Choice | Why (audit basis) |
|---|---|---|
| Bridge transport | **Native messaging host only**; JSON import (cold-start). No cloud relay. | WS can't survive MV3 SW death; cloud memory storage removed entirely |
| Supabase scope | **Auth/login only** — keep `auth-client.ts` + login UI; remove ALL memory storage/sync | Memories never leave the device except via the local bridge |
| Premium features | **Ungated** — enrichment/link-detection run on the user's own API key | Removes account-based monetization gate; aligns with local-first |
| Who decrypts | **Extension SW decrypts; ships plaintext over local IPC** | Bridge never re-derives keys → keeping OAuth random-key class is harmless |
| Who writes `engram.db` | **Native host owns ALL writes; MCP server is reader** | better-sqlite3 is sync; dual writers → `SQLITE_BUSY`/corruption |
| At-rest in SQLite | Plaintext + `0o600` for v1; SQLCipher later | FTS5 needs plaintext; matches current MCP behavior |
| Generic capture model | New content-kind + synthetic `conversationId` convention | `conversationId NOT NULL`, `role` enum too narrow |
| All-sites capture default | **Hybrid**: auto page-visit *metadata* on all sites; selections + article body opt-in | Balances coverage vs. spyware risk; metadata-only is defensible at review, deep capture stays user-initiated |

---

## 3. Target architecture

```
Any website ──► content adapter (CAPTURE ONLY)
   │  structured adapters (ChatGPT/Claude/…)  +  generic observer (visits/selections, opt-in)
   ▼
background SW ──► IndexedDB (E2E ciphertext = source of truth)
   │  (holds decrypted master key in memory; can decrypt on demand)
   ▼  chrome.runtime.connectNative  —  PLAINTEXT memory over local stdio IPC
engram-native-host (Node, single writer)
   │  re-serializes to canonical Memory; writes plaintext + portable 384-d embedding
   ▼
~/.engram/engram.db (SQLite, 0o600, WAL)  ◄── read-only ── engram-mcp (stdio) ──► Claude Desktop / Code
```

No cloud relay. Memories live only in IndexedDB and the local `engram.db`. Supabase is retained **solely for authentication** (login/session/OAuth); it never stores or syncs memories. Multi-device is out of scope for v1 (would require a future local-key-aware relay, not Supabase memory storage).

---

## 4. Phased implementation

### Phase 0 — Foundations & safety net (no behavior change)
- Add characterization tests around current capture so the teardown can't silently regress: adapter extraction snapshots for each platform.
- Introduce a stable **content-hash message ID** (`sha1(role + normalizedText)` truncated) to replace position-based `getMessageId`. Land it behind the existing path first.
- Add `conversationId`-change detection via `history.pushState`/`popstate` patching in the content entry to fix the SPA leak (`content/index.ts:250`) — re-init adapter on route change, not just `beforeunload`.
- **Acceptance:** capture parity tests pass; no duplicate/dropped messages across simulated SPA nav.

### Phase 1 — Delete the injection layer ✅ DONE
- Removed `prompt-interceptor.ts`, `network-interceptor.ts`, `inject-network-interceptor.ts`, `main-world-interceptor.ts`, and their wiring in `contents/index.ts`.
- **Correction:** `context-matcher.ts` was mislabeled as injection — it's the memory **panel's** TF-IDF relevance search (`memory-panel.tsx` depends on it). **Kept.**
- Dropped the `world:"MAIN"` script entirely. `scripting` permission is already absent from the source Plasmo manifest and no `chrome.scripting` calls exist → generated manifest drops it.
- CSP `wasm-unsafe-eval` retained (embeddings need it).
- Also removed the now-obsolete `network-interceptor-helpers.test.ts` and `link-aware-retrieval.test.ts.skip` (tested only the interceptor).
- **Result:** 0 type errors; 650 tests green; no dangling references to deleted modules.

### Phase 2 — Supabase teardown (auth-preserving)
Split into **2a (cloud-sync deletion, ✅ DONE)** and **2b (premium ungating, pending)**.
Remove all cloud **memory storage/sync**; keep Supabase **auth only**. Done early (right after injection deletion) so every later phase builds against the final cloud-free data path, not soon-deleted sync code.

**2a result:** deleted `cloud-sync.ts` + the WS-sync stack (`sync-manager`, `ws-client`, `operation-queue`, `state-machine`) and all `encrypted_memories` I/O; stripped the cloud-sync wiring from `background/index.ts` + `message-handler.ts` (`initializeCloudSyncIfNeeded`, `getCloudSync`, `getSyncManager`, `START/STOP_CLOUD_SYNC` messages, logout/login/register hooks). `GET_SYNC_STATUS` now always reports disconnected. **Kept** `sync/retry-manager.ts` (used by `enrichment-retry-queue.ts`) and all of auth. Removed obsolete sync tests. 0 type errors; 670 tests green.
- **Delete:** `lib/cloud-sync.ts`, `sync/sync-manager.ts`, the `WebSocketClient`/`autoConnect:false` plumbing (`background/index.ts:152`), all `encrypted_memories` reads/writes, and the `https://*.supabase.co/*` host-permission scope *only if* auth uses a different origin (verify — auth likely needs it, so keep).
- **Keep:** `lib/auth-client.ts`, `AuthenticationView.tsx`, `popup/pages/{Login,Signup,Welcome}.tsx`, `identity` permission. Login/session stays exactly as-is.
- **Ungate premium:** strip account/payment gating from `premium-service.ts` + `premium-api-client.ts`; rewire `enrichment-service.ts` and `link-detection-service.ts` to run on the user's own API key (the architecture already supports user-key mode — see `ARCHITECTURE.md` "User's API Key Mode"). Remove the premium-only branches rather than the features.
- **Crypto stays uniform-safe:** OAuth random-key users (`message-handler.ts:731`) remain, but since the bridge decrypts in-SW and never re-derives keys, this is harmless. No crypto changes required.
- **Acceptance:** extension builds with zero `cloud-sync`/`encrypted_memories` references; login still works; enrichment/link-detection work with a user API key and no account; `grep -ri "encrypted_memories\|CloudSync\|sync-manager" src/` returns nothing.

### Phase 2b — Ungate premium ✅ DONE
- **Services:** stripped the `provider === 'premium'` branch + `callPremium()` from `enrichment-service`, `link-detection-service`, `evolution-service`. They now run only on the user's own API key (openai/anthropic/local) — already the default; no feature lost.
- **Deleted:** `premium-service.ts`, `premium-api-client.ts`; premium message types/handlers (`GET_PREMIUM_STATUS`, `UPGRADE_TO_PREMIUM`, `REQUEST_PREMIUM_UPGRADE`); `initializePremiumClientIfNeeded`; premium module loaders.
- **UI:** deleted `PremiumBadge`/`UpgradeBanner`; removed premium badge, upgrade banner, pending-request block, and the dead cloud-sync toggle section from `sidepanel.tsx` + `SettingsTab.tsx`; dropped the `'premium'` LLM-provider option and license-key labels.
- **Deferred:** the popup pages under `src/popup/pages/` (Settings/Login/Signup/Welcome) are **orphaned/unmounted** (no popup entry; superseded by the sidepanel). They still contain premium markup but are invisible to users and compile fine. Flagged for the **Phase 6 dead-code cleanup**.
- 0 type errors; 622 tests green.

### Phase 3 — Data model for universal capture ✅ DONE (core); MCP schema → Phase 5
- Extended core `Memory` (`core/src/types/memory.ts`): added `MemoryKind` (`chat|page_visit|selection|article`, optional → absent means `chat`), widened `Role` with `'capture'` for non-chat captures, and made `encryptedContent?: EncryptedBlob` **first-class** (was written via `as any`).
- Added `genericConversationId(url, ts)` → `generic:<host>:<yyyy-mm-dd>` in core utils (satisfies the `conversationId NOT NULL` constraint for generic captures), with unit tests.
- **Build hygiene:** removed stale committed `*.js`/`*.d.ts` build artifacts from `packages/core/src/` that were shadowing the `.ts` sources during type resolution; rebuilt `dist/` (the real package entry). 0 type errors; 627 tests green.
- **Deferred to Phase 5:** MCP SQLite schema v2 (kind + `encryptedContent`/`encryptedEmbedding` columns, `applyMigrations` logic) and `serialization.ts` round-trip — the MCP package isn't installed/buildable in this workspace and the schema is only exercised by the bridge, so it's done where it can be validated end-to-end.
- **Deferred polish:** retrofitting the remaining `(as any)` encrypted-field accesses in `storage.ts` (working, guarded runtime accesses in the encryption path — low value, regression-prone to churn now). New capture code (Phase 4) uses the typed fields directly.

### Phase 4 — Generic observer (capture every site, observe-only) — **HYBRID model** ✅ DONE
Shipped in five slices: **4a** capture policy + config (pure, tested), **4b** generic observer + save-path fix (generic platform/kind labelling), **4c** manual save (context-menu selection + page article), **4d** privacy controls UI (Settings → Web Capture: kill switch, ambient toggle, denylist, consent), **4e** content-script `matches` → `https://*/*`+`http://*/*` (R3 mitigations in place). MCP-side has no change here. ~40 new tests; 659 green; 0 type errors. Original design notes retained below.

- Promote `generic-adapter.ts` to a real observer. Two capture paths coexist:
  - **Automatic ambient layer (all sites except denylist):** `page_visit` = url + title + hostname + timestamp only. No body, no DOM scrape. Throttled to ≤1 per (host, hour). Needs broad host access (`<all_urls>`) + the privacy controls below.
  - **Manual "Save to memory" gesture (user-initiated):** the deliberate-keep path, requires only **`activeTab`** (granted on click — low review risk):
    - **Save page** → `article` = main readable body via Readability. Trigger: panel button / toolbar action / shortcut.
    - **Save selection** → `selection` = highlighted text + source url. Trigger: right-click context menu on selected text (`contextMenus`).
  - **Never:** input monitoring, form values, keystrokes, passwords, network/cookies.
  - Permissions split: ambient metadata is the only reason `<all_urls>` is needed; if a user declines broad capture, manual save still works under `activeTab` alone. Consider shipping manual-save first (activeTab) and treating ambient `<all_urls>` as a toggle the user opts into.
- **Privacy controls (gating for Web Store):**
  - **Denylist shipped on by default** for sensitive categories (banking, health, `*.gov`) — auto metadata is suppressed there entirely.
  - Persistent capture indicator (shows when auto-metadata is being recorded) + one-click pause in the panel.
  - Per-site "never capture" and global kill switch. First-run consent screen explaining auto-metadata vs. opt-in deep capture.
- Expand content-script `matches` from 4 hosts to `<all_urls>` **only after** the privacy UX above exists. Web Store single-purpose narrative: "a personal memory of pages you visit and text you save"; metadata-only auto-capture is the defensible default, deep capture is user-initiated. Prepare justification + demo video.
- **Acceptance:** visiting any non-denylisted site stores exactly one `page_visit` metadata record (url/title), throttled per host/hour; denylisted site stores nothing; selection/article captured only on explicit user action; indicator + pause + kill switch verified.

### Phase 5 — The live bridge (native messaging)
- New package `packages/native-host` (Node): registers `com.engram.host` native-messaging manifest per-OS (mac/Linux paths, Windows registry), `allowed_origins` pinned to the **published, stable extension ID** (separate dev manifest for unpacked).
- Background SW: on new memory, decrypt in-SW and stream plaintext Memory (+384-d embedding) via `chrome.runtime.connectNative`. Add `"nativeMessaging"` permission. Handle SW restart: drain a small IndexedDB outbox on `connectNative` reconnect (don't rely on a long-lived port).
- **Strictly one-way, single-writer:** native host is the *only* writer to `engram.db`. **The MCP server is read-only** — open the DB with `readonly: true`, set `busy_timeout`, and **remove/disable all MCP write tools** (tag edits, `import_*`). Memory mutations happen only in the extension and flow one-way: extension → host → SQLite → MCP (read). This eliminates dual-writer contention by construction (closes R1).
- **Cold-start import** (the JSON fallback) becomes a **native-host CLI command** (`engram-native-host import <file>`), not an MCP tool — keeps MCP purely read-only.
- Installer: `npx engram-native-host install` (writes host manifest), surfaced from the extension settings with copy-paste fallback.
- **Acceptance:** create a memory in-browser → appears in `engram.db` within seconds with correct plaintext + searchable via MCP `search_memories`; kill the SW mid-stream → memory still lands on reconnect; MCP exposes **no write tools**; concurrent MCP reads never throw `SQLITE_BUSY`.

### Phase 6 — Cleanup, docs, release
- Update `ARCHITECTURE.md` (currently describes injection-era flow), `README`, store listing.
- Move `import_from_extension` out of the MCP tool set into the native-host CLI (MCP stays read-only); keep it as cold-start only with a deprecation note.
- Version bump (note repo is mid-`1.0.0`-bump, last shipped release is `v0.1.5`).

---

## 5. Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Dual-writer corruption on `engram.db` | ~~High~~ **Closed** | MCP opened `readonly:true` with no write tools; native host is sole writer; `busy_timeout`. Contention impossible by construction |
| R2 | ~~OAuth key non-derivable → bridge data loss~~ | ~~High~~ **Moot** | Resolved by design: no cloud memory + plaintext-over-IPC means keys are never re-derived off-device |
| R3 | broad-host content script (ambient metadata) flagged as spyware | **High — mitigations in place** | Phase 4d/4e: matches limited to `https://*/*`+`http://*/*` (no file/chrome); built-in sensitive-site denylist on by default; user denylist; master kill switch + ambient toggle + consent copy in Settings; capture is on-device only and policy-gated; manual save is independent. Web Store approval itself is external and unverifiable here |
| R4 | MV3 SW death drops bridge messages | Med | IndexedDB outbox + reconnect drain; no long-lived port assumption |
| R5 | Position-based dedup drops/dupes on virtualized lists | ~~Med~~ **Closed** | Phase 0b: shared content-hash `computeMessageId`. ChatGPT (position-only, the sole exposed adapter) refactored to content dedup + element-keyed streaming guard; Claude/Perplexity/Gemini already deduped on content (`processedContents`) and keep their element-stable streaming id by design (content-hashing it would break streaming-change detection) |
| R6 | SPA route changes leak observers/UI | ~~Med~~ **Closed** | Phase 0c: navigation monitoring generalized from ChatGPT-only to all four SPAs; once-installed pathname-based history patch + uniform `cleanupActive()` tears down the prior adapter/interceptor on every route change (was: 3 of 4 platforms had no re-init at all) |
| R7 | Adapter selectors break on platform redesign | Med | No telemetry → rely on CI snapshot tests against saved DOM fixtures + a user-visible "captured N this session" health indicator in the panel so zero-capture is obvious; treat adapters as a maintained surface |
| R8 | Native-host install friction across OS | Med | `npx` installer + clear errors; JSON export/import as no-install fallback (no cloud fallback exists by design) |
| R9 | Plaintext at rest in `engram.db` | Low/Med | `0o600`; SQLCipher upgrade path documented |

---

## 6. Open decisions before build
1. ~~Generic-capture default~~ — **RESOLVED: Hybrid.** Auto page-visit metadata on all sites (minus denylist); selections + article body opt-in. ✓
2. ~~Article extraction~~ — **RESOLVED: in scope**, opt-in via explicit "Save this page" (Readability). ✓
3. ~~Supabase scope~~ — **RESOLVED: auth only.** Remove cloud-sync/memory storage; keep login. Premium ungated to user-API-key. ✓
4. ~~OAuth multi-device~~ — **RESOLVED: out of scope v1.** No cloud memory at all; multi-device deferred. ✓
5. ~~MCP write tools~~ — **RESOLVED: MCP is strictly read-only.** Write tools removed; cold-start import moves to native-host CLI. Closes R1. ✓
6. ~~Telemetry~~ — **RESOLVED: none.** No analytics/telemetry. Adapter breakage caught via CI snapshot tests + in-panel capture-count health indicator (R7). ✓

**All decisions resolved — plan is build-ready.**

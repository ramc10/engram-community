# Engram Community - Code Review Issues Report

**Date:** 2026-02-09
**Scope:** Full repository review covering all source code, configuration, tests, and CI/CD

---

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 12 | 8 | 4 |
| High | 16 | 4 | 12 |
| Medium | 22 | 1 | 21 |
| Low | 12 | 0 | 12 |
| **Total** | **62** | **13** | **49** |

> Issues marked with **[FIXED]** have been resolved in the codebase.
> Issue #12 was **partially addressed** (signature field made optional).

---

## CRITICAL Issues

### 1. ~~[Security] GitHub API token exposed in client-side bundle~~ FIXED

**File:** `packages/community/src/lib/github-reporter.ts`

**Status:** Fixed in commit `d711a1c`

The `PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN` env var used the `PLASMO_PUBLIC_` prefix, which caused it to be bundled into the client-side extension code. Anyone inspecting the built extension could extract this token.

**Resolution:** Removed `PLASMO_PUBLIC_` prefix from all GitHub reporter env vars (`GITHUB_REPORTER_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`) so they are no longer bundled by Plasmo. Added a server-side proxy pattern (`PLASMO_PUBLIC_ERROR_REPORT_PROXY_URL`) where the extension POSTs error reports to a proxy endpoint that holds the GitHub token server-side. Direct GitHub API access is preserved as a fallback for development/testing only.

---

### 2. ~~[Security] Supabase SERVICE_ROLE_KEY in client-side config~~ FIXED

**File:** `packages/core/src/config.ts`

**Status:** Fixed in commit `d711a1c`

The service role key (which has full admin database access) was referenced in the shared `@engram/core` package which is bundled into the browser extension.

**Resolution:** Removed `SERVICE_ROLE_KEY` from the core config entirely. It was unused in the community package and must only exist on the server side.

---

### 3. [FIXED] [Bug] Google OAuth master key not persisted -- data loss on restart

**File:** `packages/community/src/background/message-handler.ts:741-744`

In `handleAuthLoginGoogle`, `service.setMasterKey(masterKey)` is called but `service.persistMasterKey(masterKey)` is never called. Compare with `handleAuthLogin` (line 685) and `handleAuthRegister` (line 530) which both call `persistMasterKey`. When the service worker restarts, the master key is lost, making all encrypted memories permanently unreadable for Google OAuth users.

**Fix:** Add `await service.persistMasterKey(masterKey)` after `service.setMasterKey(masterKey)`.

---

### 4. [FIXED] [Bug] Salt replacement on login destroys existing encrypted data

**File:** `packages/community/src/background/message-handler.ts:655-664`

If the stored salt fails base64 decoding or is too short, a new random salt is generated and saved. Since the master key is derived from `(password, salt)`, changing the salt produces a completely different key, making all previously encrypted memories permanently undecryptable.

```typescript
salt = crypto.generateSalt(); // NEW salt = NEW key = CANNOT decrypt old data
await authClient.updateUserMetadata({ engram_salt: uint8ArrayToBase64(salt) });
```

**Fix:** If salt recovery fails, show an error to the user rather than silently replacing it. Consider backing up salt in multiple locations.

---

### 5. [FIXED] [Bug] Sync `pullOperations()` is fire-and-forget -- sync falsely reports completion

**File:** `packages/community/src/sync/sync-manager.ts:300-308`

`pullOperations()` sends a WebSocket request via `this.wsClient.requestSync()` and immediately returns. `syncNow()` (line 261) calls `pullOperations()` then `pushOperations()` then marks sync as complete (line 288). The server's response arrives later via `handleWebSocketMessage`, long after `syncNow()` has declared completion.

**Impact:** Sync is always reported as "complete" before remote data is actually received. `lastSyncTime` is updated prematurely. The pull-then-push ordering guarantee is broken.

**Fix:** Implement a proper request-response correlation mechanism (e.g., Promise-based with timeout).

---

### 6. [FIXED] [Bug] Sync `pushOperations()` never removes operations from the queue

**File:** `packages/community/src/sync/sync-manager.ts:313-339`

Operations are sent to the server via `wsClient.sendOperation()` but are never removed from the queue on success. The ACK handler (`handleAck`, line 413) expects an `operationId` but the push loop uses `crypto.randomUUID()` as message IDs. Operations accumulate indefinitely and are re-sent every cycle.

**Fix:** Track sent operations by ID and remove them on ACK. Match message IDs properly between send and ACK.

---

### 7. [Performance] searchMemories decrypts ALL memories on fallback path

**File:** `packages/community/src/lib/storage.ts:686-753`

When the HNSW path is unavailable, keyword search loads ALL memories into memory and decrypts each one individually. For 10K+ memories, this is O(n) crypto operations blocking the service worker.

**Fix:** Maintain a plaintext keyword index, or require HNSW index to be initialized before searches are allowed.

---

### 8. [FIXED] [Bug] bulkPut of ALL memories after link detection

**File:** `packages/community/src/lib/storage.ts:1213-1214`

After detecting links, the code bulk-saves ALL memories in the database except the source memory. Only the few target memories that received new reverse links need saving. This overwrites all memories with potentially stale data fetched earlier in the function.

```typescript
const memoriesToSave = allMemories.filter(m => m.id !== memory.id);
await this.db.memories.bulkPut(memoriesToSave);
```

**Fix:** Only save the specific memories whose links were modified.

---

### 9. [FIXED] [Bug] Race condition in singleton initialization (CryptoService, StorageService)

**Files:**
- `packages/community/src/lib/crypto-service.ts:339-345`
- `packages/community/src/lib/storage.ts:1365-1371`

If two callers invoke `getCryptoService()` or `getStorageService()` concurrently, both pass the null check before the first completes `initialize()`. Two instances are created but only the second persists.

```typescript
export async function getCryptoService(): Promise<CryptoService> {
  if (!cryptoServiceInstance) {
    cryptoServiceInstance = new CryptoService();
    await cryptoServiceInstance.initialize(); // yields execution here
  }
  return cryptoServiceInstance;
}
```

**Fix:** Store the initialization Promise itself and return it to all concurrent callers:
```typescript
let initPromise: Promise<CryptoService> | null = null;
export function getCryptoService(): Promise<CryptoService> {
  if (!initPromise) {
    initPromise = (async () => { const s = new CryptoService(); await s.initialize(); return s; })();
  }
  return initPromise;
}
```

---

### 10. [FIXED] [Bug] BackgroundService initialization never retries after failure

**File:** `packages/community/src/background/index.ts:98-106`

If `_initialize()` throws, `initializationPromise` remains set to the rejected promise. All subsequent calls to `initialize()` return the cached rejected promise and never attempt re-initialization.

**Fix:** Clear `initializationPromise` on rejection:
```typescript
this.initializationPromise = this._initialize().catch(e => {
  this.initializationPromise = null;
  throw e;
});
```

---

### 11. [FIXED] [Performance] Cloud sync re-uploads ALL memories every 5 minutes

**File:** `packages/community/src/lib/cloud-sync.ts:107-109`

Every sync cycle uploads ALL local memories, re-encrypting each one. No delta tracking or change detection. For 1K memories this means 1K encryption + 1K network requests every 5 minutes.

**Fix:** Track changes since last sync (using a dirty flag or timestamp comparison) and only upload modified memories.

---

### 12. [PARTIAL] [Bug] SyncOperation.signature required but never populated

**File:** `packages/core/src/types/memory.ts:150` and `packages/community/src/sync/sync-manager.ts:238-256`

`SyncOperation` requires a `signature: string` field, but `queueOperation()` never sets it. The `generateSignature()` method (line 552) exists but is never called. Operations without signatures will fail TypeScript strict mode or be rejected by a server that validates signatures.

**Fix:** Either call `generateSignature()` before queuing, or make `signature` optional until the feature is fully implemented.

---

## HIGH Issues

### 13. [Security] Insufficient message origin validation for prompt injection

**File:** `packages/community/src/contents/main-world-interceptor.ts:32-33`

```typescript
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
```

Any script running on the page (analytics, ads, malicious) can post `ENGRAM_QUEUE_INJECTION` messages to inject arbitrary content into API requests. An attacker could replace the user's prompts.

**Fix:** Use a nonce-based message authentication scheme or use `chrome.runtime.sendMessage` instead of `window.postMessage`.

---

### 14. [Security] `postMessage` with wildcard targetOrigin

**Files:**
- `packages/community/src/content/shared/prompt-interceptor.ts:414`
- `packages/community/src/content/shared/inject-network-interceptor.ts:200-213`

Using `'*'` as the target origin allows any frame on the page to receive sensitive data.

**Fix:** Use the specific origin of the target window.

---

### 15. [FIXED] [Security] Regex injection from user-derived text

**Files:**
- `packages/community/src/content/shared/context-matcher.ts:109`
- `packages/community/src/content/shared/memory-card.tsx:36`

User-derived keywords are interpolated into `new RegExp()` without escaping. Keywords like `c++` or `user (admin)` produce invalid regex or unintended behavior.

**Fix:** Escape regex special characters: `term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`

---

### 16. [Security] Manifest has overly broad permissions

**File:** `packages/community/manifest.json:13-15, 21-23`

Both `host_permissions` and `content_scripts.matches` use `<all_urls>`. The extension only works on ChatGPT, Claude, Perplexity, and Gemini.

**Fix:** Narrow to specific domain patterns: `*://chatgpt.com/*`, `*://claude.ai/*`, `*://perplexity.ai/*`, `*://gemini.google.com/*`

---

### 17. [FIXED] [Bug] Unchecked array access on LLM API responses (9 locations)

**Files:**
- `packages/community/src/lib/enrichment-service.ts:542, 588, 652`
- `packages/community/src/lib/link-detection-service.ts:500, 546, 609`
- `packages/community/src/lib/evolution-service.ts:429, 469, 522`

All three services access `data.choices[0].message.content` or `data.content[0].text` without null/bounds checks. Empty response arrays crash the service.

**Fix:** Add guard: `const content = data.choices?.[0]?.message?.content; if (!content) throw new Error('Empty LLM response');`

---

### 18. [Memory Leak] Unbounded embedding cache in EmbeddingService

**File:** `packages/community/src/lib/embedding-service.ts:57`

`memoryEmbeddings: Map<string, number[]>` grows without limit. Each entry is ~3KB (384 floats). With 50K memories = ~150MB. Unlike `HNSWIndexService.embeddingCache` which has `CACHE_MAX_SIZE = 5000`, there is no eviction.

**Fix:** Add an LRU eviction policy or size limit matching HNSW's approach.

---

### 19. [Data Integrity] Float32Array buffer alignment risk

**Files:**
- `packages/community/src/lib/hnsw-index-service.ts:164`
- `packages/community/src/lib/embedding-migration.ts:57`

```typescript
const embedding = new Float32Array(decryptedBytes.buffer);
```

If `decryptedBytes` has a non-zero `byteOffset` (from ArrayBuffer sharing/slicing), the `Float32Array` spans the entire underlying buffer, silently producing incorrect data.

**Fix:** Use `new Float32Array(arr.buffer, arr.byteOffset, arr.byteLength / 4)` or `arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)`.

---

### 20. [Data Integrity] Cloud sync has no conflict resolution

**File:** `packages/community/src/lib/cloud-sync.ts:121-147`

`uploadMemory` uses `upsert` which overwrites unconditionally. Vector clocks are stored but never used during upload. Concurrent edits from different devices cause silent data loss.

**Fix:** Implement vector clock comparison before upload, or use a CRDT-based merge strategy.

---

### 21. [Bug] Shared mutable state in LLM service calls

**Files:**
- `packages/community/src/lib/link-detection-service.ts:297-298`
- `packages/community/src/lib/evolution-service.ts:145-146`

`this.currentRequest` / `this.currentTargetMemory` are class-level fields overwritten on each call. Concurrent invocations corrupt each other's state.

**Fix:** Pass request context as function parameters rather than storing on instance state.

---

### 22. [Performance] getStats and estimateStorageSize load ALL memories

**Files:**
- `packages/community/src/lib/storage.ts:916-919` (getStats)
- `packages/community/src/lib/storage.ts:994-1000` (estimateStorageSize)

`getStats` loads all memories just for min/max timestamps. `estimateStorageSize` serializes everything to JSON for byte measurement.

**Fix:** Use `orderBy('timestamp').first()/.last()` for stats. Use `navigator.storage.estimate()` for size.

---

### 23. [Performance] Navigation MutationObserver on entire document body

**File:** `packages/community/src/contents/index.ts:327-345`

Observes `document.body` with `{ childList: true, subtree: true }` just to detect URL changes. Fires on every DOM mutation. ChatGPT generates thousands of mutations per second during rendering.

**Fix:** Remove this observer. The `history.pushState`/`replaceState` overrides and `popstate` listener already cover navigation detection.

---

### 24. [Performance] Gemini adapter re-processes ALL messages on non-message mutations

**File:** `packages/community/src/content/platforms/gemini-adapter.ts:186-188`

On any non-message DOM mutation, `getAllMessageElements()` queries the entire DOM and `processMessage()` runs on all results. This is O(n*m).

**Fix:** Use the mutation's `addedNodes` to process only new elements.

---

### 25. [FIXED] [Bug] ChatGPT adapter URL regex doesn't match chatgpt.com

**File:** `packages/community/src/content/platforms/chatgpt-adapter.ts:61`

```typescript
urlPattern: /^https:\/\/chat(?:gpt)?\.openai\.com/,
```

Matches `chat.openai.com` and `chatgpt.openai.com` but NOT `chatgpt.com` (the actual current domain).

**Fix:** Update regex: `/^https:\/\/(chatgpt\.com|chat(?:gpt)?\.openai\.com)/`

---

### 26. [Memory Leak] PromptInterceptor event listeners never removed

**File:** `packages/community/src/content/shared/prompt-interceptor.ts:189-199`

`.bind(this)` creates new function references that are never saved. `destroy()` cannot remove them.

**Fix:** Save bound references and use them in both `addEventListener` and `removeEventListener`.

---

### 27. [FIXED] [Security] `uint8ArrayToBase64` crashes on large arrays

**File:** `packages/core/src/utils.ts:105`

```typescript
return btoa(String.fromCharCode(...array));
```

The spread operator exceeds max call stack arguments for arrays > 65536 elements (e.g., encrypted blobs).

**Fix:** Use a chunked approach or `Buffer.from(array).toString('base64')`.

---

### 28. [Security] Private key stored unencrypted in IndexedDB

**File:** `packages/community/src/sync/sync-manager.ts:123-124`

Device private key is stored as a plain base64 string in IndexedDB, accessible to any script on the same origin.

**Fix:** Encrypt the private key with the master key before storage.

---

## MEDIUM Issues

### 29. [Bug] WebSocket reconnect exponential backoff never activates

**File:** `packages/community/src/sync/ws-client.ts:118-141`

`retryManager.recordAttempt()` is never called on reconnect, so `retryCount` stays at 0. Backoff always returns 1000ms.

**Fix:** Call `retryManager.recordAttempt()` before `setTimer()` in the reconnect path.

---

### 30. [Bug] `disconnect()` permanently mutates WebSocket config

**File:** `packages/community/src/sync/ws-client.ts:154`

`this.config.reconnectOnClose = false` directly mutates config. After disconnect, reconnect never works.

**Fix:** Use a separate `shouldReconnect` flag or save/restore the config value.

---

### 31. [Bug] AuthClient constructor has unresolved async initialization

**File:** `packages/community/src/lib/auth-client.ts:60-62`

`initializeSession()` is async but the constructor cannot await it. Callers using the singleton immediately after import may find `this.session` is null.

**Fix:** Use a lazy initialization pattern similar to `getCryptoService()`.

---

### 32. [Bug] Shared RetryManager state across all memories in enrichment queue

**File:** `packages/community/src/lib/enrichment-retry-queue.ts:119-142`

Global retry counters mean one memory exhausting retries blocks all other memories from retrying.

**Fix:** Track retry counts per memory ID.

---

### 33. [FIXED] [Bug] evolution-service callOpenAI missing usage null check

**File:** `packages/community/src/lib/evolution-service.ts:432-434`

Unlike enrichment-service and link-detection-service which check `if (data.usage)`, this crashes if usage data is omitted.

**Fix:** Add `if (data.usage)` guard.

---

### 34. [FIXED] [Bug] `formatDate` uses 24-hour periods instead of calendar days

**File:** `packages/community/src/lib/formatters.ts:14-17`

11:59 PM yesterday shows as "Today" (only 2 mins ago). 12:01 AM today shows as "Yesterday" (nearly 24 hours).

**Fix:** Compare calendar dates: `new Date(now).setHours(0,0,0,0) - new Date(date).setHours(0,0,0,0)`.

---

### 35. [Bug] Claude adapter `data-test-render-count` is not a unique message ID

**File:** `packages/community/src/content/platforms/claude-adapter.ts:298-310`

`data-test-render-count` resets across conversations. Different messages can share the same count.

**Fix:** Combine render count with conversation ID or use content hashing.

---

### 36. [Bug] State machine missing IDLE -> SYNC_START transition

**File:** `packages/community/src/sync/state-machine.ts:212-218`

`syncNow()` fires `SYNC_START` but the state machine doesn't allow it from IDLE state.

**Fix:** Add `SYNC_START` as a valid event from `IDLE` state.

---

### 37. [Bug] `config.body` type not validated before JSON.parse

**Files:**
- `packages/community/src/contents/main-world-interceptor.ts:165`
- `packages/community/src/content/shared/network-interceptor.ts:146`

`FormData`, `Blob`, `ReadableStream` bodies will cause `JSON.stringify`/`JSON.parse` to fail.

**Fix:** Check `typeof config.body === 'string'` and skip non-JSON bodies.

---

### 38. [Bug] PromptInterceptor stored in local variable, unreachable for cleanup

**File:** `packages/community/src/contents/index.ts:143-148`

`initializeClaude` stores interceptor in `const interceptor` (local) not `currentInterceptor` (module-level).

**Fix:** Assign to module-level `currentInterceptor` variable.

---

### 39. [Bug] Duplicate initialization systems

**Files:** `packages/community/src/content/index.ts` and `packages/community/src/contents/index.ts`

Both files perform platform detection and adapter initialization. Conversations could be captured twice.

**Fix:** Determine which is the active entry point and remove the other.

---

### 40. [Memory Leak] Unbounded deduplication sets in all platform adapters

**Files:**
- `packages/community/src/content/platforms/chatgpt-adapter.ts:51`
- `packages/community/src/content/platforms/claude-adapter.ts:43-46`
- `packages/community/src/content/platforms/gemini-adapter.ts:43-46`
- `packages/community/src/content/platforms/perplexity-adapter.ts:52-54`

`processedMessages`, `processedContents`, `messageContentMap` grow indefinitely in long sessions.

**Fix:** Add periodic eviction or use a bounded LRU cache.

---

### 41. [Memory Leak] Navigation observers/listeners never cleaned up

**File:** `packages/community/src/contents/index.ts:327-377`

- MutationObserver reference is local (unreachable for disconnect)
- `popstate` listener never removed
- `history.pushState`/`replaceState` monkey-patches never restored
- No `beforeunload` handler

**Fix:** Store references and add cleanup on page unload.

---

### 42. [React] Debounce timer stored in useState instead of useRef

**File:** `packages/community/src/sidepanel.tsx:359`

Timer IDs in state trigger unnecessary re-renders and cause stale closure issues.

**Fix:** Use `useRef<number | null>(null)`.

---

### 43. [React] `filteredMemories` not memoized

**File:** `packages/community/src/sidepanel.tsx:803-812`

With up to 1000 memories, the filter runs on every render.

**Fix:** Wrap in `useMemo`.

---

### 44. [Performance] Embeddings recomputed for ALL memories every 10 seconds

**File:** `packages/community/src/sidepanel.tsx:516-526, 476-498`

The 10-second auto-refresh triggers `precomputeEmbeddings(response.memories)` for all memories.

**Fix:** Track which memories already have embeddings and only compute for new/changed ones.

---

### 45. [Performance] `updateEnrichmentConfig` fires on every keystroke in API key input

**Files:**
- `packages/community/src/sidepanel.tsx:1791`
- `packages/community/src/popup/pages/Settings.tsx:1085, 1121`

Writes to `chrome.storage.local`, sends messages, and encrypts -- all on every keystroke.

**Fix:** Debounce or use local state with save-on-blur.

---

### 46. [Accessibility] Toggle switches missing ARIA attributes

**Files:**
- `packages/community/src/sidepanel.tsx:1469-1495, 1565-1631`
- `packages/community/src/popup/pages/Settings.tsx:788-968`

Custom toggle switches lack `role="switch"`, `aria-checked`, and `aria-label`.

---

### 47. [Accessibility] Memory cards not keyboard-accessible

**File:** `packages/community/src/sidepanel.tsx:1017-1028`

Clickable `<div>` elements lack `role="button"`, `tabIndex={0}`, and keyboard handlers.

---

### 48. [Accessibility] Tab navigation missing ARIA tab pattern

**File:** `packages/community/src/sidepanel.tsx:852-873`

Missing `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`, and arrow-key navigation.

---

### 49. [Config] ESLint `no-explicit-any` is off

**File:** `packages/community/.eslintrc.json:29`

In a security-sensitive codebase with encryption and sync, allowing `any` everywhere undermines type safety.

**Fix:** Enable as `"warn"` and progressively fix violations.

---

### 50. [Type Safety] Duplicate VectorClock types and utility functions

**Files:**
- `packages/core/src/types/memory.ts:32` and `packages/core/src/crdt-utils.ts:10`
- `packages/core/src/utils.ts` and `packages/core/src/crdt-utils.ts`

Duplicate definitions can diverge over time.

**Fix:** Single source of truth for `VectorClock` type and utility functions.

---

## LOW Issues

### 51. [Bug] OperationQueue.retry() moves operation to END of queue, not front

**File:** `packages/community/src/sync/operation-queue.ts:255-268`

Comment says "front" but `Date.now()` timestamp puts it at the back.

---

### 52. [Bug] `extractConversationId` regex too restrictive for ChatGPT

**File:** `packages/community/src/contents/index.ts:40`

Pattern `[a-f0-9-]` misses uppercase letters and underscores in ChatGPT conversation IDs.

---

### 53. [Bug] `deepClone` using JSON.stringify loses typed arrays

**File:** `packages/core/src/utils.ts:172-174`

Silently corrupts `Uint8Array`, `Float32Array`, `Date`, and `undefined` values.

---

### 54. [Config] DB_VERSION inconsistency

**Files:**
- `packages/core/src/config.ts:31` -- `DB_VERSION: 1`
- `packages/core/src/types/storage.ts:12` -- `DB_VERSION = 2`

---

### 55. [Dead Code] `content/index.ts` appears to be legacy entry point

~250 lines duplicating `contents/index.ts` logic. The `NetworkInterceptor` class (~216 lines) cannot work from content script world (isolated world). `inject-network-interceptor.ts` is superseded by Plasmo main world script.

---

### 56. [Dead Code] `generateSignature()` never called

**File:** `packages/community/src/sync/sync-manager.ts:552-562`

Method exists but has zero call sites.

---

### 57. [Dead Code] Core `SyncEvent` and `StateMachineConfig` types unused

**File:** `packages/core/src/types/sync.ts:151-179`

Community package defines its own incompatible types.

---

### 58. [Dead Code] Compiled JS files committed in core package

**Files:** `packages/core/src/types/memory.js`, `sync.js`, `utils.js`, `crdt-utils.js`

Build artifacts should be in `dist/` or `.gitignore`d.

---

### 59. [Memory Leak] Unbounded error metadata in GitHubReporter

**File:** `packages/community/src/lib/github-reporter.ts:525-548`

`allMetadata` grows indefinitely in `chrome.storage.local` with no eviction.

---

### 60. [Memory Leak] HNSW tombstones never compacted

**File:** `packages/community/src/lib/hnsw-index-service.ts:342`

`softDelete()` leaves tombstones that degrade search performance over time.

---

### 61. [CI/CD] No dependency caching, redundant jobs

**File:** `.github/workflows/test.yml`

- No `actions/cache` for npm -- 8 parallel jobs all install from scratch
- `lib-tests` is a subset of `unit-tests` (runs same tests twice)
- No job dependencies -- `build` output is unused by downstream jobs

---

### 62. [Testing] Most E2E tests skipped, sync system untested

- 5 of 7 E2E specs are `.spec.ts.skip`
- No unit tests for `sync-manager.ts`, `operation-queue.ts`, `retry-manager.ts`, `ws-client.ts`
- CRDT conflict resolution integration tests don't actually test CRDT logic
- `forceExit: true` in Jest masks hanging async issues

---

## Quick Reference: Files with Most Issues

| File | Issue Count | Key Concerns |
|------|-------------|--------------|
| `src/lib/storage.ts` | 6 | Performance (full scans), race conditions, data integrity |
| `src/sync/sync-manager.ts` | 5 | Broken sync flow, missing signatures, dead code |
| `src/background/message-handler.ts` | 3 | Data loss (master key, salt), critical auth bugs |
| `src/contents/index.ts` | 4 | Memory leaks, missing cleanup, duplicate systems |
| `src/lib/crypto-service.ts` | 3 | Race condition, null deref, dead export |
| `src/sidepanel.tsx` | 6 | React anti-patterns, performance, accessibility |
| `src/lib/cloud-sync.ts` | 3 | Full re-upload, no conflict resolution |
| `packages/core/src/config.ts` | 2 | Service role key exposure, version mismatch |

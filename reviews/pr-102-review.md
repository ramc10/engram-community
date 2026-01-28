# PR #102 Review: fix: resolve test flakiness and update Gemini/Perplexity adapters

**PR:** https://github.com/ramc10/engram-community/pull/102
**Author:** ramc10
**Branch:** `fix/test-flakiness-and-build-updates` -> `main`
**Date Reviewed:** 2026-01-28

---

## Summary

This PR addresses timing-sensitive test failures, updates Gemini adapter DOM selectors to match the current (Jan 2026) page structure, integrates Gemini and Perplexity adapters into the Plasmo content script entry point, and updates build artifacts to v0.1.3 with notifications permission support.

**Changed files (12):**

| File | Additions | Deletions | Description |
|------|-----------|-----------|-------------|
| `state-machine.test.ts` | 1 | 1 | Fix timing-sensitive uptime assertion |
| `gemini-adapter.ts` | 28 | 42 | Update DOM selectors for Jan 2026, stricter role/content handling |
| `gemini-adapter.test.ts` | 36 | 36 | Update tests to match new selectors and null-return behavior |
| `contents/index.ts` | 98 | 0 | Add Gemini and Perplexity platform initialization |
| `storage.ts` | 0 | 30 | Remove `waitForHNSWIndexing()` method |
| `intelligence-flows.test.ts` | 19 | 42 | Simplify embedding mock, skip HNSW save test |
| `manifest.json` (dev) | 1 | 1 | Version bump to 0.1.3, add notifications permission |
| `manifest.json` (prod) | 1 | 1 | Version bump to 0.1.3, add notifications permission |
| `background/index.js` (dev) | 2798 | 4224 | Rebuilt build artifact |
| `background/index.js` (prod) | 62 | 47 | Rebuilt build artifact |
| `package-lock.json` | 24 | 11 | Peer dependency flag changes |
| `.github/workflows/test.yml` | 0 | 4 | Remove `fail_ci_if_error: false` from codecov steps |

---

## Issues

### Issue 1: CI Workflow Reverts Codecov Fix
**Severity:** High
**File:** `.github/workflows/test.yml`

The PR removes `fail_ci_if_error: false` from all 4 codecov upload steps. However, **PR #103** (commit `e2c0652`, already merged to main) specifically added this flag to prevent CI failures caused by codecov network issues. This PR reverts that safety net, meaning CI will break again whenever codecov has connectivity problems.

**Recommendation:** Restore `fail_ci_if_error: false` on all codecov upload steps, or explicitly justify why this revert is intended.

---

### Issue 2: Build Manifests Missing Gemini URL in Content Script Matches
**Severity:** High
**Files:** `build/chrome-mv3-dev/manifest.json`, `build/chrome-mv3-prod/manifest.json`

The build manifests only list ChatGPT, Claude, and Perplexity in `content_scripts.matches`:

```json
"matches": [
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://www.perplexity.ai/*"
]
```

`https://gemini.google.com/*` is **missing**. The source `PlasmoCSConfig` uses `<all_urls>` so Plasmo's dev server would work, but the **built extension** will not inject the content script on Gemini pages. The entire Gemini adapter integration is non-functional in the production build. The `host_permissions` array also lacks the Gemini URL.

**Recommendation:** Add `https://gemini.google.com/*` to both `content_scripts.matches` and `host_permissions` in the build manifests, then rebuild.

---

### Issue 3: Skipped Test Instead of Fixed
**Severity:** Medium
**File:** `tests/integration/intelligence-flows.test.ts:837`

The HNSW index save test is disabled with `test.skip` rather than actually fixed:

```typescript
test.skip('should add memory to HNSW index on save', async () => {
```

The PR title says "resolve test flakiness" but skipping a test is not resolving it -- it hides the problem.

**Recommendation:** Either fix the underlying race condition or create a tracking issue to re-enable this test.

---

### Issue 4: Production Code Removed for Test Convenience
**Severity:** Medium
**File:** `src/lib/storage.ts`

The `waitForHNSWIndexing()` polling utility method was entirely removed from `StorageService`. While it was primarily used in tests, removing production API surface to fix test issues is backwards. This method could have legitimate production use (e.g., waiting for index readiness after bulk imports).

**Recommendation:** Keep the method in `StorageService` and fix the tests to not depend on it, or move it to a test utility if it's truly test-only.

---

### Issue 5: Build Artifacts Committed to Repo
**Severity:** Medium
**Files:** `build/chrome-mv3-dev/static/background/index.js` (7,022 line changes), `build/chrome-mv3-prod/static/background/index.js`

Compiled build artifacts are committed to the repository, contributing the bulk of the diff (2,798 + 62 additions, 4,224 + 47 deletions). This bloats the repo and makes diffs harder to review.

**Recommendation:** Add `build/` to `.gitignore` and generate artifacts via CI/CD instead.

---

### Issue 6: Version Bump Inconsistency
**Severity:** Low
**Files:** `packages/community/manifest.json` vs build manifests

Build manifests are bumped to `0.1.3`, but the source `packages/community/manifest.json` still shows `0.1.0`. This creates a divergence between source of truth and build output.

**Recommendation:** Bump the source manifest to `0.1.3` as well, or automate the version from a single source (e.g., `package.json`).

---

### Issue 7: Simplified Embedding Mock May Mask Bugs
**Severity:** Low
**File:** `tests/integration/intelligence-flows.test.ts:26-52`

The `extractTextFromMemory()` helper was removed and replaced with:

```typescript
memory.content?.text || memory.content || ''
```

The original helper properly handled encrypted content by falling back to keywords, tags, and context metadata. The simplified version produces empty strings for encrypted memories, potentially allowing tests to pass without exercising the encrypted content path.

**Recommendation:** Verify that no integration tests depend on encrypted content extraction. If they do, restore the helper or add a simpler fallback that still handles the encrypted case.

---

## Observations (Non-blocking)

### No PromptInterceptor for Gemini/Perplexity
`initializeChatGPT()` and `initializeClaude()` set up a `PromptInterceptor` for auto-injecting memories into prompts. The new `initializeGemini()` and `initializePerplexity()` only observe messages -- they do not set up prompt interception. This may be intentional (feature not yet supported for these platforms) but is worth noting.

### No SPA Navigation Monitoring for Gemini/Perplexity
Only ChatGPT has `setupNavigationMonitoring()` for detecting conversation changes via URL observation and `history.pushState` patching. Gemini and Perplexity are also SPAs, so conversation switches will not trigger adapter re-initialization. The adapter may continue tracking the old conversation after navigation.

### Gemini Adapter Role Handling Improvement
Returning `null` from `determineRole()` instead of defaulting to `'assistant'` for unknown elements is a correct improvement. It prevents random UI elements from being captured as messages. Tests are properly updated.

### State Machine Test Fix is Correct
Changing `toBeGreaterThan(0)` to `toBeGreaterThanOrEqual(0)` at `state-machine.test.ts:584` is a valid fix. Uptime can legitimately be 0ms in fast test environments where the stats are queried immediately after transitions.

---

## Verdict

This PR has **two high-severity issues** (codecov revert and missing Gemini URL in build manifests) and **three medium-severity issues** (skipped test, removed production code, committed build artifacts) that should be addressed before merging. The Gemini selector updates and content script integration are solid, but the build configuration makes the Gemini integration non-functional in production.

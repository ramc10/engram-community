# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — MCP-first revamp

### Changed (breaking)
- **Removed text injection.** Capture is now observe-only; the prompt interceptor
  and main-world network/fetch patching are gone.
- **Universal capture.** The content script runs on every site: AI conversations
  via DOM adapters, plus a policy-gated generic observer (ambient `page_visit`
  metadata) and manual "Save selection / Save page" via the context menu.
- **Local-only storage.** Cloud sync (Supabase memory storage + the WebSocket
  sync stack) removed; Supabase is retained for authentication only.
- **Premium ungated.** Enrichment, link-detection, and evolution run on the
  user's own API key; the premium tier, its service/client, and UI are removed.

### Added
- Privacy controls (Settings → Web Capture): master kill switch, ambient toggle,
  built-in sensitive-site denylist + per-site blocking.
- `Memory.kind` (`chat | page_visit | selection | article`), `capture` role, and
  `genericConversationId` for non-chat captures.
- **MCP bridge**: `@engram/native-host` native-messaging host (single SQLite
  writer) + the MCP server opened **read-only**, exposing memory to Claude
  Desktop / Claude Code.

### Security / robustness
- Content-hash message dedup (position-independent); SPA navigation re-init across
  all platforms; bridge keeps E2E encryption intact (plaintext only in transit).

> Native host + read-only MCP are implemented but not yet verified end-to-end in
> CI (native deps not installed there). See `packages/native-host/README.md`.

---

## [1.0.0] - 2026-02-07

### Architecture
- **Refactored sidepanel.tsx** from a 1950-line monolith into focused components:
  - `AuthenticationView` - Login and signup forms
  - `PlatformLogo` - Platform-specific icons (ChatGPT, Claude, Perplexity, Gemini)
  - `MemoryCard` - Individual memory display with expansion, links, and evolution timeline
  - `MemoriesTab` - Search and memory list with semantic search
  - `SettingsTab` - Account, cloud sync, and enrichment configuration

### Added
- Error boundaries around MemoriesTab and SettingsTab for isolated crash recovery
- Onboarding flag on first install for future welcome flow
- Version migration system for data transitions between releases
- Content script command handler for background-to-content communication (toggle UI, refresh, ping)
- Gemini platform logo in PlatformLogo component
- MCP (Model Context Protocol) server package for third-party AI integrations
- Comprehensive code review documentation (62 issues identified and prioritized)

### Fixed
- **Critical**: Fixed Google OAuth master key persistence issue (prevented data loss on restart)
- **Critical**: Fixed HNSW vector index WASM loading in Chrome extension service worker
- **High Priority**: Resolved 10+ critical and high-severity security issues
- Added proper WASM module initialization for EdgeVec in service worker context
- Implemented fallback initialization mechanism for robustness
- Fixed unchecked array access on LLM API responses
- Improved error handling in enrichment, link detection, and evolution services
- Fixed regex injection vulnerabilities in user-derived text
- Enhanced message origin validation for prompt injection prevention

### Security
- Enhanced encryption key derivation and storage
- Improved salt management and recovery mechanisms
- Fixed potential race conditions in singleton initialization
- Better error boundaries to prevent crash propagation

## [0.1.3] - 2026-01-11

### Added
- Automated CI testing for encryption and security
- Multi-device encryption key synchronization
- Legacy user migration path (salt generation on first login)
- Salt corruption recovery and robust metadata handling

### Fixed
- Improved legal documentation to reflect open-source licensing
- Fixed repository links and unified copyright information

## [0.1.2] - 2026-01-11

### Fixed
- Fixed critical issue where re-login would prevent decryption of previous memories (added persistent salt storage)
- Ensuring consistent encryption key derivation across sessions

## [0.1.1] - 2026-01-11

### Fixed
- Fixed unused imports in background scripts (`fix/background-cleanup`)
- Fixed unused code in UpgradeBanner component (`fix/ui-cleanup`)
- Fixed unused imports in context matcher (`fix/content-cleanup`)
- Fixed unused imports in shared libraries (`fix/libs-cleanup`)
- General code quality improvements and cleanup

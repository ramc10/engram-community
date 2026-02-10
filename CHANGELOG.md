# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Fixed
- Fixed HNSW vector index WASM loading in Chrome extension service worker
- Added proper WASM module initialization for EdgeVec in service worker context
- Implemented fallback initialization mechanism for robustness

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

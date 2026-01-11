# Changelog

All notable changes to this project will be documented in this file.

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

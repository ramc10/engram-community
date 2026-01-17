#!/bin/bash

# Script to close completed GitHub issues
# Run this after installing GitHub CLI: https://cli.github.com/

set -e

echo "Closing completed GitHub issues..."
echo ""

# Close issue #35
echo "Closing issue #35: Implement retry logic for failed enrichments..."
gh issue close 35 --comment "✅ Completed in PR #70

The retry logic for failed enrichments has been fully implemented with:
- Persistent retry queue using Chrome storage
- Exponential backoff strategy (2s → 32s)
- Maximum 5 retry attempts
- Background processor checking every 30 seconds
- User notifications for permanent failures

Implementation is ready to merge."

echo "✓ Issue #35 closed"
echo ""

# Close issue #36
echo "Closing issue #36: Add telemetry for error tracking (opt-in)..."
gh issue close 36 --comment "✅ Completed

Privacy-first, opt-in error reporting has been fully implemented:

**Features:**
- Automatic GitHub issue creation with intelligent deduplication
- Error fingerprinting to prevent duplicate reports
- Rate limiting (5 min cooldown, 10 issues/day max)
- PII sanitization for privacy protection
- User-controlled opt-in via Settings UI

**Implementation:**
- GitHubReporter service with full test coverage
- Error sanitization and fingerprinting utilities
- Settings page integration
- Documentation in ERROR_REPORTING_IMPLEMENTATION.md

Users can enable this in Settings → Error Reporting."

echo "✓ Issue #36 closed"
echo ""

# Close issue #37
echo "Closing issue #37: Add comprehensive unit tests..."
gh issue close 37 --comment "✅ Completed

Comprehensive unit test coverage has been achieved:

**Test Infrastructure:**
- 24+ test files covering core functionality
- GitHub Actions CI/CD with 8 test jobs (unit, integration, platform, lib, encryption, type-check, lint, build)
- CodeCov integration for coverage tracking
- Automated test runs on all PRs and pushes

**Coverage Areas:**
- Cryptographic services
- Error reporting and handling
- Authentication and encryption
- Storage services
- Message handlers
- Platform adapters
- Background services

Test suite runs automatically on every commit and PR."

echo "✓ Issue #37 closed"
echo ""

echo "✅ All completed issues have been closed!"
echo ""
echo "Issue #38 (Playwright E2E tests) remains open as implementation is incomplete."

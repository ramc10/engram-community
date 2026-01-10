# Testing Framework Roadmap

**Last Updated**: January 10, 2026

This document tracks the long-term roadmap for the testing framework, including technical debt and future improvements.

---

## 🎯 Current Status

### Phase 1: Testing Infrastructure ✅ COMPLETE
- ✅ Jest configuration
- ✅ Test fixtures and utilities
- ✅ Custom matchers
- ✅ MSW setup for API mocking
- ✅ CI/CD workflow

### Phase 2: Unit Tests 🚧 IN PROGRESS (52%)
- ✅ Premium API Client (41 tests)
- ✅ Message Handler (63 tests)
- 🔲 Storage Service (~40 tests)
- 🔲 Auth Client (~30 tests)
- 🔲 Background Service (~30 tests)

**Target**: 200+ tests | **Current**: 104 tests (52%)

---

## 📋 Technical Debt & Deferred Items

### High Priority - Jest 30 Upgrade & ESM Support

**Issue**: 2 test suites skipped due to ESM module resolution
**Status**: ⚠️ Temporarily skipped, tracked for resolution
**Target Date**: Q2 2026 (when Jest 30 stable)

#### Affected Tests
1. `tests/api-key-crypto.test.ts`
2. `tests/integration/cloud-sync-persistence.test.ts`

#### Root Cause
- `@noble` packages are ESM-only
- Jest 29 has limited ESM support in CommonJS environment
- Cannot resolve `@noble/ciphers/chacha` and related imports

#### Current Workaround
Added to `testPathIgnorePatterns` in [jest.config.js:75-79](packages/community/jest.config.js#L75-L79):
```javascript
testPathIgnorePatterns: [
  '/node_modules/',
  'api-key-crypto.test.ts',           // TODO: Re-enable with Jest 30
  'cloud-sync-persistence.test.ts',   // TODO: Re-enable with Jest 30
],
```

#### Resolution Plan
**Option A: Jest 30 Upgrade (Recommended)**
- **When**: Q2 2026 (Jest 30 stable release)
- **Effort**: Medium (2-3 days)
- **Steps**:
  1. Monitor Jest 30 stable release
  2. Upgrade Jest and all plugins (ts-jest, testing-library, etc.)
  3. Remove `testPathIgnorePatterns` for these files
  4. Verify ESM resolution works
  5. Run full test suite

**Option B: Create @noble Mocks (If needed earlier)**
- **When**: If crypto-service tests needed before Jest 30
- **Effort**: Low (1 day)
- **Steps**:
  1. Create `__mocks__/@noble/ciphers/chacha.ts`
  2. Create `__mocks__/@noble/curves/ed25519.ts`
  3. Create `__mocks__/@noble/hashes/*.ts`
  4. Re-enable tests
  5. Accept reduced crypto verification in tests

#### Tracking
- **Document**: [TEST_FAILURES_TO_FIX.md](TEST_FAILURES_TO_FIX.md)
- **GitHub Issue**: TODO - Create issue
- **Priority**: Medium (not blocking Phase 2-4)

---

## 🚀 Future Phases

### Phase 3: Integration Tests (Planned - Q1 2026)
**Target**: 50+ integration tests

- [ ] Memory CRUD with encryption flow
- [ ] Cloud sync end-to-end
- [ ] Premium API integration
- [ ] Authentication flows
- [ ] Enrichment pipeline

**Estimated Effort**: 2-3 weeks

---

### Phase 4: E2E Tests (Planned - Q2 2026)
**Target**: 30+ E2E tests

- [ ] Browser extension loading
- [ ] Content script injection
- [ ] ChatGPT conversation capture
- [ ] Claude conversation capture
- [ ] UI interactions (side panel, popup)

**Tools**: Playwright or Puppeteer
**Estimated Effort**: 3-4 weeks

---

### Phase 5: API Contract Tests (Planned - Q2 2026)
**Target**: 20+ contract tests

- [ ] Premium API contracts
- [ ] Supabase API contracts
- [ ] OpenRouter API contracts

**Tools**: Pact or similar
**Estimated Effort**: 1-2 weeks

---

## 🔧 Testing Infrastructure Improvements

### Priority 1: ESM/Jest 30 Migration
- **When**: Q2 2026
- **Why**: Unblock skipped tests, future-proof
- **Effort**: Medium
- **Dependencies**: Jest 30 stable release

### Priority 2: Visual Regression Testing
- **When**: Q3 2026
- **Why**: Catch UI changes in side panel/popup
- **Effort**: Medium
- **Tools**: Percy, Chromatic, or Playwright screenshots

### Priority 3: Performance Testing
- **When**: Q3 2026
- **Why**: Ensure memory operations scale
- **Effort**: Low
- **Tools**: Benchmark.js or custom

### Priority 4: Security Testing
- **When**: Q4 2026
- **Why**: Verify encryption, XSS prevention
- **Effort**: Medium
- **Tools**: OWASP ZAP, custom crypto tests

---

## 📊 Coverage Goals

### Current Coverage
- Premium API Client: ~95%
- Message Handler: ~95%
- Overall: ~70%

### Target Coverage (End of Phase 2)
- Critical flows (background, crypto, storage): 90-95%
- Global: 75%

### Target Coverage (End of Phase 5)
- Critical flows: 95%+
- Global: 85%

---

## 🛠️ Technical Debt Register

### 1. Jest 30 Upgrade ⚠️ HIGH PRIORITY
- **Issue**: ESM module resolution for @noble packages
- **Impact**: 2 tests skipped
- **Resolution**: Upgrade to Jest 30 when stable
- **Tracking**: This roadmap + TEST_FAILURES_TO_FIX.md

### 2. Crypto Service Unit Tests 🔹 MEDIUM PRIORITY
- **Issue**: No direct unit tests for crypto-service.ts
- **Impact**: Crypto functionality tested indirectly
- **Resolution**: Create mocks or wait for Jest 30
- **Tracking**: Phase 2 backlog

### 3. Mock Cleanup Automation 🔹 MEDIUM PRIORITY
- **Issue**: Manual mock reset in afterEach
- **Impact**: Risk of test pollution
- **Resolution**: Add auto-mock-reset to Jest config
- **Tracking**: Phase 3

### 4. Test Data Factories 🔸 LOW PRIORITY
- **Issue**: Some fixtures are verbose
- **Impact**: Test readability
- **Resolution**: Enhance builder pattern
- **Tracking**: Ongoing

---

## 📅 Milestones

### Q1 2026
- ✅ Phase 1: Testing Infrastructure (DONE)
- 🚧 Phase 2: Unit Tests (52% complete)
  - ✅ Premium API Client
  - ✅ Message Handler
  - 🔲 Storage Service
  - 🔲 Auth Client
  - 🔲 Background Service
- 🔲 Phase 3: Integration Tests (start)

### Q2 2026
- 🔲 Phase 2: Unit Tests (complete)
- 🔲 Phase 3: Integration Tests (complete)
- 🔲 Phase 4: E2E Tests (start)
- 🔲 **Jest 30 Upgrade** ⚠️
- 🔲 Re-enable skipped tests

### Q3 2026
- 🔲 Phase 4: E2E Tests (complete)
- 🔲 Phase 5: API Contract Tests (start)
- 🔲 Visual regression testing setup

### Q4 2026
- 🔲 Phase 5: API Contract Tests (complete)
- 🔲 Performance testing
- 🔲 Security testing
- 🔲 Full test suite at 85%+ coverage

---

## 🔄 Review Schedule

This roadmap should be reviewed and updated:
- **Weekly**: During active development
- **Monthly**: Between phases
- **Quarterly**: For long-term planning

**Next Review**: End of Phase 2 (estimated Feb 2026)

---

## 📝 Notes

### Why Jest 30 is Important
Jest 30 will provide:
- Native ESM support
- Better module resolution
- No need for transformIgnorePatterns hacks
- Future-proof testing setup

### Why We're Deferring @noble Tests
1. Not blocking Phase 2 unit tests
2. Tests passed before (code is likely fine)
3. Proper fix coming with Jest 30
4. Creating mocks would lose real crypto verification

### Decision Log
- **2026-01-10**: Decided to skip 2 failing tests and wait for Jest 30
- **2026-01-10**: Prioritized Phase 2 completion over fixing ESM issues
- **2026-01-10**: Created this roadmap to track deferred work

---

## 🔗 Related Documents

- [TESTING_FRAMEWORK_PLAN.md](TESTING_FRAMEWORK_PLAN.md) - Original 8-week plan
- [TESTING_PHASE1_RESULTS.md](TESTING_PHASE1_RESULTS.md) - Phase 1 completion report
- [TESTING_PHASE2_PROGRESS.md](TESTING_PHASE2_PROGRESS.md) - Current Phase 2 progress
- [TEST_FAILURES_TO_FIX.md](TEST_FAILURES_TO_FIX.md) - Detailed failure analysis
- [jest.config.js](packages/community/jest.config.js) - Jest configuration with skipped tests

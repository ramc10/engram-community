# Engram Extension Testing Framework

Comprehensive testing infrastructure for the Engram Chrome extension, covering unit tests, integration tests, E2E tests, and API contract tests.

## 📁 Directory Structure

```
tests/
├── __fixtures__/          # Test data generators
│   ├── memories.ts        # Memory factory functions
│   ├── users.ts           # User/auth fixtures
│   ├── conversations.ts   # Conversation fixtures
│   └── premium-api.ts     # API response fixtures
│
├── __utils__/             # Test utilities
│   ├── test-helpers.ts    # Common test utilities
│   ├── mock-builders.ts   # Builder pattern for test objects
│   ├── assertions.ts      # Custom Jest matchers
│   └── msw-setup.ts       # MSW API mocking setup
│
├── __mocks__/             # Global mocks
│   ├── edgevec.ts         # HNSW vector index mock
│   └── @xenova/transformers.ts  # ML embeddings mock
│
├── unit/                  # Unit tests (individual services/components)
├── integration/           # Integration tests (multi-service flows)
├── e2e/                   # End-to-end tests (complete user journeys)
├── api-contract/          # API contract tests (Premium API)
│
├── setup.ts               # Global test setup (Chrome mocks, polyfills)
├── jest.setup.ts          # Jest extensions (custom matchers)
└── README.md              # This file
```

## 🚀 Running Tests

### All Tests
```bash
npm test
```

### By Category
```bash
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only
npm run test:api            # API contract tests only
```

### Watch Mode
```bash
npm run test:watch          # Watch for changes and re-run
```

### Coverage
```bash
npm run test:coverage       # Full coverage report
npm run test:coverage:critical  # Coverage for critical flows only
```

### Debug Mode
```bash
npm run test:debug          # Run with Node debugger attached
```

## 🧪 Writing Tests

### Using Fixtures

Fixtures provide consistent test data:

```typescript
import { createMemory, createEnrichedMemory } from '../__fixtures__/memories';
import { createUser, createMasterKey } from '../__fixtures__/users';
import { createEnrichmentResponse } from '../__fixtures__/premium-api';

describe('StorageService', () => {
  it('should save encrypted memory', async () => {
    const memory = createMemory({ encrypted: true });
    const user = createUser({ premium: true });

    await storage.saveMemory(memory);

    expect(memory).toBeEncrypted();
  });
});
```

### Using Builders

Builders provide fluent API for complex objects:

```typescript
import { buildMemory, buildUser, buildAPIResponse } from '../__utils__/mock-builders';

describe('EnrichmentService', () => {
  it('should enrich memory with LLM metadata', async () => {
    const memory = buildMemory()
      .withContent('Test message about AI')
      .encrypted()
      .build();

    const user = buildUser()
      .premium()
      .withSyncEnabled(true)
      .build();

    const apiResponse = buildAPIResponse()
      .asSuccess(createEnrichmentResponse())
      .build();

    // ... test logic
  });
});
```

### Using Custom Matchers

Custom Jest matchers for domain-specific assertions:

```typescript
describe('Memory encryption', () => {
  it('should have valid encrypted blob', () => {
    const memory = createMemory({ encrypted: true });

    expect(memory).toBeEncrypted();
    expect(memory).toHaveValidEncryptedBlob();
  });

  it('should be enriched with metadata', () => {
    const memory = createEnrichedMemory();

    expect(memory).toBeEnriched();
    expect(memory).toHaveKeywords();
    expect(memory).toHaveTags();
    expect(memory).toHaveContext();
  });
});
```

### Mocking Chrome APIs

Chrome APIs are automatically mocked in `setup.ts`. Override behavior in tests:

```typescript
import { createMockChromeStorage } from '../__utils__/test-helpers';

describe('Settings', () => {
  it('should save enrichment config', async () => {
    const mockStorage = createMockChromeStorage();
    (global.chrome.storage.local as any) = mockStorage;

    const config = { enabled: true, provider: 'openai' };
    await chrome.storage.local.set({ enrichmentConfig: config });

    expect(mockStorage.storage.get('enrichmentConfig')).toEqual(config);
  });
});
```

### Mocking HTTP Requests with MSW

Use MSW (Mock Service Worker) for API mocking:

```typescript
import { setupMockServer, mockPremiumEndpoint } from '../__utils__/msw-setup';

describe('Premium API Client', () => {
  setupMockServer();  // Automatically setup/teardown

  it('should authenticate with license key', async () => {
    // Uses default handlers from msw-setup.ts
    const response = await premiumClient.authenticate('ENGRAM-TEST-KEY');

    expect(response.token).toBeDefined();
    expect(response.license.tier).toBe('PRO');
  });

  it('should handle rate limit error', async () => {
    // Override endpoint for specific test
    mockPremiumEndpoint('/v1/enrich', createRateLimitError(), { status: 429 });

    await expect(premiumClient.enrich(memory)).rejects.toThrow('Rate limit exceeded');
  });
});
```

## 📚 Available Test Utilities

### Test Helpers (`test-helpers.ts`)

- `waitFor(condition, options)` - Wait for async condition
- `flushPromises()` - Flush pending promises
- `wait(ms)` - Simple delay
- `createMockChromeStorage()` - Chrome storage mock
- `createMockDatabase()` - IndexedDB mock
- `createMockFetch()` - Fetch mock with helpers
- `spyOnConsole()` - Console spy
- `createDeferred()` - Manual promise control
- `expectToThrow(fn, error)` - Assert throw

### Mock Builders (`mock-builders.ts`)

- `buildMemory()` - Memory builder
- `buildUser()` - User builder
- `buildAPIResponse()` - API response builder
- `buildChromeStorage()` - Chrome storage builder

### Custom Matchers (`assertions.ts`)

- `toBeEncrypted()` - Memory is encrypted
- `toHaveValidEncryptedBlob()` - Valid encryption metadata
- `toBeEnriched()` - Has LLM metadata
- `toHaveKeywords()` - Has keywords
- `toHaveTags()` - Has tags
- `toHaveContext()` - Has context
- `toHaveEmbedding()` - Has vector embedding
- `toHaveLinks()` - Has semantic links
- `toHaveEvolution()` - Has evolution history
- `toBeValidMemory()` - Valid memory structure
- `toHavePlaintextContent()` - Not encrypted

## 🎯 Coverage Goals

### Overall Targets
- **70%** overall coverage (statements, branches, functions, lines)

### Critical Flows (90%+ coverage required)
- Background service (`src/background/**/*.ts`)
- Crypto service (`src/lib/crypto-service.ts`)
- Storage service (`src/lib/storage.ts`)

### Current Coverage
Run `npm run test:coverage` to see current coverage report.

## 🔧 Configuration

### Jest Configuration
Located in `jest.config.js`:
- Test environment: jsdom (browser simulation)
- Module name mapping for monorepo
- Coverage thresholds for critical paths
- Setup files for global mocks

### MSW Configuration
Located in `__utils__/msw-setup.ts`:
- Premium API handlers
- Supabase handlers
- Helper functions for mocking endpoints

### Chrome API Mocks
Located in `setup.ts`:
- chrome.runtime
- chrome.storage
- chrome.tabs
- chrome.sidePanel
- chrome.identity (OAuth)
- chrome.windows

## 📝 Best Practices

### 1. Test Organization
- Use `describe` blocks for logical grouping
- One `it` block per behavior/assertion
- Use `beforeEach/afterEach` for setup/teardown

### 2. Test Isolation
- Each test should be independent
- Use fresh fixtures for each test
- Clear mocks in `afterEach`

### 3. Naming
- Describe what the code does, not implementation
- Use "should" statements: `it('should encrypt content with XChaCha20')`
- Be specific: `it('should throw error when master key is missing')`

### 4. Assertions
- Use custom matchers when available
- Test both success and failure paths
- Verify error messages, not just that errors are thrown

### 5. Async Testing
- Always await async operations
- Use `waitFor` for eventual consistency
- Don't use arbitrary timeouts (use condition-based waits)

## 🐛 Debugging Tests

### Run Single Test File
```bash
npm test -- path/to/test-file.test.ts
```

### Run Single Test
```bash
npm test -- -t "test name pattern"
```

### Enable Console Output
Comment out console suppression in `jest.setup.ts`:
```typescript
// global.console.error = jest.fn();  // Commented out for debugging
```

### Use Debugger
```bash
npm run test:debug
# Then open chrome://inspect in Chrome
```

### Verbose Output
```bash
npm test -- --verbose
```

## 🚦 CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

GitHub Actions workflow: `.github/workflows/test.yml`

Jobs:
- Unit tests
- Integration tests
- E2E tests
- Type check
- Lint
- Build verification

Coverage reports uploaded to Codecov automatically.

## 📦 Dependencies

Testing dependencies:
- `jest` - Test framework
- `ts-jest` - TypeScript support
- `@testing-library/react` - React component testing
- `@testing-library/user-event` - User interaction simulation
- `@testing-library/jest-dom` - DOM matchers
- `msw` - API mocking
- `fake-indexeddb` - IndexedDB simulation

## 🤝 Contributing

When adding new tests:
1. Use fixtures for test data
2. Write clear, descriptive test names
3. Test both success and error paths
4. Maintain or improve coverage
5. Update this README if adding new utilities

## 📖 Related Documentation

- [Testing Framework Plan](../../../TESTING_FRAMEWORK_PLAN.md) - Complete testing strategy
- [Testing Best Practices](../../../TESTING_BEST_PRACTICES.md) - Detailed best practices guide
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [MSW Documentation](https://mswjs.io/docs/)

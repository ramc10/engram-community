# Comprehensive Testing Framework Plan for Engram Extension

**Goal**: Build an extensive testing framework to achieve 100% coverage of all critical flows in the Engram Chrome extension and Premium API server.

**Test Types**: Unit tests, Integration tests, E2E tests, API contract tests

**Organization**: Expand existing `tests/` directory structure

---

## 1. TESTING FRAMEWORK ARCHITECTURE

### 1.1 Test Pyramid Structure

```
                    ▲
                   / \
                  /E2E\           ~10 tests
                 /Tests\          (Full user flows)
                /_______\
               /         \
              /Integration\       ~50 tests
             /   Tests     \      (Multi-service)
            /______________\
           /                \
          /   Unit Tests     \   ~200 tests
         /                    \  (Individual functions)
        /______________________\
```

**Distribution**:
- **Unit Tests (75%)**: Fast, isolated, comprehensive coverage of services/utilities
- **Integration Tests (20%)**: Multi-service flows, storage + crypto + enrichment
- **E2E Tests (5%)**: Critical user journeys, full stack validation

### 1.2 Test Framework Stack

```typescript
Core Testing:
  ├── Jest (v29.7.0) - Test runner & assertion library
  ├── ts-jest - TypeScript compilation
  ├── @testing-library/react - React component testing
  ├── @testing-library/user-event - User interaction simulation
  └── jest-environment-jsdom - Browser environment

Mocking & Utilities:
  ├── fake-indexeddb - IndexedDB simulation
  ├── msw (Mock Service Worker) - API mocking
  ├── @playwright/test - E2E testing (optional, for visual tests)
  └── Custom test utilities (fixtures, builders, assertions)

Chrome Extension Specific:
  ├── chrome API mocks (extended from tests/setup.ts)
  ├── Message protocol test helpers
  └── Content script test environment
```

---

## 2. TEST SUITE ORGANIZATION

### 2.1 Directory Structure

```
packages/community/
├── tests/
│   ├── __mocks__/                    # Global mocks
│   │   ├── chrome-api.ts             # Extended Chrome API mock
│   │   ├── edgevec.ts                # Existing HNSW mock
│   │   └── @xenova/transformers.ts   # Existing embeddings mock
│   │
│   ├── __fixtures__/                 # Test data generators
│   │   ├── memories.ts               # Memory factory
│   │   ├── users.ts                  # User/auth fixtures
│   │   ├── conversations.ts          # Conversation fixtures
│   │   └── premium-api.ts            # API response fixtures
│   │
│   ├── __utils__/                    # Test utilities
│   │   ├── test-helpers.ts           # Common test utilities
│   │   ├── mock-builders.ts          # Builder pattern for mocks
│   │   ├── assertions.ts             # Custom matchers
│   │   └── setup-test-env.ts         # Test environment setup
│   │
│   ├── unit/                         # Unit tests (NEW)
│   │   ├── background/
│   │   │   ├── background-service.test.ts
│   │   │   ├── message-handler.test.ts
│   │   │   └── message-routing.test.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── auth-client.test.ts
│   │   │   ├── cloud-sync.test.ts
│   │   │   ├── crypto-service.test.ts
│   │   │   ├── premium-api-client.test.ts
│   │   │   ├── storage-service.test.ts
│   │   │   └── network-interceptor.test.ts
│   │   │
│   │   ├── ui/                       # React components
│   │   │   ├── pages/
│   │   │   │   ├── Login.test.tsx
│   │   │   │   ├── Signup.test.tsx
│   │   │   │   └── Settings.test.tsx
│   │   │   └── components/
│   │   │       ├── MemoryCard.test.tsx
│   │   │       └── SearchBar.test.tsx
│   │   │
│   │   └── content/
│   │       ├── chatgpt-adapter.test.ts (move from platforms/)
│   │       └── claude-adapter.test.ts (move from platforms/)
│   │
│   ├── integration/                  # Integration tests
│   │   ├── flows/
│   │   │   ├── auth-flow.test.ts              # Complete auth flow
│   │   │   ├── memory-save-flow.test.ts       # Save + encrypt + enrich
│   │   │   ├── memory-retrieve-flow.test.ts   # Retrieve + decrypt + display
│   │   │   ├── premium-enrichment-flow.test.ts
│   │   │   ├── cloud-sync-flow.test.ts
│   │   │   └── settings-update-flow.test.ts
│   │   │
│   │   └── services/
│   │       ├── storage-crypto-integration.test.ts
│   │       ├── enrichment-storage-integration.test.ts
│   │       └── sync-storage-integration.test.ts
│   │
│   ├── e2e/                          # End-to-end tests (NEW)
│   │   ├── user-journeys/
│   │   │   ├── new-user-registration.test.ts
│   │   │   ├── returning-user-login.test.ts
│   │   │   ├── save-chatgpt-conversation.test.ts
│   │   │   ├── search-memories.test.ts
│   │   │   └── premium-upgrade.test.ts
│   │   │
│   │   └── extension-lifecycle/
│   │       ├── install-and-setup.test.ts
│   │       ├── reload-persistence.test.ts
│   │       └── cross-device-sync.test.ts
│   │
│   ├── api-contract/                 # Premium API tests (NEW)
│   │   ├── auth/
│   │   │   ├── license-authentication.test.ts
│   │   │   ├── jwt-token-management.test.ts
│   │   │   └── session-refresh.test.ts
│   │   │
│   │   ├── enrichment/
│   │   │   ├── enrich-endpoint.test.ts
│   │   │   ├── batch-enrichment.test.ts
│   │   │   └── rate-limiting.test.ts
│   │   │
│   │   ├── link-detection/
│   │   │   └── detect-links-endpoint.test.ts
│   │   │
│   │   └── evolution/
│   │       └── check-evolution-endpoint.test.ts
│   │
│   ├── setup.ts                      # Global test setup (existing, extend)
│   ├── teardown.ts                   # Global teardown (NEW)
│   └── jest.setup.ts                 # Jest extensions (NEW)
│
└── jest.config.js                    # Updated config

packages/engram-premium-api/          # Premium API server
├── tests/                            # NEW - API server tests
│   ├── __fixtures__/
│   │   ├── licenses.ts
│   │   ├── users.ts
│   │   └── api-requests.ts
│   │
│   ├── unit/
│   │   ├── auth/
│   │   │   ├── license-validation.test.ts
│   │   │   ├── jwt-generation.test.ts
│   │   │   └── rate-limit-check.test.ts
│   │   │
│   │   ├── enrichment/
│   │   │   ├── openai-client.test.ts
│   │   │   ├── anthropic-client.test.ts
│   │   │   └── enrichment-service.test.ts
│   │   │
│   │   └── database/
│   │       ├── license-repository.test.ts
│   │       └── usage-tracking.test.ts
│   │
│   ├── integration/
│   │   ├── auth-flow.test.ts
│   │   ├── enrichment-flow.test.ts
│   │   └── rate-limiting-enforcement.test.ts
│   │
│   ├── e2e/
│   │   └── full-api-workflow.test.ts
│   │
│   └── setup.ts
│
└── jest.config.js                    # NEW
```

---

## 3. CRITICAL FLOWS TO TEST (100% Coverage)

Based on exploration, these are the critical flows requiring 100% test coverage:

### 3.1 Authentication Flows

**Priority: CRITICAL**

1. **Email/Password Registration**
   - Form validation (email regex, password strength)
   - Supabase registration API call
   - Master key derivation (Argon2id)
   - Device key generation (AES-GCM)
   - Master key encryption with device key
   - Persistence to chrome.storage.local
   - Error handling (duplicate email, network errors)

2. **Email/Password Login**
   - Supabase authentication
   - Master key re-derivation (same password = same key)
   - Device key loading
   - Master key restoration
   - Session persistence
   - Error handling (wrong password, network errors)

3. **Google OAuth Login**
   - OAuth flow initiation
   - chrome.identity.launchWebAuthFlow()
   - Token extraction from redirect URL
   - Session establishment with Supabase
   - Random master key generation (no password)
   - Master key persistence

4. **Session Persistence**
   - Master key restoration on reload
   - Device key decryption
   - Token validation
   - Re-authentication if expired

5. **Logout**
   - Cloud sync stop
   - Supabase sign out
   - Master key clearing from memory
   - Encrypted storage clearing

**Test Files**:
- `tests/unit/lib/auth-client.test.ts`
- `tests/unit/background/auth-handlers.test.ts`
- `tests/unit/ui/pages/Login.test.tsx`
- `tests/unit/ui/pages/Signup.test.tsx`
- `tests/integration/flows/auth-flow.test.ts`
- `tests/e2e/user-journeys/new-user-registration.test.ts`
- `tests/e2e/user-journeys/returning-user-login.test.ts`

---

### 3.2 Memory Management Flows

**Priority: CRITICAL**

1. **Save Message Flow**
   - Content script message detection
   - Platform adapter extraction (ChatGPT/Claude)
   - Content encryption (XChaCha20-Poly1305)
   - IndexedDB storage
   - Background enrichment trigger
   - Sync queue enqueue
   - Error handling (no master key, encryption failure)

2. **Encrypt Content Flow**
   - Plaintext to JSON serialization
   - Nonce generation (random, unique)
   - XChaCha20-Poly1305 encryption
   - EncryptedBlob creation
   - Verify no plaintext leakage

3. **Enrich with LLM Flow**
   - Queue management (rate limiting)
   - Provider selection (OpenAI/Anthropic/Local/Premium)
   - LLM API call
   - Keyword/tag/context extraction
   - Metadata update in IndexedDB
   - Error handling (API errors, rate limits, network)

4. **Retrieve and Decrypt Flow**
   - IndexedDB query with filters
   - Encrypted blob retrieval
   - Decryption with master key
   - Plaintext content population
   - Error handling (no master key, corrupted data)

5. **Search Memories Flow**
   - Full-text search on decrypted content
   - Tag matching
   - Relevance scoring
   - Result pagination
   - Performance (decrypt all vs selective)

6. **Delete Memory Flow**
   - IndexedDB deletion
   - HNSW index removal
   - Search index cleanup
   - Conversation metadata update
   - Cascade handling

**Test Files**:
- `tests/unit/lib/storage-service.test.ts`
- `tests/unit/lib/crypto-service.test.ts`
- `tests/unit/lib/enrichment-service.test.ts` (existing, extend)
- `tests/unit/background/memory-handlers.test.ts`
- `tests/integration/flows/memory-save-flow.test.ts`
- `tests/integration/flows/memory-retrieve-flow.test.ts`
- `tests/e2e/user-journeys/save-chatgpt-conversation.test.ts`
- `tests/e2e/user-journeys/search-memories.test.ts`

---

### 3.3 Premium API Flows

**Priority: CRITICAL**

1. **License Authentication**
   - License key validation
   - JWT token generation (server)
   - Token storage in chrome.storage.local
   - Session restoration
   - Error handling (invalid key, expired license)

2. **JWT Token Management**
   - Token expiration checking
   - Automatic refresh
   - Re-authentication on 401
   - Token caching in memory

3. **Enrichment Requests**
   - Request formatting
   - Authorization header injection
   - Rate limiting (tier-based)
   - Response parsing
   - Cost/token tracking
   - Error handling (429, 5xx, network)

4. **Link Detection**
   - Candidate selection (semantic similarity)
   - API request with top candidates
   - Link confidence scoring
   - Bidirectional link creation

5. **Memory Evolution**
   - Evolution check for linked memories
   - Version history tracking
   - Metadata updates
   - Embedding regeneration
   - Rollback support

6. **Rate Limiting & Error Handling**
   - Rate limiter implementation
   - Exponential backoff
   - Retry logic
   - Queue persistence on failure

**Test Files**:
- `tests/unit/lib/premium-api-client.test.ts`
- `tests/integration/flows/premium-enrichment-flow.test.ts`
- `tests/api-contract/auth/license-authentication.test.ts`
- `tests/api-contract/enrichment/enrich-endpoint.test.ts`
- `tests/api-contract/enrichment/rate-limiting.test.ts`
- `tests/e2e/user-journeys/premium-upgrade.test.ts`

**Premium API Server Tests**:
- `packages/engram-premium-api/tests/unit/auth/license-validation.test.ts`
- `packages/engram-premium-api/tests/unit/auth/jwt-generation.test.ts`
- `packages/engram-premium-api/tests/integration/auth-flow.test.ts`
- `packages/engram-premium-api/tests/integration/enrichment-flow.test.ts`
- `packages/engram-premium-api/tests/integration/rate-limiting-enforcement.test.ts`

---

### 3.4 Cloud Sync Flows

**Priority: HIGH**

1. **Cloud Sync Setup**
   - Premium tier verification
   - Sync enabled check
   - CloudSyncService initialization
   - Initial download and merge

2. **Upload/Download Memories**
   - Upload cycle (every 5 minutes)
   - Encryption before upload
   - Download on startup
   - Decryption after download
   - Merge strategy

3. **Conflict Resolution**
   - Vector clock comparison
   - Causal ordering detection
   - Concurrent write detection
   - Last-write-wins tiebreaker

4. **Operation Queue**
   - Enqueue operations
   - FIFO dequeue
   - Retry logic
   - Error recovery

**Test Files**:
- `tests/unit/lib/cloud-sync.test.ts`
- `tests/integration/flows/cloud-sync-flow.test.ts`
- `tests/integration/cloud-sync-persistence.test.ts` (existing, extend)
- `tests/e2e/extension-lifecycle/cross-device-sync.test.ts`

---

### 3.5 Settings/Configuration Flows

**Priority: MEDIUM**

1. **Update Enrichment Settings**
   - Config save to chrome.storage.local
   - Service re-initialization
   - Provider change
   - API key encryption

2. **Change Providers**
   - Validation (credentials check)
   - Service swap
   - Config persistence

3. **Update API Keys**
   - Encryption before storage
   - Decryption on load
   - Validation (test API call)

**Test Files**:
- `tests/unit/ui/pages/Settings.test.tsx`
- `tests/unit/lib/api-key-crypto.test.ts` (existing, extend)
- `tests/integration/flows/settings-update-flow.test.ts`

---

### 3.6 Background Service Flows

**Priority: CRITICAL**

1. **Extension Initialization**
   - Service instantiation order
   - Migration execution
   - Device ID generation
   - Master key restoration
   - Cloud sync initialization
   - Premium client initialization

2. **Premium Client Initialization**
   - Session restoration
   - License key authentication
   - Token storage

3. **Storage Service Initialization**
   - IndexedDB open
   - Schema migration
   - Enrichment service setup
   - HNSW index loading

4. **Message Handler Routing**
   - Message validation
   - Type-based routing
   - Async response handling
   - Error propagation

**Test Files**:
- `tests/unit/background/background-service.test.ts`
- `tests/unit/background/message-handler.test.ts`
- `tests/unit/background/message-routing.test.ts`
- `tests/e2e/extension-lifecycle/install-and-setup.test.ts`
- `tests/e2e/extension-lifecycle/reload-persistence.test.ts`

---

## 4. TEST UTILITIES & HELPERS

### 4.1 Test Fixtures (`tests/__fixtures__/`)

**Purpose**: Provide consistent, reusable test data

#### `memories.ts` - Memory Factory

```typescript
import { Memory, MemoryWithMemA } from '@engram/core';
import { generateUUID } from '../utils';

export interface MemoryFactoryOptions {
  id?: string;
  conversationId?: string;
  platform?: 'chatgpt' | 'claude' | 'perplexity';
  content?: { role: string; text: string };
  encrypted?: boolean;
  enriched?: boolean;
  withLinks?: boolean;
  withEvolution?: boolean;
  timestamp?: number;
  deviceId?: string;
}

export function createMemory(options: MemoryFactoryOptions = {}): Memory {
  const {
    id = generateUUID(),
    conversationId = generateUUID(),
    platform = 'chatgpt',
    content = { role: 'user', text: 'Test message content' },
    encrypted = true,
    timestamp = Date.now(),
    deviceId = 'test-device-1',
  } = options;

  const memory: Memory = {
    id,
    conversationId,
    platform,
    content: encrypted
      ? { role: content.role, text: '[ENCRYPTED]', metadata: {} }
      : content,
    encryptedContent: encrypted ? createMockEncryptedBlob(content.text) : undefined,
    timestamp,
    vectorClock: { [deviceId]: 1 },
    deviceId,
    syncStatus: 'pending',
    tags: [],
  };

  return memory;
}

export function createEnrichedMemory(options: MemoryFactoryOptions = {}): MemoryWithMemA {
  const memory = createMemory(options);
  return {
    ...memory,
    keywords: ['test', 'memory', 'keyword'],
    tags: ['testing', 'unit-test'],
    context: 'This is a test memory for unit testing purposes',
    embedding: new Float32Array(384).fill(0.5),
    memAVersion: 1,
  };
}

export function createMemoryBatch(count: number, options: MemoryFactoryOptions = {}): Memory[] {
  return Array.from({ length: count }, (_, i) =>
    createMemory({ ...options, id: `${options.id || 'mem'}-${i}` })
  );
}

function createMockEncryptedBlob(plaintext: string) {
  // Simple base64 encoding for testing (not real encryption)
  return {
    version: 1,
    algorithm: 'XChaCha20-Poly1305',
    nonce: btoa('test-nonce-12345678'),
    ciphertext: btoa(plaintext),
  };
}
```

#### `users.ts` - User/Auth Fixtures

```typescript
export interface UserFactoryOptions {
  email?: string;
  password?: string;
  premium?: boolean;
  syncEnabled?: boolean;
}

export function createUser(options: UserFactoryOptions = {}) {
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'TestPass123!',
    premium = false,
    syncEnabled = false,
  } = options;

  return {
    email,
    password,
    userId: generateUUID(),
    tier: premium ? 'PRO' : 'FREE',
    syncEnabled,
  };
}

export function createMasterKey() {
  return {
    key: new Uint8Array(32).fill(1),
    salt: new Uint8Array(16).fill(2),
    derivedAt: Date.now(),
  };
}

export function createDeviceKey() {
  return {
    id: generateUUID(),
    name: 'Test Device',
    createdAt: Date.now(),
  };
}
```

#### `premium-api.ts` - API Response Fixtures

```typescript
export function createEnrichmentResponse(overrides = {}) {
  return {
    keywords: ['technology', 'artificial intelligence', 'machine learning'],
    tags: ['AI', 'tech', 'development'],
    context: 'Discussion about AI and machine learning technologies',
    cost: 0.0001,
    tokens: 150,
    ...overrides,
  };
}

export function createAuthResponse(overrides = {}) {
  return {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    license: {
      tier: 'PRO',
      rateLimit: 500,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ...overrides,
  };
}

export function createRateLimitError() {
  return {
    error: 'Rate limit exceeded',
    retryAfter: 60,
    limit: 100,
    remaining: 0,
    reset: Date.now() + 60000,
  };
}
```

### 4.2 Test Utilities (`tests/__utils__/`)

#### `test-helpers.ts` - Common Utilities

```typescript
/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Mock chrome storage with in-memory Map
 */
export function createMockChromeStorage() {
  const storage = new Map<string, any>();

  return {
    storage,
    get: jest.fn((keys) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: storage.get(keys) });
      }
      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          if (storage.has(key)) result[key] = storage.get(key);
        });
        return Promise.resolve(result);
      }
      return Promise.resolve(Object.fromEntries(storage));
    }),
    set: jest.fn((items) => {
      Object.entries(items).forEach(([key, value]) => storage.set(key, value));
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => storage.delete(key));
      return Promise.resolve();
    }),
    clear: () => storage.clear(),
  };
}

/**
 * Create mock IndexedDB database
 */
export async function createMockDatabase() {
  const { default: Dexie } = await import('dexie');
  const db = new Dexie('TestDB');

  db.version(1).stores({
    memories: 'id, conversationId, timestamp',
    conversations: 'id',
    syncQueue: 'id, timestamp',
  });

  return db;
}
```

#### `mock-builders.ts` - Builder Pattern

```typescript
/**
 * Fluent builder for Memory objects
 */
export class MemoryBuilder {
  private memory: Partial<Memory>;

  constructor() {
    this.memory = {
      id: generateUUID(),
      conversationId: generateUUID(),
      platform: 'chatgpt',
      content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
      timestamp: Date.now(),
      vectorClock: {},
      deviceId: 'test-device',
      syncStatus: 'pending',
      tags: [],
    };
  }

  withId(id: string): this {
    this.memory.id = id;
    return this;
  }

  withContent(text: string, role = 'user'): this {
    this.memory.content = { role, text, metadata: {} };
    return this;
  }

  encrypted(): this {
    this.memory.encryptedContent = createMockEncryptedBlob(
      this.memory.content?.text || ''
    );
    this.memory.content = { role: 'user', text: '[ENCRYPTED]', metadata: {} };
    return this;
  }

  enriched(): this {
    (this.memory as any).keywords = ['test'];
    (this.memory as any).tags = ['testing'];
    (this.memory as any).context = 'Test context';
    return this;
  }

  build(): Memory {
    return this.memory as Memory;
  }
}

// Usage:
// const memory = new MemoryBuilder()
//   .withContent('Test message')
//   .encrypted()
//   .enriched()
//   .build();
```

#### `assertions.ts` - Custom Jest Matchers

```typescript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeEncrypted(): R;
      toHaveValidEncryptedBlob(): R;
      toBeEnriched(): R;
    }
  }
}

export const customMatchers = {
  toBeEncrypted(received: Memory) {
    const pass =
      received.content.text === '[ENCRYPTED]' &&
      received.encryptedContent !== undefined &&
      received.encryptedContent.ciphertext !== undefined;

    return {
      pass,
      message: () => pass
        ? `Expected memory not to be encrypted`
        : `Expected memory to be encrypted (content.text='[ENCRYPTED]' and encryptedContent present)`,
    };
  },

  toHaveValidEncryptedBlob(received: Memory) {
    const blob = received.encryptedContent;
    const pass =
      blob?.version === 1 &&
      blob?.algorithm === 'XChaCha20-Poly1305' &&
      blob?.nonce !== undefined &&
      blob?.ciphertext !== undefined;

    return {
      pass,
      message: () => pass
        ? `Expected invalid encrypted blob`
        : `Expected valid encrypted blob with version, algorithm, nonce, and ciphertext`,
    };
  },

  toBeEnriched(received: MemoryWithMemA) {
    const pass =
      received.keywords !== undefined &&
      received.tags !== undefined &&
      received.context !== undefined;

    return {
      pass,
      message: () => pass
        ? `Expected memory not to be enriched`
        : `Expected memory to have keywords, tags, and context`,
    };
  },
};
```

### 4.3 MSW API Mocking Setup (`tests/__utils__/msw-setup.ts`)

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { createEnrichmentResponse, createAuthResponse } from '../__fixtures__/premium-api';

/**
 * Mock Premium API handlers
 */
export const premiumApiHandlers = [
  // Authentication
  rest.post('http://localhost:3001/auth/authenticate', (req, res, ctx) => {
    return res(ctx.json(createAuthResponse()));
  }),

  // Enrichment
  rest.post('http://localhost:3001/v1/enrich', (req, res, ctx) => {
    return res(ctx.json(createEnrichmentResponse()));
  }),

  // Rate limit error
  rest.post('http://localhost:3001/v1/enrich-rate-limited', (req, res, ctx) => {
    return res(
      ctx.status(429),
      ctx.json({
        error: 'Rate limit exceeded',
        retryAfter: 60,
      })
    );
  }),
];

/**
 * Create MSW server instance
 */
export const server = setupServer(...premiumApiHandlers);

// Setup/teardown helpers
export function setupMockServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
```

---

## 5. CI/CD INTEGRATION

### 5.1 GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/community/coverage/lcov.info
          flags: unit

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          cd packages/engram-premium-api
          npm run db:migrate

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/engram_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/community/coverage/lcov.info
          flags: integration

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-screenshots
          path: tests/e2e/screenshots/

  api-tests:
    name: API Contract Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start Premium API server
        run: |
          cd packages/engram-premium-api
          npm run build
          npm start &
          sleep 5

      - name: Run API contract tests
        run: npm run test:api
        env:
          API_URL: http://localhost:3001

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/engram-premium-api/coverage/lcov.info
          flags: api
```

### 5.2 NPM Scripts

**Update `package.json`**:

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e",
    "test:api": "jest --testPathPattern=tests/api-contract",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:coverage:critical": "jest --coverage --collectCoverageFrom='src/**/*.{ts,tsx}' --coveragePathIgnorePatterns='src/ui/' --coverageThreshold='{\"global\":{\"lines\":100,\"functions\":100,\"branches\":100,\"statements\":100}}'",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

---

## 6. IMPLEMENTATION STEPS

### Phase 1: Setup & Infrastructure (Week 1)

**Goal**: Establish testing infrastructure and utilities

1. **Update Jest Configuration**
   - Add test path patterns for new directories
   - Configure coverage thresholds
   - Add MSW for API mocking
   - Configure separate configs for unit/integration/e2e

2. **Create Test Utilities**
   - `tests/__fixtures__/memories.ts`
   - `tests/__fixtures__/users.ts`
   - `tests/__fixtures__/premium-api.ts`
   - `tests/__utils__/test-helpers.ts`
   - `tests/__utils__/mock-builders.ts`
   - `tests/__utils__/assertions.ts`
   - `tests/__utils__/msw-setup.ts`

3. **Extend Chrome API Mocks**
   - Enhanced chrome.storage.local mock
   - chrome.runtime message passing mock
   - chrome.tabs mock for E2E
   - chrome.identity mock for OAuth

4. **Setup CI/CD**
   - `.github/workflows/test.yml`
   - Code coverage reporting (Codecov)
   - PR status checks

**Deliverables**:
- ✅ Complete test infrastructure
- ✅ Reusable test utilities
- ✅ CI/CD pipeline
- ✅ Documentation

---

### Phase 2: Unit Tests - Critical Services (Week 2-3)

**Goal**: 100% coverage of critical service layers

1. **Background Service** (`tests/unit/background/`)
   - `background-service.test.ts` - Initialization, lifecycle
   - `message-handler.test.ts` - Message routing, validation
   - `message-routing.test.ts` - Type-based routing logic

2. **Auth Services** (`tests/unit/lib/`)
   - `auth-client.test.ts` - Supabase integration, OAuth
   - Extend `device-key-manager.test.ts` - Add edge cases

3. **Storage & Crypto** (`tests/unit/lib/`)
   - `storage-service.test.ts` - CRUD operations, encryption integration
   - Extend `crypto-service.test.ts` - Add edge cases

4. **Premium API Client** (`tests/unit/lib/`)
   - `premium-api-client.test.ts` - Authentication, enrichment, rate limiting

5. **Cloud Sync** (`tests/unit/lib/`)
   - `cloud-sync.test.ts` - Upload/download, conflict resolution

**Deliverables**:
- ✅ 200+ unit tests
- ✅ 100% coverage of critical services
- ✅ All edge cases covered

---

### Phase 3: Unit Tests - UI Components (Week 4)

**Goal**: Test React components with user interactions

1. **Pages** (`tests/unit/ui/pages/`)
   - `Login.test.tsx` - Form validation, submission, errors
   - `Signup.test.tsx` - Registration flow, validation
   - `Settings.test.tsx` - Config updates, provider changes

2. **Components** (`tests/unit/ui/components/`)
   - `MemoryCard.test.tsx` - Display, actions
   - `SearchBar.test.tsx` - Search input, results

**Deliverables**:
- ✅ 50+ component tests
- ✅ User event simulation
- ✅ Accessibility checks

---

### Phase 4: Integration Tests (Week 5)

**Goal**: Test multi-service flows

1. **Critical Flows** (`tests/integration/flows/`)
   - `auth-flow.test.ts` - Registration → login → session
   - `memory-save-flow.test.ts` - Save → encrypt → enrich → store
   - `memory-retrieve-flow.test.ts` - Query → decrypt → display
   - `premium-enrichment-flow.test.ts` - Auth → enrich → update
   - `cloud-sync-flow.test.ts` - Upload → download → merge
   - `settings-update-flow.test.ts` - Update → reinitialize

2. **Service Integration** (`tests/integration/services/`)
   - `storage-crypto-integration.test.ts`
   - `enrichment-storage-integration.test.ts`
   - `sync-storage-integration.test.ts`

**Deliverables**:
- ✅ 50+ integration tests
- ✅ Multi-service validation
- ✅ End-to-end data flow verification

---

### Phase 5: E2E Tests (Week 6)

**Goal**: Test complete user journeys

1. **User Journeys** (`tests/e2e/user-journeys/`)
   - `new-user-registration.test.ts` - Signup → setup → first save
   - `returning-user-login.test.ts` - Login → restore session → access memories
   - `save-chatgpt-conversation.test.ts` - Visit ChatGPT → save → verify
   - `search-memories.test.ts` - Search → decrypt → display
   - `premium-upgrade.test.ts` - Configure → authenticate → enrich

2. **Extension Lifecycle** (`tests/e2e/extension-lifecycle/`)
   - `install-and-setup.test.ts` - Install → initialize → ready
   - `reload-persistence.test.ts` - Save → reload → restore
   - `cross-device-sync.test.ts` - Save on device A → sync → retrieve on device B

**Deliverables**:
- ✅ 10+ E2E tests
- ✅ Full user flow validation
- ✅ Cross-device scenarios

---

### Phase 6: API Contract Tests (Week 7)

**Goal**: Test Premium API endpoints

1. **Extension API Tests** (`tests/api-contract/`)
   - `auth/license-authentication.test.ts`
   - `enrichment/enrich-endpoint.test.ts`
   - `enrichment/rate-limiting.test.ts`

2. **Premium API Server Tests** (`packages/engram-premium-api/tests/`)
   - Unit tests for auth, enrichment, database
   - Integration tests for full API flows
   - E2E test for complete workflow

**Deliverables**:
- ✅ 40+ API tests
- ✅ Contract validation
- ✅ Server-side logic coverage

---

### Phase 7: Documentation & Maintenance (Week 8)

**Goal**: Document testing framework and best practices

1. **Documentation**
   - Testing guide for contributors
   - Writing test examples
   - Debugging test failures
   - Coverage requirements

2. **Maintenance**
   - Fix skipped tests
   - Update existing tests
   - Refactor test utilities
   - Performance optimization

**Deliverables**:
- ✅ Complete testing documentation
- ✅ All tests passing
- ✅ 100% critical flow coverage
- ✅ CI/CD fully automated

---

## 7. FILES TO CREATE/MODIFY

### New Files (Estimated: 60+ files)

**Test Utilities** (8 files):
- `tests/__fixtures__/memories.ts`
- `tests/__fixtures__/users.ts`
- `tests/__fixtures__/conversations.ts`
- `tests/__fixtures__/premium-api.ts`
- `tests/__utils__/test-helpers.ts`
- `tests/__utils__/mock-builders.ts`
- `tests/__utils__/assertions.ts`
- `tests/__utils__/msw-setup.ts`

**Unit Tests - Background** (3 files):
- `tests/unit/background/background-service.test.ts`
- `tests/unit/background/message-handler.test.ts`
- `tests/unit/background/message-routing.test.ts`

**Unit Tests - Services** (6 files):
- `tests/unit/lib/auth-client.test.ts`
- `tests/unit/lib/cloud-sync.test.ts`
- `tests/unit/lib/premium-api-client.test.ts`
- `tests/unit/lib/storage-service.test.ts`
- `tests/unit/lib/network-interceptor.test.ts`
- `tests/unit/lib/crypto-service.test.ts` (extend existing)

**Unit Tests - UI** (5 files):
- `tests/unit/ui/pages/Login.test.tsx`
- `tests/unit/ui/pages/Signup.test.tsx`
- `tests/unit/ui/pages/Settings.test.tsx`
- `tests/unit/ui/components/MemoryCard.test.tsx`
- `tests/unit/ui/components/SearchBar.test.tsx`

**Integration Tests** (9 files):
- `tests/integration/flows/auth-flow.test.ts`
- `tests/integration/flows/memory-save-flow.test.ts`
- `tests/integration/flows/memory-retrieve-flow.test.ts`
- `tests/integration/flows/premium-enrichment-flow.test.ts`
- `tests/integration/flows/cloud-sync-flow.test.ts`
- `tests/integration/flows/settings-update-flow.test.ts`
- `tests/integration/services/storage-crypto-integration.test.ts`
- `tests/integration/services/enrichment-storage-integration.test.ts`
- `tests/integration/services/sync-storage-integration.test.ts`

**E2E Tests** (8 files):
- `tests/e2e/user-journeys/new-user-registration.test.ts`
- `tests/e2e/user-journeys/returning-user-login.test.ts`
- `tests/e2e/user-journeys/save-chatgpt-conversation.test.ts`
- `tests/e2e/user-journeys/search-memories.test.ts`
- `tests/e2e/user-journeys/premium-upgrade.test.ts`
- `tests/e2e/extension-lifecycle/install-and-setup.test.ts`
- `tests/e2e/extension-lifecycle/reload-persistence.test.ts`
- `tests/e2e/extension-lifecycle/cross-device-sync.test.ts`

**API Contract Tests** (6 files):
- `tests/api-contract/auth/license-authentication.test.ts`
- `tests/api-contract/auth/jwt-token-management.test.ts`
- `tests/api-contract/enrichment/enrich-endpoint.test.ts`
- `tests/api-contract/enrichment/rate-limiting.test.ts`
- `tests/api-contract/link-detection/detect-links-endpoint.test.ts`
- `tests/api-contract/evolution/check-evolution-endpoint.test.ts`

**Premium API Server Tests** (12 files):
- `packages/engram-premium-api/tests/__fixtures__/licenses.ts`
- `packages/engram-premium-api/tests/__fixtures__/users.ts`
- `packages/engram-premium-api/tests/__fixtures__/api-requests.ts`
- `packages/engram-premium-api/tests/unit/auth/license-validation.test.ts`
- `packages/engram-premium-api/tests/unit/auth/jwt-generation.test.ts`
- `packages/engram-premium-api/tests/unit/auth/rate-limit-check.test.ts`
- `packages/engram-premium-api/tests/unit/enrichment/openai-client.test.ts`
- `packages/engram-premium-api/tests/unit/enrichment/anthropic-client.test.ts`
- `packages/engram-premium-api/tests/unit/enrichment/enrichment-service.test.ts`
- `packages/engram-premium-api/tests/integration/auth-flow.test.ts`
- `packages/engram-premium-api/tests/integration/enrichment-flow.test.ts`
- `packages/engram-premium-api/tests/integration/rate-limiting-enforcement.test.ts`

**Configuration & CI** (5 files):
- `tests/jest.setup.ts`
- `tests/teardown.ts`
- `packages/engram-premium-api/jest.config.js`
- `packages/engram-premium-api/tests/setup.ts`
- `.github/workflows/test.yml`

**Documentation** (3 files):
- `TESTING_GUIDE.md`
- `TESTING_BEST_PRACTICES.md`
- `tests/README.md`

### Modified Files

- `packages/community/jest.config.js` - Add test patterns, MSW setup
- `packages/community/tests/setup.ts` - Extend Chrome mocks
- `packages/community/package.json` - Add test scripts
- `.github/workflows/` - Update CI configuration

---

## 8. SUCCESS METRICS

### Coverage Targets

**Critical Flows (100% coverage required)**:
- ✅ Authentication (all flows)
- ✅ Memory save/retrieve/encrypt
- ✅ Premium API integration
- ✅ Cloud sync
- ✅ Background service initialization

**Overall Targets**:
- Unit tests: 200+ tests
- Integration tests: 50+ tests
- E2E tests: 10+ tests
- API tests: 40+ tests
- **Total: 300+ comprehensive tests**

### Quality Gates

- All tests must pass in CI before merge
- Code coverage > 80% overall
- Critical flows > 95% coverage
- No skipped tests in critical paths
- Performance: Unit tests < 10s, Integration < 30s, E2E < 2min

---

## 9. DEPENDENCIES TO ADD

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.1.4",
    "msw": "^1.3.2",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

For Premium API:
```json
{
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3"
  }
}
```

---

## 10. RISK MITIGATION

**Potential Risks**:

1. **Test Complexity**: E2E tests may be flaky
   - Mitigation: Use retry logic, stable selectors, wait utilities

2. **Performance**: Large test suite may slow CI
   - Mitigation: Parallel execution, caching, selective test runs

3. **Maintenance**: Tests become outdated as code changes
   - Mitigation: Co-locate tests with code, enforce test updates in PRs

4. **Coverage Gaps**: Hard-to-test code paths
   - Mitigation: Refactor for testability, use integration tests as fallback

---

## SUMMARY

This comprehensive testing framework will provide:

✅ **300+ tests** covering all critical flows
✅ **100% coverage** of authentication, encryption, Premium API, sync
✅ **4 test types**: Unit, Integration, E2E, API contract
✅ **CI/CD automation** with GitHub Actions
✅ **Reusable utilities** for fast test development
✅ **Premium API server tests** for complete validation
✅ **8-week implementation plan** with clear deliverables

The framework ensures reliability, maintainability, and confidence in the Engram extension across all platforms and use cases.

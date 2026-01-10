/**
 * Mock Service Worker (MSW) setup for API mocking
 * Provides HTTP mocking for Premium API and Supabase endpoints
 */

import { setupServer } from 'msw/node';
import { rest } from 'msw';
import {
  createAuthResponse,
  createEnrichmentResponse,
  createLinkDetectionResponse,
  createEvolutionCheckResponse,
  createRateLimitError,
  createAuthError,
} from '../__fixtures__/premium-api';
import { createSupabaseSession } from '../__fixtures__/users';

/**
 * Base URLs for mocked services
 */
export const PREMIUM_API_URL = 'http://localhost:3001';
export const SUPABASE_URL = 'https://test.supabase.co';

/**
 * Premium API handlers
 */
export const premiumApiHandlers = [
  // Authentication
  rest.post(`${PREMIUM_API_URL}/auth/authenticate`, (req, res, ctx) => {
    const { licenseKey } = req.body as any;

    if (!licenseKey) {
      return res(ctx.status(400), ctx.json(createAuthError()));
    }

    if (licenseKey === 'INVALID-KEY') {
      return res(ctx.status(401), ctx.json(createAuthError({
        code: 'INVALID_LICENSE_KEY',
        message: 'Invalid license key',
      })));
    }

    return res(ctx.status(200), ctx.json(createAuthResponse()));
  }),

  // Enrichment
  rest.post(`${PREMIUM_API_URL}/v1/enrich`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json(createAuthError()));
    }

    return res(ctx.status(200), ctx.json(createEnrichmentResponse()));
  }),

  // Link Detection
  rest.post(`${PREMIUM_API_URL}/v1/detect-links`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json(createAuthError()));
    }

    const { candidates } = req.body as any;
    const memoryIds = candidates?.map((c: any) => c.id) || [];

    return res(ctx.status(200), ctx.json(createLinkDetectionResponse(memoryIds)));
  }),

  // Evolution Check
  rest.post(`${PREMIUM_API_URL}/v1/check-evolution`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json(createAuthError()));
    }

    return res(ctx.status(200), ctx.json(createEvolutionCheckResponse()));
  }),

  // Rate limit error scenario
  rest.post(`${PREMIUM_API_URL}/v1/enrich-rate-limited`, (req, res, ctx) => {
    return res(ctx.status(429), ctx.json(createRateLimitError()));
  }),
];

/**
 * Supabase handlers
 */
export const supabaseHandlers = [
  // Sign up
  rest.post(`${SUPABASE_URL}/auth/v1/signup`, (req, res, ctx) => {
    const { email, password } = req.body as any;

    if (!email || !password) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Email and password required' })
      );
    }

    return res(ctx.status(200), ctx.json(createSupabaseSession(undefined, email)));
  }),

  // Sign in
  rest.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, (req, res, ctx) => {
    const { email, password } = req.body as any;

    if (!email || !password) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Email and password required' })
      );
    }

    if (password === 'wrong-password') {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid credentials' })
      );
    }

    return res(ctx.status(200), ctx.json(createSupabaseSession(undefined, email)));
  }),

  // Sign out
  rest.post(`${SUPABASE_URL}/auth/v1/logout`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({}));
  }),

  // Google OAuth
  rest.post(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, (req, res, ctx) => {
    const { id_token } = req.body as any;

    if (!id_token) {
      return res(ctx.status(400), ctx.json({ error: 'ID token required' }));
    }

    return res(ctx.status(200), ctx.json(createSupabaseSession()));
  }),

  // User session
  rest.get(`${SUPABASE_URL}/auth/v1/user`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    return res(
      ctx.status(200),
      ctx.json(createSupabaseSession().user)
    );
  }),
];

/**
 * Combined handlers
 */
export const defaultHandlers = [...premiumApiHandlers, ...supabaseHandlers];

/**
 * Create MSW server instance
 */
export const server = setupServer(...defaultHandlers);

/**
 * Setup/teardown helpers for tests
 */
export function setupMockServer() {
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'warn',
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}

/**
 * Helper to override specific endpoints
 */
export function mockPremiumEndpoint(
  endpoint: string,
  response: any,
  options: { status?: number; delay?: number } = {}
) {
  const { status = 200, delay = 0 } = options;

  server.use(
    rest.post(`${PREMIUM_API_URL}${endpoint}`, (req, res, ctx) => {
      return res(ctx.delay(delay), ctx.status(status), ctx.json(response));
    })
  );
}

/**
 * Helper to simulate network error
 */
export function mockNetworkError(endpoint: string) {
  server.use(
    rest.post(`${PREMIUM_API_URL}${endpoint}`, (req, res, ctx) => {
      return res.networkError('Failed to connect');
    })
  );
}

/**
 * Helper to simulate timeout
 */
export function mockTimeout(endpoint: string, delay = 30000) {
  server.use(
    rest.post(`${PREMIUM_API_URL}${endpoint}`, (req, res, ctx) => {
      return res(ctx.delay(delay));
    })
  );
}

/**
 * Helper to mock authentication failure
 */
export function mockAuthFailure() {
  server.use(
    rest.post(`${PREMIUM_API_URL}/auth/authenticate`, (req, res, ctx) => {
      return res(ctx.status(401), ctx.json(createAuthError()));
    })
  );
}

/**
 * Helper to mock rate limiting
 */
export function mockRateLimit(endpoint = '/v1/enrich') {
  server.use(
    rest.post(`${PREMIUM_API_URL}${endpoint}`, (req, res, ctx) => {
      return res(ctx.status(429), ctx.json(createRateLimitError()));
    })
  );
}

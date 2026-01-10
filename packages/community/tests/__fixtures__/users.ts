/**
 * Test fixtures for User and Authentication objects
 * Provides factory functions for creating test users, auth sessions, and keys
 */

import { MasterKey, UUID } from '@engram/core';
import { generateTestUUID } from './memories';

/**
 * Options for creating test users
 */
export interface UserFactoryOptions {
  email?: string;
  password?: string;
  userId?: UUID;
  premium?: boolean;
  tier?: 'FREE' | 'PRO' | 'ENTERPRISE';
  syncEnabled?: boolean;
  deviceId?: UUID;
}

/**
 * Create a test user
 */
export function createUser(options: UserFactoryOptions = {}) {
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'TestPass123!',
    userId = generateTestUUID(),
    premium = false,
    tier = premium ? 'PRO' : 'FREE',
    syncEnabled = false,
    deviceId = generateTestUUID(),
  } = options;

  return {
    id: userId,
    email,
    password,
    tier,
    syncEnabled,
    deviceId,
    createdAt: Date.now(),
  };
}

/**
 * Create a free tier user
 */
export function createFreeUser(options: Omit<UserFactoryOptions, 'tier' | 'premium'> = {}) {
  return createUser({ ...options, tier: 'FREE', premium: false });
}

/**
 * Create a PRO tier user
 */
export function createProUser(options: Omit<UserFactoryOptions, 'tier' | 'premium'> = {}) {
  return createUser({ ...options, tier: 'PRO', premium: true });
}

/**
 * Create an ENTERPRISE tier user
 */
export function createEnterpriseUser(options: Omit<UserFactoryOptions, 'tier' | 'premium'> = {}) {
  return createUser({ ...options, tier: 'ENTERPRISE', premium: true });
}

/**
 * Create a master key for testing
 */
export function createMasterKey(overrides: Partial<MasterKey> = {}): MasterKey {
  return {
    key: new Uint8Array(32).fill(1),
    salt: new Uint8Array(16).fill(2),
    derivedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a random master key
 */
export function createRandomMasterKey(): MasterKey {
  const key = new Uint8Array(32);
  const salt = new Uint8Array(16);

  // Fill with random values
  crypto.getRandomValues(key);
  crypto.getRandomValues(salt);

  return {
    key,
    salt,
    derivedAt: Date.now(),
  };
}

/**
 * Create a device object for testing
 */
export function createDevice(overrides: any = {}) {
  return {
    id: generateTestUUID(),
    name: 'Test Device',
    platform: 'chrome-extension',
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create an encrypted master key blob
 */
export function createEncryptedMasterKey(masterKey?: MasterKey) {
  const key = masterKey || createMasterKey();

  return {
    ciphertext: btoa(String.fromCharCode(...key.key)),
    nonce: btoa('test-nonce-123456789012'),
    salt: btoa(String.fromCharCode(...key.salt)),
    derivedAt: key.derivedAt,
    version: 1,
  };
}

/**
 * Create a Supabase session object
 */
export function createSupabaseSession(userId?: UUID, email?: string) {
  return {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token',
    refresh_token: 'refresh-token-test',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    user: {
      id: userId || generateTestUUID(),
      email: email || 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Create a Google OAuth response
 */
export function createGoogleOAuthResponse() {
  return {
    provider: 'google',
    url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
    access_token: 'ya29.test-google-access-token',
    refresh_token: 'google-refresh-token',
    id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.google-id-token',
  };
}

/**
 * Create authentication credentials
 */
export interface AuthCredentials {
  email: string;
  password: string;
}

export function createAuthCredentials(overrides: Partial<AuthCredentials> = {}): AuthCredentials {
  return {
    email: `test-${Date.now()}@example.com`,
    password: 'SecureTestPass123!',
    ...overrides,
  };
}

/**
 * Create a batch of users for testing
 */
export function createUserBatch(count: number, options: UserFactoryOptions = []) {
  return Array.from({ length: count }, (_, i) =>
    createUser({
      ...options,
      email: `test-${Date.now()}-${i}@example.com`,
      userId: `user-${i}` as UUID,
    })
  );
}

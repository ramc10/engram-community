/**
 * Test utility functions
 * Common helpers used across all test suites
 */

import { jest, expect } from '@jest/globals';
import Dexie from 'dexie';

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met within timeout' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Flush all pending promises and timers
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock chrome.storage.local implementation
 */
export function createMockChromeStorage() {
  const storage = new Map<string, any>();

  const mockStorage = {
    storage,
    get: jest.fn<any>((keys: string | string[] | null) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: storage.get(keys) });
      }
      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          if (storage.has(key)) {
            result[key] = storage.get(key);
          }
        });
        return Promise.resolve(result);
      }
      // null or undefined - return all
      return Promise.resolve(Object.fromEntries(storage));
    }),
    set: jest.fn<any>((items: Record<string, any>) => {
      Object.entries(items).forEach(([key, value]) => {
        storage.set(key, value);
      });
      return Promise.resolve();
    }),
    remove: jest.fn<any>((keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => storage.delete(key));
      return Promise.resolve();
    }),
    clear: () => storage.clear(),
  };

  return mockStorage;
}

/**
 * Create a mock IndexedDB database for testing
 */
export async function createMockDatabase(dbName = 'TestDB') {
  const db = new Dexie(dbName);

  db.version(1).stores({
    memories: 'id, conversationId, platform, timestamp, syncStatus, *tags',
    conversations: 'id, platform, lastMessageAt',
    devices: 'id, lastSeenAt',
    syncQueue: 'id, timestamp',
    metadata: 'key',
    searchIndex: 'tag',
  });

  db.version(2).stores({
    memories: 'id, conversationId, platform, timestamp, syncStatus, *tags',
    conversations: 'id, platform, lastMessageAt',
    devices: 'id, lastSeenAt',
    syncQueue: 'id, timestamp',
    metadata: 'key',
    searchIndex: 'tag',
    hnswIndex: 'key',
  });

  await db.open();

  return db;
}

/**
 * Clear a test database
 */
export async function clearDatabase(db: Dexie): Promise<void> {
  const tableNames = db.tables.map(table => table.name);
  for (const tableName of tableNames) {
    await db.table(tableName).clear();
  }
}

/**
 * Mock fetch for API testing
 */
export function createMockFetch() {
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  return {
    fetch: mockFetch,
    mockResponse: (data: any, options: { status?: number; ok?: boolean } = {}) => {
      const { status = 200, ok = true } = options;
      mockFetch.mockResolvedValueOnce({
        ok,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as Response);
    },
    mockError: (error: Error) => {
      mockFetch.mockRejectedValueOnce(error);
    },
    mockNetworkError: () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));
    },
  };
}

/**
 * Create a spy on console methods
 */
export function spyOnConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log = jest.fn<any>((...args: any[]) => {
    logs.push(args.join(' '));
  });

  console.error = jest.fn<any>((...args: any[]) => {
    errors.push(args.join(' '));
  });

  console.warn = jest.fn<any>((...args: any[]) => {
    warnings.push(args.join(' '));
  });

  return {
    logs,
    errors,
    warnings,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

/**
 * Create a deferred promise for manual resolution
 */
export function createDeferred<T = void>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Advance timers by time and flush promises
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}

/**
 * Mock chrome.runtime.sendMessage for testing
 */
export function createMockSendMessage() {
  const responses = new Map<string, any>();

  const sendMessage = jest.fn<any>((message: any, callback?: (response: any) => void) => {
    const response = responses.get(message.type) || { success: true };
    if (callback) {
      callback(response);
    }
    return Promise.resolve(response);
  });

  return {
    sendMessage,
    mockResponse: (messageType: string, response: any) => {
      responses.set(messageType, response);
    },
    clear: () => responses.clear(),
  };
}

/**
 * Create a test error with specific properties
 */
export function createTestError(message: string, code?: string): Error {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
}

/**
 * Assert that a function throws a specific error
 */
export async function expectToThrow(
  fn: () => Promise<any> | any,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error: any) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError);
      } else {
        expect(error.message).toMatch(expectedError);
      }
    }
  }
}

/**
 * Generate a random string for testing
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate a random email for testing
 */
export function randomEmail(): string {
  return `test-${randomString()}@example.com`;
}

/**
 * Create a mock event for testing
 */
export function createMockEvent<T extends Event>(
  type: string,
  properties: Partial<T> = {}
): T {
  const event = new Event(type) as T;
  Object.assign(event, properties);
  return event;
}

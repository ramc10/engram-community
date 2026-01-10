/**
 * Builder pattern utilities for creating test objects
 * Provides fluent API for building complex test data
 */

import { Memory, MemoryWithMemA, UUID } from '@engram/core';
import { generateTestUUID } from '../__fixtures__/memories';

/**
 * Fluent builder for Memory objects
 */
export class MemoryBuilder {
  private memory: Partial<Memory>;

  constructor() {
    this.memory = {
      id: generateTestUUID(),
      conversationId: generateTestUUID(),
      platform: 'chatgpt',
      content: {
        role: 'user',
        text: 'Test message',
        metadata: {},
      },
      timestamp: Date.now(),
      vectorClock: {},
      deviceId: 'test-device-1',
      syncStatus: 'pending',
      tags: [],
    };
  }

  withId(id: UUID): this {
    this.memory.id = id;
    return this;
  }

  withConversationId(conversationId: UUID): this {
    this.memory.conversationId = conversationId;
    return this;
  }

  withPlatform(platform: 'chatgpt' | 'claude' | 'perplexity'): this {
    this.memory.platform = platform;
    return this;
  }

  withContent(text: string, role: 'user' | 'assistant' = 'user'): this {
    this.memory.content = {
      role,
      text,
      metadata: this.memory.content?.metadata || {},
    };
    return this;
  }

  withRole(role: 'user' | 'assistant'): this {
    if (this.memory.content) {
      this.memory.content.role = role;
    }
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    if (this.memory.content) {
      this.memory.content.metadata = { ...this.memory.content.metadata, ...metadata };
    }
    return this;
  }

  withTimestamp(timestamp: number): this {
    this.memory.timestamp = timestamp;
    return this;
  }

  withDeviceId(deviceId: string): this {
    this.memory.deviceId = deviceId;
    return this;
  }

  withSyncStatus(status: 'pending' | 'synced' | 'failed'): this {
    this.memory.syncStatus = status;
    return this;
  }

  withTags(tags: string[]): this {
    this.memory.tags = tags;
    return this;
  }

  encrypted(): this {
    const contentText = this.memory.content?.text || 'Test message';
    this.memory.encryptedContent = {
      version: 1,
      algorithm: 'XChaCha20-Poly1305',
      nonce: btoa('test-nonce-' + Math.random()),
      ciphertext: btoa(JSON.stringify(this.memory.content)),
    };
    this.memory.content = {
      role: this.memory.content?.role || 'user',
      text: '[ENCRYPTED]',
      metadata: {},
    };
    return this;
  }

  enriched(options: { keywords?: string[]; tags?: string[]; context?: string } = {}): this {
    const {
      keywords = ['test', 'example', 'keyword'],
      tags = ['testing', 'unit-test'],
      context = 'Test context for enriched memory',
    } = options;

    (this.memory as any).keywords = keywords;
    (this.memory as any).tags = tags;
    (this.memory as any).context = context;
    (this.memory as any).memAVersion = 1;

    return this;
  }

  withEmbedding(embedding?: Float32Array): this {
    (this.memory as any).embedding = embedding || new Float32Array(384).map(() => Math.random());
    return this;
  }

  withLinks(links: Array<{ memoryId: UUID; score: number }>): this {
    (this.memory as any).links = links.map(link => ({
      ...link,
      createdAt: Date.now(),
    }));
    return this;
  }

  withEvolution(history: any[]): this {
    (this.memory as any).evolution = { history };
    return this;
  }

  build(): Memory {
    return this.memory as Memory;
  }

  buildEnriched(): MemoryWithMemA {
    return this.memory as MemoryWithMemA;
  }
}

/**
 * Fluent builder for User objects
 */
export class UserBuilder {
  private user: any;

  constructor() {
    this.user = {
      id: generateTestUUID(),
      email: `test-${Date.now()}@example.com`,
      tier: 'FREE',
      syncEnabled: false,
      deviceId: generateTestUUID(),
      createdAt: Date.now(),
    };
  }

  withId(id: UUID): this {
    this.user.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  withTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): this {
    this.user.tier = tier;
    return this;
  }

  premium(): this {
    this.user.tier = 'PRO';
    return this;
  }

  enterprise(): this {
    this.user.tier = 'ENTERPRISE';
    return this;
  }

  withSyncEnabled(enabled: boolean): this {
    this.user.syncEnabled = enabled;
    return this;
  }

  withDeviceId(deviceId: UUID): this {
    this.user.deviceId = deviceId;
    return this;
  }

  build() {
    return this.user;
  }
}

/**
 * Fluent builder for API responses
 */
export class APIResponseBuilder<T = any> {
  private response: {
    status: number;
    ok: boolean;
    data: T | null;
  };

  constructor() {
    this.response = {
      status: 200,
      ok: true,
      data: null,
    };
  }

  withStatus(status: number): this {
    this.response.status = status;
    this.response.ok = status >= 200 && status < 300;
    return this;
  }

  withData(data: T): this {
    this.response.data = data;
    return this;
  }

  asSuccess(data: T): this {
    return this.withStatus(200).withData(data);
  }

  asError(status: number, error: any): this {
    return this.withStatus(status).withData(error);
  }

  asNotFound(): this {
    return this.asError(404, { error: 'Not found' });
  }

  asUnauthorized(): this {
    return this.asError(401, { error: 'Unauthorized' });
  }

  asRateLimited(): this {
    return this.asError(429, {
      error: 'Rate limit exceeded',
      retryAfter: 60,
    });
  }

  asServerError(): this {
    return this.asError(500, { error: 'Internal server error' });
  }

  build(): Response {
    return {
      ok: this.response.ok,
      status: this.response.status,
      json: async () => this.response.data,
      text: async () => JSON.stringify(this.response.data),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as Response;
  }
}

/**
 * Fluent builder for Chrome storage mock
 */
export class ChromeStorageBuilder {
  private storage: Map<string, any>;

  constructor() {
    this.storage = new Map();
  }

  withItem(key: string, value: any): this {
    this.storage.set(key, value);
    return this;
  }

  withItems(items: Record<string, any>): this {
    Object.entries(items).forEach(([key, value]) => {
      this.storage.set(key, value);
    });
    return this;
  }

  withMasterKey(encrypted: any): this {
    this.storage.set('encrypted_master_key', encrypted);
    return this;
  }

  withDeviceKey(key: any): this {
    this.storage.set('device_encryption_key', key);
    return this;
  }

  withEnrichmentConfig(config: any): this {
    this.storage.set('enrichmentConfig', config);
    return this;
  }

  build() {
    return {
      storage: this.storage,
      get: jest.fn((keys: string | string[] | null) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: this.storage.get(keys) });
        }
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (this.storage.has(key)) {
              result[key] = this.storage.get(key);
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve(Object.fromEntries(this.storage));
      }),
      set: jest.fn((items: Record<string, any>) => {
        Object.entries(items).forEach(([key, value]) => {
          this.storage.set(key, value);
        });
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => this.storage.delete(key));
        return Promise.resolve();
      }),
      clear: () => this.storage.clear(),
    };
  }
}

// Helper functions for quick builder access
export const buildMemory = () => new MemoryBuilder();
export const buildUser = () => new UserBuilder();
export const buildAPIResponse = <T = any>() => new APIResponseBuilder<T>();
export const buildChromeStorage = () => new ChromeStorageBuilder();

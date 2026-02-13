/**
 * Unit tests for SQLiteStorage
 */

import { SQLiteStorage } from '../../src/storage/sqlite-storage';
import { createTestMemory, createTestConversation, createTestMemories, TEST_DEVICE_ID } from '../__fixtures__/memories';

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage;

  beforeEach(async () => {
    // Use in-memory database for fast tests
    storage = new SQLiteStorage(':memory:', TEST_DEVICE_ID);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('initialize', () => {
    it('should create tables and indexes', async () => {
      const stats = await storage.getStats();
      expect(stats.totalMemories).toBe(0);
      expect(stats.totalConversations).toBe(0);
    });
  });

  describe('saveMemory / getMemory', () => {
    it('should save and retrieve a memory', async () => {
      const memory = createTestMemory({ id: 'test-save-001' });
      await storage.saveMemory(memory);

      const retrieved = await storage.getMemory('test-save-001');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('test-save-001');
      expect(retrieved!.content.text).toBe(memory.content.text);
      expect(retrieved!.platform).toBe(memory.platform);
      expect(retrieved!.tags).toEqual(memory.tags);
    });

    it('should return null for non-existent memory', async () => {
      const result = await storage.getMemory('does-not-exist');
      expect(result).toBeNull();
    });

    it('should auto-create conversation on save', async () => {
      const memory = createTestMemory({ conversationId: 'auto-conv-001' });
      await storage.saveMemory(memory);

      const conversation = await storage.getConversation('auto-conv-001');
      expect(conversation).not.toBeNull();
      expect(conversation!.platform).toBe(memory.platform);
      expect(conversation!.messageCount).toBe(1);
    });

    it('should increment conversation message count', async () => {
      const mem1 = createTestMemory({ id: 'msg-1', conversationId: 'conv-inc' });
      const mem2 = createTestMemory({ id: 'msg-2', conversationId: 'conv-inc' });

      await storage.saveMemory(mem1);
      await storage.saveMemory(mem2);

      const conversation = await storage.getConversation('conv-inc');
      expect(conversation!.messageCount).toBe(2);
    });
  });

  describe('getMemories', () => {
    beforeEach(async () => {
      const memories = createTestMemories(20);
      for (const memory of memories) {
        await storage.saveMemory(memory);
      }
    });

    it('should list memories with default limit', async () => {
      const memories = await storage.getMemories({});
      expect(memories.length).toBe(20);
    });

    it('should filter by platform', async () => {
      const memories = await storage.getMemories({ platform: 'chatgpt' });
      expect(memories.every((m) => m.platform === 'chatgpt')).toBe(true);
    });

    it('should filter by conversationId', async () => {
      const memories = await storage.getMemories({ conversationId: 'conv-000' });
      expect(memories.every((m) => m.conversationId === 'conv-000')).toBe(true);
    });

    it('should filter by tags', async () => {
      const memories = await storage.getMemories({ tags: ['important'] });
      expect(memories.every((m) => m.tags.includes('important'))).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const page1 = await storage.getMemories({ limit: 5, offset: 0 });
      const page2 = await storage.getMemories({ limit: 5, offset: 5 });

      expect(page1.length).toBe(5);
      expect(page2.length).toBe(5);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('deleteMemory', () => {
    it('should delete a memory', async () => {
      const memory = createTestMemory({ id: 'delete-me' });
      await storage.saveMemory(memory);

      await storage.deleteMemory('delete-me');
      const result = await storage.getMemory('delete-me');
      expect(result).toBeNull();
    });
  });

  describe('searchMemories', () => {
    it('should find memories by text search', async () => {
      const memory = createTestMemory({
        id: 'search-001',
        content: { role: 'user', text: 'How to implement websockets in Python' },
      });
      await storage.saveMemory(memory);

      const results = await storage.searchMemories('websockets Python');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('search-001');
    });

    it('should return empty for non-matching queries', async () => {
      const memory = createTestMemory({ id: 'search-002' });
      await storage.saveMemory(memory);

      const results = await storage.searchMemories('zzzznonexistenttermzzzz');
      expect(results.length).toBe(0);
    });
  });

  describe('conversations', () => {
    it('should save and retrieve a conversation', async () => {
      const conversation = createTestConversation({ id: 'conv-test-001' });
      await storage.saveConversation(conversation);

      const retrieved = await storage.getConversation('conv-test-001');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe(conversation.title);
      expect(retrieved!.platform).toBe(conversation.platform);
    });

    it('should filter conversations by platform', async () => {
      await storage.saveConversation(createTestConversation({ id: 'c1', platform: 'chatgpt' }));
      await storage.saveConversation(createTestConversation({ id: 'c2', platform: 'claude' }));
      await storage.saveConversation(createTestConversation({ id: 'c3', platform: 'chatgpt' }));

      const chatgptConvs = await storage.getConversations({ platform: 'chatgpt' });
      expect(chatgptConvs.length).toBe(2);
      expect(chatgptConvs.every((c) => c.platform === 'chatgpt')).toBe(true);
    });
  });

  describe('metadata', () => {
    it('should store and retrieve metadata', async () => {
      await storage.setMetadata('testKey', { value: 42 });
      const result = await storage.getMetadata<{ value: number }>('testKey');
      expect(result).toEqual({ value: 42 });
    });

    it('should return null for missing metadata', async () => {
      const result = await storage.getMetadata('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('modifyTags', () => {
    it('should add tags', async () => {
      const memory = createTestMemory({ id: 'tag-test', tags: ['existing'] });
      await storage.saveMemory(memory);

      const updated = await storage.modifyTags('tag-test', ['new-tag']);
      expect(updated).toContain('existing');
      expect(updated).toContain('new-tag');
    });

    it('should remove tags', async () => {
      const memory = createTestMemory({ id: 'tag-test-2', tags: ['keep', 'remove'] });
      await storage.saveMemory(memory);

      const updated = await storage.modifyTags('tag-test-2', undefined, ['remove']);
      expect(updated).toContain('keep');
      expect(updated).not.toContain('remove');
    });

    it('should not duplicate tags', async () => {
      const memory = createTestMemory({ id: 'tag-test-3', tags: ['existing'] });
      await storage.saveMemory(memory);

      const updated = await storage.modifyTags('tag-test-3', ['existing', 'new']);
      expect(updated.filter((t) => t === 'existing').length).toBe(1);
    });
  });

  describe('bulkSaveMemories', () => {
    it('should save multiple memories in a transaction', async () => {
      const memories = createTestMemories(10);
      await storage.bulkSaveMemories(memories);

      const stats = await storage.getStats();
      expect(stats.totalMemories).toBe(10);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const memories = createTestMemories(8);
      for (const memory of memories) {
        await storage.saveMemory(memory);
      }

      const stats = await storage.getStats();
      expect(stats.totalMemories).toBe(8);
      expect(stats.totalConversations).toBeGreaterThan(0);
      expect(stats.storageUsedBytes).toBeGreaterThan(0);
    });
  });

  describe('getPlatformBreakdown', () => {
    it('should group counts by platform', async () => {
      const memories = createTestMemories(8);
      for (const memory of memories) {
        await storage.saveMemory(memory);
      }

      const breakdown = await storage.getPlatformBreakdown();
      expect(breakdown).toHaveProperty('chatgpt');
      const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(8);
    });
  });
});

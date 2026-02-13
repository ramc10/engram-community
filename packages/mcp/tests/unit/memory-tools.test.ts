/**
 * Unit tests for memory MCP tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SQLiteStorage } from '../../src/storage/sqlite-storage';
import { registerMemoryTools } from '../../src/tools/memory-tools';
import { TEST_DEVICE_ID, createTestMemory } from '../__fixtures__/memories';

// Helper to call a tool on the server
async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  // Access the internal tool handlers
  const handlers = (server as any)._registeredTools;
  const tool = handlers?.get(name);
  if (!tool) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return tool.callback(args);
}

describe('Memory Tools', () => {
  let server: McpServer;
  let storage: SQLiteStorage;

  beforeEach(async () => {
    storage = new SQLiteStorage(':memory:', TEST_DEVICE_ID);
    await storage.initialize();

    server = new McpServer({ name: 'test', version: '1.0.0' });
    registerMemoryTools(server, storage, null, null, TEST_DEVICE_ID);
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('save_memory', () => {
    it('should save a memory and return its id', async () => {
      const result = await callTool(server, 'save_memory', {
        content: { role: 'user', text: 'Hello, world!' },
        conversationId: 'conv-001',
        platform: 'chatgpt',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBeDefined();
      expect(data.conversationId).toBe('conv-001');
      expect(data.platform).toBe('chatgpt');

      // Verify it was actually saved
      const memory = await storage.getMemory(data.id);
      expect(memory).not.toBeNull();
      expect(memory!.content.text).toBe('Hello, world!');
    });
  });

  describe('get_memory', () => {
    it('should retrieve an existing memory', async () => {
      const memory = createTestMemory({ id: 'get-test-001' });
      await storage.saveMemory(memory);

      const result = await callTool(server, 'get_memory', { id: 'get-test-001' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe('get-test-001');
    });

    it('should return error for non-existent memory', async () => {
      const result = await callTool(server, 'get_memory', { id: 'nonexistent' });
      expect(result.isError).toBe(true);
    });
  });

  describe('delete_memory', () => {
    it('should delete an existing memory', async () => {
      const memory = createTestMemory({ id: 'delete-test-001' });
      await storage.saveMemory(memory);

      const result = await callTool(server, 'delete_memory', { id: 'delete-test-001' });
      expect(result.isError).toBeFalsy();

      const deleted = await storage.getMemory('delete-test-001');
      expect(deleted).toBeNull();
    });
  });

  describe('update_memory_tags', () => {
    it('should add tags to a memory', async () => {
      const memory = createTestMemory({ id: 'tag-test-001', tags: ['existing'] });
      await storage.saveMemory(memory);

      const result = await callTool(server, 'update_memory_tags', {
        id: 'tag-test-001',
        addTags: ['new-tag'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.tags).toContain('existing');
      expect(data.tags).toContain('new-tag');
    });
  });

  describe('list_memories', () => {
    it('should list memories with filters', async () => {
      await storage.saveMemory(createTestMemory({ id: 'm1', platform: 'chatgpt' }));
      await storage.saveMemory(createTestMemory({ id: 'm2', platform: 'claude' }));

      const result = await callTool(server, 'list_memories', { platform: 'chatgpt' });
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(1);
      expect(data.memories[0].platform).toBe('chatgpt');
    });
  });
});

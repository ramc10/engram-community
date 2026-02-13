/**
 * Unit tests for conversation MCP tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SQLiteStorage } from '../../src/storage/sqlite-storage';
import { registerConversationTools } from '../../src/tools/conversation-tools';
import { TEST_DEVICE_ID, createTestMemory, createTestConversation } from '../__fixtures__/memories';

async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  const handlers = (server as any)._registeredTools;
  const tool = handlers?.get(name);
  if (!tool) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return tool.callback(args);
}

describe('Conversation Tools', () => {
  let server: McpServer;
  let storage: SQLiteStorage;

  beforeEach(async () => {
    storage = new SQLiteStorage(':memory:', TEST_DEVICE_ID);
    await storage.initialize();

    server = new McpServer({ name: 'test', version: '1.0.0' });
    registerConversationTools(server, storage);
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('list_conversations', () => {
    it('should list all conversations', async () => {
      await storage.saveConversation(createTestConversation({ id: 'c1', platform: 'chatgpt' }));
      await storage.saveConversation(createTestConversation({ id: 'c2', platform: 'claude' }));

      const result = await callTool(server, 'list_conversations', {});
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });

    it('should filter by platform', async () => {
      await storage.saveConversation(createTestConversation({ id: 'c1', platform: 'chatgpt' }));
      await storage.saveConversation(createTestConversation({ id: 'c2', platform: 'claude' }));

      const result = await callTool(server, 'list_conversations', { platform: 'claude' });
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(1);
      expect(data.conversations[0].platform).toBe('claude');
    });
  });

  describe('get_conversation', () => {
    it('should get conversation with memories', async () => {
      await storage.saveConversation(createTestConversation({ id: 'conv-detail' }));
      await storage.saveMemory(
        createTestMemory({ id: 'm1', conversationId: 'conv-detail' })
      );
      await storage.saveMemory(
        createTestMemory({ id: 'm2', conversationId: 'conv-detail' })
      );

      const result = await callTool(server, 'get_conversation', {
        id: 'conv-detail',
        includeMemories: true,
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe('conv-detail');
      expect(data.memories).toBeDefined();
      expect(data.memories.length).toBe(2);
    });

    it('should return error for non-existent conversation', async () => {
      const result = await callTool(server, 'get_conversation', {
        id: 'nonexistent',
      });
      expect(result.isError).toBe(true);
    });
  });
});

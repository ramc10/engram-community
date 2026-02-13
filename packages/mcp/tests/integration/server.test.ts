/**
 * Integration test: full MCP server roundtrip
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SQLiteStorage } from '../../src/storage/sqlite-storage';
import { registerAll } from '../../src/server';
import { TEST_DEVICE_ID } from '../__fixtures__/memories';

async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  const handlers = (server as any)._registeredTools;
  const tool = handlers?.get(name);
  if (!tool) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return tool.callback(args);
}

describe('Engram MCP Server Integration', () => {
  let server: McpServer;
  let storage: SQLiteStorage;

  beforeEach(async () => {
    storage = new SQLiteStorage(':memory:', TEST_DEVICE_ID);
    await storage.initialize();

    server = new McpServer({ name: 'engram-mcp', version: '1.0.0' });
    registerAll(server, {
      storage,
      cryptoService: null,
      keyManager: null,
      embeddingService: null,
      vectorStore: null,
      deviceId: TEST_DEVICE_ID,
    });
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should complete a save → search → get roundtrip', async () => {
    // 1. Save a memory
    const saveResult = await callTool(server, 'save_memory', {
      content: {
        role: 'user',
        text: 'How do I use async/await in TypeScript for handling multiple API calls?',
      },
      conversationId: 'integration-conv-001',
      platform: 'claude',
      tags: ['typescript', 'async'],
    });
    expect(saveResult.isError).toBeFalsy();
    const saved = JSON.parse(saveResult.content[0].text);
    expect(saved.id).toBeDefined();

    // 2. Search for it
    const searchResult = await callTool(server, 'search_memories', {
      query: 'async await TypeScript',
    });
    expect(searchResult.isError).toBeFalsy();
    const searchData = JSON.parse(searchResult.content[0].text);
    expect(searchData.resultCount).toBeGreaterThan(0);
    expect(searchData.results[0].id).toBe(saved.id);

    // 3. Get it by ID
    const getResult = await callTool(server, 'get_memory', { id: saved.id });
    expect(getResult.isError).toBeFalsy();
    const memory = JSON.parse(getResult.content[0].text);
    expect(memory.id).toBe(saved.id);
    expect(memory.content.text).toContain('async/await');
    expect(memory.tags).toContain('typescript');
  });

  it('should complete a multi-message conversation flow', async () => {
    const conversationId = 'multi-msg-conv';

    // Save multiple messages
    await callTool(server, 'save_memory', {
      content: { role: 'user', text: 'What is React Server Components?' },
      conversationId,
      platform: 'chatgpt',
    });

    await callTool(server, 'save_memory', {
      content: {
        role: 'assistant',
        text: 'React Server Components allow rendering on the server...',
      },
      conversationId,
      platform: 'chatgpt',
    });

    await callTool(server, 'save_memory', {
      content: { role: 'user', text: 'How do they differ from SSR?' },
      conversationId,
      platform: 'chatgpt',
    });

    // List conversation
    const convResult = await callTool(server, 'get_conversation', {
      id: conversationId,
      includeMemories: true,
    });
    const conv = JSON.parse(convResult.content[0].text);
    expect(conv.memories.length).toBe(3);

    // Get stats
    const statsResult = await callTool(server, 'get_stats', {});
    const stats = JSON.parse(statsResult.content[0].text);
    expect(stats.totalMemories).toBe(3);
    expect(stats.totalConversations).toBe(1);
    expect(stats.platformBreakdown.chatgpt).toBe(3);
  });

  it('should handle tag management flow', async () => {
    // Save
    const saveResult = await callTool(server, 'save_memory', {
      content: { role: 'user', text: 'Test message for tagging' },
      conversationId: 'tag-conv',
      platform: 'generic',
      tags: ['initial'],
    });
    const { id } = JSON.parse(saveResult.content[0].text);

    // Add tags
    const addResult = await callTool(server, 'update_memory_tags', {
      id,
      addTags: ['important', 'review'],
    });
    const afterAdd = JSON.parse(addResult.content[0].text);
    expect(afterAdd.tags).toEqual(['initial', 'important', 'review']);

    // Remove tags
    const removeResult = await callTool(server, 'update_memory_tags', {
      id,
      removeTags: ['initial'],
    });
    const afterRemove = JSON.parse(removeResult.content[0].text);
    expect(afterRemove.tags).toEqual(['important', 'review']);

    // List filtered by tag
    const listResult = await callTool(server, 'list_memories', {
      tags: ['important'],
    });
    const listData = JSON.parse(listResult.content[0].text);
    expect(listData.count).toBe(1);
    expect(listData.memories[0].id).toBe(id);
  });

  it('should handle delete flow', async () => {
    const saveResult = await callTool(server, 'save_memory', {
      content: { role: 'user', text: 'Ephemeral message' },
      conversationId: 'delete-conv',
      platform: 'generic',
    });
    const { id } = JSON.parse(saveResult.content[0].text);

    // Delete
    const deleteResult = await callTool(server, 'delete_memory', { id });
    expect(deleteResult.isError).toBeFalsy();

    // Verify gone
    const getResult = await callTool(server, 'get_memory', { id });
    expect(getResult.isError).toBe(true);
  });
});

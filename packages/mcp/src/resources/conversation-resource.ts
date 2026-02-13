/**
 * MCP resource for conversations
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';

export function registerConversationResource(server: McpServer, storage: SQLiteStorage): void {
  server.resource(
    'conversation',
    new ResourceTemplate('conversation://{id}', { list: undefined }),
    {
      description: 'AI conversation with all messages',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      const conversation = await storage.getConversation(id as string);
      if (!conversation) {
        throw new Error(`Conversation not found: ${id}`);
      }

      const memories = await storage.getMemories({
        conversationId: id as string,
        limit: 200,
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                ...conversation,
                memories: memories.map((m) => ({
                  id: m.id,
                  role: m.content.role,
                  text: m.content.text || '[encrypted]',
                  timestamp: m.timestamp,
                  tags: m.tags,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

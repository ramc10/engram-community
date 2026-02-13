/**
 * MCP tools for conversation management
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import { PlatformSchema, DateStringSchema } from '../utils/validators';

export function registerConversationTools(
  server: McpServer,
  storage: SQLiteStorage
): void {
  // ===== list_conversations =====
  server.tool(
    'list_conversations',
    'List conversations with optional filters',
    {
      platform: PlatformSchema.optional(),
      startDate: DateStringSchema.optional(),
      endDate: DateStringSchema.optional(),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    async ({ platform, startDate, endDate, limit }) => {
      try {
        const conversations = await storage.getConversations({
          platform,
          startDate: startDate ? new Date(startDate).getTime() : undefined,
          endDate: endDate ? new Date(endDate).getTime() : undefined,
          limit,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  count: conversations.length,
                  conversations: conversations.map((c) => ({
                    id: c.id,
                    platform: c.platform,
                    title: c.title || 'Untitled',
                    messageCount: c.messageCount,
                    createdAt: c.createdAt,
                    lastMessageAt: c.lastMessageAt,
                    tags: c.tags,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ===== get_conversation =====
  server.tool(
    'get_conversation',
    'Get a conversation with its messages',
    {
      id: z.string().describe('Conversation ID'),
      includeMemories: z.boolean().optional().default(true).describe('Include all messages'),
      limit: z.number().int().min(1).max(200).optional().default(50),
    },
    async ({ id, includeMemories, limit }) => {
      try {
        const conversation = await storage.getConversation(id);
        if (!conversation) {
          return {
            content: [{ type: 'text' as const, text: `Conversation not found: ${id}` }],
            isError: true,
          };
        }

        let memories = undefined;
        if (includeMemories) {
          const mems = await storage.getMemories({
            conversationId: id,
            limit,
          });
          memories = mems.map((m) => ({
            id: m.id,
            role: m.content.role,
            text: m.content.text || '[encrypted]',
            timestamp: m.timestamp,
            tags: m.tags,
          }));
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ...conversation,
                  memories,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}

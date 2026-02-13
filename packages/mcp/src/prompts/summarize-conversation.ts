/**
 * MCP prompt: summarize a conversation
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';

export function registerSummarizePrompt(server: McpServer, storage: SQLiteStorage): void {
  server.prompt(
    'summarize_conversation',
    'Generate a summary of a conversation',
    {
      conversationId: z.string().describe('Conversation ID to summarize'),
      style: z
        .enum(['brief', 'detailed', 'bullet-points'])
        .optional()
        .default('brief')
        .describe('Summary style'),
    },
    async ({ conversationId, style }) => {
      const conversation = await storage.getConversation(conversationId);
      const memories = await storage.getMemories({
        conversationId,
        limit: 100,
      });

      const title = conversation?.title || 'Untitled';
      const platform = conversation?.platform || 'unknown';

      const messagesText = memories
        .map((m) => `[${m.content.role}]: ${m.content.text || '[encrypted]'}`)
        .join('\n\n');

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Summarize this AI conversation in ${style} style.\n\nConversation: ${title}\nPlatform: ${platform}\nMessages: ${memories.length}\n\n${messagesText}`,
            },
          },
        ],
      };
    }
  );
}

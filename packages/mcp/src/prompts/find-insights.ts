/**
 * MCP prompt: find insights across memories
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import type { MemoryWithMemA } from '@engram/core';
import { PlatformSchema } from '../utils/validators';

export function registerFindInsightsPrompt(server: McpServer, storage: SQLiteStorage): void {
  server.prompt(
    'find_insights',
    'Discover patterns and insights across stored memories',
    {
      topic: z.string().optional().describe('Focus area for insights'),
      platform: PlatformSchema.optional(),
      limit: z.number().int().min(5).max(50).optional().default(20),
    },
    async ({ topic, platform, limit }) => {
      let memories;
      if (topic) {
        memories = await storage.searchMemories(topic, limit);
      } else {
        memories = await storage.getMemories({ platform, limit });
      }

      const memoriesText = memories
        .map((m) => {
          const mem = m as MemoryWithMemA;
          let line = `[${m.platform}/${m.content.role}] ${m.content.text || '[encrypted]'}`;
          if (mem.keywords) {
            line += `\nKeywords: ${mem.keywords.join(', ')}`;
          }
          if (mem.context) {
            line += `\nContext: ${mem.context}`;
          }
          return line;
        })
        .join('\n---\n');

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Analyze these ${memories.length} AI conversation memories and identify:\n1. Recurring themes and topics\n2. Knowledge patterns\n3. Questions that were asked repeatedly\n4. Areas of deep exploration\n5. Potential knowledge gaps\n\n${topic ? `Focus area: ${topic}\n` : ''}Memories:\n${memoriesText}`,
            },
          },
        ],
      };
    }
  );
}

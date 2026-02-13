/**
 * MCP tools for analytics and statistics
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import type { VectorStore } from '../embeddings/vector-store';
import type { KeyManager } from '../crypto/key-manager';

export function registerAnalyticsTools(
  server: McpServer,
  storage: SQLiteStorage,
  vectorStore: VectorStore | null,
  keyManager: KeyManager | null
): void {
  server.tool(
    'get_stats',
    'Get storage statistics: memory count, conversation count, platform breakdown, and more',
    {},
    async () => {
      try {
        const stats = await storage.getStats();
        const platformBreakdown = await storage.getPlatformBreakdown();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  totalMemories: stats.totalMemories,
                  totalConversations: stats.totalConversations,
                  storageUsedBytes: stats.storageUsedBytes,
                  storageUsedMB: Math.round((stats.storageUsedBytes / 1024 / 1024) * 100) / 100,
                  platformBreakdown,
                  oldestMemory: stats.oldestMemory
                    ? new Date(stats.oldestMemory).toISOString()
                    : null,
                  newestMemory: stats.newestMemory
                    ? new Date(stats.newestMemory).toISOString()
                    : null,
                  embeddingsAvailable: vectorStore ? vectorStore.size() > 0 : false,
                  embeddingsCount: vectorStore?.size() || 0,
                  encryptionEnabled: keyManager?.isAvailable() || false,
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

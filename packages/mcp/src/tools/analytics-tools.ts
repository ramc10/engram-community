/**
 * MCP tools for analytics and statistics
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import type { VectorStore } from '../embeddings/vector-store';
import type { EmbeddingService } from '../embeddings/embedding-service';
import type { KeyManager } from '../crypto/key-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('analytics-tools');

export function registerAnalyticsTools(
  server: McpServer,
  storage: SQLiteStorage,
  vectorStore: VectorStore | null,
  keyManager: KeyManager | null,
  embeddingService: EmbeddingService | null = null
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

  // ===== reindex_embeddings =====
  server.tool(
    'reindex_embeddings',
    [
      'Generate and store embeddings for memories that currently have none.',
      '',
      'The vector store is populated at startup from rows that already have an',
      'embedding column.  New memories saved via save_memory or import_conversation',
      'do not automatically receive embeddings — this tool backfills them.',
      '',
      'Requires ENGRAM_ENABLE_EMBEDDINGS=true and @xenova/transformers installed.',
      'The first call will download the BGE-Small model (~130 MB) if not cached.',
      '',
      'Progress is streamed via log output; the tool returns counts when done.',
    ].join('\n'),
    {
      batchSize: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(50)
        .describe('Memories to process per batch (default 50)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100000)
        .optional()
        .describe('Maximum total memories to index in this run (omit for all)'),
    },
    async ({ batchSize, limit }) => {
      if (!embeddingService) {
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                'Embedding service is not available.',
                'Set ENGRAM_ENABLE_EMBEDDINGS=true and install @xenova/transformers:',
                '  npm install @xenova/transformers',
                'Then restart the MCP server.',
              ].join('\n'),
            },
          ],
          isError: true,
        };
      }

      if (!vectorStore) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Vector store is not initialised. Ensure embeddings are enabled at startup.',
            },
          ],
          isError: true,
        };
      }

      try {
        // Collect all memories that lack embeddings
        const allMemories = await storage.getMemories({
          limit: limit || 100000,
          offset: 0,
        });

        const withEmbeddings = await storage.getMemoriesWithEmbeddings();
        const alreadyIndexed = new Set(withEmbeddings.map((e) => e.id));
        const toIndex = allMemories.filter(
          (m) => !alreadyIndexed.has(m.id) && m.content.text
        );

        logger.info(
          `reindex_embeddings: ${toIndex.length} memories to index ` +
            `(${alreadyIndexed.size} already have embeddings)`
        );

        let indexed = 0;
        let failed = 0;

        for (let i = 0; i < toIndex.length; i += batchSize) {
          const batch = toIndex.slice(i, i + batchSize);

          for (const memory of batch) {
            try {
              const enhancedText = embeddingService.buildEnhancedText({
                text: memory.content.text,
                keywords: (memory as any).keywords,
                tags: memory.tags,
                context: (memory as any).context,
              });

              const vector = await embeddingService.embed(enhancedText);
              const embedding = new Float32Array(vector);

              // Persist to SQLite
              await storage.updateEmbedding(memory.id, embedding);
              // Update in-memory vector store (live search picks it up immediately)
              vectorStore.set(memory.id, embedding);

              indexed++;
            } catch (err) {
              logger.warn(`Failed to embed memory ${memory.id}: ${(err as Error).message}`);
              failed++;
            }
          }

          logger.info(
            `reindex_embeddings: progress ${Math.min(i + batchSize, toIndex.length)}/${toIndex.length}`
          );
        }

        logger.info(`reindex_embeddings complete: ${indexed} indexed, ${failed} failed`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  indexed,
                  failed,
                  alreadyHadEmbeddings: alreadyIndexed.size,
                  totalVectorStoreSize: vectorStore.size(),
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

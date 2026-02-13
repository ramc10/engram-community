/**
 * MCP tools for semantic search and discovery
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import type { VectorStore } from '../embeddings/vector-store';
import type { EmbeddingService } from '../embeddings/embedding-service';
import type { MemoryWithMemA } from '@engram/core';
import { PlatformSchema } from '../utils/validators';
import { createLogger } from '../utils/logger';

const logger = createLogger('search-tools');

export function registerSearchTools(
  server: McpServer,
  storage: SQLiteStorage,
  embeddingService: EmbeddingService | null,
  vectorStore: VectorStore | null
): void {
  // ===== semantic_search =====
  server.tool(
    'semantic_search',
    'Search memories by meaning using semantic embeddings (falls back to full-text search)',
    {
      query: z.string().describe('Natural language query to search by meaning'),
      limit: z.number().int().min(1).max(20).optional().default(5),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .default(0.5)
        .describe('Minimum similarity score (0-1)'),
      platform: PlatformSchema.optional(),
    },
    async ({ query, limit, threshold, platform }) => {
      try {
        // Try semantic search first if embeddings are available
        if (embeddingService && vectorStore && vectorStore.size() > 0) {
          const queryEmbedding = await embeddingService.embed(query);

          let results = vectorStore.search(
            new Float32Array(queryEmbedding),
            limit * 2 // Get extra for post-filtering
          );

          // Apply threshold
          results = results.filter((r) => r.score >= threshold);

          // Look up full memories
          const memories = [];
          for (const result of results) {
            const memory = await storage.getMemory(result.id);
            if (memory) {
              if (platform && memory.platform !== platform) continue;
              memories.push({ memory, score: result.score });
            }
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    method: 'semantic',
                    query,
                    resultCount: Math.min(memories.length, limit),
                    results: memories.slice(0, limit).map(({ memory, score }) => ({
                      id: memory.id,
                      score: Math.round(score * 1000) / 1000,
                      conversationId: memory.conversationId,
                      platform: memory.platform,
                      role: memory.content.role,
                      text: memory.content.text?.substring(0, 300) || '[encrypted]',
                      timestamp: memory.timestamp,
                      tags: memory.tags,
                      keywords: (memory as MemoryWithMemA).keywords,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Fallback to FTS5
        logger.debug('Falling back to FTS5 search');
        let results = await storage.searchMemories(query, limit);

        if (platform) {
          results = results.filter((m) => m.platform === platform);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  method: 'full-text',
                  query,
                  resultCount: results.length,
                  results: results.map((m) => ({
                    id: m.id,
                    conversationId: m.conversationId,
                    platform: m.platform,
                    role: m.content.role,
                    text: m.content.text?.substring(0, 300) || '[encrypted]',
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
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ===== find_related =====
  server.tool(
    'find_related',
    'Find memories related to a given memory',
    {
      memoryId: z.string().describe('Memory ID to find related memories for'),
      limit: z.number().int().min(1).max(20).optional().default(5),
    },
    async ({ memoryId, limit }) => {
      try {
        const memory = await storage.getMemory(memoryId);
        if (!memory) {
          return {
            content: [{ type: 'text' as const, text: `Memory not found: ${memoryId}` }],
            isError: true,
          };
        }

        // Try embedding-based search first
        if (vectorStore && vectorStore.size() > 0) {
          const memEmbedding = vectorStore.getEmbedding(memoryId);
          if (memEmbedding) {
            const results = vectorStore
              .search(memEmbedding, limit + 1)
              .filter((r) => r.id !== memoryId)
              .slice(0, limit);

            const related = [];
            for (const result of results) {
              const relatedMem = await storage.getMemory(result.id);
              if (relatedMem) {
                related.push({
                  id: relatedMem.id,
                  score: Math.round(result.score * 1000) / 1000,
                  conversationId: relatedMem.conversationId,
                  platform: relatedMem.platform,
                  role: relatedMem.content.role,
                  text: relatedMem.content.text?.substring(0, 200) || '[encrypted]',
                  timestamp: relatedMem.timestamp,
                  tags: relatedMem.tags,
                });
              }
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    { method: 'semantic', sourceMemoryId: memoryId, results: related },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        // Fallback: find by tag/keyword overlap
        const memA = memory as MemoryWithMemA;
        const searchTerms = [
          ...(memA.keywords || []),
          ...(memory.tags || []),
        ];

        if (searchTerms.length > 0) {
          const ftsQuery = searchTerms.join(' OR ');
          const results = await storage.searchMemories(ftsQuery, limit + 1);
          const filtered = results.filter((m) => m.id !== memoryId).slice(0, limit);

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    method: 'keyword-overlap',
                    sourceMemoryId: memoryId,
                    results: filtered.map((m) => ({
                      id: m.id,
                      conversationId: m.conversationId,
                      platform: m.platform,
                      role: m.content.role,
                      text: m.content.text?.substring(0, 200) || '[encrypted]',
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

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                method: 'none',
                sourceMemoryId: memoryId,
                results: [],
                message: 'No embeddings or keywords available for finding related memories',
              }),
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

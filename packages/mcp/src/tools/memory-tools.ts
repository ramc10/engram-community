/**
 * MCP tools for memory management
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import type { KeyManager } from '../crypto/key-manager';
import type { CryptoService } from '../crypto/crypto-service';
import type { Memory } from '@engram/core';
import { generateUUID, now, createVectorClock, incrementClock, stringToUint8Array } from '@engram/core';
import { PlatformSchema, RoleSchema, DateStringSchema } from '../utils/validators';
import { createLogger } from '../utils/logger';

const logger = createLogger('memory-tools');

export function registerMemoryTools(
  server: McpServer,
  storage: SQLiteStorage,
  keyManager: KeyManager | null,
  cryptoService: CryptoService | null,
  deviceId: string
): void {
  // ===== save_memory =====
  server.tool(
    'save_memory',
    'Save a new conversation memory (message)',
    {
      content: z.object({
        role: RoleSchema,
        text: z.string(),
        metadata: z
          .object({
            codeBlocks: z
              .array(z.object({ language: z.string(), code: z.string() }))
              .optional(),
            attachments: z
              .array(z.object({ type: z.string(), name: z.string() }))
              .optional(),
          })
          .optional(),
      }),
      conversationId: z.string().describe('Conversation ID to group messages'),
      platform: PlatformSchema.describe('AI platform source'),
      tags: z.array(z.string()).optional().describe('Tags to attach'),
      encrypt: z.boolean().optional().describe('Encrypt content at rest (requires passphrase)'),
    },
    async ({ content, conversationId, platform, tags, encrypt }) => {
      try {
        const memory: Memory = {
          id: generateUUID(),
          content: {
            role: content.role,
            text: content.text,
            metadata: content.metadata || undefined,
          },
          conversationId,
          platform,
          timestamp: now(),
          vectorClock: incrementClock(createVectorClock(), deviceId),
          deviceId,
          syncStatus: 'pending',
          tags: tags || [],
        };

        // Encrypt if requested and key is available
        if (encrypt && keyManager?.isAvailable() && cryptoService) {
          const key = keyManager.getKey();
          const blob = await cryptoService.encrypt(
            stringToUint8Array(JSON.stringify({ text: content.text, metadata: content.metadata })),
            key
          );
          memory.encrypted = {
            algorithm: blob.algorithm,
            nonce: blob.nonce,
            ciphertext: blob.ciphertext,
          };
          memory.content.text = null;
          memory.content.metadata = null;
        }

        await storage.saveMemory(memory);
        logger.info(`Saved memory ${memory.id} to conversation ${conversationId}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                id: memory.id,
                conversationId,
                platform,
                timestamp: memory.timestamp,
                encrypted: !!memory.encrypted,
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

  // ===== get_memory =====
  server.tool(
    'get_memory',
    'Retrieve a specific memory by ID',
    {
      id: z.string().describe('Memory UUID'),
    },
    async ({ id }) => {
      try {
        const memory = await storage.getMemory(id);
        if (!memory) {
          return {
            content: [{ type: 'text' as const, text: `Memory not found: ${id}` }],
            isError: true,
          };
        }

        // Attempt decryption if encrypted and key available
        if (
          memory.encrypted &&
          memory.content.text === null &&
          keyManager?.isAvailable() &&
          cryptoService
        ) {
          try {
            const key = keyManager.getKey();
            const blob = {
              version: 1 as const,
              algorithm: memory.encrypted.algorithm,
              nonce: memory.encrypted.nonce,
              ciphertext: memory.encrypted.ciphertext,
              authTag: memory.encrypted.ciphertext.slice(-16),
            };
            const decrypted = await cryptoService.decrypt(blob, key);
            const parsed = JSON.parse(new TextDecoder().decode(decrypted));
            memory.content.text = parsed.text;
            memory.content.metadata = parsed.metadata;
          } catch {
            logger.warn(`Could not decrypt memory ${id}`);
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(memory, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ===== search_memories =====
  server.tool(
    'search_memories',
    'Full-text search across memories',
    {
      query: z.string().describe('Search query text'),
      limit: z.number().int().min(1).max(100).optional().default(20),
      platform: PlatformSchema.optional(),
      startDate: DateStringSchema.optional(),
      endDate: DateStringSchema.optional(),
    },
    async ({ query, limit, platform, startDate, endDate }) => {
      try {
        let results = await storage.searchMemories(query, limit);

        // Apply additional filters
        if (platform) {
          results = results.filter((m) => m.platform === platform);
        }
        if (startDate) {
          const start = new Date(startDate).getTime();
          results = results.filter((m) => m.timestamp >= start);
        }
        if (endDate) {
          const end = new Date(endDate).getTime();
          results = results.filter((m) => m.timestamp <= end);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  query,
                  resultCount: results.length,
                  results: results.map((m) => ({
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
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ===== list_memories =====
  server.tool(
    'list_memories',
    'List memories with filters',
    {
      platform: PlatformSchema.optional(),
      conversationId: z.string().optional(),
      tags: z.array(z.string()).optional(),
      startDate: DateStringSchema.optional(),
      endDate: DateStringSchema.optional(),
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ platform, conversationId, tags, startDate, endDate, limit, offset }) => {
      try {
        const memories = await storage.getMemories({
          platform,
          conversationId,
          tags,
          startDate: startDate ? new Date(startDate).getTime() : undefined,
          endDate: endDate ? new Date(endDate).getTime() : undefined,
          limit,
          offset,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  count: memories.length,
                  memories: memories.map((m) => ({
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
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ===== delete_memory =====
  server.tool(
    'delete_memory',
    'Delete a memory by ID',
    {
      id: z.string().describe('Memory UUID to delete'),
    },
    async ({ id }) => {
      try {
        const existing = await storage.getMemory(id);
        if (!existing) {
          return {
            content: [{ type: 'text' as const, text: `Memory not found: ${id}` }],
            isError: true,
          };
        }

        await storage.deleteMemory(id);
        logger.info(`Deleted memory ${id}`);

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ deleted: true, id }) },
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

  // ===== update_memory_tags =====
  server.tool(
    'update_memory_tags',
    'Add or remove tags on a memory',
    {
      id: z.string().describe('Memory UUID'),
      addTags: z.array(z.string()).optional().describe('Tags to add'),
      removeTags: z.array(z.string()).optional().describe('Tags to remove'),
    },
    async ({ id, addTags, removeTags }) => {
      try {
        const updatedTags = await storage.modifyTags(id, addTags, removeTags);
        logger.info(`Updated tags for memory ${id}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ id, tags: updatedTags }),
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

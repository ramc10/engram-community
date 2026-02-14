/**
 * MCP tools for importing conversation data into the local SQLite store.
 *
 * Two tools are provided:
 *
 * 1. import_conversation — general-purpose bulk importer.  Accepts any array
 *    of memory objects that conform to the @engram/core Memory shape.  Useful
 *    for cold-start seeding from JSON files, CI fixtures, or any external
 *    producer that can serialise to the canonical format.
 *
 * 2. import_from_extension — bridge for the Chrome extension's IndexedDB
 *    export.  The extension stores memories in IndexedDB (Dexie) with
 *    libsodium / XChaCha20-Poly1305 encryption.  Because the browser sandbox
 *    prevents direct filesystem writes, the recommended bridge path is:
 *
 *      Extension background script
 *        → chrome.runtime.sendNativeMessage (native messaging)
 *        or chrome.downloads.download({ url: blobURL })
 *        → JSON file on disk (~/.engram/extension-export.json)
 *        → user runs: npx engram-mcp import-extension
 *        or Claude Desktop calls this MCP tool directly.
 *
 *    The extension export JSON format mirrors the Memory interface so that
 *    no schema translation is required; only field-name normalisation for
 *    camelCase / snake_case differences is handled here.
 *
 * Architecture note
 * -----------------
 * Chrome Extension → IndexedDB (libsodium) ─[export JSON]─► import_from_extension
 *                                                                       │
 *                                                              SQLite (~/.engram/engram.db)
 *                                                                       │
 *                                                               MCP Server tools
 */

import { z } from 'zod';
import * as fs from 'fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import type { Memory } from '@engram/core';
import { generateUUID, now, createVectorClock, incrementClock } from '@engram/core';
import { PlatformSchema, RoleSchema } from '../utils/validators';
import { createLogger } from '../utils/logger';

const logger = createLogger('import-tools');

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

/**
 * A single memory as accepted from an external producer.
 * All fields except role, text, conversationId, and platform are optional so
 * that the tool can be used for quick manual seeding as well as structured
 * exports.
 */
const InboundMemorySchema = z.object({
  /** Existing ID — preserved if provided, generated otherwise */
  id: z.string().optional(),
  role: RoleSchema,
  text: z.string(),
  conversationId: z.string(),
  platform: PlatformSchema,
  timestamp: z.number().optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  context: z.string().optional(),
});

type InboundMemory = z.infer<typeof InboundMemorySchema>;

/**
 * The Chrome extension exports memories with slightly different field names
 * (snake_case from Dexie) alongside the canonical camelCase fields.  This
 * schema accepts both forms so callers don't have to pre-process the export.
 */
const ExtensionMemorySchema = z.object({
  id: z.string().optional(),
  // camelCase (canonical)
  conversationId: z.string().optional(),
  // snake_case (Dexie / extension export)
  conversation_id: z.string().optional(),

  platform: PlatformSchema,

  content: z
    .object({
      role: RoleSchema,
      text: z.string().nullable(),
    })
    .optional(),

  // Flat fields emitted by some export versions
  role: RoleSchema.optional(),
  text: z.string().optional(),

  timestamp: z.number().optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  context: z.string().optional(),
  deviceId: z.string().optional(),
  device_id: z.string().optional(),
  syncStatus: z.string().optional(),
  sync_status: z.string().optional(),
  vectorClock: z.record(z.number()).optional(),
  vector_clock: z.record(z.number()).optional(),
});

type ExtensionMemory = z.infer<typeof ExtensionMemorySchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inboundToMemory(raw: InboundMemory, deviceId: string): Memory {
  return {
    id: raw.id || generateUUID(),
    content: {
      role: raw.role,
      text: raw.text,
    },
    conversationId: raw.conversationId,
    platform: raw.platform,
    timestamp: raw.timestamp || now(),
    vectorClock: incrementClock(createVectorClock(), deviceId),
    deviceId,
    syncStatus: 'pending',
    tags: raw.tags || [],
    // memA fields
    ...(raw.keywords ? { keywords: raw.keywords } : {}),
    ...(raw.context ? { context: raw.context } : {}),
  } as Memory;
}

function extensionMemoryToMemory(raw: ExtensionMemory, deviceId: string): Memory | null {
  // Resolve content
  const role = raw.content?.role ?? raw.role;
  const text = raw.content?.text ?? raw.text ?? null;

  if (!role || text === null || text === undefined) {
    // Skip encrypted memories (text is null) — they cannot be bridged without
    // the passphrase from the extension, which is not available to the MCP.
    return null;
  }

  const conversationId = raw.conversationId ?? raw.conversation_id;
  if (!conversationId) {
    return null;
  }

  const resolvedDeviceId = raw.deviceId ?? raw.device_id ?? deviceId;
  const vectorClock =
    (raw.vectorClock as Record<string, number> | undefined) ??
    (raw.vector_clock as Record<string, number> | undefined) ??
    incrementClock(createVectorClock(), resolvedDeviceId);

  return {
    id: raw.id || generateUUID(),
    content: { role, text },
    conversationId,
    platform: raw.platform,
    timestamp: raw.timestamp ?? now(),
    vectorClock,
    deviceId: resolvedDeviceId,
    syncStatus: 'synced', // treat imported data as already synced
    tags: raw.tags ?? [],
    ...(raw.keywords ? { keywords: raw.keywords } : {}),
    ...(raw.context ? { context: raw.context } : {}),
  } as Memory;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerImportTools(
  server: McpServer,
  storage: SQLiteStorage,
  deviceId: string
): void {
  // ===== import_conversation =====
  server.tool(
    'import_conversation',
    [
      'Bulk-import memories from an external JSON source into local SQLite storage.',
      'Accepts an array of memory objects in the canonical @engram/core format.',
      'Use this for cold-start seeding, migrating from other tools, or importing',
      'a JSON file produced by the Chrome extension export feature.',
      '',
      'Each memory must include: role, text, conversationId, platform.',
      'Optional fields: id, timestamp, tags, keywords, context.',
      'Existing memories with the same id are skipped (no overwrite by default).',
    ].join('\n'),
    {
      memories: z
        .array(InboundMemorySchema)
        .min(1)
        .max(10000)
        .describe('Array of memories to import'),
      overwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe('Replace existing memories with the same id (default: skip)'),
      source: z
        .string()
        .optional()
        .describe('Label describing where this data came from (logged, not stored)'),
    },
    async ({ memories, overwrite, source }) => {
      try {
        const label = source ? `"${source}"` : 'unspecified source';
        logger.info(`Starting import of ${memories.length} memories from ${label}`);

        let imported = 0;
        let skipped = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const raw of memories) {
          try {
            const memory = inboundToMemory(raw, deviceId);

            if (!overwrite) {
              const existing = await storage.getMemory(memory.id);
              if (existing) {
                skipped++;
                continue;
              }
            }

            await storage.saveMemory(memory);
            imported++;
          } catch (err) {
            failed++;
            const msg = (err as Error).message;
            if (errors.length < 10) errors.push(msg); // cap error list
          }
        }

        logger.info(`Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  imported,
                  skipped,
                  failed,
                  ...(errors.length > 0 ? { sampleErrors: errors } : {}),
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

  // ===== import_from_extension =====
  server.tool(
    'import_from_extension',
    [
      'Bridge tool: imports memories exported from the Engram Chrome extension.',
      '',
      'The Chrome extension stores conversations in IndexedDB (Dexie) with',
      'XChaCha20-Poly1305 encryption.  Because the browser cannot write directly',
      'to the filesystem, the recommended workflow is:',
      '',
      '  1. In the extension side-panel, click "Export memories" (Settings → Export).',
      '     This downloads ~/.engram/extension-export.json (or a chosen path).',
      '  2. Call this tool with the file path, or paste the JSON as the `data`',
      '     parameter.',
      '',
      'Note: Encrypted memories (where content.text is null) are skipped because',
      'the extension passphrase is not available to the MCP server.  Export',
      'unencrypted or decrypt in the extension before exporting if you need',
      'those memories here.',
      '',
      'This is the primary bridge between:',
      '  Chrome Extension → IndexedDB  →  [this tool]  →  SQLite  ←  MCP Server',
    ].join('\n'),
    {
      filePath: z
        .string()
        .optional()
        .describe(
          'Absolute path to a JSON file produced by the extension export (e.g. ~/.engram/extension-export.json). Provide either this OR `data`.'
        ),
      data: z
        .array(z.unknown())
        .optional()
        .describe(
          'Raw JSON array of extension memory objects. Provide either this OR `filePath`.'
        ),
      overwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe('Replace existing memories with the same id (default: skip)'),
    },
    async ({ filePath, data, overwrite }) => {
      try {
        if (!filePath && !data) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: provide either `filePath` (path to export JSON) or `data` (array of memory objects).',
              },
            ],
            isError: true,
          };
        }

        let rawItems: unknown[];

        if (filePath) {
          // Expand ~ manually (Node doesn't do it automatically)
          const resolved = filePath.replace(/^~/, process.env.HOME || '');
          if (!fs.existsSync(resolved)) {
            return {
              content: [
                { type: 'text' as const, text: `File not found: ${resolved}` },
              ],
              isError: true,
            };
          }
          const contents = fs.readFileSync(resolved, 'utf-8');
          const parsed: unknown = JSON.parse(contents);
          if (!Array.isArray(parsed)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Export file must contain a JSON array of memory objects.',
                },
              ],
              isError: true,
            };
          }
          rawItems = parsed;
        } else {
          rawItems = data as unknown[];
        }

        logger.info(`Importing ${rawItems.length} extension memories…`);

        let imported = 0;
        let skipped = 0;
        let encryptedSkipped = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const item of rawItems) {
          try {
            const parsed = ExtensionMemorySchema.safeParse(item);
            if (!parsed.success) {
              failed++;
              if (errors.length < 10) errors.push(parsed.error.message);
              continue;
            }

            const memory = extensionMemoryToMemory(parsed.data, deviceId);
            if (!memory) {
              // Encrypted or incomplete — cannot import without the extension key
              encryptedSkipped++;
              continue;
            }

            if (!overwrite) {
              const existing = await storage.getMemory(memory.id);
              if (existing) {
                skipped++;
                continue;
              }
            }

            await storage.saveMemory(memory);
            imported++;
          } catch (err) {
            failed++;
            const msg = (err as Error).message;
            if (errors.length < 10) errors.push(msg);
          }
        }

        logger.info(
          `Extension import complete: ${imported} imported, ${skipped} skipped (duplicate), ` +
            `${encryptedSkipped} skipped (encrypted), ${failed} failed`
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  imported,
                  skippedDuplicate: skipped,
                  skippedEncrypted: encryptedSkipped,
                  failed,
                  note:
                    encryptedSkipped > 0
                      ? 'Encrypted memories were skipped. Re-export from the extension with encryption disabled, or decrypt in the extension before exporting.'
                      : undefined,
                  ...(errors.length > 0 ? { sampleErrors: errors } : {}),
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

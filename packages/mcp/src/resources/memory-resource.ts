/**
 * MCP resource for individual memories
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from '../storage/sqlite-storage';

export function registerMemoryResource(server: McpServer, storage: SQLiteStorage): void {
  server.resource(
    'memory',
    new ResourceTemplate('memory://{id}', { list: undefined }),
    {
      description: 'Individual AI conversation memory',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      const memory = await storage.getMemory(id as string);
      if (!memory) {
        throw new Error(`Memory not found: ${id}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(memory, null, 2),
          },
        ],
      };
    }
  );
}

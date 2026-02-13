/**
 * MCP server setup - registers all tools, resources, and prompts
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLiteStorage } from './storage/sqlite-storage';
import type { CryptoService } from './crypto/crypto-service';
import type { KeyManager } from './crypto/key-manager';
import type { EmbeddingService } from './embeddings/embedding-service';
import type { VectorStore } from './embeddings/vector-store';
import { registerMemoryTools } from './tools/memory-tools';
import { registerConversationTools } from './tools/conversation-tools';
import { registerSearchTools } from './tools/search-tools';
import { registerAnalyticsTools } from './tools/analytics-tools';
import { registerMemoryResource } from './resources/memory-resource';
import { registerConversationResource } from './resources/conversation-resource';
import { registerSummarizePrompt } from './prompts/summarize-conversation';
import { registerFindInsightsPrompt } from './prompts/find-insights';

export interface ServerDependencies {
  storage: SQLiteStorage;
  cryptoService: CryptoService | null;
  keyManager: KeyManager | null;
  embeddingService: EmbeddingService | null;
  vectorStore: VectorStore | null;
  deviceId: string;
}

export function registerAll(server: McpServer, deps: ServerDependencies): void {
  // Tools
  registerMemoryTools(
    server,
    deps.storage,
    deps.keyManager,
    deps.cryptoService,
    deps.deviceId
  );
  registerConversationTools(server, deps.storage);
  registerSearchTools(server, deps.storage, deps.embeddingService, deps.vectorStore);
  registerAnalyticsTools(server, deps.storage, deps.vectorStore, deps.keyManager);

  // Resources
  registerMemoryResource(server, deps.storage);
  registerConversationResource(server, deps.storage);

  // Prompts
  registerSummarizePrompt(server, deps.storage);
  registerFindInsightsPrompt(server, deps.storage);
}

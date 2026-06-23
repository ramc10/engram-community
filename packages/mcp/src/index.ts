#!/usr/bin/env node

/**
 * Engram MCP Server
 * Exposes AI conversation memory management via the Model Context Protocol
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config';
import { createSQLiteStorage } from './storage/sqlite-storage';
import { CryptoService } from './crypto/crypto-service';
import { KeyManager } from './crypto/key-manager';
import { VectorStore } from './embeddings/vector-store';
import { registerAll } from './server';
import { createLogger } from './utils/logger';

const logger = createLogger('engram-mcp');

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info('Starting Engram MCP server...');

  // Initialize storage READ-ONLY. The @engram/native-host process is the single
  // writer + schema owner; opening read-only here makes dual-writer contention
  // impossible by construction. The DB file must already exist (the host creates
  // it on first write).
  const storage = createSQLiteStorage(config.storagePath, config.deviceId, true);
  await storage.initialize();
  logger.info(`Storage opened (read-only) at ${config.storagePath}`);

  // Initialize crypto (if passphrase configured)
  let cryptoService: CryptoService | null = null;
  let keyManager: KeyManager | null = null;
  if (config.encryptionPassphrase) {
    cryptoService = new CryptoService();
    keyManager = new KeyManager(cryptoService, storage);
    await keyManager.deriveFromPassphrase(config.encryptionPassphrase);
    logger.info('Encryption enabled');
  }

  // Initialize embeddings (optional)
  let embeddingService: import('./embeddings/embedding-service').EmbeddingService | null = null;
  let vectorStore: VectorStore | null = null;

  if (config.enableEmbeddings) {
    try {
      const { createEmbeddingService } = await import('./embeddings/embedding-service');
      embeddingService = await createEmbeddingService();

      if (embeddingService) {
        vectorStore = new VectorStore();

        // Load existing embeddings from storage
        const existingEmbeddings = await storage.getMemoriesWithEmbeddings();
        vectorStore.loadFromEntries(existingEmbeddings);
        logger.info(`Loaded ${existingEmbeddings.length} embeddings into vector store`);
      }
    } catch (error) {
      logger.warn('Embedding service unavailable, using FTS5 search only:', (error as Error).message);
    }
  }

  // Create MCP server
  const server = new McpServer({
    name: 'engram-mcp',
    version: '1.0.0',
  });

  // Register all tools, resources, and prompts
  registerAll(server, {
    storage,
    cryptoService,
    keyManager,
    embeddingService,
    vectorStore,
    deviceId: config.deviceId,
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Engram MCP server running on stdio');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    keyManager?.clear();
    await storage.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    keyManager?.clear();
    await storage.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

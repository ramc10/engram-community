/**
 * Embedding Encryption Migration
 * Encrypts all existing unencrypted embeddings
 */

import { MemoryWithMemA } from '@engram/core';
import type { StorageService } from './storage';
import { getCryptoService } from './crypto-service';

export class EmbeddingMigration {
  /**
   * Check if migration is needed
   */
  static async needsMigration(storage: StorageService): Promise<boolean> {
    const memories = await storage.getMemories({ limit: 100 });

    // Check if any memories have unencrypted embeddings
    return memories.some(m => {
      const mem = m as MemoryWithMemA;
      return mem.embedding && !(mem as any).embeddingVersion;
    });
  }

  /**
   * Migrate all unencrypted embeddings to encrypted format
   */
  static async migrateEmbeddings(
    storage: StorageService,
    masterKey: { key: Uint8Array },
    onProgress?: (current: number, total: number) => void
  ): Promise<{ migrated: number; skipped: number; failed: number }> {
    const crypto = await getCryptoService();
    const stats = { migrated: 0, skipped: 0, failed: 0 };

    const memories = await storage.getMemories({});
    const total = memories.length;

    console.log(`[Migration] Starting embedding encryption for ${total} memories`);

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i] as MemoryWithMemA;

      try {
        // Skip if already encrypted
        if ((memory as any).embeddingVersion === 2 || (memory as any).encryptedEmbedding) {
          stats.skipped++;
          continue;
        }

        // Skip if no embedding
        if (!memory.embedding) {
          stats.skipped++;
          continue;
        }

        // Encrypt the embedding
        const embeddingBytes = new Uint8Array(memory.embedding.buffer);
        const encryptedEmbedding = await crypto.encrypt(embeddingBytes, masterKey.key);

        // Update memory
        (memory as any).encryptedEmbedding = encryptedEmbedding;
        (memory as any).embeddingVersion = 2;
        delete (memory as any).embedding;

        // Save to database
        await storage.updateMemory(memory.id, {
          ...(memory as any),
        });

        stats.migrated++;

        if (onProgress && i % 10 === 0) {
          onProgress(i + 1, total);
        }
      } catch (err) {
        console.error(`[Migration] Failed for ${memory.id}:`, err);
        stats.failed++;
      }
    }

    console.log(`[Migration] Complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.failed} failed`);

    return stats;
  }
}

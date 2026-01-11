/**
 * Migration Service for memA
 * Handles schema migrations for existing v0.1.0 memories
 */

import type { MemoryWithMemA, Timestamp } from '@engram/core';
import { getStorageService } from './storage';

/**
 * Migration metadata
 */
interface MigrationMetadata {
  version: number;
  timestamp: Timestamp;
  migratedCount: number;
}

/**
 * Current schema version
 */
const CURRENT_SCHEMA_VERSION = 1;
const MIGRATION_METADATA_KEY = 'memA_migration_metadata';

/**
 * Migration Service
 * Handles backward-compatible migrations from v0.1.0 to memA
 */
export class MigrationService {
  /**
   * Check if migration is needed
   */
  async needsMigration(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(MIGRATION_METADATA_KEY);
      const metadata = result[MIGRATION_METADATA_KEY] as MigrationMetadata | undefined;

      // If no metadata exists, migration is needed
      if (!metadata) {
        return true;
      }

      // If version is older than current, migration is needed
      return metadata.version < CURRENT_SCHEMA_VERSION;
    } catch (error) {
      console.error('[Migration] Failed to check migration status:', error);
      return false;
    }
  }

  /**
   * Run migration from v0.1.0 to memA
   * Non-destructive: only adds optional fields
   */
  async migrate(
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; migratedCount: number; error?: string }> {
    try {
      const storage = await getStorageService();

      // Get all existing memories
      const allMemories = await storage.getMemories({ limit: 10000 });

      if (allMemories.length === 0) {
        // No memories to migrate
        await this.saveMigrationMetadata({
          version: CURRENT_SCHEMA_VERSION,
          timestamp: Date.now(),
          migratedCount: 0,
        });
        return { success: true, migratedCount: 0 };
      }

      let migratedCount = 0;

      // Migrate in batches of 50
      const batchSize = 50;
      for (let i = 0; i < allMemories.length; i += batchSize) {
        const batch = allMemories.slice(i, i + batchSize);
        const migratedBatch: MemoryWithMemA[] = batch.map((memory) => {
          // Cast to MemoryWithMemA and ensure memA fields exist (undefined is fine)
          const migratedMemory = memory as MemoryWithMemA;

          // Only add memAVersion if it doesn't exist
          // This ensures we don't overwrite already-enriched memories
          if (!migratedMemory.memAVersion) {
            migratedMemory.memAVersion = 0; // Version 0 = not yet enriched
          }

          return migratedMemory;
        });

        // Save migrated batch
        await storage.bulkSaveMemories(migratedBatch);
        migratedCount += batch.length;

        // Report progress
        if (onProgress) {
          onProgress(migratedCount, allMemories.length);
        }
      }

      // Save migration metadata
      await this.saveMigrationMetadata({
        version: CURRENT_SCHEMA_VERSION,
        timestamp: Date.now(),
        migratedCount,
      });

      console.log(
        `[Migration] Successfully migrated ${migratedCount} memories to memA schema`
      );

      return { success: true, migratedCount };
    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      return {
        success: false,
        migratedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<MigrationMetadata | null> {
    try {
      const result = await chrome.storage.local.get(MIGRATION_METADATA_KEY);
      return (result[MIGRATION_METADATA_KEY] as MigrationMetadata) || null;
    } catch (error) {
      console.error('[Migration] Failed to get migration status:', error);
      return null;
    }
  }

  /**
   * Save migration metadata
   */
  private async saveMigrationMetadata(metadata: MigrationMetadata): Promise<void> {
    await chrome.storage.local.set({ [MIGRATION_METADATA_KEY]: metadata });
  }

  /**
   * Reset migration (for testing only)
   */
  async resetMigration(): Promise<void> {
    await chrome.storage.local.remove(MIGRATION_METADATA_KEY);
    console.log('[Migration] Migration metadata reset');
  }
}

/**
 * Global singleton instance
 */
let migrationInstance: MigrationService | null = null;

/**
 * Get the global MigrationService instance
 */
export function getMigrationService(): MigrationService {
  if (!migrationInstance) {
    migrationInstance = new MigrationService();
  }
  return migrationInstance;
}

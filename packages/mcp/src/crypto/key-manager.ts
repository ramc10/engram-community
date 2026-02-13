/**
 * Key manager for Engram MCP server
 * Handles passphrase-based key derivation and master key lifecycle
 */

import type { MasterKey } from '@engram/core';
import { base64ToUint8Array, uint8ArrayToBase64 } from '@engram/core';
import { CryptoService } from './crypto-service';
import type { SQLiteStorage } from '../storage/sqlite-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('key-manager');

const SALT_METADATA_KEY = 'masterKeySalt';

export class KeyManager {
  private masterKey: MasterKey | null = null;
  private cryptoService: CryptoService;
  private storage: SQLiteStorage;

  constructor(cryptoService: CryptoService, storage: SQLiteStorage) {
    this.cryptoService = cryptoService;
    this.storage = storage;
  }

  /**
   * Derive master key from passphrase.
   * Loads existing salt from storage, or generates a new one on first use.
   */
  async deriveFromPassphrase(passphrase: string): Promise<void> {
    // Check if we have an existing salt
    const existingSalt = await this.storage.getMetadata<string>(SALT_METADATA_KEY);

    let salt: Uint8Array | undefined;
    if (existingSalt) {
      salt = base64ToUint8Array(existingSalt);
      logger.info('Using existing salt from storage');
    } else {
      logger.info('First-time setup: generating new salt');
    }

    this.masterKey = await this.cryptoService.deriveKey(passphrase, salt);

    // Persist salt if new
    if (!existingSalt) {
      await this.storage.setMetadata(
        SALT_METADATA_KEY,
        uint8ArrayToBase64(this.masterKey.salt)
      );
      logger.info('Salt persisted to storage');
    }

    logger.info('Master key derived successfully');
  }

  /**
   * Get the master key. Throws if not derived yet.
   */
  getKey(): Uint8Array {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveFromPassphrase() first.');
    }
    return this.masterKey.key;
  }

  /**
   * Check if master key is available
   */
  isAvailable(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Clear master key from memory
   */
  clear(): void {
    if (this.masterKey) {
      // Zero out key bytes before dropping reference
      this.masterKey.key.fill(0);
      this.masterKey = null;
      logger.info('Master key cleared from memory');
    }
  }
}

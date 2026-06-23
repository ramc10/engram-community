/**
 * Background Service Worker
 * Central coordinator for Engram extension
 * 
 * Responsibilities:
 * - Initialize crypto and storage services
 * - Handle messages from content scripts
 * - Coordinate message encryption and storage
 * - Manage extension lifecycle
 */

import { MasterKey, generateUUID } from '@engram/core';
// Import CryptoService from local lib (not from @engram/core to avoid bundling issues)
import { CryptoService } from '../lib/crypto-service';
import { StorageService } from '../lib/storage';
import { Message, createErrorResponse } from '../lib/messages';
import { handleMessage } from './message-handler';
import { registerCaptureContextMenus, registerContextMenuClickHandler } from '../lib/context-menus';
import { runBridge } from '../lib/bridge-runtime';
// LAZY LOADED: EmbeddingMigration — loaded dynamically to reduce initial bundle size
import { authClient } from '../lib/auth-client';
import { getMigrationService } from '../lib/migration-service';
import { DeviceKeyManager } from '../lib/device-key-manager';
import { createLogger } from '../lib/logger';
// Import ErrorSeverity from separate file for tree-shaking
import { ErrorSeverity } from '../lib/error-types';

// Types for lazy-loaded modules
type EmbeddingMigrationModule = typeof import('../lib/embedding-migration');

// Lazy module loaders (cached after first load)
let embeddingMigrationModule: EmbeddingMigrationModule | null = null;

async function getEmbeddingMigrationModule(): Promise<EmbeddingMigrationModule> {
  if (!embeddingMigrationModule) {
    embeddingMigrationModule = await import('../lib/embedding-migration');
  }
  return embeddingMigrationModule;
}

const logger = createLogger('Background');

/**
 * Background service state
 */
class BackgroundService {
  private crypto: CryptoService | null = null;
  private storage: StorageService | null = null;
  private deviceId: string | null = null;
  private masterKey: MasterKey | null = null; // Master key in memory (can be persisted encrypted)
  private deviceKeyManager: DeviceKeyManager = new DeviceKeyManager();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize().catch((e) => {
      // Clear the cached promise so subsequent calls can retry initialization
      this.initializationPromise = null;
      throw e;
    });
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('[Engram] Initializing background service...');

      // Initialize crypto service
      this.crypto = new CryptoService();
      await this.crypto.initialize();
      console.log('[Engram] Crypto service initialized');

      // Initialize storage service
      this.storage = new StorageService();
      await this.storage.initialize();
      console.log('[Engram] Storage service initialized');

      // Run migrations if needed
      const migrationService = getMigrationService();
      const needsMigration = await migrationService.needsMigration();
      if (needsMigration) {
        console.log('[Engram] Running schema migration...');
        const result = await migrationService.migrate((current, total) => {
          console.log(`[Engram] Migration progress: ${current}/${total}`);
        });
        if (result.success) {
          console.log(`[Engram] Migration complete: ${result.migratedCount} memories migrated`);
        } else {
          console.error('[Engram] Migration failed:', result.error);
        }
      } else {
        console.log('[Engram] No migration needed');
      }

      // Get or create device ID
      this.deviceId = await this.getOrCreateDeviceId();
      console.log('[Engram] Device ID:', this.deviceId);

      // Restore master key if available (needed to decrypt local memories)
      await this.restoreMasterKey();

      // Drain any memories queued for the local MCP store (best-effort).
      runBridge(this).catch((err) => console.warn('[Engram] Bridge startup drain failed:', err));

      this.isInitialized = true;
      console.log('[Engram] Background service ready');
    } catch (error) {
      console.error('[Engram] Initialization failed:', error);
      if (error instanceof Error) {
        console.error('[Engram] Error name:', error.name);
        console.error('[Engram] Error message:', error.message);
        console.error('[Engram] Error stack:', error.stack);

        // Report critical initialization error to GitHub
        logger.reportError(error, {
          operation: 'initialize',
          severity: ErrorSeverity.CRITICAL,
          userAction: 'Extension startup'
        }).catch(err => {
          console.error('[Engram] Failed to report initialization error:', err);
        });
      }
      throw error;
    }
  }

  /**
   * Get or create device ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    // Try to get existing device ID
    let deviceId = await this.storage.getMetadata<string>('deviceId');

    if (!deviceId) {
      // Create new device ID
      deviceId = generateUUID();
      await this.storage.setMetadata('deviceId', deviceId);
      console.log('[Engram] Created new device ID');
    }

    return deviceId;
  }

  /**
   * Get crypto service (must be initialized)
   */
  getCrypto(): CryptoService {
    if (!this.crypto) {
      throw new Error('Crypto service not initialized');
    }
    return this.crypto;
  }

  /**
   * Get storage service (must be initialized)
   */
  getStorage(): StorageService {
    if (!this.storage) {
      throw new Error('Storage service not initialized');
    }
    return this.storage;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    if (!this.deviceId) {
      throw new Error('Device ID not available');
    }
    return this.deviceId;
  }

  /**
   * Check if initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get auth client
   */
  getAuthClient() {
    return authClient;
  }

  /**
   * Set master key (derived from password during login/register)
   * IMPORTANT: Master key is kept in memory and can be persisted (encrypted)
   */
  setMasterKey(masterKey: MasterKey): void {
    this.masterKey = masterKey;
    console.log('[Engram] Master key set in memory');

    // SECURITY: Provide master key to storage for embedding encryption
    // This also configures HNSW service (accessed via storage)
    if (this.storage) {
      this.storage.setMasterKeyProvider(() => this.masterKey);
      console.log('[Engram] Storage configured with master key provider');
    }

    // SECURITY: Run embedding encryption migration if needed (lazy loaded)
    if (this.storage) {
      (async () => {
        try {
          const { EmbeddingMigration } = await getEmbeddingMigrationModule();
          const needsMigration = await EmbeddingMigration.needsMigration(this.storage!);
          if (needsMigration) {
            console.log('[Engram] Embedding migration needed, starting...');

            const stats = await EmbeddingMigration.migrateEmbeddings(
              this.storage!,
              masterKey,
              (current, total) => {
                if (current % 100 === 0) {
                  console.log(`[Migration] Progress: ${current}/${total}`);
                }
              }
            );
            console.log('[Migration] Complete:', stats);
          }
        } catch (err) {
          console.error('[Engram] Failed to run embedding migration:', err);
        }
      })();
    }
  }

  /**
   * Get master key
   */
  getMasterKey(): MasterKey | null {
    return this.masterKey;
  }

  /**
   * Check if master key is available
   */
  hasMasterKey(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Clear master key (on logout or session end)
   */
  clearMasterKey(): void {
    this.masterKey = null;
    console.log('[Engram] Master key cleared from memory');
  }

  /**
   * Clear persisted master key from storage
   * Called on logout
   */
  async clearPersistedMasterKey(): Promise<void> {
    try {
      await this.deviceKeyManager.clearMasterKey();
      console.log('[Engram] Persisted master key cleared');
    } catch (error) {
      console.error('[Engram] Failed to clear persisted master key:', error);
      throw error;
    }
  }

  /**
   * Persist master key (encrypted with device key)
   * Called after login to enable auto-restore on reload
   */
  async persistMasterKey(masterKey: MasterKey): Promise<void> {
    try {
      const encrypted = await this.deviceKeyManager.encryptMasterKey(masterKey);
      await this.deviceKeyManager.storeMasterKey(encrypted);
      console.log('[Engram] Master key persisted (encrypted)');
    } catch (error) {
      console.error('[Engram] Failed to persist master key:', error);
      throw error;
    }
  }

  /**
   * Restore master key from storage (if available)
   * Called on startup to maintain authentication across reloads
   * @returns true if master key was restored, false otherwise
   */
  async restoreMasterKey(): Promise<boolean> {
    try {
      const encrypted = await this.deviceKeyManager.loadMasterKey();

      if (!encrypted) {
        console.log('[Engram] No persisted master key found');
        return false;
      }

      const masterKey = await this.deviceKeyManager.decryptMasterKey(encrypted);
      this.setMasterKey(masterKey);
      console.log('[Engram] Master key restored from storage');
      return true;
    } catch (error) {
      console.error('[Engram] Failed to restore master key:', error);
      // Clear corrupted key
      await this.deviceKeyManager.clearMasterKey();
      return false;
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('[Engram] Shutting down background service...');

    if (this.storage) {
      await this.storage.close();
      this.storage = null;
    }

    // Clear sensitive data
    this.clearMasterKey();

    this.crypto = null;
    this.deviceId = null;
    this.isInitialized = false;
    this.initializationPromise = null;

    console.log('[Engram] Background service shut down');
  }
}

// Create singleton instance
const backgroundService = new BackgroundService();

/**
 * Show error reporting consent notification
 */
async function showErrorReportingConsent(): Promise<void> {
  try {
    // Check if user has already been asked
    const result = await chrome.storage.local.get('error-reporting-consent-shown');
    if (result['error-reporting-consent-shown']) {
      return; // Already asked
    }

    // Create notification
    const notificationId: string = await new Promise((resolve, _reject) => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getManifest().icons?.['128'] || '',
        title: 'Help Improve Engram',
        message: 'Automatic error reporting is enabled to help us fix bugs. No personal data is collected. You can disable it in Settings anytime.',
        priority: 1,
        buttons: [
          { title: 'Disable' },
          { title: 'Keep Enabled' }
        ]
      }, (notifId) => {
        if (chrome.runtime.lastError) {
          console.warn('[Engram] Notification icon error (non-critical):', chrome.runtime.lastError.message);
        }
        resolve(notifId || '');
      });
    });

    // Mark as shown
    await chrome.storage.local.set({ 'error-reporting-consent-shown': true });

    // Set default config (enabled by default with opt-out)
    const existingConfig = await chrome.storage.local.get('github-reporter-config');
    if (!existingConfig['github-reporter-config']) {
      await chrome.storage.local.set({
        'github-reporter-config': {
          enabled: true, // Enabled by default (opt-out)
          rateLimitMinutes: 5,
          maxIssuesPerDay: 10,
          includeStackTrace: true,
          excludePatterns: []
        }
      });
      console.log('[Engram] Error reporting enabled by default');
    }

    // Handle notification button clicks
    chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
      if (notifId === notificationId) {
        if (buttonIndex === 0) {
          // User clicked "Disable"
          chrome.storage.local.set({
            'github-reporter-config': {
              enabled: false,
              rateLimitMinutes: 5,
              maxIssuesPerDay: 10,
              includeStackTrace: true,
              excludePatterns: []
            }
          });
          console.log('[Engram] User disabled error reporting');
        } else {
          // User clicked "Keep Enabled"
          console.log('[Engram] User accepted error reporting');
        }
        chrome.notifications.clear(notificationId);
      }
    });
  } catch (error) {
    console.error('[Engram] Failed to show error reporting consent:', error);
  }
}

/**
 * Run data migrations between extension versions
 */
async function runMigrations(previousVersion: string): Promise<void> {
  console.log('[Engram] Checking migrations from version', previousVersion);

  const [prevMajor, prevMinor] = previousVersion.split('.').map(Number);

  // Migration: pre-1.0.0 → 1.0.0
  // Store the migration version so we don't re-run
  const result = await chrome.storage.local.get('engram_migration_version');
  const lastMigration = result.engram_migration_version || '0.0.0';

  if (lastMigration < '1.0.0') {
    console.log('[Engram] Running v1.0.0 migration...');

    // Clean up any stale enrichment cache entries from pre-1.0 versions
    try {
      const storageData = await chrome.storage.local.get(null);
      const staleKeys = Object.keys(storageData).filter(
        key => key.startsWith('enrichment_cache_') || key.startsWith('temp_')
      );
      if (staleKeys.length > 0) {
        await chrome.storage.local.remove(staleKeys);
        console.log(`[Engram] Cleaned up ${staleKeys.length} stale cache entries`);
      }
    } catch (err) {
      console.warn('[Engram] Cache cleanup migration failed:', err);
    }

    await chrome.storage.local.set({ engram_migration_version: '1.0.0' });
    console.log('[Engram] v1.0.0 migration complete');
  }
}

/**
 * Extension installation handler
 */
// Register the manual-save context menus + click handler.
registerCaptureContextMenus();
registerContextMenuClickHandler(backgroundService);

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Engram] Extension installed/updated:', details.reason);

  try {
    await backgroundService.initialize();

    // Re-create context menus on install/update (they don't persist across updates).
    registerCaptureContextMenus();

    if (details.reason === 'install') {
      console.log('[Engram] First-time installation');
      // Show error reporting consent notification
      await showErrorReportingConsent();
      // Open the side panel as onboarding entry point
      try {
        // Store onboarding flag so side panel can show welcome state
        await chrome.storage.local.set({ engram_onboarding: true });
        console.log('[Engram] Onboarding flag set for first launch');
      } catch (err) {
        console.error('[Engram] Failed to set onboarding flag:', err);
      }
    } else if (details.reason === 'update') {
      console.log('[Engram] Extension updated from', details.previousVersion);
      // Show consent if not shown before (for existing users)
      await showErrorReportingConsent();
      // Run migrations for version transitions
      try {
        const prev = details.previousVersion || '0.0.0';
        await runMigrations(prev);
      } catch (err) {
        console.error('[Engram] Migration failed:', err);
      }
    }
  } catch (error) {
    console.error('[Engram] Failed to initialize on install:', error);
    if (error instanceof Error) {
      console.error('[Engram] Install error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Engram] Browser started, initializing extension...');

  try {
    await backgroundService.initialize();
  } catch (error) {
    console.error('[Engram] Failed to initialize on startup:', error);
    if (error instanceof Error) {
      console.error('[Engram] Startup error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
});

/**
 * Check if URL is a valid web page (not a browser internal page)
 */
function isWebPage(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Tab update handler - enable side panel on all web pages
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes or tab loads
  if (changeInfo.status === 'complete' || changeInfo.url) {
    const enabled = isWebPage(tab.url);

    try {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled,
      });
      if (enabled) {
        console.log('[Engram] Side panel enabled for', tab.url);
      }
    } catch (error) {
      // Silently fail if tab is closed or invalid
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('No tab with id')) {
        console.error('[Engram] Failed to update side panel state:', error);
      }
    }
  }
});

/**
 * Tab activation handler - update side panel state when switching tabs
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    await chrome.sidePanel.setOptions({
      tabId: activeInfo.tabId,
      enabled: isWebPage(tab.url),
    });
  } catch (error) {
    // Silently fail
  }
});

/**
 * Action icon click handler - open side panel on any web page
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Engram] Action clicked, opening side panel');

  try {
    if (!isWebPage(tab.url)) {
      console.log('[Engram] Not a web page, cannot open side panel');
      return;
    }

    // Open side panel for the current window
    if (tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (error) {
    console.error('[Engram] Failed to open side panel:', error);
  }
});

/**
 * Message handler from content scripts
 */
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  console.log('[Engram] Received message:', message.type, 'from', sender.tab?.url);

  // Handle messages asynchronously
  (async () => {
    try {
      // Ensure initialization
      if (!backgroundService.getIsInitialized()) {
        console.log('[Engram] Not initialized, initializing now...');
        await backgroundService.initialize();
      }

      // Delegate to message handler
      const response = await handleMessage(
        message as Message,
        sender,
        backgroundService
      );

      sendResponse(response);
    } catch (error) {
      console.error('[Engram] Message handler error:', error);

      // Report message handler errors to GitHub
      if (error instanceof Error) {
        logger.reportError(error, {
          operation: 'handleMessage',
          severity: ErrorSeverity.HIGH,
          userAction: `Processing message: ${message.type}`,
          additionalData: {
            messageType: message.type
          }
        }).catch(err => {
          console.error('[Engram] Failed to report message handler error:', err);
        });
      }

      sendResponse(createErrorResponse(error as Error, message.type));
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Global error handlers for unhandled errors and promise rejections
 */
if (typeof self !== 'undefined') {
  // Handle unhandled promise rejections
  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('[Engram] Unhandled promise rejection:', event.reason);

    if (event.reason instanceof Error) {
      logger.reportError(event.reason, {
        operation: 'unhandledRejection',
        severity: ErrorSeverity.HIGH,
        userAction: 'Background process'
      }).catch(err => {
        console.error('[Engram] Failed to report unhandled rejection:', err);
      });
    }
  });

  // Handle global errors
  self.addEventListener('error', (event: ErrorEvent) => {
    console.error('[Engram] Global error:', event.error || event.message);

    if (event.error instanceof Error) {
      logger.reportError(event.error, {
        operation: 'globalError',
        severity: ErrorSeverity.HIGH,
        userAction: 'Background process',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      }).catch(err => {
        console.error('[Engram] Failed to report global error:', err);
      });
    }
  });
}

/**
 * Export for access in message handler
 */
export { backgroundService, BackgroundService };

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
import { SyncManager } from '../sync/sync-manager';
import { authClient } from '../lib/auth-client';
import { getMigrationService } from '../lib/migration-service';
import { DeviceKeyManager } from '../lib/device-key-manager';
import { CloudSyncService } from '../lib/cloud-sync';
import { premiumService } from '../lib/premium-service';
import { getPremiumClient } from '../lib/premium-api-client';
import { EmbeddingMigration } from '../lib/embedding-migration';
import type { EnrichmentConfig } from '@engram/core';
import { decryptApiKey, isEncrypted } from '../lib/api-key-crypto';
import { createLogger } from '../lib/logger';
import { ErrorSeverity } from '../lib/github-reporter';

const logger = createLogger('Background');

/**
 * Background service state
 */
class BackgroundService {
  private crypto: CryptoService | null = null;
  private storage: StorageService | null = null;
  private syncManager: SyncManager | null = null;
  private cloudSync: CloudSyncService | null = null;
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

    this.initializationPromise = this._initialize();
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

      // Initialize sync manager
      this.syncManager = new SyncManager(this.storage, {
        serverUrl: 'ws://localhost:3001/ws',
        deviceId: this.deviceId,
        autoConnect: false, // Don't auto-connect for now
        syncOnStartup: false,
      });
      await this.syncManager.initialize();
      console.log('[Engram] Sync manager initialized');

      // Restore master key if available (for premium sync)
      const keyRestored = await this.restoreMasterKey();

      // Initialize cloud sync if key restored and user is premium
      if (keyRestored) {
        await this.initializeCloudSyncIfNeeded();
      }

      // Initialize premium API client if using premium provider
      await this.initializePremiumClientIfNeeded();

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
   * Get sync manager (must be initialized)
   */
  getSyncManager(): SyncManager {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }
    return this.syncManager;
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

    // SECURITY: Run embedding encryption migration if needed
    if (this.storage) {
      EmbeddingMigration.needsMigration(this.storage).then(needsMigration => {
        if (needsMigration) {
          console.log('[Engram] Embedding migration needed, starting...');

          EmbeddingMigration.migrateEmbeddings(
            this.storage!,
            masterKey,
            (current, total) => {
              if (current % 100 === 0) {
                console.log(`[Migration] Progress: ${current}/${total}`);
              }
            }
          ).then(stats => {
            console.log('[Migration] Complete:', stats);
          }).catch(err => {
            console.error('[Migration] Failed:', err);
          });
        }
      }).catch(err => {
        console.error('[Engram] Failed to check migration status:', err);
      });
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
   * Initialize cloud sync if user is premium with sync enabled
   * Called on startup after master key restoration
   */
  async initializeCloudSyncIfNeeded(): Promise<void> {
    if (!this.hasMasterKey()) {
      console.log('[CloudSync] No master key, skipping sync initialization');
      return;
    }

    if (!this.storage || !this.crypto) {
      console.log('[CloudSync] Storage or crypto not initialized');
      return;
    }

    try {
      // Check auth state
      const authState = await authClient.getAuthState();
      if (!authState.isAuthenticated || !authState.userId) {
        console.log('[CloudSync] Not authenticated, skipping sync');
        return;
      }

      // Check premium status and sync enabled
      const supabaseClient = authClient.getSupabaseClient();
      const premiumStatus = await premiumService.getPremiumStatus(
        authState.userId,
        supabaseClient
      );

      if (!premiumStatus.isPremium || !premiumStatus.syncEnabled) {
        console.log('[CloudSync] User not premium or sync disabled');
        return;
      }

      // Initialize CloudSyncService
      console.log('[CloudSync] Initializing cloud sync...');
      this.cloudSync = new CloudSyncService(
        authState.userId,
        this.crypto,
        this.getMasterKey()!
      );

      // Download memories from cloud
      await this.downloadAndMergeMemories();

      // Start periodic sync
      await this.cloudSync.start(() => this.storage!.getMemories({}));

      console.log('[CloudSync] Cloud sync initialized and started');
    } catch (error) {
      console.error('[CloudSync] Failed to initialize cloud sync:', error);
      // Don't throw - allow extension to continue without sync
    }
  }

  /**
   * Initialize premium API client if enrichment provider is 'premium'
   * Called on startup and when enrichment settings change
   */
  async initializePremiumClientIfNeeded(): Promise<void> {
    console.log('[PremiumAPI] initializePremiumClientIfNeeded() started');
    try {
      // Get the premium client singleton
      const premiumClient = getPremiumClient();
      console.log('[PremiumAPI] Got premium client singleton');

      // First, try to load existing credentials from storage
      console.log('[PremiumAPI] Attempting to restore session from storage...');
      const restored = await premiumClient.initialize();
      console.log('[PremiumAPI] initialize() returned:', restored);

      if (restored) {
        console.log('[PremiumAPI] Session restored successfully');
        return;
      }

      // No saved session, check if we have a license key to authenticate
      console.log('[PremiumAPI] No saved session, checking for license key...');
      const result = await chrome.storage.local.get('enrichmentConfig');
      console.log('[PremiumAPI] Got enrichmentConfig:', !!result.enrichmentConfig);

      if (!result.enrichmentConfig) {
        console.log('[PremiumAPI] No enrichment config found');
        return;
      }

      const config: EnrichmentConfig = result.enrichmentConfig;
      console.log('[PremiumAPI] Config provider:', config.provider);

      // Check if using premium provider
      if ((config.provider as string) !== 'premium') {
        console.log('[PremiumAPI] Not using premium provider');
        return;
      }

      // Check if license key is set (stored in apiKey field for premium)
      console.log('[PremiumAPI] Config has apiKey:', !!config.apiKey);
      if (!config.apiKey) {
        console.log('[PremiumAPI] No license key configured');
        return;
      }

      // Decrypt license key if encrypted
      let licenseKey = config.apiKey;
      const encrypted = isEncrypted(config.apiKey);
      console.log('[PremiumAPI] License key is encrypted:', encrypted);

      if (encrypted) {
        try {
          console.log('[PremiumAPI] Decrypting license key...');
          licenseKey = await decryptApiKey(config.apiKey);
          console.log('[PremiumAPI] License key decrypted successfully');
        } catch (err) {
          console.error('[PremiumAPI] Failed to decrypt license key:', err);
          return;
        }
      }

      // Authenticate with premium API using license key
      console.log('[PremiumAPI] Authenticating with license key...');
      await premiumClient.authenticate(licenseKey);
      console.log('[PremiumAPI] Authentication successful');
    } catch (error) {
      console.error('[PremiumAPI] Failed to initialize premium client:', error);
      console.error('[PremiumAPI] Error stack:', error instanceof Error ? error.stack : 'No stack');
      // Don't throw - allow extension to continue without premium features
    }
  }

  /**
   * Download memories from cloud and merge with local
   */
  private async downloadAndMergeMemories(): Promise<void> {
    if (!this.cloudSync || !this.storage) {
      throw new Error('CloudSync or Storage not initialized');
    }

    try {
      console.log('[CloudSync] Downloading memories from cloud...');
      const remoteMemories = await this.cloudSync.downloadMemories();

      if (remoteMemories.length === 0) {
        console.log('[CloudSync] No remote memories to download');
        return;
      }

      console.log(`[CloudSync] Downloaded ${remoteMemories.length} memories`);

      // Merge with local memories (simple timestamp-based resolution)
      for (const remoteMemory of remoteMemories) {
        const localMemory = await this.storage.getMemory(remoteMemory.id);

        if (!localMemory) {
          // New memory from cloud - save locally
          await this.storage.saveMemory(remoteMemory);
          console.log(`[CloudSync] Added new memory from cloud: ${remoteMemory.id}`);
        } else {
          // Conflict - use timestamp to resolve (newer wins)
          if (remoteMemory.timestamp > localMemory.timestamp) {
            await this.storage.saveMemory(remoteMemory);
            console.log(`[CloudSync] Updated memory from cloud: ${remoteMemory.id}`);
          } else {
            console.log(`[CloudSync] Local memory newer, skipping: ${remoteMemory.id}`);
          }
        }
      }

      console.log('[CloudSync] Memories merged successfully');
    } catch (error) {
      console.error('[CloudSync] Error downloading and merging memories:', error);
      throw error;
    }
  }

  /**
   * Get cloud sync service (if initialized)
   */
  getCloudSync(): CloudSyncService | null {
    return this.cloudSync;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('[Engram] Shutting down background service...');

    if (this.cloudSync) {
      await this.cloudSync.stop();
      this.cloudSync = null;
    }

    if (this.syncManager) {
      await this.syncManager.destroy();
      this.syncManager = null;
    }

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
    const notificationId: string = await new Promise((resolve, reject) => {
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
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Engram] Extension installed/updated:', details.reason);

  try {
    await backgroundService.initialize();

    if (details.reason === 'install') {
      console.log('[Engram] First-time installation');
      // Show error reporting consent notification
      await showErrorReportingConsent();
      // TODO: Open onboarding page
    } else if (details.reason === 'update') {
      console.log('[Engram] Extension updated');
      // Show consent if not shown before (for existing users)
      await showErrorReportingConsent();
      // TODO: Handle migrations if needed
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
 * Check if URL is a supported platform (ChatGPT, Claude, or Perplexity)
 */
function isSupportedPlatform(url?: string): boolean {
  if (!url) return false;

  const supportedDomains = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'www.perplexity.ai',
  ];

  try {
    const urlObj = new URL(url);
    return supportedDomains.some(domain => urlObj.hostname === domain);
  } catch {
    return false;
  }
}

/**
 * Tab update handler - enable/disable side panel based on URL
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes or tab loads
  if (changeInfo.status === 'complete' || changeInfo.url) {
    const isSupported = isSupportedPlatform(tab.url);

    try {
      if (isSupported) {
        // Enable side panel for this tab
        await chrome.sidePanel.setOptions({
          tabId,
          enabled: true,
        });
        console.log('[Engram] Side panel enabled for', tab.url);
      } else {
        // Disable side panel for this tab
        await chrome.sidePanel.setOptions({
          tabId,
          enabled: false,
        });
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
    const isSupported = isSupportedPlatform(tab.url);

    await chrome.sidePanel.setOptions({
      tabId: activeInfo.tabId,
      enabled: isSupported,
    });
  } catch (error) {
    // Silently fail
  }
});

/**
 * Action icon click handler - open side panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Engram] Action clicked, opening side panel');

  try {
    // Check if we're on a supported platform
    if (!isSupportedPlatform(tab.url)) {
      console.log('[Engram] Not on a supported platform');
      // Could show a notification here
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

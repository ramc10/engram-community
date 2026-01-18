/**
 * Message Handler
 * Processes messages from content scripts
 */

declare const chrome: any;

import {
  Message,
  MessageType,
  InitResponse,
  SaveMessageResponse,
  GetMemoriesResponse,
  SearchMemoriesResponse,
  GetSyncStatusResponse,
  AuthRegisterResponse,
  AuthLoginResponse,
  AuthLoginGoogleResponse,
  AuthLogoutResponse,
  GetAuthStateResponse,
  GetPremiumStatusResponse,
  UpgradeToPremiumResponse,
  RequestPremiumUpgradeResponse,
  StartCloudSyncResponse,
  StopCloudSyncResponse,
  ReinitializeEnrichmentResponse,
  RevertEvolutionResponse,
  AuthState,
  SyncStatus,
  createErrorResponse,
  validateMessage,
} from '../lib/messages';
import { BackgroundService } from './index';
import { Memory } from '@engram/core';
import { generateUUID, getPlatformFromUrl, base64ToUint8Array, uint8ArrayToBase64 } from '@engram/core';
import { premiumService } from '../lib/premium-service';


/**
 * Decrypt memories retrieved from storage
 * Replaces the placeholder content with decrypted actual content
 */
async function decryptMemories(
  memories: Memory[],
  service: BackgroundService
): Promise<Memory[]> {
  // Check if we have a master key to decrypt
  if (!service.hasMasterKey()) {
    console.warn('[Engram] No master key available - returning encrypted memories');
    return memories;
  }

  const masterKey = service.getMasterKey();
  if (!masterKey) {
    console.warn('[Engram] Master key is null - returning encrypted memories');
    return memories;
  }

  const crypto = service.getCrypto();
  const decryptedMemories: Memory[] = [];

  for (const memory of memories) {
    try {
      // Check if memory has encrypted content
      if (!(memory as any).encryptedContent) {
        console.warn(`[Engram] Memory ${memory.id} has no encryptedContent - skipping decryption`);
        decryptedMemories.push(memory);
        continue;
      }

      const encryptedContent = (memory as any).encryptedContent;

      // Decrypt the content (encryptedContent is now the full EncryptedBlob)
      const decryptedBytes = await crypto.decrypt(encryptedContent, masterKey.key);

      // Convert Uint8Array to string
      const decryptedJson = new TextDecoder().decode(decryptedBytes);
      const decryptedData = JSON.parse(decryptedJson);

      // Create decrypted memory with real content
      const decryptedMemory: Memory = {
        ...memory,
        content: {
          role: decryptedData.role,
          text: decryptedData.text,
          metadata: decryptedData.metadata || {},
        },
      };

      decryptedMemories.push(decryptedMemory);
    } catch (error) {
      console.error(`[Engram] Failed to decrypt memory ${memory.id}:`, error);
      // On decryption error, return memory as-is (with placeholder)
      decryptedMemories.push(memory);
    }
  }

  return decryptedMemories;
}

/**
 * Handle incoming messages
 */
export async function handleMessage(
  message: Message,
  sender: any,
  service: BackgroundService
): Promise<any> {
  // Validate message structure
  const validation = validateMessage(message);
  if (!validation.valid) {
    return createErrorResponse(validation.error || 'Invalid message');
  }

  console.log('[Engram] Handling message:', message.type);

  try {
    switch (message.type) {
      case MessageType.INIT_REQUEST:
        return await handleInitRequest(service);

      case MessageType.SAVE_MESSAGE:
        return await handleSaveMessage(message, service, sender);

      case MessageType.GET_MEMORIES:
        return await handleGetMemories(message, service);

      case MessageType.SEARCH_MEMORIES:
        return await handleSearchMemories(message, service);

      case MessageType.GET_SYNC_STATUS:
        return await handleGetSyncStatus(service);

      case MessageType.AUTH_REGISTER:
        return await handleAuthRegister(message, service);

      case MessageType.AUTH_LOGIN:
        return await handleAuthLogin(message, service);

      case MessageType.AUTH_LOGIN_GOOGLE:
        return await handleAuthLoginGoogle(service);

      case MessageType.AUTH_LOGOUT:
        return await handleAuthLogout(service);

      case MessageType.GET_AUTH_STATE:
        return await handleGetAuthState(service);

      case MessageType.GET_PREMIUM_STATUS:
        return await handleGetPremiumStatus(service);

      case MessageType.UPGRADE_TO_PREMIUM:
        return await handleUpgradeToPremium(service);

      case MessageType.REQUEST_PREMIUM_UPGRADE:
        return await handleRequestPremiumUpgrade(service);

      case MessageType.START_CLOUD_SYNC:
        return await handleStartCloudSync(service);

      case MessageType.STOP_CLOUD_SYNC:
        return await handleStopCloudSync(service);

      case MessageType.REINITIALIZE_ENRICHMENT:
        return await handleReinitializeEnrichment(service);

      case MessageType.REVERT_EVOLUTION:
        return await handleRevertEvolution(message, service);

      default:
        return createErrorResponse(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error('[Engram] handleMessage error:', error);
    return createErrorResponse((error as Error).message || 'Unknown error');
  }
}

/**
 * Handle initialization request
 */
async function handleInitRequest(service: BackgroundService): Promise<InitResponse> {
  try {
    const deviceId = service.getDeviceId();

    return {
      type: MessageType.INIT_RESPONSE,
      success: true,
      deviceId,
    };
  } catch (error) {
    return {
      type: MessageType.INIT_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle save message request
 */
async function handleSaveMessage(
  message: any,
  service: BackgroundService,
  sender?: any
): Promise<SaveMessageResponse> {
  try {
    const extractedMessage = message.message;
    if (!extractedMessage) {
      throw new Error('Missing message data');
    }

    const storage = service.getStorage();
    const crypto = service.getCrypto();

    // Detect platform from sender URL
    const platform = sender?.tab?.url
      ? getPlatformFromUrl(sender.tab.url) || 'chatgpt'
      : 'chatgpt'; // fallback

    console.log('[Engram] Detected platform:', platform, 'from URL:', sender?.tab?.url);

    // Check if user is authenticated and has master key
    if (!service.hasMasterKey()) {
      console.warn('[Engram] No master key available - user needs to login first');
      throw new Error('Authentication required. Please login to save memories.');
    }

    const masterKey = service.getMasterKey();
    if (!masterKey) {
      throw new Error('Master key not available');
    }

    // Encrypt the content using master key
    const contentJson = JSON.stringify({
      role: extractedMessage.role,
      text: extractedMessage.content,
      metadata: extractedMessage.metadata,
    });

    const encrypted = await crypto.encrypt(contentJson, masterKey.key);

    console.log('[Engram] Content encrypted with master key');

    // Create memory object with encrypted content
    // IMPORTANT: We store encrypted content only. The 'content' field is a placeholder
    // and will be populated by decrypting 'encryptedContent' when retrieving memories.
    const memory: any = {
      id: generateUUID(),
      conversationId: extractedMessage.conversationId,
      platform,
      content: {
        role: extractedMessage.role,
        text: null as any, // SECURITY: null indicates encrypted content, use encryptedContent field
        metadata: null as any, // SECURITY: null indicates encrypted metadata
      },
      encryptedContent: encrypted, // Store the complete encrypted blob with version and algorithm
      timestamp: extractedMessage.timestamp || Date.now(),
      vectorClock: {
        [service.getDeviceId()]: 1,
      },
      deviceId: service.getDeviceId(),
      syncStatus: 'pending',
      tags: [],
    };

    // Save to storage WITH plaintext content for enrichment
    // The plaintext is needed for LLM-based enrichment (keywords/tags extraction)
    // It's only used temporarily and never persisted in plaintext
    const plaintextContent = {
      role: extractedMessage.role,
      text: extractedMessage.content,
      metadata: extractedMessage.metadata,
    };

    // Check if enrichment is enabled to use atomic persistence
    const enrichmentConfig = await storage.getEnrichmentConfig();
    const isEnrichmentEnabled = enrichmentConfig.enabled && (
      enrichmentConfig.provider === 'local'
        ? !!enrichmentConfig.localEndpoint
        : !!enrichmentConfig.apiKey
    );

    // Use atomic mode when enrichment is enabled (single-pass persistence)
    await storage.saveMemory(memory, plaintextContent, {
      skipInitialSave: isEnrichmentEnabled,
      useAtomicTransaction: isEnrichmentEnabled,
    });

    // SECURITY: Explicitly clear plaintext from memory
    // Zero out the plaintext to minimize exposure window
    if (plaintextContent) {
      plaintextContent.text = '';
      plaintextContent.role = 'user';
      if (plaintextContent.metadata) {
        Object.keys(plaintextContent.metadata).forEach(key => {
          delete (plaintextContent.metadata as any)[key];
        });
      }
      plaintextContent.metadata = undefined;
    }

    console.log('[Engram] Saved memory:', memory.id);
    console.log('[Engram] Plaintext cleared from memory');

    return {
      type: MessageType.SAVE_MESSAGE_RESPONSE,
      success: true,
      memoryId: memory.id,
    };
  } catch (error) {
    console.error('[Engram] Failed to save message:', error);
    return {
      type: MessageType.SAVE_MESSAGE_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle get memories request
 */
async function handleGetMemories(
  message: any,
  service: BackgroundService
): Promise<GetMemoriesResponse> {
  try {
    const storage = service.getStorage();
    const filter = message.filter || {};

    const memories = await storage.getMemories(filter);

    // Decrypt memories before returning
    const decryptedMemories = await decryptMemories(memories, service);

    return {
      type: MessageType.GET_MEMORIES_RESPONSE,
      success: true,
      memories: decryptedMemories,
    };
  } catch (error) {
    console.error('[Engram] Failed to get memories:', error);
    return {
      type: MessageType.GET_MEMORIES_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle search memories request
 */
async function handleSearchMemories(
  message: any,
  service: BackgroundService
): Promise<SearchMemoriesResponse> {
  try {
    const storage = service.getStorage();
    const { query, limit } = message;

    if (!query) {
      throw new Error('Search query is required');
    }

    // Use storage search which handles both semantic (HNSW) and keyword fallback
    const results = await storage.searchMemories(query, limit || 20);

    // Decrypt the search results
    const decryptedResults = await decryptMemories(results, service);

    // Map memories to their original index for stable tie-breaking (preserves semantic rank)
    const originalOrder = new Map(decryptedResults.map((m, i) => [m.id, i]));

    // Sort by relevance (keyword matching if they have the query in text)
    const normalizedQuery = query.toLowerCase().trim();
    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const queryRegExp = new RegExp(escapedQuery, 'g');

    decryptedResults.sort((a, b) => {
      const aText = a.content?.text?.toLowerCase() || '';
      const bText = b.content?.text?.toLowerCase() || '';
      const aOccurrences = (aText.match(queryRegExp) || []).length;
      const bOccurrences = (bText.match(queryRegExp) || []).length;

      if (aOccurrences !== bOccurrences) {
        return bOccurrences - aOccurrences; // More occurrences first
      }

      // If same occurrences, preserve original order from storage (which might be semantic)
      const aIndex = originalOrder.get(a.id) ?? 999;
      const bIndex = originalOrder.get(b.id) ?? 999;
      return aIndex - bIndex;
    });

    const limitedResults = limit ? decryptedResults.slice(0, limit) : decryptedResults;

    console.log(`[Engram] Search for "${query}" found ${results.length} results (returning ${limitedResults.length})`);

    return {
      type: MessageType.SEARCH_MEMORIES_RESPONSE,
      success: true,
      memories: limitedResults,
    };
  } catch (error) {
    console.error('[Engram] Failed to search memories:', error);
    return {
      type: MessageType.SEARCH_MEMORIES_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle get sync status request
 */
async function handleGetSyncStatus(
  service: BackgroundService
): Promise<GetSyncStatusResponse> {
  try {
    const storage = service.getStorage();
    const deviceId = service.getDeviceId();

    // Get pending operations count
    // TODO: Implement getSyncQueue or get count another way
    const pendingOperations = 0; // Placeholder

    // Get last sync time from metadata
    const lastSyncTime = await storage.getMetadata<number>('lastSyncTime');

    const cloudSync = service.getCloudSync();
    let isConnected = cloudSync?.isStarted() || false;

    if (!isConnected) {
      try {
        const syncManager = service.getSyncManager();
        isConnected = syncManager?.isConnected() || false;
      } catch (e) {
        // Sync manager not initialized, which occurs during initial setup
        // or in unit tests. This is expected.
      }
    }

    const status: SyncStatus = {
      isConnected,
      lastSyncTime: lastSyncTime || undefined,
      pendingOperations,
      deviceId,
    };

    return {
      type: MessageType.GET_SYNC_STATUS_RESPONSE,
      success: true,
      status,
    };
  } catch (error) {
    console.error('[Engram] Failed to get sync status:', error);
    return {
      type: MessageType.GET_SYNC_STATUS_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle authentication registration
 */
async function handleAuthRegister(
  message: any,
  service: BackgroundService
): Promise<AuthRegisterResponse> {
  try {
    const { email, password } = message;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const authClient = service.getAuthClient();
    const crypto = service.getCrypto();

    console.log('[Engram] Registering user:', email);

    const authToken = await authClient.register({ email, password });

    if (!authToken || !authToken.user) {
      throw new Error('Registration failed: No user returned');
    }

    console.log('[Engram] User registered, userId:', authToken.user.id);

    // 2. Derive master key from password (client-side only)
    // Generate a fixed salt for this user and store it in metadata
    // This ensures we can derive the same key on other devices/logins
    const salt = crypto.generateSalt();

    // Attempt to save salt to user metadata
    try {
      await authClient.updateUserMetadata({ engram_salt: uint8ArrayToBase64(salt) });
      console.log('[Engram] User salt generated and stored');
    } catch (metadataError) {
      console.warn('[Engram] Failed to store user salt:', metadataError);
    }


    const masterKey = await crypto.deriveKey(password, salt);
    service.setMasterKey(masterKey);

    console.log('[Engram] Master key derived and stored in memory');

    // 3. Persist master key (encrypted with device key) for auto-restore on reload
    await service.persistMasterKey(masterKey);

    console.log('[Engram] Master key persisted (encrypted)');

    // 4. Register device with authenticated user
    const deviceId = service.getDeviceId();
    const deviceName = `Browser Extension - ${new Date().toLocaleDateString()}`;

    // TODO: Generate and store Ed25519 signing key pair for device
    const publicKey = 'placeholder-public-key'; // Temporary

    try {
      await authClient.registerDevice(deviceId, deviceName, publicKey, {
        browser: navigator.userAgent,
        version: chrome.runtime.getManifest().version,
      });
      console.log('[Engram] Device registered with server');
    } catch (deviceError) {
      console.warn('[Engram] Device registration failed:', deviceError);
      // Continue anyway - device registration can be retried later
    }

    // 5. Initialize cloud sync if user is premium with sync enabled
    await service.initializeCloudSyncIfNeeded();

    return {
      type: MessageType.AUTH_REGISTER_RESPONSE,
      success: true,
      userId: authToken.user.id,
      email: authToken.user.email,
    };
  } catch (error) {
    console.error('[Engram] Registration failed:', error);
    return {
      type: MessageType.AUTH_REGISTER_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle authentication login
 */
async function handleAuthLogin(
  message: any,
  service: BackgroundService
): Promise<AuthLoginResponse> {
  try {
    const { email, password } = message;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const authClient = service.getAuthClient();
    const crypto = service.getCrypto();

    console.log('[Engram] Logging in user:', email);

    // 1. Login with auth server (gets JWT token)
    const authToken = await authClient.login({ email, password });

    if (!authToken || !authToken.user) {
      throw new Error('Login failed: No user returned');
    }

    console.log('[Engram] User logged in, userId:', authToken.user.id);

    // 2. Derive master key from password (client-side only)
    // Check if we have a stored salt for this user
    let salt: Uint8Array;
    const saltB64 = authToken.user.user_metadata?.engram_salt;

    if (saltB64) {
      try {
        salt = base64ToUint8Array(saltB64);

        // Basic validation: salt must be at least 16 bytes for Argon2id
        if (salt.length < 16) {
          throw new Error('Stored salt is too short or invalid');
        }

        console.log('[Engram] Found existing user salt');
      } catch (e) {
        console.warn('[Engram] Failed to decode user salt or invalid salt, generating new one:', e);
        salt = crypto.generateSalt();
        // Save the fresh salt since the old one was corrupt or invalid
        try {
          await authClient.updateUserMetadata({ engram_salt: uint8ArrayToBase64(salt) });
          console.log('[Engram] Replaced invalid salt with new one');
        } catch (metadataError) {
          console.warn('[Engram] Failed to store replacement salt:', metadataError);
        }
      }
    } else {
      console.log('[Engram] No user salt found, generating new one');
      salt = crypto.generateSalt();

      // Save it for next time
      try {
        await authClient.updateUserMetadata({ engram_salt: uint8ArrayToBase64(salt) });
        console.log('[Engram] New user salt saved');
      } catch (metadataError) {
        console.warn('[Engram] Failed to store new user salt:', metadataError);
      }
    }

    const masterKey = await crypto.deriveKey(password, salt);
    service.setMasterKey(masterKey);

    console.log('[Engram] Master key derived and stored in memory');

    // 3. Persist master key (encrypted with device key) for auto-restore on reload
    await service.persistMasterKey(masterKey);

    console.log('[Engram] Master key persisted (encrypted)');

    // 4. Initialize cloud sync if user is premium with sync enabled
    await service.initializeCloudSyncIfNeeded();

    return {
      type: MessageType.AUTH_LOGIN_RESPONSE,
      success: true,
      userId: authToken.user.id,
      email: authToken.user.email,
    };
  } catch (error) {
    console.error('[Engram] Login failed:', error);
    return {
      type: MessageType.AUTH_LOGIN_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle Google OAuth login
 */
async function handleAuthLoginGoogle(
  service: BackgroundService
): Promise<AuthLoginGoogleResponse> {
  try {
    const authClient = service.getAuthClient();

    console.log('[Engram] Starting Google OAuth login');

    // 1. Login with Google OAuth (launches browser flow)
    const authToken = await authClient.loginWithGoogle();

    if (!authToken || !authToken.user) {
      throw new Error('Google login failed: No user returned');
    }

    console.log('[Engram] Google login successful, userId:', authToken.user.id);

    // 2. For Google OAuth users, we generate a secure master key
    // Since they don't have a password, we generate a cryptographically secure random key
    // This key is stored securely in chrome.storage and used for E2E encryption
    const cryptoService = service.getCrypto();
    const masterKeyBytes = cryptoService.generateEncryptionKey(); // 32 bytes of secure random data

    // Create master key object
    const masterKey = {
      key: masterKeyBytes,
      salt: cryptoService.generateSalt(),
      derivedAt: Date.now(),
    };

    // Set master key in service
    service.setMasterKey(masterKey);
    console.log('[Engram] Master key generated and set for Google OAuth user');

    return {
      type: MessageType.AUTH_LOGIN_GOOGLE_RESPONSE,
      success: true,
      userId: authToken.user.id,
      email: authToken.user.email,
    };
  } catch (error) {
    console.error('[Engram] Google login failed:', error);
    return {
      type: MessageType.AUTH_LOGIN_GOOGLE_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle authentication logout
 */
async function handleAuthLogout(
  service: BackgroundService
): Promise<AuthLogoutResponse> {
  try {
    const authClient = service.getAuthClient();

    console.log('[Engram] Logging out user');

    // 1. Stop cloud sync if running
    const cloudSync = service.getCloudSync();
    if (cloudSync) {
      await cloudSync.stop();
      console.log('[Engram] Cloud sync stopped');
    }

    // 2. Logout from server (clears JWT)
    await authClient.logout();

    // 3. Clear master key from memory
    service.clearMasterKey();

    // 4. Clear persisted encrypted master key
    await service.clearPersistedMasterKey();

    console.log('[Engram] User logged out successfully');

    return {
      type: MessageType.AUTH_LOGOUT_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[Engram] Logout failed:', error);

    // Even if server logout fails, clear client-side state
    service.clearMasterKey();
    await service.clearPersistedMasterKey().catch(e =>
      console.error('[Engram] Failed to clear persisted key:', e)
    );

    return {
      type: MessageType.AUTH_LOGOUT_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle get auth state request
 */
async function handleGetAuthState(
  service: BackgroundService
): Promise<GetAuthStateResponse> {
  try {
    const authClient = service.getAuthClient();

    // Get auth state from client
    const clientAuthState = await authClient.getAuthState();

    // Check if master key is available
    const hasMasterKey = service.hasMasterKey();

    const authState: AuthState = {
      isAuthenticated: clientAuthState.isAuthenticated && hasMasterKey,
      userId: clientAuthState.userId,
      email: clientAuthState.email,
    };

    return {
      type: MessageType.GET_AUTH_STATE_RESPONSE,
      success: true,
      authState,
    };
  } catch (error) {
    console.error('[Engram] Failed to get auth state:', error);
    return {
      type: MessageType.GET_AUTH_STATE_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle get premium status request
 */
async function handleGetPremiumStatus(
  service: BackgroundService
): Promise<GetPremiumStatusResponse> {
  try {
    const authClient = service.getAuthClient();
    const authState = await authClient.getAuthState();

    if (!authState.isAuthenticated || !authState.userId) {
      throw new Error('Not authenticated');
    }

    console.log('[Premium] Getting premium status for user:', authState.userId);

    // Get authenticated Supabase client (has user session for RLS)
    const supabaseClient = authClient.getSupabaseClient();

    const status = await premiumService.getPremiumStatus(authState.userId, supabaseClient);

    return {
      type: MessageType.GET_PREMIUM_STATUS_RESPONSE,
      success: true,
      status,
    };
  } catch (error) {
    console.error('[Premium] Failed to get premium status:', error);
    return {
      type: MessageType.GET_PREMIUM_STATUS_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle upgrade to premium request
 */
async function handleUpgradeToPremium(
  service: BackgroundService
): Promise<UpgradeToPremiumResponse> {
  try {
    const authClient = service.getAuthClient();
    const authState = await authClient.getAuthState();

    if (!authState.isAuthenticated || !authState.userId) {
      throw new Error('Not authenticated');
    }

    console.log('[Premium] Upgrading user to premium:', authState.userId);

    await premiumService.upgradeToPremium(authState.userId);

    console.log('[Premium] User upgraded successfully');

    return {
      type: MessageType.UPGRADE_TO_PREMIUM_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[Premium] Failed to upgrade to premium:', error);
    return {
      type: MessageType.UPGRADE_TO_PREMIUM_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle request premium upgrade
 */
async function handleRequestPremiumUpgrade(
  service: BackgroundService
): Promise<RequestPremiumUpgradeResponse> {
  try {
    const authClient = service.getAuthClient();
    const authState = await authClient.getAuthState();

    if (!authState.isAuthenticated || !authState.userId || !authState.email) {
      throw new Error('Not authenticated');
    }

    console.log('[Premium] Submitting upgrade request for user:', authState.userId);

    // Get authenticated Supabase client (has user session for RLS)
    const supabaseClient = authClient.getSupabaseClient();

    await premiumService.requestPremiumUpgrade(authState.userId, authState.email, supabaseClient);

    console.log('[Premium] Upgrade request submitted successfully');

    return {
      type: MessageType.REQUEST_PREMIUM_UPGRADE_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[Premium] Failed to submit upgrade request:', error);
    return {
      type: MessageType.REQUEST_PREMIUM_UPGRADE_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle start cloud sync request
 */
async function handleStartCloudSync(
  service: BackgroundService
): Promise<StartCloudSyncResponse> {
  try {
    const authClient = service.getAuthClient();
    const authState = await authClient.getAuthState();

    if (!authState.isAuthenticated || !authState.userId) {
      throw new Error('Not authenticated');
    }

    // Get authenticated Supabase client (has user session for RLS)
    const supabaseClient = authClient.getSupabaseClient();

    // Check if user has premium tier
    const isPremium = await premiumService.isPremium(authState.userId, supabaseClient);
    if (!isPremium) {
      throw new Error('Premium subscription required for cloud sync');
    }

    console.log('[CloudSync] Starting cloud sync for user:', authState.userId);

    // Enable sync in database with authenticated client (for RLS)
    await premiumService.enableSync(authState.userId, supabaseClient);

    console.log('[CloudSync] Cloud sync enabled in database');

    // Initialize CloudSyncService (now fixed to work in service worker context)
    await service.initializeCloudSyncIfNeeded();

    console.log('[CloudSync] Cloud sync service initialized and started');

    return {
      type: MessageType.START_CLOUD_SYNC_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[CloudSync] Failed to start cloud sync:', error);
    return {
      type: MessageType.START_CLOUD_SYNC_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle stop cloud sync request
 */
async function handleStopCloudSync(
  service: BackgroundService
): Promise<StopCloudSyncResponse> {
  try {
    console.log('[CloudSync] Stopping cloud sync');

    // Get auth state
    const authClient = service.getAuthClient();
    const authState = await authClient.getAuthState();

    if (authState.isAuthenticated && authState.userId) {
      // Get authenticated Supabase client (has user session for RLS)
      const supabaseClient = authClient.getSupabaseClient();

      // Disable sync in database with authenticated client (for RLS)
      await premiumService.disableSync(authState.userId, supabaseClient);
    }

    // Stop cloud sync service if running
    const cloudSync = service.getCloudSync();
    if (cloudSync) {
      await cloudSync.stop();
      console.log('[CloudSync] Cloud sync service stopped');
    }

    console.log('[CloudSync] Cloud sync disabled');

    return {
      type: MessageType.STOP_CLOUD_SYNC_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[CloudSync] Failed to stop cloud sync:', error);
    return {
      type: MessageType.STOP_CLOUD_SYNC_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle reinitialize enrichment request
 * Called when enrichment settings are changed in the UI
 */
async function handleReinitializeEnrichment(
  service: BackgroundService
): Promise<ReinitializeEnrichmentResponse> {
  try {
    console.log('[Enrichment] Reinitializing enrichment services');

    const storage = service.getStorage();
    await storage.reinitializeEnrichment();

    // Re-initialize Premium API client if using premium provider
    // This ensures the client is authenticated after user configures license key in UI
    await service.initializePremiumClientIfNeeded();

    console.log('[Enrichment] Enrichment services reinitialized successfully');

    return {
      type: MessageType.REINITIALIZE_ENRICHMENT_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[Enrichment] Failed to reinitialize enrichment:', error);
    return {
      type: MessageType.REINITIALIZE_ENRICHMENT_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle revert evolution request (Phase 3)
 * Revert a memory to a previous version from its evolution history
 */
async function handleRevertEvolution(
  message: any,
  service: BackgroundService
): Promise<RevertEvolutionResponse> {
  try {
    const { memoryId, versionIndex } = message;

    if (!memoryId) {
      throw new Error('Missing memoryId');
    }

    if (versionIndex === undefined || versionIndex === null) {
      throw new Error('Missing versionIndex');
    }

    console.log(`[Evolution] Reverting memory ${memoryId} to version ${versionIndex}`);

    const storage = service.getStorage();

    // Get the memory
    const memory = await storage.getMemory(memoryId) as any;
    if (!memory) {
      throw new Error('Memory not found');
    }

    // Check if memory has evolution history
    if (!memory.evolution || !memory.evolution.history || memory.evolution.history.length === 0) {
      throw new Error('Memory has no evolution history');
    }

    // Validate versionIndex
    if (versionIndex < 0 || versionIndex >= memory.evolution.history.length) {
      throw new Error(`Invalid versionIndex: ${versionIndex}. Valid range: 0-${memory.evolution.history.length - 1}`);
    }

    // Get the target version
    const targetVersion = memory.evolution.history[versionIndex];

    // Save current state to history before reverting (makes revert reversible)
    const currentState = {
      keywords: memory.keywords || [],
      tags: memory.tags || [],
      context: memory.context || '',
      timestamp: Date.now(),
    };

    // Revert to target version
    memory.keywords = targetVersion.keywords;
    memory.tags = targetVersion.tags;
    memory.context = targetVersion.context;

    // Add current state to history (pushed to end, making this revert reversible)
    memory.evolution.history.push(currentState);

    // Maintain max 10 versions in history
    if (memory.evolution.history.length > 10) {
      memory.evolution.history = memory.evolution.history.slice(-10);
    }

    // Update memory in storage
    await storage.saveMemory(memory);

    console.log(`[Evolution] Memory ${memoryId} reverted successfully to version ${versionIndex}`);

    return {
      type: MessageType.REVERT_EVOLUTION_RESPONSE,
      success: true,
    };
  } catch (error) {
    console.error('[Evolution] Failed to revert evolution:', error);
    return {
      type: MessageType.REVERT_EVOLUTION_RESPONSE,
      success: false,
      error: (error as Error).message,
    };
  }
}

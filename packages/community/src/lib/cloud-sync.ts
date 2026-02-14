import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Memory, MasterKey } from '@engram/core';
import { CryptoService } from './crypto-service';

/**
 * CloudSyncService - Handles cloud synchronization for premium users
 *
 * Responsibilities:
 * - Upload local memories to Supabase
 * - Download remote memories from Supabase
 * - Real-time sync across devices
 * - Conflict resolution using vector clocks
 */
export class CloudSyncService {
  private supabase: SupabaseClient;
  private userId: string;
  private crypto: CryptoService;
  private masterKey: MasterKey;
  private subscription: RealtimeChannel | null = null;
  private syncInterval: number | null = null;
  private onRemoteChangeCallback: ((change: any) => void) | null = null;
  private lastSyncTimestamp: number = 0;
  private onMemorySynced: ((memoryId: string) => Promise<void>) | null = null;

  constructor(userId: string, crypto: CryptoService, masterKey: MasterKey) {
    this.userId = userId;
    this.crypto = crypto;
    this.masterKey = masterKey;

    const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Start cloud sync service
   * - Uploads existing local memories
   * - Subscribes to real-time changes
   * - Starts periodic sync (every 5 minutes)
   */
  async start(
    getLocalMemories: () => Promise<Memory[]>,
    onMemorySynced?: (memoryId: string) => Promise<void>
  ): Promise<void> {
    try {
      console.log('[CloudSync] Starting cloud sync for user:', this.userId);

      if (onMemorySynced) {
        this.onMemorySynced = onMemorySynced;
      }

      // Load persisted lastSyncTimestamp from Supabase profile
      await this.loadLastSyncTimestamp();

      // 1. Upload existing local memories
      await this.uploadLocalMemories(getLocalMemories);

      // 2. Subscribe to real-time changes from other devices
      this.subscribeToChanges();

      // 3. Start periodic sync (every 5 minutes)
      this.syncInterval = setInterval(async () => {
        console.log('[CloudSync] Periodic sync triggered');
        await this.uploadLocalMemories(getLocalMemories);
      }, 5 * 60 * 1000) as unknown as number;

      console.log('[CloudSync] Cloud sync started successfully');
    } catch (err) {
      console.error('[CloudSync] Error starting cloud sync:', err);
      throw err;
    }
  }

  /**
   * Check if cloud sync is started
   */
  isStarted(): boolean {
    return this.syncInterval !== null;
  }

  /**
   * Stop cloud sync service
   * - Unsubscribes from real-time changes
   * - Stops periodic sync
   */
  async stop(): Promise<void> {
    console.log('[CloudSync] Stopping cloud sync');

    // Unsubscribe from real-time
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }

    // Stop periodic sync
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    console.log('[CloudSync] Cloud sync stopped');
  }

  /**
   * Upload modified local memories to cloud (delta sync)
   * Only uploads memories that are pending sync or were created since the last sync.
   */
  private async uploadLocalMemories(
    getLocalMemories: () => Promise<Memory[]>
  ): Promise<void> {
    try {
      const memories = await getLocalMemories();

      // Filter to only memories needing sync:
      // - syncStatus is 'pending' or 'failed' (modified/new memories)
      // - Or created after last sync timestamp (catches any missed)
      const memoriesToSync = this.lastSyncTimestamp === 0
        ? memories // First sync: upload all
        : memories.filter(m =>
            m.syncStatus !== 'synced' || m.timestamp > this.lastSyncTimestamp
          );

      if (memoriesToSync.length === 0) {
        console.log('[CloudSync] No modified memories to upload');
        return;
      }

      console.log(`[CloudSync] Uploading ${memoriesToSync.length} modified memories (of ${memories.length} total)`);

      for (const memory of memoriesToSync) {
        await this.uploadMemory(memory);
        // Mark memory as synced so it won't be re-uploaded next cycle
        if (this.onMemorySynced) {
          try {
            await this.onMemorySynced(memory.id);
          } catch (err) {
            console.warn('[CloudSync] Failed to mark memory as synced:', memory.id, err);
          }
        }
      }

      this.lastSyncTimestamp = Date.now();
      await this.persistLastSyncTimestamp();
      console.log('[CloudSync] Upload complete');
    } catch (err) {
      console.error('[CloudSync] Error uploading memories:', err);
      throw err;
    }
  }

  /**
   * Upload a single memory to cloud
   */
  async uploadMemory(memory: Memory): Promise<void> {
    try {
      // Encrypt memory content
      const encrypted = await this.encryptMemory(memory);

      // Upload to Supabase
      const { error } = await this.supabase.from('encrypted_memories').upsert({
        id: memory.id,
        user_id: this.userId,
        encrypted_content: encrypted.content,
        nonce: encrypted.nonce,
        platform: memory.platform,
        conversation_id: memory.conversationId || null,
        created_at: new Date(memory.timestamp).toISOString(),
        vector_clock: memory.vectorClock || {},
        device_id: memory.deviceId || null,
      });

      if (error) {
        console.error('[CloudSync] Error uploading memory:', error);
        throw new Error(`Failed to upload memory: ${error.message}`);
      }
    } catch (err) {
      console.error('[CloudSync] Unexpected error uploading memory:', err);
      throw err;
    }
  }

  /**
   * Download memories from cloud
   * @param since - Optional timestamp to get memories created/updated after this time
   */
  async downloadMemories(since?: Date): Promise<Memory[]> {
    try {
      console.log('[CloudSync] Downloading memories from cloud');

      let query = this.supabase
        .from('encrypted_memories')
        .select('*')
        .eq('user_id', this.userId)
        .is('deleted_at', null);

      if (since) {
        query = query.gt('updated_at', since.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[CloudSync] Error downloading memories:', error);
        throw new Error(`Failed to download memories: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log('[CloudSync] No memories to download');
        return [];
      }

      // Decrypt and convert to Memory objects
      const memories: Memory[] = [];
      for (const encryptedMemory of data) {
        try {
          const memory = await this.decryptMemory(encryptedMemory);
          memories.push(memory);
        } catch (err) {
          console.error('[CloudSync] Error decrypting memory:', err);
          // Skip corrupted memories
        }
      }

      console.log(`[CloudSync] Downloaded ${memories.length} memories`);
      return memories;
    } catch (err) {
      console.error('[CloudSync] Unexpected error downloading memories:', err);
      throw err;
    }
  }

  /**
   * Delete a memory from cloud
   */
  async deleteMemory(memoryId: string): Promise<void> {
    try {
      // Soft delete (set deleted_at timestamp)
      const { error } = await this.supabase
        .from('encrypted_memories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', memoryId)
        .eq('user_id', this.userId);

      if (error) {
        console.error('[CloudSync] Error deleting memory:', error);
        throw new Error(`Failed to delete memory: ${error.message}`);
      }

      console.log('[CloudSync] Memory deleted from cloud');
    } catch (err) {
      console.error('[CloudSync] Unexpected error deleting memory:', err);
      throw err;
    }
  }

  /**
   * Subscribe to real-time changes from other devices
   */
  private subscribeToChanges(): void {
    console.log('[CloudSync] Subscribing to real-time changes');

    this.subscription = this.supabase
      .channel(`memories:${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'encrypted_memories',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          this.handleRemoteChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('[CloudSync] Realtime subscription status:', status);
      });
  }

  /**
   * Handle remote changes from other devices
   */
  private async handleRemoteChange(payload: any): Promise<void> {
    try {
      console.log('[CloudSync] Remote change detected:', payload.eventType);

      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        // Download and decrypt the new/updated memory
        const memory = await this.decryptMemory(payload.new);

        // Notify caller (e.g., to update local storage)
        if (this.onRemoteChangeCallback) {
          this.onRemoteChangeCallback({
            type: payload.eventType === 'INSERT' ? 'create' : 'update',
            memory,
          });
        }
      } else if (payload.eventType === 'DELETE') {
        // Notify caller to delete locally
        if (this.onRemoteChangeCallback) {
          this.onRemoteChangeCallback({
            type: 'delete',
            memoryId: payload.old.id,
          });
        }
      }
    } catch (err) {
      console.error('[CloudSync] Error handling remote change:', err);
    }
  }

  /**
   * Set callback for remote changes
   */
  onRemoteChange(callback: (change: any) => void): void {
    this.onRemoteChangeCallback = callback;
  }

  /**
   * Load lastSyncTimestamp from Supabase profile
   */
  private async loadLastSyncTimestamp(): Promise<void> {
    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('last_sync_at')
        .eq('id', this.userId)
        .single();

      if (profile?.last_sync_at) {
        this.lastSyncTimestamp = new Date(profile.last_sync_at).getTime();
        console.log('[CloudSync] Loaded lastSyncTimestamp:', this.lastSyncTimestamp);
      }
    } catch (err) {
      console.warn('[CloudSync] Failed to load lastSyncTimestamp:', err);
    }
  }

  /**
   * Persist lastSyncTimestamp to Supabase profile
   */
  private async persistLastSyncTimestamp(): Promise<void> {
    try {
      await this.supabase
        .from('profiles')
        .update({ last_sync_at: new Date(this.lastSyncTimestamp).toISOString() })
        .eq('id', this.userId);
    } catch (err) {
      console.warn('[CloudSync] Failed to persist lastSyncTimestamp:', err);
    }
  }

  /**
   * Encrypt memory content using XChaCha20-Poly1305
   */
  private async encryptMemory(memory: Memory): Promise<{
    content: string;
    nonce: string;
  }> {
    // Serialize memory to JSON
    const serialized = JSON.stringify(memory);

    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(serialized);

    // Encrypt using master key (XChaCha20-Poly1305)
    const encrypted = await this.crypto.encrypt(dataBytes, this.masterKey.key);

    // Convert encrypted data to base64 for storage
    const contentBase64 = this.arrayBufferToBase64(encrypted.ciphertext);
    const nonceBase64 = this.arrayBufferToBase64(encrypted.nonce);

    return {
      content: contentBase64,
      nonce: nonceBase64,
    };
  }

  /**
   * Decrypt memory content using XChaCha20-Poly1305
   */
  private async decryptMemory(encrypted: any): Promise<Memory> {
    // Convert from base64 to Uint8Array
    const ciphertext = this.base64ToUint8Array(encrypted.encrypted_content);
    const nonce = this.base64ToUint8Array(encrypted.nonce);

    // Build EncryptedBlob - note: authTag is included in ciphertext by XChaCha20-Poly1305
    const blob = {
      version: 1 as const,
      algorithm: 'XChaCha20-Poly1305' as const,
      ciphertext,
      nonce,
      authTag: new Uint8Array(0), // Included in ciphertext
    };

    // Decrypt using master key
    const decryptedBytes = await this.crypto.decrypt(blob, this.masterKey.key);

    // Convert Uint8Array back to string
    const decoder = new TextDecoder();
    const decrypted = decoder.decode(decryptedBytes);

    // Parse JSON to Memory object
    const memory = JSON.parse(decrypted);

    return memory;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Trigger manual sync
   */
  async syncNow(getLocalMemories: () => Promise<Memory[]>): Promise<void> {
    console.log('[CloudSync] Manual sync triggered');
    await this.uploadLocalMemories(getLocalMemories);
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalMemories: number;
    lastSyncAt: Date | null;
  }> {
    try {
      const { count, error } = await this.supabase
        .from('encrypted_memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .is('deleted_at', null);

      if (error) {
        console.error('[CloudSync] Error getting sync stats:', error);
        return { totalMemories: 0, lastSyncAt: null };
      }

      // Get last sync timestamp from profile
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('last_sync_at')
        .eq('id', this.userId)
        .single();

      return {
        totalMemories: count || 0,
        lastSyncAt: profile?.last_sync_at ? new Date(profile.last_sync_at) : null,
      };
    } catch (err) {
      console.error('[CloudSync] Error getting sync stats:', err);
      return { totalMemories: 0, lastSyncAt: null };
    }
  }
}

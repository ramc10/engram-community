/**
 * Sync Manager
 * Main coordinator for client-side synchronization
 *
 * Responsibilities:
 * - Manage WebSocket connection lifecycle
 * - Queue and process sync operations
 * - Handle offline/online transitions
 * - Coordinate state machine, retry logic, and operation queue
 * - Emit events for UI updates
 */

import { SyncState, ISyncManager, SyncOperation, incrementClock } from '@engram/core';
import { StorageService } from '../lib/storage';
import { SyncStateMachine } from './state-machine';
import { WebSocketClient, DEFAULT_WEBSOCKET_CONFIG } from './ws-client';
import { OperationQueue } from './operation-queue';

export interface SyncManagerConfig {
  serverUrl: string;
  deviceId: string;
  autoConnect: boolean;
  syncOnStartup: boolean;
}

export const DEFAULT_SYNC_CONFIG: SyncManagerConfig = {
  serverUrl: 'ws://localhost:3001/ws',
  deviceId: '',
  autoConnect: true,
  syncOnStartup: true,
};

export class SyncManager implements ISyncManager {
  private stateMachine: SyncStateMachine;
  private wsClient: WebSocketClient;
  private operationQueue: OperationQueue;
  private storage: StorageService;
  private vectorClock: Record<string, number> = {};
  private lastSyncTime: number = 0;
  private syncInProgress: boolean = false;

  // Event callbacks
  private stateChangeCallbacks: Set<(state: SyncState) => void> = new Set();
  private remoteChangeCallbacks: Set<(op: SyncOperation) => void> = new Set();
  private errorCallbacks: Set<(error: Error) => void> = new Set();

  constructor(
    storage: StorageService,
    private config: SyncManagerConfig = DEFAULT_SYNC_CONFIG
  ) {
    this.storage = storage;
    this.stateMachine = new SyncStateMachine();
    this.wsClient = new WebSocketClient({
      ...DEFAULT_WEBSOCKET_CONFIG,
      url: config.serverUrl,
    });
    this.operationQueue = new OperationQueue(storage);

    this.setupEventHandlers();
  }

  /**
   * Initialize sync manager
   */
  async initialize(): Promise<void> {
    console.log('[SyncManager] Initializing...');

    // Load last sync time from storage
    this.lastSyncTime = (await this.storage.getMetadata<number>('lastSyncTime')) || 0;

    // Load vector clock from storage
    const storedClock = await this.storage.getMetadata<Record<string, number>>('vectorClock');
    this.vectorClock = storedClock || { [this.config.deviceId]: 0 };

    console.log('[SyncManager] Initialized', {
      lastSyncTime: this.lastSyncTime,
      vectorClock: this.vectorClock,
    });

    // Auto-connect if configured
    if (this.config.autoConnect) {
      await this.connect();
    }

    // Sync on startup if configured
    if (this.config.syncOnStartup && this.config.autoConnect) {
      setTimeout(() => this.syncNow(), 1000);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // WebSocket events
    this.wsClient.on('connected', (data: any) => {
      this.stateMachine.transition('CONNECTED');
      this.vectorClock = data.vectorClock || this.vectorClock;

      // Sync after connection
      this.syncNow();
    });

    this.wsClient.on('disconnected', () => {
      this.stateMachine.transition('DISCONNECT');
    });

    this.wsClient.on('error', (error: any) => {
      this.handleError(new Error(error.message || 'WebSocket error'));
    });

    this.wsClient.on('reconnecting', (data: any) => {
      console.log(`[SyncManager] Reconnecting... attempt ${data.attempt}`);
    });

    this.wsClient.on('message', (data: any) => {
      this.handleWebSocketMessage(data);
    });

    // Operation queue events
    this.operationQueue.onReadyToProcess(() => {
      if (this.isConnected() && !this.syncInProgress) {
        this.syncNow();
      }
    });

    // State machine events
    this.stateMachine.onStateChange((state) => {
      this.notifyStateChange(state);
    });
  }

  /**
   * Connect to sync server
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      console.log('[SyncManager] Already connected');
      return;
    }

    console.log('[SyncManager] Connecting...');
    this.stateMachine.transition('CONNECT');

    try {
      // For now, use placeholder values
      // In production, these would come from device registration and crypto service
      const deviceName = 'Browser Extension'; // Placeholder
      const publicKey = 'placeholder-public-key'; // Placeholder

      await this.wsClient.connect(
        this.config.deviceId,
        deviceName,
        publicKey,
        this.vectorClock,
        this.lastSyncTime
      );
    } catch (error) {
      this.stateMachine.transition('ERROR', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from sync server
   */
  async disconnect(): Promise<void> {
    console.log('[SyncManager] Disconnecting...');

    this.wsClient.disconnect();
    this.stateMachine.transition('DISCONNECT');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stateMachine.isConnected() && this.wsClient.getIsConnected();
  }

  /**
   * Get current state
   */
  getState(): SyncState {
    return this.stateMachine.getState();
  }

  /**
   * Queue operation for sync
   */
  async queueOperation(op: SyncOperation): Promise<void> {
    console.log(`[SyncManager] Queueing operation: ${op.type} ${op.memoryId}`);

    // Increment vector clock
    this.vectorClock = incrementClock(this.vectorClock, this.config.deviceId);

    // Add to operation with vector clock
    const operation = {
      ...op,
      vectorClock: this.vectorClock,
      deviceId: this.config.deviceId,
      timestamp: Date.now(),
    };

    await this.operationQueue.enqueue(operation);

    // Save updated vector clock
    await this.storage.setMetadata('vectorClock', this.vectorClock);
  }

  /**
   * Sync now (manual trigger)
   */
  async syncNow(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[SyncManager] Sync already in progress');
      return;
    }

    if (!this.isConnected()) {
      console.log('[SyncManager] Not connected, cannot sync');
      return;
    }

    this.syncInProgress = true;
    this.stateMachine.transition('SYNC_START');

    try {
      console.log('[SyncManager] Starting sync...');

      // Step 1: Pull operations from server
      await this.pullOperations();

      // Step 2: Push queued operations to server
      await this.pushOperations();

      // Update last sync time
      this.lastSyncTime = Date.now();
      await this.storage.setMetadata('lastSyncTime', this.lastSyncTime);

      this.stateMachine.transition('SYNC_COMPLETE');
      console.log('[SyncManager] Sync complete');
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      this.stateMachine.transition('ERROR', error as Error);
      this.handleError(error as Error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Pull operations from server
   */
  private async pullOperations(): Promise<void> {
    console.log('[SyncManager] Pulling operations from server...');

    this.wsClient.requestSync(this.lastSyncTime, this.vectorClock, 100);

    // Wait for sync response (handled in handleWebSocketMessage)
  }

  /**
   * Push queued operations to server
   */
  private async pushOperations(): Promise<void> {
    const batch = await this.operationQueue.getBatch();

    if (batch.length === 0) {
      console.log('[SyncManager] No operations to push');
      return;
    }

    console.log(`[SyncManager] Pushing ${batch.length} operations...`);

    for (const operation of batch) {
      try {
        this.wsClient.sendOperation({
          type: 'OPERATION',
          timestamp: Date.now(),
          messageId: crypto.randomUUID(),
          payload: {
            operation,
          },
        });

        // Wait for ACK (handled in handleWebSocketMessage)
      } catch (error) {
        console.error('[SyncManager] Failed to push operation:', error);
        // Don't remove from queue on failure
      }
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'SYNC_RESPONSE':
        this.handleSyncResponse(data.message);
        break;

      case 'OPERATION':
        this.handleRemoteOperation(data.message);
        break;

      case 'ACK':
        this.handleAck(data.message);
        break;

      default:
        console.warn('[SyncManager] Unknown message type:', data.type);
    }
  }

  /**
   * Handle sync response from server
   */
  private async handleSyncResponse(message: any): Promise<void> {
    const { operations, hasMore } = message;

    console.log(`[SyncManager] Received ${operations.length} operations from server`);

    for (const operation of operations) {
      // Apply operation to local storage
      await this.applyRemoteOperation(operation);

      // Merge vector clock
      this.vectorClock = {
        ...this.vectorClock,
        ...operation.vectorClock,
      };
    }

    // Save updated vector clock
    await this.storage.setMetadata('vectorClock', this.vectorClock);

    // If there are more operations, request them
    if (hasMore) {
      this.wsClient.requestSync(this.lastSyncTime, this.vectorClock, 100);
    }
  }

  /**
   * Handle remote operation broadcast
   */
  private async handleRemoteOperation(message: any): Promise<void> {
    const { operation } = message;

    console.log('[SyncManager] Received remote operation:', operation.operationType);

    await this.applyRemoteOperation(operation);

    // Notify remote change listeners
    this.notifyRemoteChange(operation);

    // Trigger state machine
    this.stateMachine.transition('REMOTE_CHANGE');
  }

  /**
   * Handle ACK for sent operation
   */
  private async handleAck(message: any): Promise<void> {
    const { operationId } = message;

    console.log(`[SyncManager] Received ACK for operation: ${operationId}`);

    // Remove operation from queue
    await this.operationQueue.markProcessed(operationId);
  }

  /**
   * Apply remote operation to local storage
   */
  private async applyRemoteOperation(operation: SyncOperation): Promise<void> {
    // TODO: Implement actual operation application logic
    // This would involve updating memories in storage based on the operation
    console.log('[SyncManager] Applying remote operation:', operation.id);
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    console.error('[SyncManager] Error:', error);

    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        console.error('[SyncManager] Error in error callback:', e);
      }
    }
  }

  /**
   * Register state change callback
   */
  onStateChange(callback: (state: SyncState) => void): void {
    this.stateChangeCallbacks.add(callback);
  }

  /**
   * Register remote change callback
   */
  onRemoteChange(callback: (op: SyncOperation) => void): void {
    this.remoteChangeCallbacks.add(callback);
  }

  /**
   * Register error callback
   */
  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  /**
   * Notify state change
   */
  private notifyStateChange(state: SyncState): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(state);
      } catch (error) {
        console.error('[SyncManager] Error in state change callback:', error);
      }
    }
  }

  /**
   * Notify remote change
   */
  private notifyRemoteChange(op: SyncOperation): void {
    for (const callback of this.remoteChangeCallbacks) {
      try {
        callback(op);
      } catch (error) {
        console.error('[SyncManager] Error in remote change callback:', error);
      }
    }
  }

  /**
   * Generate signature for authentication
   * TODO: Implement actual Ed25519 signing
   */
  private async generateSignature(deviceId: string): Promise<string> {
    // Placeholder: In production, use device's private key to sign
    const message = `CONNECT:${deviceId}:${Date.now()}`;
    return Buffer.from(message).toString('base64');
  }

  /**
   * Get sync statistics
   */
  async getStats(): Promise<{
    state: SyncState;
    isConnected: boolean;
    lastSyncTime: number;
    queueSize: number;
    vectorClock: Record<string, number>;
  }> {
    const queueSize = await this.operationQueue.getSize();

    return {
      state: this.getState(),
      isConnected: this.isConnected(),
      lastSyncTime: this.lastSyncTime,
      queueSize,
      vectorClock: this.vectorClock,
    };
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    console.log('[SyncManager] Destroying...');

    await this.disconnect();
    this.stateChangeCallbacks.clear();
    this.remoteChangeCallbacks.clear();
    this.errorCallbacks.clear();
  }
}

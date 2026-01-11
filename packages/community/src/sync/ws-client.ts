/**
 * WebSocket Client
 * Browser WebSocket client with auto-reconnect and message handling
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Message queue while disconnected
 * - Heartbeat monitoring
 * - Event-based architecture
 */

import {
  WebSocketMessage,
  ConnectMessage,
  ConnectedMessage,
  SyncRequestMessage,
  SyncResponseMessage,
  OperationMessage,
  AckMessage,
  ErrorMessage,
  HeartbeatMessage,
} from '@engram/core';
import { RetryManager } from './retry-manager';

export type WebSocketClientEvent =
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'error'
  | 'reconnecting';

export interface WebSocketClientConfig {
  url: string;
  heartbeatInterval: number; // 30 seconds
  reconnectOnClose: boolean;
}

export const DEFAULT_WEBSOCKET_CONFIG: WebSocketClientConfig = {
  url: 'ws://localhost:3001/ws',
  heartbeatInterval: 30000, // 30 seconds
  reconnectOnClose: true,
};

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private deviceName: string | null = null;
  private publicKey: string | null = null;
  private vectorClock: Record<string, number> = {};
  private lastSyncTimestamp: number = 0;
  private retryManager: RetryManager;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private eventHandlers: Map<WebSocketClientEvent, Set<Function>> = new Map();

  constructor(private config: WebSocketClientConfig = DEFAULT_WEBSOCKET_CONFIG) {
    this.retryManager = new RetryManager();
  }

  /**
   * Connect to WebSocket server
   */
  async connect(
    deviceId: string,
    deviceName: string,
    publicKey: string,
    vectorClock: Record<string, number>,
    lastSyncTimestamp: number
  ): Promise<void> {
    if (this.isConnected) {
      console.log('[WSClient] Already connected');
      return;
    }

    // Store connection parameters for reconnection
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.publicKey = publicKey;
    this.vectorClock = vectorClock;
    this.lastSyncTimestamp = lastSyncTimestamp;

    try {
      console.log(`[WSClient] Connecting to ${this.config.url}...`);

      // Create WebSocket connection
      this.ws = new WebSocket(this.config.url);

      // Set up event handlers
      this.ws.onopen = () => {
        console.log('[WSClient] WebSocket opened, sending CONNECT...');

        // Send CONNECT message
        const connectMsg: ConnectMessage = {
          type: 'CONNECT',
          timestamp: Date.now(),
          messageId: crypto.randomUUID(),
          payload: {
            deviceId,
            deviceName,
            publicKey,
            vectorClock,
            lastSyncTimestamp,
          },
        };

        this.send(connectMsg);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[WSClient] WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        console.log(`[WSClient] WebSocket closed: ${event.code} ${event.reason}`);
        this.handleDisconnect();

        // Auto-reconnect if configured
        if (this.config.reconnectOnClose && this.retryManager.shouldRetry()) {
          this.emit('reconnecting', {
            attempt: this.retryManager.getRetryCount() + 1,
            delay: this.retryManager.getRetryDelay(),
          });

          this.retryManager.setTimer(() => {
            if (this.deviceId && this.deviceName && this.publicKey) {
              this.connect(
                this.deviceId,
                this.deviceName,
                this.publicKey,
                this.vectorClock,
                this.lastSyncTimestamp
              );
            }
          });
        }
      };
    } catch (error) {
      console.error('[WSClient] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WSClient] Disconnecting...');

    this.config.reconnectOnClose = false; // Disable auto-reconnect
    this.stopHeartbeat();

    if (this.ws) {
      // Close the connection (no DISCONNECT message in protocol)
      this.ws.close(1000, 'Client requested disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.retryManager.clearTimer();
    this.emit('disconnected', {});
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string | ArrayBuffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      console.log(`[WSClient] Received: ${message.type}`);

      // Handle different message types
      switch (message.type) {
        case 'CONNECTED':
          this.handleConnected(message as ConnectedMessage);
          break;

        case 'SYNC_RESPONSE':
          this.emit('message', { type: 'SYNC_RESPONSE', message: message as SyncResponseMessage });
          break;

        case 'OPERATION':
          this.emit('message', { type: 'OPERATION', message: message as OperationMessage });
          break;

        case 'ACK':
          this.emit('message', { type: 'ACK', message: message as AckMessage });
          break;

        case 'ERROR':
          this.handleError(message as ErrorMessage);
          break;

        case 'HEARTBEAT':
          // Echo heartbeat back
          this.send({
            type: 'HEARTBEAT',
            timestamp: Date.now(),
            messageId: crypto.randomUUID(),
            payload: {
              timestamp: Date.now(),
            },
          });
          break;

        default:
          console.warn('[WSClient] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WSClient] Error handling message:', error);
    }
  }

  /**
   * Handle CONNECTED message
   */
  private handleConnected(message: ConnectedMessage): void {
    console.log('[WSClient] Connected successfully');

    this.isConnected = true;
    this.retryManager.reset();
    this.startHeartbeat();

    // Flush message queue
    this.flushMessageQueue();

    this.emit('connected', {
      serverTime: message.payload.serverTime,
      vectorClock: message.payload.serverVectorClock,
    });
  }

  /**
   * Handle ERROR message
   */
  private handleError(message: ErrorMessage): void {
    console.error('[WSClient] Server error:', message.payload);
    this.emit('error', {
      code: message.payload.code,
      message: message.payload.message,
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.stopHeartbeat();
    this.emit('disconnected', {});
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      console.log('[WSClient] Queueing message (not connected):', message.type);
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WSClient] Failed to send message:', error);
      // Queue message on failure
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`[WSClient] Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'HEARTBEAT',
          timestamp: Date.now(),
          messageId: crypto.randomUUID(),
          payload: {
            timestamp: Date.now(),
          },
        });
      }
    }, this.config.heartbeatInterval);

    console.log('[WSClient] Heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get WebSocket ready state
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Register event handler
   */
  on(event: WebSocketClientEvent, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Emit event
   */
  private emit(event: WebSocketClientEvent, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WSClient] Error in ${event} handler:`, error);
        }
      }
    }
  }

  /**
   * Request sync
   */
  requestSync(since: number, vectorClock: Record<string, number>, limit: number = 100): void {
    if (!this.deviceId) {
      throw new Error('Cannot request sync: deviceId not set. Call connect() first.');
    }

    const message: SyncRequestMessage = {
      type: 'SYNC_REQUEST',
      timestamp: Date.now(),
      messageId: crypto.randomUUID(),
      payload: {
        deviceId: this.deviceId,
        vectorClock,
        since,
      },
    };

    this.send(message);
  }

  /**
   * Send operation
   */
  sendOperation(operation: OperationMessage): void {
    this.send(operation);
  }

  /**
   * Get retry manager
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  /**
   * Get connection stats
   */
  getStats(): {
    isConnected: boolean;
    queuedMessages: number;
    retryCount: number;
    readyState: number;
  } {
    return {
      isConnected: this.isConnected,
      queuedMessages: this.messageQueue.length,
      retryCount: this.retryManager.getRetryCount(),
      readyState: this.getReadyState(),
    };
  }
}

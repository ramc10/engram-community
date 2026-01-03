/**
 * Sync protocol types and interfaces
 * Based on MVP Implementation Specification Phase 3
 */

import { UUID, Timestamp, VectorClock, SyncOperation } from './memory';

/**
 * WebSocket message types
 */
export type MessageType =
  | 'CONNECT'
  | 'CONNECTED'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'OPERATION'
  | 'ACK'
  | 'ERROR'
  | 'HEARTBEAT'
  | 'DISCONNECT';

/**
 * Base message structure
 */
export interface BaseMessage {
  type: MessageType;
  timestamp: Timestamp;
  messageId: UUID;
}

/**
 * Client connects to server
 */
export interface ConnectMessage extends BaseMessage {
  type: 'CONNECT';
  payload: {
    deviceId: UUID;
    deviceName: string;
    publicKey: string;
    vectorClock: VectorClock;
    lastSyncTimestamp: Timestamp;
  };
}

/**
 * Server acknowledges connection
 */
export interface ConnectedMessage extends BaseMessage {
  type: 'CONNECTED';
  payload: {
    serverTime: Timestamp;
    serverVectorClock: VectorClock;
    connectedDevices: string[]; // Other devices online
  };
}

/**
 * Client requests sync
 */
export interface SyncRequestMessage extends BaseMessage {
  type: 'SYNC_REQUEST';
  payload: {
    deviceId: UUID;
    vectorClock: VectorClock;
    since: Timestamp; // Only send changes after this
  };
}

/**
 * Server responds with operations
 */
export interface SyncResponseMessage extends BaseMessage {
  type: 'SYNC_RESPONSE';
  payload: {
    operations: SyncOperation[];
    hasMore: boolean; // Pagination flag
    nextCursor?: Timestamp;
  };
}

/**
 * Real-time operation broadcast
 */
export interface OperationMessage extends BaseMessage {
  type: 'OPERATION';
  payload: {
    operation: SyncOperation;
  };
}

/**
 * Acknowledgment
 */
export interface AckMessage extends BaseMessage {
  type: 'ACK';
  payload: {
    messageId: UUID; // Which message is being acked
    success: boolean;
  };
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Heartbeat (keep-alive)
 */
export interface HeartbeatMessage extends BaseMessage {
  type: 'HEARTBEAT';
  payload: {
    timestamp: Timestamp;
  };
}

/**
 * Union type of all messages
 */
export type WebSocketMessage =
  | ConnectMessage
  | ConnectedMessage
  | SyncRequestMessage
  | SyncResponseMessage
  | OperationMessage
  | AckMessage
  | ErrorMessage
  | HeartbeatMessage;

/**
 * Sync states
 */
export type SyncState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'IDLE'
  | 'ERROR';

/**
 * Sync events
 */
export type SyncEvent =
  | 'NETWORK_AVAILABLE'
  | 'CONNECT_REQUESTED'
  | 'CONNECTION_ESTABLISHED'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'LOCAL_CHANGE'
  | 'REMOTE_CHANGE'
  | 'CONNECTION_LOST'
  | 'ERROR_OCCURRED'
  | 'RETRY_TIMEOUT';

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  // Timeouts
  connectionTimeout: number; // 10 seconds
  syncTimeout: number; // 30 seconds
  heartbeatInterval: number; // 30 seconds

  // Retry strategy
  maxRetries: number; // 10
  retryDelays: number[]; // [1s, 2s, 5s, 10s, 30s, ...]

  // Batching
  batchSize: number; // Max operations per sync
  batchDebounce: number; // Wait 500ms for more changes
}

/**
 * Conflict types
 */
export type ConflictType = 'CONCURRENT_UPDATE' | 'DELETE_UPDATE' | 'DUPLICATE_ADD';

/**
 * Conflict detection
 */
export interface Conflict {
  memoryId: UUID;
  localVersion: any;
  remoteVersion: any;
  type: ConflictType;
}

/**
 * Sync manager interface
 */
export interface ISyncManager {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // State
  getState(): SyncState;
  onStateChange(callback: (state: SyncState) => void): void;

  // Sync operations
  syncNow(): Promise<void>;
  queueOperation(op: SyncOperation): Promise<void>;

  // Events
  onRemoteChange(callback: (op: SyncOperation) => void): void;
  onError(callback: (error: Error) => void): void;
}

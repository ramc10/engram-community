/**
 * Storage layer interfaces and types
 * Based on MVP Implementation Specification Phase 2
 */

import { Memory, Conversation, SyncOperation, UUID, Timestamp, Platform, SyncStatus } from './memory';

/**
 * Database name and version constants
 */
export const DB_NAME = 'EngramDB';
export const DB_VERSION = 2; // v2: Added HNSW vector index (Phase 4)

/**
 * Metadata keys used in storage
 */
export const METADATA_KEYS = {
  DEVICE_ID: 'deviceId',
  DEVICE_NAME: 'deviceName',
  MASTER_KEY_SALT: 'masterKeySalt',
  DEVICE_PRIVATE_KEY: 'devicePrivateKey', // Encrypted with master key
  DEVICE_PUBLIC_KEY: 'devicePublicKey',
  VECTOR_CLOCK: 'vectorClock',
  LAST_SYNC_TIMESTAMP: 'lastSyncTimestamp',
  SERVER_URL: 'serverUrl',
  ONBOARDING_COMPLETE: 'onboardingComplete',
} as const;

/**
 * Memory filter options
 */
export interface MemoryFilter {
  conversationId?: string;
  platform?: Platform;
  startDate?: Timestamp;
  endDate?: Timestamp;
  tags?: string[];
  syncStatus?: SyncStatus;
  limit?: number;
  offset?: number;
}

/**
 * Conversation filter options
 */
export interface ConversationFilter {
  platform?: Platform;
  startDate?: Timestamp;
  endDate?: Timestamp;
  limit?: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalMemories: number;
  totalConversations: number;
  storageUsedBytes: number;
  pendingSyncOps: number;
  oldestMemory: Timestamp;
  newestMemory: Timestamp;
}

/**
 * Storage layer interface
 */
export interface IStorage {
  // Initialization
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Memories
  saveMemory(memory: Memory): Promise<void>;
  getMemory(id: UUID): Promise<Memory | null>;
  getMemories(filter: MemoryFilter): Promise<Memory[]>;
  updateMemory(id: UUID, updates: Partial<Memory>): Promise<void>;
  deleteMemory(id: UUID): Promise<void>;

  // Conversations
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(id: string): Promise<Conversation | null>;
  getConversations(filter: ConversationFilter): Promise<Conversation[]>;

  // Sync queue
  enqueueSyncOperation(op: SyncOperation): Promise<void>;
  dequeueSyncOperations(limit: number): Promise<SyncOperation[]>;
  clearSyncQueue(): Promise<void>;

  // Search
  searchMemories(query: string): Promise<Memory[]>;
  updateSearchIndex(memoryId: UUID, tags: string[]): Promise<void>;

  // Metadata
  getMetadata<T>(key: string): Promise<T | null>;
  setMetadata<T>(key: string, value: T): Promise<void>;

  // Bulk operations
  bulkSaveMemories(memories: Memory[]): Promise<void>;

  // Stats
  getStats(): Promise<StorageStats>;
}

/**
 * Server storage backend interface
 */
export interface IStorageBackend {
  // Devices
  registerDevice(device: {
    id: UUID;
    name: string;
    publicKey: string;
    platform: string;
    createdAt: Timestamp;
  }): Promise<void>;
  getDevice(deviceId: UUID): Promise<any>;
  updateDeviceLastSeen(deviceId: UUID, timestamp: Timestamp): Promise<void>;

  // Operations
  storeOperation(op: SyncOperation): Promise<void>;
  getOperations(filter: OperationFilter): Promise<SyncOperation[]>;

  // Vector clocks
  getServerVectorClock(): Promise<Record<string, number>>;
  updateVectorClock(deviceId: string, value: number): Promise<void>;

  // Stats
  getServerStats(): Promise<ServerStats>;
}

/**
 * Operation filter for server queries
 */
export interface OperationFilter {
  deviceId?: UUID;
  since?: Timestamp;
  excludeDeviceId?: UUID; // For syncing to other devices
  limit?: number;
  cursor?: Timestamp;
}

/**
 * Server statistics
 */
export interface ServerStats {
  totalDevices: number;
  activeDevices: number; // Seen in last 24h
  totalOperations: number;
  storageUsedBytes: number;
}

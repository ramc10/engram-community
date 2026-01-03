/**
 * REST API types and interfaces
 * Based on MVP Implementation Specification Phase 4
 */

import { UUID, Timestamp, VectorClock, SyncOperation, Memory } from './memory';
import { Device } from './memory';

/**
 * API version prefix
 */
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: Timestamp;
  version: string;
  uptime: number; // seconds
}

/**
 * Device registration request
 */
export interface RegisterDeviceRequest {
  deviceId: UUID;
  deviceName: string;
  publicKey: string; // Ed25519 public key
  platform: string; // 'darwin', 'win32', 'linux'
}

/**
 * Device registration response
 */
export interface RegisterDeviceResponse {
  deviceId: UUID;
  registered: boolean;
  serverTime: Timestamp;
}

/**
 * Get device response
 */
export type GetDeviceResponse = Device;

/**
 * Sync memories request
 */
export interface SyncMemoriesRequest {
  deviceId: UUID;
  vectorClock: VectorClock;
  since: Timestamp; // Last sync timestamp
  operations: SyncOperation[]; // Client's pending operations
}

/**
 * Sync memories response
 */
export interface SyncMemoriesResponse {
  operations: SyncOperation[]; // Server's operations for this device
  serverVectorClock: VectorClock;
  hasMore: boolean;
  nextCursor?: Timestamp;
}

/**
 * Store memory request
 */
export interface StoreMemoryRequest {
  operation: SyncOperation;
}

/**
 * Store memory response
 */
export interface StoreMemoryResponse {
  stored: boolean;
  operationId: UUID;
}

/**
 * Export format
 */
export type ExportFormat = 'json' | 'markdown';

/**
 * Export data request (query params)
 */
export interface ExportDataQuery {
  deviceId: UUID;
  format: ExportFormat;
}

/**
 * Export data response
 */
export interface ExportDataResponse {
  format: ExportFormat;
  exportedAt: Timestamp;
  data: Memory[] | string; // JSON array or markdown string
}

/**
 * Authentication headers
 */
export interface AuthHeaders {
  'X-Device-Id': UUID;
  'X-Signature': string; // Ed25519 signature of request body
  'X-Timestamp': string; // Timestamp as string
}

/**
 * Error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Timestamp;
}

/**
 * Message Protocol
 * Type-safe message passing between content scripts and background service worker
 * 
 * Message Flow:
 * Content Script → Background Worker → Storage/Crypto
 * Background Worker → Content Script (responses)
 */

import { ExtractedMessage } from '@engram/core';
import { Memory, UUID } from '@engram/core';
import { MemoryFilter } from '@engram/core';

/**
 * Message Types
 */
export enum MessageType {
  // Initialization
  INIT_REQUEST = 'INIT_REQUEST',
  INIT_RESPONSE = 'INIT_RESPONSE',

  // Message Extraction
  SAVE_MESSAGE = 'SAVE_MESSAGE',
  SAVE_MESSAGE_RESPONSE = 'SAVE_MESSAGE_RESPONSE',

  // Memory Queries
  GET_MEMORIES = 'GET_MEMORIES',
  GET_MEMORIES_RESPONSE = 'GET_MEMORIES_RESPONSE',
  
  SEARCH_MEMORIES = 'SEARCH_MEMORIES',
  SEARCH_MEMORIES_RESPONSE = 'SEARCH_MEMORIES_RESPONSE',

  // Sync Status
  GET_SYNC_STATUS = 'GET_SYNC_STATUS',
  GET_SYNC_STATUS_RESPONSE = 'GET_SYNC_STATUS_RESPONSE',

  // Authentication
  AUTH_REGISTER = 'AUTH_REGISTER',
  AUTH_REGISTER_RESPONSE = 'AUTH_REGISTER_RESPONSE',
  AUTH_LOGIN = 'AUTH_LOGIN',
  AUTH_LOGIN_RESPONSE = 'AUTH_LOGIN_RESPONSE',
  AUTH_LOGIN_GOOGLE = 'AUTH_LOGIN_GOOGLE',
  AUTH_LOGIN_GOOGLE_RESPONSE = 'AUTH_LOGIN_GOOGLE_RESPONSE',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_LOGOUT_RESPONSE = 'AUTH_LOGOUT_RESPONSE',
  GET_AUTH_STATE = 'GET_AUTH_STATE',
  GET_AUTH_STATE_RESPONSE = 'GET_AUTH_STATE_RESPONSE',

  // Premium Tier
  GET_PREMIUM_STATUS = 'GET_PREMIUM_STATUS',
  GET_PREMIUM_STATUS_RESPONSE = 'GET_PREMIUM_STATUS_RESPONSE',
  UPGRADE_TO_PREMIUM = 'UPGRADE_TO_PREMIUM',
  UPGRADE_TO_PREMIUM_RESPONSE = 'UPGRADE_TO_PREMIUM_RESPONSE',
  REQUEST_PREMIUM_UPGRADE = 'REQUEST_PREMIUM_UPGRADE',
  REQUEST_PREMIUM_UPGRADE_RESPONSE = 'REQUEST_PREMIUM_UPGRADE_RESPONSE',
  START_CLOUD_SYNC = 'START_CLOUD_SYNC',
  START_CLOUD_SYNC_RESPONSE = 'START_CLOUD_SYNC_RESPONSE',
  STOP_CLOUD_SYNC = 'STOP_CLOUD_SYNC',
  STOP_CLOUD_SYNC_RESPONSE = 'STOP_CLOUD_SYNC_RESPONSE',

  // Enrichment Config
  REINITIALIZE_ENRICHMENT = 'REINITIALIZE_ENRICHMENT',
  REINITIALIZE_ENRICHMENT_RESPONSE = 'REINITIALIZE_ENRICHMENT_RESPONSE',

  // Memory Evolution (Phase 3)
  REVERT_EVOLUTION = 'REVERT_EVOLUTION',
  REVERT_EVOLUTION_RESPONSE = 'REVERT_EVOLUTION_RESPONSE',

  // Errors
  ERROR = 'ERROR',
}

/**
 * Base message structure
 */
export interface BaseMessage {
  type: MessageType;
  requestId?: string; // For request/response correlation
}

/**
 * Initialization messages
 */
export interface InitRequest extends BaseMessage {
  type: MessageType.INIT_REQUEST;
}

export interface InitResponse extends BaseMessage {
  type: MessageType.INIT_RESPONSE;
  success: boolean;
  deviceId?: UUID;
  error?: string;
}

/**
 * Save message from extracted content
 */
export interface SaveMessageRequest extends BaseMessage {
  type: MessageType.SAVE_MESSAGE;
  message: ExtractedMessage;
}

export interface SaveMessageResponse extends BaseMessage {
  type: MessageType.SAVE_MESSAGE_RESPONSE;
  success: boolean;
  memoryId?: UUID;
  error?: string;
}

/**
 * Get memories with filters
 */
export interface GetMemoriesRequest extends BaseMessage {
  type: MessageType.GET_MEMORIES;
  filter?: MemoryFilter;
}

export interface GetMemoriesResponse extends BaseMessage {
  type: MessageType.GET_MEMORIES_RESPONSE;
  success: boolean;
  memories?: Memory[];
  error?: string;
}

/**
 * Search memories
 */
export interface SearchMemoriesRequest extends BaseMessage {
  type: MessageType.SEARCH_MEMORIES;
  query: string;
  limit?: number;
}

export interface SearchMemoriesResponse extends BaseMessage {
  type: MessageType.SEARCH_MEMORIES_RESPONSE;
  success: boolean;
  memories?: Memory[];
  error?: string;
}

/**
 * Get sync status
 */
export interface GetSyncStatusRequest extends BaseMessage {
  type: MessageType.GET_SYNC_STATUS;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSyncTime?: number;
  pendingOperations: number;
  deviceId?: UUID;
}

export interface GetSyncStatusResponse extends BaseMessage {
  type: MessageType.GET_SYNC_STATUS_RESPONSE;
  success: boolean;
  status?: SyncStatus;
  error?: string;
}

/**
 * Authentication messages
 */
export interface AuthRegisterRequest extends BaseMessage {
  type: MessageType.AUTH_REGISTER;
  email: string;
  password: string;
}

export interface AuthRegisterResponse extends BaseMessage {
  type: MessageType.AUTH_REGISTER_RESPONSE;
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

export interface AuthLoginRequest extends BaseMessage {
  type: MessageType.AUTH_LOGIN;
  email: string;
  password: string;
}

export interface AuthLoginResponse extends BaseMessage {
  type: MessageType.AUTH_LOGIN_RESPONSE;
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

export interface AuthLogoutRequest extends BaseMessage {
  type: MessageType.AUTH_LOGOUT;
}

export interface AuthLogoutResponse extends BaseMessage {
  type: MessageType.AUTH_LOGOUT_RESPONSE;
  success: boolean;
  error?: string;
}

export interface GetAuthStateRequest extends BaseMessage {
  type: MessageType.GET_AUTH_STATE;
}

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
}

export interface GetAuthStateResponse extends BaseMessage {
  type: MessageType.GET_AUTH_STATE_RESPONSE;
  success: boolean;
  authState?: AuthState;
  error?: string;
}

/**
 * Premium tier messages
 */
export interface GetPremiumStatusRequest extends BaseMessage {
  type: MessageType.GET_PREMIUM_STATUS;
}

export interface PremiumStatus {
  tier: 'free' | 'premium';
  isPremium: boolean;
  syncEnabled: boolean;
  premiumSince: string | null;
  hasPendingRequest: boolean;
}

export interface GetPremiumStatusResponse extends BaseMessage {
  type: MessageType.GET_PREMIUM_STATUS_RESPONSE;
  success: boolean;
  status?: PremiumStatus;
  error?: string;
}

export interface UpgradeToPremiumRequest extends BaseMessage {
  type: MessageType.UPGRADE_TO_PREMIUM;
}

export interface UpgradeToPremiumResponse extends BaseMessage {
  type: MessageType.UPGRADE_TO_PREMIUM_RESPONSE;
  success: boolean;
  error?: string;
}

export interface RequestPremiumUpgradeRequest extends BaseMessage {
  type: MessageType.REQUEST_PREMIUM_UPGRADE;
}

export interface RequestPremiumUpgradeResponse extends BaseMessage {
  type: MessageType.REQUEST_PREMIUM_UPGRADE_RESPONSE;
  success: boolean;
  error?: string;
}

export interface StartCloudSyncRequest extends BaseMessage {
  type: MessageType.START_CLOUD_SYNC;
}

export interface StartCloudSyncResponse extends BaseMessage {
  type: MessageType.START_CLOUD_SYNC_RESPONSE;
  success: boolean;
  error?: string;
}

export interface StopCloudSyncRequest extends BaseMessage {
  type: MessageType.STOP_CLOUD_SYNC;
}

export interface StopCloudSyncResponse extends BaseMessage {
  type: MessageType.STOP_CLOUD_SYNC_RESPONSE;
  success: boolean;
  error?: string;
}

export interface ReinitializeEnrichmentRequest extends BaseMessage {
  type: MessageType.REINITIALIZE_ENRICHMENT;
}

export interface ReinitializeEnrichmentResponse extends BaseMessage {
  type: MessageType.REINITIALIZE_ENRICHMENT_RESPONSE;
  success: boolean;
  error?: string;
}

/**
 * Memory Evolution (Phase 3)
 */
export interface RevertEvolutionRequest extends BaseMessage {
  type: MessageType.REVERT_EVOLUTION;
  memoryId: UUID;
  versionIndex: number;
}

export interface RevertEvolutionResponse extends BaseMessage {
  type: MessageType.REVERT_EVOLUTION_RESPONSE;
  success: boolean;
  error?: string;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  error: string;
  originalType?: MessageType;
}

/**
 * Union of all message types
 */
export type Message =
  | InitRequest
  | InitResponse
  | SaveMessageRequest
  | SaveMessageResponse
  | GetMemoriesRequest
  | GetMemoriesResponse
  | SearchMemoriesRequest
  | SearchMemoriesResponse
  | GetSyncStatusRequest
  | GetSyncStatusResponse
  | AuthRegisterRequest
  | AuthRegisterResponse
  | AuthLoginRequest
  | AuthLoginResponse
  | AuthLogoutRequest
  | AuthLogoutResponse
  | GetAuthStateRequest
  | GetAuthStateResponse
  | GetPremiumStatusRequest
  | GetPremiumStatusResponse
  | UpgradeToPremiumRequest
  | UpgradeToPremiumResponse
  | RequestPremiumUpgradeRequest
  | RequestPremiumUpgradeResponse
  | StartCloudSyncRequest
  | StartCloudSyncResponse
  | StopCloudSyncRequest
  | StopCloudSyncResponse
  | ReinitializeEnrichmentRequest
  | ReinitializeEnrichmentResponse
  | RevertEvolutionRequest
  | RevertEvolutionResponse
  | ErrorMessage;

/**
 * Type guard for message validation
 */
export function isValidMessage(obj: any): obj is Message {
  return obj && typeof obj === 'object' && 'type' in obj && typeof obj.type === 'string';
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send message to background worker
 */
export async function sendMessage<T extends Message>(
  message: Omit<T, 'requestId'>
): Promise<any> {
  const requestId = generateRequestId();
  const messageWithId = { ...message, requestId } as T;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(messageWithId, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.type === MessageType.ERROR) {
        reject(new Error(response.error));
        return;
      }

      resolve(response);
    });
  });
}

/**
 * Helper: Send init request
 */
export async function sendInitRequest(): Promise<InitResponse> {
  return sendMessage<InitRequest>({
    type: MessageType.INIT_REQUEST,
  });
}

/**
 * Helper: Save extracted message
 */
export async function sendSaveMessage(
  message: ExtractedMessage
): Promise<SaveMessageResponse> {
  return sendMessage<SaveMessageRequest>({
    type: MessageType.SAVE_MESSAGE,
    message,
  });
}

/**
 * Helper: Get memories
 */
export async function sendGetMemories(
  filter?: MemoryFilter
): Promise<GetMemoriesResponse> {
  return sendMessage<GetMemoriesRequest>({
    type: MessageType.GET_MEMORIES,
    filter,
  });
}

/**
 * Helper: Search memories
 */
export async function sendSearchMemories(
  query: string,
  limit?: number
): Promise<SearchMemoriesResponse> {
  return sendMessage<SearchMemoriesRequest>({
    type: MessageType.SEARCH_MEMORIES,
    query,
    limit,
  });
}

/**
 * Helper: Get sync status
 */
export async function sendGetSyncStatus(): Promise<GetSyncStatusResponse> {
  return sendMessage<GetSyncStatusRequest>({
    type: MessageType.GET_SYNC_STATUS,
  });
}

/**
 * Message handler type for background worker
 */
export type MessageHandler = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => boolean | void | Promise<void>;

/**
 * Create error response
 */
export function createErrorResponse(
  error: string | Error,
  originalType?: MessageType
): ErrorMessage {
  return {
    type: MessageType.ERROR,
    error: error instanceof Error ? error.message : error,
    originalType,
  };
}

/**
 * Validate message structure
 */
export function validateMessage(message: any): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }

  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Message must have a type string' };
  }

  if (!Object.values(MessageType).includes(message.type)) {
    return { valid: false, error: `Invalid message type: ${message.type}` };
  }

  return { valid: true };
}

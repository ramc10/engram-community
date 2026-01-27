/**
 * Core memory data structures
 * Based on MVP Implementation Specification Phase 1.1
 */

import type { EncryptedBlob } from './crypto';

/**
 * Unique identifier type
 */
export type UUID = string; // RFC 4122 v4

/**
 * Timestamp in milliseconds since epoch
 */
export type Timestamp = number;

/**
 * Platform identifier
 */
export type Platform = 'chatgpt' | 'claude' | 'perplexity' | 'gemini' | 'generic';

/**
 * Message role in conversation
 */
export type Role = 'user' | 'assistant' | 'system';

/**
 * Vector clock for causal ordering
 * Maps device ID to logical clock value
 */
export type VectorClock = Record<string, number>;

/**
 * Sync status for memories
 */
export type SyncStatus = 'pending' | 'synced' | 'failed';

/**
 * Code block metadata
 */
export interface CodeBlock {
  language: string;
  code: string;
}

/**
 * Attachment metadata
 */
export interface Attachment {
  type: string;
  name: string;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  codeBlocks?: CodeBlock[];
  attachments?: Attachment[];
}

/**
 * Message content structure
 * Note: text and metadata are null when content is encrypted
 */
export interface MessageContent {
  role: Role;
  text: string | null; // null when content is encrypted
  metadata?: MessageMetadata | null; // null when encrypted
}

/**
 * Encryption envelope
 */
export interface EncryptionEnvelope {
  algorithm: 'XChaCha20-Poly1305';
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

/**
 * Core memory unit - represents a single AI message
 */
export interface Memory {
  // Identity
  id: UUID; // Deterministic from content hash

  // Content (encrypted at rest)
  content: MessageContent;

  // Context
  conversationId: string; // Links messages in same conversation
  platform: Platform; // Which AI platform

  // Ordering and causality
  timestamp: Timestamp; // Wall clock (for display)
  vectorClock: VectorClock; // Logical clock (for ordering)

  // Sync metadata
  deviceId: string; // Which device created this
  syncStatus: SyncStatus;

  // User organization
  tags: string[]; // User-added tags

  // Encryption envelope (when stored)
  encrypted?: EncryptionEnvelope;
}

/**
 * Conversation metadata
 */
export interface Conversation {
  id: string;
  platform: Platform;
  title?: string; // Auto-generated or user-set
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
  messageCount: number;
  tags: string[];
}

/**
 * Device registration
 */
export interface Device {
  id: UUID;
  name: string; // "Chrome on MacBook"
  platform: string; // "darwin", "win32", "linux"
  publicKey: string; // Ed25519 verification key
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
}

/**
 * Sync operation type
 */
export type SyncOperationType = 'add' | 'update' | 'delete';

/**
 * Sync operation (CRDT operation)
 */
export interface SyncOperation {
  id: UUID;
  type: SyncOperationType;
  memoryId: UUID;
  vectorClock: VectorClock;
  payload: Memory | Partial<Memory> | null;
  signature: string; // Ed25519 signature
  timestamp: Timestamp;
}

/**
 * Local device state
 */
export interface DeviceState {
  deviceId: UUID;
  vectorClock: VectorClock;
  lastSyncTimestamp: Timestamp;
  pendingSyncOps: SyncOperation[];
}

// ============================================================================
// memA Extension - A-MEM-inspired Memory Intelligence
// ============================================================================

/**
 * Evolution history entry
 * Tracks how a memory's metadata changed over time
 */
export interface EvolutionHistoryEntry {
  keywords: string[];
  tags: string[];
  context: string;
  timestamp: Timestamp;
}

/**
 * Evolution metadata
 * Tracks how memories evolve based on new information
 */
export interface EvolutionMetadata {
  /** Number of times this memory has been updated */
  updateCount: number;

  /** Last time this memory was evolved */
  lastUpdated: Timestamp;

  /** Memory IDs that triggered evolution */
  triggeredBy: UUID[];

  /** Historical states (last 10 versions) */
  history: EvolutionHistoryEntry[];
}

/**
 * Link quality score
 * Represents confidence in the semantic connection
 */
export interface LinkScore {
  /** Target memory ID */
  memoryId: UUID;

  /** Confidence score (0.0-1.0) */
  score: number;

  /** When this link was created */
  createdAt: Timestamp;

  /** LLM-generated reason for the link */
  reason?: string;
}

/**
 * Enrichment configuration
 * Controls LLM-based metadata generation
 */
export interface EnrichmentConfig {
  /** Enable/disable enrichment */
  enabled: boolean;

  /** LLM provider */
  provider: 'openai' | 'anthropic' | 'local' | 'premium';

  /** Model to use */
  model: string;

  /** Encrypted API key (not required for local models) */
  apiKey?: string;

  /** Local model endpoint URL (e.g., http://localhost:11434/v1 for Ollama) */
  localEndpoint?: string;

  /** Batch size for processing */
  batchSize: number;

  /** Cost tracking */
  estimatedCost?: number;

  /** Enable/disable link detection (Phase 2) */
  enableLinkDetection?: boolean;

  /** Enable/disable memory evolution (Phase 3) */
  enableEvolution?: boolean;
}

/**
 * Extended Memory interface with memA fields
 * Backward compatible with v0.1.0
 */
export interface MemoryWithMemA extends Memory {
  // ===== memA fields =====

  /** LLM-generated keywords (3-7 terms) */
  keywords?: string[];

  /** LLM-generated context (1 sentence summary) */
  context?: string;

  /** Semantic links to related memories */
  links?: LinkScore[];

  /** Evolution tracking metadata */
  evolution?: EvolutionMetadata;

  /** Schema version for migrations */
  memAVersion?: number;

  /**
   * @deprecated Use encryptedEmbedding instead (v2)
   * Semantic embedding vector (384-dim for BGE-Small)
   */
  embedding?: Float32Array;

  /**
   * Encrypted embedding vector (v2)
   * Stored as EncryptedBlob to protect semantic information
   * Decrypted on-demand during search operations
   */
  encryptedEmbedding?: EncryptedBlob;

  /**
   * Embedding schema version
   * v1: Unencrypted embeddings (legacy)
   * v2: Encrypted embeddings
   */
  embeddingVersion?: 1 | 2;
}

/**
 * Enrichment request to LLM
 */
export interface EnrichmentRequest {
  memoryId: UUID;
  content: string;
  platform: Platform;
  role: Role;
  timestamp: Timestamp;
}

/**
 * Enrichment response from LLM
 */
export interface EnrichmentResponse {
  keywords: string[];
  tags: string[];
  context: string;
}

/**
 * Link detection request
 */
export interface LinkDetectionRequest {
  memoryId: UUID;
  embedding: Float32Array;
  topK: number; // How many candidates to consider
}

/**
 * Link detection response
 */
export interface LinkDetectionResponse {
  /** Memory IDs to link with scores */
  links: LinkScore[];
}

/**
 * Evolution check request
 */
export interface EvolutionCheckRequest {
  /** Memory to potentially evolve */
  targetMemoryId: UUID;

  /** New memory that might trigger evolution */
  newMemoryId: UUID;

  /** Current state of target memory */
  currentKeywords: string[];
  currentTags: string[];
  currentContext: string;
}

/**
 * Evolution check response
 */
export interface EvolutionCheckResponse {
  /** Should the memory evolve? */
  shouldEvolve: boolean;

  /** Updated keywords (if shouldEvolve) */
  keywords?: string[];

  /** Updated tags (if shouldEvolve) */
  tags?: string[];

  /** Updated context (if shouldEvolve) */
  context?: string;

  /** LLM explanation of why it should/shouldn't evolve */
  reason: string;
}

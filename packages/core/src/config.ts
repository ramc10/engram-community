/**
 * Global configuration constants
 * Based on MVP Implementation Specification Phase 8
 */

import type { Platform } from './types/memory';

/**
 * Application version
 */
export const VERSION = '0.1.0';

/**
 * Crypto configuration
 */
export const CRYPTO_CONFIG = {
  ALGORITHM: 'XChaCha20-Poly1305' as const,
  KEY_SIZE: 32, // 256 bits
  NONCE_SIZE: 24,
  ARGON2_TIME: 4,
  ARGON2_MEMORY: 65536, // 64 MB in KiB
  ARGON2_PARALLELISM: 1,
  SIGNATURE_ALGORITHM: 'Ed25519' as const,
} as const;

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  DB_NAME: 'EngramDB',
  DB_VERSION: 1,
  MAX_MEMORY_SIZE: 10 * 1024 * 1024, // 10 MB per memory
  SEARCH_LIMIT: 100,
} as const;

/**
 * Supabase configuration
 */
export const SUPABASE_CONFIG = {
  URL: process.env.PLASMO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  ANON_KEY: process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'your-anon-key',
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key', // Server-side only - has admin privileges
} as const;

/**
 * Sync configuration
 */
export const SYNC_CONFIG = {
  SERVER_URL_MANAGED: 'https://engram.fly.dev',
  SERVER_URL_DEFAULT: 'http://localhost:3001',
  API_BASE_URL: 'http://localhost:3001/api',
  WEBSOCKET_PATH: '/ws',
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  SYNC_TIMEOUT: 30000, // 30 seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  MAX_RETRIES: 10,
  RETRY_DELAYS: [1000, 2000, 5000, 10000, 30000, 60000],
  BATCH_SIZE: 50, // Max operations per batch
  BATCH_DEBOUNCE: 500, // Wait 500ms for more changes
} as const;

/**
 * Platform detection configuration
 */
export const PLATFORM_CONFIG = {
  CHATGPT: {
    URL_PATTERN: /chatgpt\.com/,
    NAME: 'chatgpt' as Platform,
  },
  CLAUDE: {
    URL_PATTERN: /claude\.ai/,
    NAME: 'claude' as Platform,
  },
  PERPLEXITY: {
    URL_PATTERN: /perplexity\.ai/,
    NAME: 'perplexity' as Platform,
  },
} as const;

/**
 * UI configuration
 */
export const UI_CONFIG = {
  MEMORY_PANEL_WIDTH: 320,
  MAX_PREVIEW_LENGTH: 150,
  DEBOUNCE_SEARCH: 300, // ms
  SUGGESTION_THRESHOLD: 0.7, // Similarity score
} as const;

/**
 * Limits configuration
 */
export const LIMITS = {
  MAX_MEMORIES_PER_CONVERSATION: 1000,
  MAX_TAGS_PER_MEMORY: 10,
  MAX_TAG_LENGTH: 50,
  MAX_SEARCH_RESULTS: 100,
} as const;

/**
 * LM Studio / Local LLM configuration
 */
export const LM_STUDIO_CONFIG = {
  DEFAULT_ENDPOINT: 'http://localhost:1234',
  DEFAULT_MODEL: 'llama-3.2-3b-instruct',
  OLLAMA_ENDPOINT: 'http://localhost:11434',
} as const;

/**
 * Combined configuration object
 */
export const CONFIG = {
  VERSION,
  CRYPTO: CRYPTO_CONFIG,
  STORAGE: STORAGE_CONFIG,
  SUPABASE: SUPABASE_CONFIG,
  SYNC: SYNC_CONFIG,
  PLATFORMS: PLATFORM_CONFIG,
  UI: UI_CONFIG,
  LIMITS,
  LM_STUDIO: LM_STUDIO_CONFIG,
} as const;

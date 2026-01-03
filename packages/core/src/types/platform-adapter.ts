/**
 * Platform adapter interfaces
 * Based on MVP Implementation Specification Phase 1.2
 */

import { Platform, Role } from './memory';

/**
 * DOM Selectors for platform
 */
export interface PlatformSelectors {
  // Main container where messages appear
  containerSelector: string;

  // Individual message elements
  messageSelector: string;

  // Message content (text)
  contentSelector: string;

  // Optional: Code blocks
  codeBlockSelector?: string;

  // Where to inject memory UI
  injectionPointSelector: string;
}

/**
 * Platform feature support
 */
export interface PlatformFeatures {
  supportsStreaming: boolean; // Messages appear incrementally
  supportsCodeBlocks: boolean;
  supportsAttachments: boolean;
  supportsRegeneration: boolean;
}

/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  platformId: Platform;

  // DOM Selectors
  selectors: PlatformSelectors;

  // URL patterns
  urlPattern: RegExp;
  conversationIdExtractor: (url: string) => string | null;

  // Platform-specific behavior
  features: PlatformFeatures;
}

/**
 * Code block extracted from DOM
 */
export interface ExtractedCodeBlock {
  language: string;
  code: string;
}

/**
 * Message metadata from extraction
 */
export interface ExtractedMetadata {
  codeBlocks?: ExtractedCodeBlock[];
  isStreaming?: boolean;
  messageIndex?: number;
  sources?: string[]; // Perplexity citations/sources
}

/**
 * Extracted message from DOM
 */
export interface ExtractedMessage {
  role: Role;
  content: string;
  timestamp?: number;
  conversationId: string;
  metadata?: ExtractedMetadata;
}

/**
 * Platform adapter interface
 * Each platform implements this
 */
export interface IPlatformAdapter {
  // Configuration
  getConfig(): PlatformConfig;

  // Lifecycle
  initialize(): Promise<void>;
  destroy(): void;

  // Detection
  isCurrentPlatform(url: string): boolean;

  // Extraction
  extractMessage(element: HTMLElement): ExtractedMessage | null;
  extractConversationId(): string | null;

  // Observation
  observeMessages(callback: (message: ExtractedMessage) => void): Promise<void>;
  stopObserving(): void;

  // UI Injection
  getInjectionPoint(): HTMLElement | null;
  shouldShowMemoryUI(): boolean;
}

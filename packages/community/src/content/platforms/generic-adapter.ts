/**
 * Generic Platform Adapter
 * Provides Engram memory access on any website.
 * Unlike AI platform adapters, this does NOT observe/extract messages.
 * It simply enables the memory panel UI so users can search and
 * access their saved memories from any site.
 */

import {
  IPlatformAdapter,
  PlatformConfig,
  ExtractedMessage,
  PlatformSelectors,
  PlatformFeatures,
} from '@engram/core';
import { Platform } from '@engram/core';

/**
 * Generic DOM selectors (not used for message extraction)
 */
const SELECTORS: PlatformSelectors = {
  containerSelector: 'body',
  messageSelector: '', // No message extraction on generic sites
  contentSelector: '',
  injectionPointSelector: 'body',
};

/**
 * Generic feature support
 */
const FEATURES: PlatformFeatures = {
  supportsStreaming: false,
  supportsCodeBlocks: false,
  supportsAttachments: false,
  supportsRegeneration: false,
};

/**
 * Generic Platform Adapter Implementation
 * Provides memory panel access without message observation.
 */
export class GenericAdapter implements IPlatformAdapter {
  /**
   * Get platform configuration
   */
  getConfig(): PlatformConfig {
    return {
      platformId: 'generic' as Platform,
      selectors: SELECTORS,
      urlPattern: /^https?:\/\//,  // Matches any http/https URL
      conversationIdExtractor: () => null,
      features: FEATURES,
    };
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    // No special initialization needed for generic sites
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Nothing to clean up
  }

  /**
   * Check if current URL matches (any http/https page)
   */
  isCurrentPlatform(url: string): boolean {
    return this.getConfig().urlPattern.test(url);
  }

  /**
   * No message extraction on generic sites
   */
  extractMessage(_element: HTMLElement): ExtractedMessage | null {
    return null;
  }

  /**
   * No conversation ID on generic sites
   */
  extractConversationId(): string | null {
    return null;
  }

  /**
   * No message observation on generic sites.
   * The adapter exists to enable the memory panel UI.
   */
  async observeMessages(_callback: (message: ExtractedMessage) => void): Promise<void> {
    // No-op: generic sites don't have messages to observe
  }

  /**
   * No-op stop observing
   */
  stopObserving(): void {
    // Nothing to stop
  }

  /**
   * Get injection point for memory UI (fixed position on body)
   */
  getInjectionPoint(): HTMLElement | null {
    return null; // Return null to use fixed-position overlay mode
  }

  /**
   * Always show memory UI on generic sites
   */
  shouldShowMemoryUI(): boolean {
    return true;
  }
}

/**
 * Export singleton instance
 */
export const genericAdapter = new GenericAdapter();

/**
 * Perplexity Platform Adapter
 * Implements IPlatformAdapter for Perplexity (perplexity.ai)
 *
 * DOM Structure (as of Jan 2025):
 * - Container: main
 * - Messages: .MessageContainer or .message
 * - User messages: Have .user class or data-role="user"
 * - Assistant messages: Have .prose content
 * - Code blocks: pre > code with .language-* classes
 * - Sources/Citations: Links within messages (.source, .citation classes)
 * - Conversation ID: URL pattern /search/{search-id}
 */

import {
  IPlatformAdapter,
  PlatformConfig,
  ExtractedMessage,
  ExtractedCodeBlock,
  PlatformSelectors,
  PlatformFeatures,
} from '@engram/core';
import { Platform, Role } from '@engram/core';

/**
 * Perplexity DOM selectors
 */
const SELECTORS: PlatformSelectors = {
  containerSelector: 'main',
  messageSelector: '.MessageContainer, .message, [class*="message"]',
  contentSelector: '.MessageContent, .prose, [class*="content"]',
  codeBlockSelector: 'pre code',
  injectionPointSelector: 'aside, .sidebar, #sidebar',
};

/**
 * Perplexity feature support
 */
const FEATURES: PlatformFeatures = {
  supportsStreaming: true,
  supportsCodeBlocks: true,
  supportsAttachments: false,
  supportsRegeneration: true,
};

/**
 * Perplexity Platform Adapter Implementation
 */
export class PerplexityAdapter implements IPlatformAdapter {
  private observer: MutationObserver | null = null;
  private observerCallback: ((message: ExtractedMessage) => void) | null = null;
  private lastProcessedMessages = new Set<string>();
  private processedContents = new Set<string>(); // Track processed content to avoid duplicates
  private streamingMessages = new Map<string, number>(); // Track streaming messages with debounce timers

  /**
   * Get platform configuration
   */
  getConfig(): PlatformConfig {
    return {
      platformId: 'perplexity' as Platform,
      selectors: SELECTORS,
      urlPattern: /perplexity\.ai/,
      conversationIdExtractor: this.extractConversationIdFromUrl,
      features: FEATURES,
    };
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    // Clear any previous state
    this.lastProcessedMessages.clear();
    this.processedContents.clear();

    // Wait for page to be ready
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
    this.stopObserving();
    this.lastProcessedMessages.clear();
    this.processedContents.clear();

    // Clear all streaming timers
    this.streamingMessages.forEach(timer => window.clearTimeout(timer));
    this.streamingMessages.clear();

    this.observerCallback = null;
  }

  /**
   * Check if current URL is Perplexity
   */
  isCurrentPlatform(url: string): boolean {
    return this.getConfig().urlPattern.test(url);
  }

  /**
   * Extract conversation ID from URL
   */
  private extractConversationIdFromUrl(url: string): string | null {
    // URL pattern: https://www.perplexity.ai/search/{search-id}
    const match = url.match(/\/search\/([\w-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract conversation ID from current page
   */
  extractConversationId(): string | null {
    return this.extractConversationIdFromUrl(window.location.href);
  }

  /**
   * Determine message role from element
   */
  private determineRole(element: HTMLElement): Role | null {
    // Check for explicit user class or data attribute first
    if (element.classList.contains('user') ||
        element.getAttribute('data-role') === 'user' ||
        element.className.includes('user')) {
      return 'user';
    }

    // Check for explicit assistant class or data attribute
    if (element.classList.contains('assistant') ||
        element.getAttribute('data-role') === 'assistant') {
      return 'assistant';
    }

    // Check for content - if has content, default to assistant
    // (User messages should have been caught by class check above)
    const hasContent = element.querySelector(SELECTORS.contentSelector);
    if (hasContent) {
      return 'assistant';
    }

    return null;
  }

  /**
   * Extract a single message from DOM element
   */
  extractMessage(element: HTMLElement): ExtractedMessage | null {
    try {
      // Determine role
      const role = this.determineRole(element);
      if (!role) {
        return null;
      }

      // Extract content
      const contentElement = element.querySelector(SELECTORS.contentSelector);
      if (!contentElement) {
        return null;
      }

      const content = this.extractTextContent(contentElement as HTMLElement);

      // Extract code blocks
      const codeBlocks = this.extractCodeBlocks(element);

      // Reject only if both content and code blocks are empty
      if ((!content || content.trim().length === 0) && codeBlocks.length === 0) {
        return null;
      }

      // Extract sources (Perplexity-specific)
      const sources = this.extractSources(element);

      // Get conversation ID
      const conversationId = this.extractConversationId();
      if (!conversationId) {
        return null;
      }

      // Check if message is still streaming
      const isStreaming = this.isMessageStreaming(element);

      // Get message timestamp (use current time as Perplexity doesn't expose timestamps)
      const timestamp = Date.now();

      // Get message index from DOM position
      const container = document.querySelector(SELECTORS.containerSelector);
      const messages = container?.querySelectorAll(SELECTORS.messageSelector);
      const messageIndex = messages ? Array.from(messages).indexOf(element) : undefined;

      return {
        role,
        content: content || '', // Ensure content is at least empty string
        timestamp,
        conversationId,
        metadata: {
          codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
          isStreaming,
          messageIndex,
          sources: sources.length > 0 ? sources : undefined,
        },
      };
    } catch (error) {
      console.error('Perplexity adapter: Error extracting message:', error);
      return null;
    }
  }

  /**
   * Extract text content from element, handling markdown
   */
  private extractTextContent(element: HTMLElement): string {
    // Clone to avoid modifying DOM
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove code blocks (we handle them separately)
    clone.querySelectorAll('pre').forEach(pre => pre.remove());

    // Remove source/citation elements (we handle them separately)
    clone.querySelectorAll('.source, .citation').forEach(src => src.remove());

    // Get text content
    let text = clone.textContent || '';

    // Clean up whitespace
    text = text
      .split('\n') // Split into lines
      .map(line => line.trim()) // Trim each line
      .join('\n') // Rejoin
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();

    return text;
  }

  /**
   * Extract code blocks from message
   */
  private extractCodeBlocks(element: HTMLElement): ExtractedCodeBlock[] {
    const blocks: ExtractedCodeBlock[] = [];
    const codeElements = element.querySelectorAll(SELECTORS.codeBlockSelector!);

    codeElements.forEach(codeEl => {
      const code = codeEl.textContent || '';

      // Extract language from class (e.g., "language-python")
      let language = 'plaintext';
      const classes = (codeEl as HTMLElement).className;
      const langMatch = classes.match(/language-(\w+)/);
      if (langMatch) {
        language = langMatch[1];
      } else {
        // Check parent pre element for language class
        const preElement = codeEl.closest('pre');
        if (preElement) {
          const preClasses = preElement.className;
          const preLangMatch = preClasses.match(/language-(\w+)/);
          if (preLangMatch) {
            language = preLangMatch[1];
          }
        }
      }

      blocks.push({ language, code: code.trim() });
    });

    return blocks;
  }

  /**
   * Extract sources/citations from message (Perplexity-specific)
   */
  private extractSources(element: HTMLElement): string[] {
    const sources = new Set<string>();

    // Look for source and citation containers
    const sourceElements = element.querySelectorAll('.source a, .citation a, [class*="source"] a, [class*="citation"] a');

    sourceElements.forEach(link => {
      const href = (link as HTMLAnchorElement).href;
      if (href && href.startsWith('http')) {
        sources.add(href);
      }
    });

    // Also check for any links in the message (Perplexity includes inline citations)
    const allLinks = element.querySelectorAll('a[href]');
    allLinks.forEach(link => {
      const href = (link as HTMLAnchorElement).href;
      // Only include external links, not internal navigation
      if (href && href.startsWith('http') && !href.includes('perplexity.ai')) {
        sources.add(href);
      }
    });

    return Array.from(sources);
  }

  /**
   * Check if message is currently streaming (being written)
   */
  private isMessageStreaming(element: HTMLElement): boolean {
    // Perplexity shows typing indicators or streaming markers
    const hasTypingIndicator = !!element.querySelector('[class*="typing"], [class*="streaming"], .cursor-blink');

    // Check if there's a stop button visible (indicates active generation)
    const hasStopButton = !!document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"]');

    // Check for streaming metadata attribute
    const isStreamingAttr = element.getAttribute('data-streaming') === 'true';

    return hasTypingIndicator || hasStopButton || isStreamingAttr;
  }

  /**
   * Wait for container to appear in DOM
   */
  private async waitForContainer(maxAttempts = 10, delayMs = 500): Promise<Element | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const container = document.querySelector(SELECTORS.containerSelector);
      if (container) {
        console.log(`Perplexity adapter: Container found on attempt ${i + 1}`);
        return container;
      }

      console.log(`Perplexity adapter: Waiting for container (attempt ${i + 1}/${maxAttempts})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return null;
  }

  /**
   * Start observing messages
   */
  async observeMessages(callback: (message: ExtractedMessage) => void): Promise<void> {
    this.observerCallback = callback;

    // Wait for container with retries
    const container = await this.waitForContainer();
    if (!container) {
      console.error('Perplexity adapter: Message container not found after retries');
      console.error('Perplexity adapter: Looking for selector:', SELECTORS.containerSelector);
      console.error('Perplexity adapter: Available main elements:', document.querySelectorAll('main'));
      return;
    }

    console.log('Perplexity adapter: Starting to observe messages');

    // Process existing messages with retry mechanism
    await this.processExistingMessagesWithRetry();

    // Set up mutation observer for new messages
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Stop observing messages
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Process existing messages with retry mechanism
   */
  private async processExistingMessagesWithRetry(maxRetries = 5, delayMs = 300): Promise<void> {
    let previousCount = 0;

    for (let i = 0; i < maxRetries; i++) {
      const container = document.querySelector(SELECTORS.containerSelector);
      if (!container) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      const messages = container.querySelectorAll(SELECTORS.messageSelector);
      const currentCount = messages.length;

      console.log(`Perplexity adapter: Processing existing messages (attempt ${i + 1}/${maxRetries}, found ${currentCount} messages)`);

      messages.forEach(msg => {
        // Process existing messages immediately without debounce
        this.processMessage(msg as HTMLElement, true);
      });

      // If we found new messages, continue checking
      if (currentCount > previousCount) {
        previousCount = currentCount;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else if (i >= 2) {
        // After 3 attempts with no new messages, we're done
        break;
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`Perplexity adapter: Finished processing existing messages (total: ${previousCount})`);
  }

  /**
   * Handle DOM mutations
   */
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      // Check for new message elements
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Check if it's a message or contains messages
            if (element.matches(SELECTORS.messageSelector)) {
              this.processMessage(element);
            } else {
              const messages = element.querySelectorAll(SELECTORS.messageSelector);
              messages.forEach(msg => this.processMessage(msg as HTMLElement));
            }
          }
        });
      }

      // Handle streaming updates (characterData changes)
      if (mutation.type === 'characterData') {
        const element = (mutation.target as Node).parentElement;
        if (element) {
          const message = element.closest(SELECTORS.messageSelector);
          if (message) {
            this.processMessage(message as HTMLElement);
          }
        }
      }
    }
  }

  /**
   * Process a single message element
   */
  private processMessage(element: HTMLElement, forceImmediate = false): void {
    if (!this.observerCallback) return;

    // Create unique ID for message
    const messageId = this.getMessageId(element);

    // Skip if already processed and saved
    if (this.lastProcessedMessages.has(messageId)) {
      return;
    }

    // Extract message first to check content duplication
    const extracted = this.extractMessage(element);
    if (!extracted) {
      return;
    }

    // Create a content signature that includes text and code blocks
    const contentSignature = this.getContentSignature(extracted);

    // Check for duplicate content (same text and code already processed)
    if (this.processedContents.has(contentSignature)) {
      return; // Skip duplicate content
    }

    // Check if message is still streaming
    const isStreaming = this.isMessageStreaming(element);

    if (isStreaming && !forceImmediate) {
      // Message is streaming - debounce and wait for completion
      this.debounceStreamingMessage(messageId, element);
      return;
    }

    // Message is complete - save immediately
    this.lastProcessedMessages.add(messageId);
    this.processedContents.add(contentSignature);

    // Clear any pending debounce timer for this message
    const existingTimer = this.streamingMessages.get(messageId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      this.streamingMessages.delete(messageId);
    }

    this.observerCallback(extracted);
    console.log(`Perplexity adapter: Saved complete message ${messageId}${forceImmediate ? ' (immediate)' : ''}`);
  }

  /**
   * Debounce streaming messages - only save when streaming stops
   */
  private debounceStreamingMessage(messageId: string, element: HTMLElement): void {
    // Clear existing timer for this message
    const existingTimer = this.streamingMessages.get(messageId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    // Set new timer - if no updates for 2 seconds, consider it complete
    const timer = window.setTimeout(() => {
      console.log(`Perplexity adapter: Streaming completed for ${messageId}`);
      this.streamingMessages.delete(messageId);

      // Reprocess the message (it should be complete now)
      const extracted = this.extractMessage(element);
      if (extracted) {
        const contentSignature = this.getContentSignature(extracted);
        if (!this.lastProcessedMessages.has(messageId) &&
            !this.processedContents.has(contentSignature)) {
          this.lastProcessedMessages.add(messageId);
          this.processedContents.add(contentSignature);
          this.observerCallback?.(extracted);
          console.log(`Perplexity adapter: Saved streamed message ${messageId}`);
        }
      }
    }, 2000); // 2 second delay after last update

    this.streamingMessages.set(messageId, timer);
  }

  /**
   * Generate content signature for deduplication
   * Includes both text content and code blocks
   */
  private getContentSignature(message: ExtractedMessage): string {
    let signature = message.content;

    // Include code blocks in signature to differentiate messages with same text but different code
    if (message.metadata?.codeBlocks && message.metadata.codeBlocks.length > 0) {
      const codeSignature = message.metadata.codeBlocks
        .map(block => `${block.language}:${block.code}`)
        .join('|');
      signature += `||CODE:${codeSignature}`;
    }

    return signature;
  }

  /**
   * Generate unique ID for message element
   */
  private getMessageId(element: HTMLElement): string {
    const container = document.querySelector(SELECTORS.containerSelector);
    const messages = container?.querySelectorAll(SELECTORS.messageSelector);
    const index = messages ? Array.from(messages).indexOf(element) : -1;
    const conversationId = this.extractConversationId() || 'unknown';

    // Include content hash for uniqueness
    const content = element.textContent?.slice(0, 50) || '';
    const hash = this.simpleHash(content);

    return `${conversationId}-${index}-${hash}`;
  }

  /**
   * Simple string hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get injection point for memory UI
   */
  getInjectionPoint(): HTMLElement | null {
    // Try sidebar selectors
    const sidebarSelectors = ['aside', '#sidebar', '.sidebar'];

    for (const selector of sidebarSelectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        return element;
      }
    }

    return null;
  }

  /**
   * Check if memory UI should be shown
   */
  shouldShowMemoryUI(): boolean {
    // Show UI if we have a valid conversation (in search view)
    const conversationId = this.extractConversationId();

    // Only show in search view, not on home page
    return conversationId !== null;
  }
}

/**
 * Export singleton instance
 */
export const perplexityAdapter = new PerplexityAdapter();

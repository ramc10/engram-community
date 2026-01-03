/**
 * ChatGPT Platform Adapter
 * Implements IPlatformAdapter for ChatGPT (chat.openai.com)
 * 
 * DOM Structure (as of Dec 2024):
 * - Messages: article[data-testid^="conversation-turn"]
 * - User messages: .text-message (with data-message-author-role="user")
 * - Assistant messages: .text-message (with data-message-author-role="assistant")
 * - Code blocks: pre > code with .language-* classes
 * - Conversation ID: URL pattern /c/{conversation-id}
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
 * ChatGPT DOM selectors
 * Updated for current ChatGPT UI (Dec 2024)
 */
const SELECTORS: PlatformSelectors = {
  containerSelector: '#thread, main > div', // Updated: ChatGPT now uses #thread
  messageSelector: 'article[data-testid^="conversation-turn"]',
  contentSelector: '[data-message-author-role] .markdown',
  codeBlockSelector: 'pre code',
  injectionPointSelector: 'main aside, main > div:last-child',
};

/**
 * ChatGPT feature support
 */
const FEATURES: PlatformFeatures = {
  supportsStreaming: true,
  supportsCodeBlocks: true,
  supportsAttachments: true,
  supportsRegeneration: true,
};

/**
 * ChatGPT Platform Adapter Implementation
 */
export class ChatGPTAdapter implements IPlatformAdapter {
  private observer: MutationObserver | null = null;
  private observerCallback: ((message: ExtractedMessage) => void) | null = null;
  private lastProcessedMessages = new Set<string>();
  private streamingMessages = new Map<string, number>(); // Track streaming messages with debounce timers

  /**
   * Get platform configuration
   */
  getConfig(): PlatformConfig {
    return {
      platformId: 'chatgpt' as Platform,
      selectors: SELECTORS,
      urlPattern: /^https:\/\/chat(?:gpt)?\.openai\.com/,
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

    // Clear all streaming timers
    this.streamingMessages.forEach(timer => window.clearTimeout(timer));
    this.streamingMessages.clear();

    this.observerCallback = null;
  }

  /**
   * Check if current URL is ChatGPT
   */
  isCurrentPlatform(url: string): boolean {
    return this.getConfig().urlPattern.test(url);
  }

  /**
   * Extract conversation ID from URL
   */
  private extractConversationIdFromUrl(url: string): string | null {
    // URL pattern: https://chat.openai.com/c/{conversation-id}
    const match = url.match(/\/c\/([\w-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract conversation ID from current page
   */
  extractConversationId(): string | null {
    return this.extractConversationIdFromUrl(window.location.href);
  }

  /**
   * Extract a single message from DOM element
   */
  extractMessage(element: HTMLElement): ExtractedMessage | null {
    try {
      // Get role from data attribute
      const roleAttr = element.querySelector('[data-message-author-role]');
      if (!roleAttr) {
        return null;
      }

      const roleValue = roleAttr.getAttribute('data-message-author-role');
      if (!roleValue || (roleValue !== 'user' && roleValue !== 'assistant')) {
        return null;
      }

      const role: Role = roleValue as Role;

      // Extract content
      const contentElement = element.querySelector(SELECTORS.contentSelector);
      if (!contentElement) {
        return null;
      }

      let content = this.extractTextContent(contentElement as HTMLElement);
      
      // Extract code blocks
      const codeBlocks = this.extractCodeBlocks(element);

      // Get conversation ID
      const conversationId = this.extractConversationId();
      if (!conversationId) {
        return null;
      }

      // Check if message is still streaming
      const isStreaming = this.isMessageStreaming(element);

      // Get message timestamp (use current time as ChatGPT doesn't expose timestamps)
      const timestamp = Date.now();

      // Get message index from DOM position
      const container = document.querySelector(SELECTORS.containerSelector);
      const messages = container?.querySelectorAll(SELECTORS.messageSelector);
      const messageIndex = messages ? Array.from(messages).indexOf(element) : undefined;

      return {
        role,
        content,
        timestamp,
        conversationId,
        metadata: {
          codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
          isStreaming,
          messageIndex,
        },
      };
    } catch (error) {
      console.error('ChatGPT adapter: Error extracting message:', error);
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
      }

      blocks.push({ language, code: code.trim() });
    });

    return blocks;
  }

  /**
   * Check if message is currently streaming (being written)
   */
  private isMessageStreaming(element: HTMLElement): boolean {
    // ChatGPT shows a blinking cursor or "stop generating" button during streaming
    const parent = element.closest('[data-testid^="conversation-turn"]');
    if (!parent) return false;

    // Look for streaming indicators
    const hasStopButton = !!document.querySelector('button[aria-label*="Stop"]');
    const hasCursor = !!parent.querySelector('.cursor-blink, [class*="cursor"]');
    
    return hasStopButton || hasCursor;
  }

  /**
   * Wait for container to appear in DOM
   */
  private async waitForContainer(maxAttempts = 10, delayMs = 500): Promise<Element | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const container = document.querySelector(SELECTORS.containerSelector);
      if (container) {
        console.log(`ChatGPT adapter: Container found on attempt ${i + 1}`);
        return container;
      }

      console.log(`ChatGPT adapter: Waiting for container (attempt ${i + 1}/${maxAttempts})...`);
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
      console.error('ChatGPT adapter: Message container not found after retries');
      console.error('ChatGPT adapter: Looking for selector:', SELECTORS.containerSelector);
      console.error('ChatGPT adapter: Available main elements:', document.querySelectorAll('main > *'));
      return;
    }

    console.log('ChatGPT adapter: Starting to observe messages');

    // Process existing messages with retry mechanism
    // This ensures we catch messages that appear during/right after initialization
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
   * This catches messages that appear during/after initialization
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

      console.log(`ChatGPT adapter: Processing existing messages (attempt ${i + 1}/${maxRetries}, found ${currentCount} messages)`);

      messages.forEach(msg => {
        // Process existing messages immediately without debounce
        // They're already complete, no need to wait
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

    console.log(`ChatGPT adapter: Finished processing existing messages (total: ${previousCount})`);
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

    // Create unique ID for message (use DOM position as ChatGPT doesn't have IDs)
    const messageId = this.getMessageId(element);

    // Skip if already processed and saved
    if (this.lastProcessedMessages.has(messageId)) {
      return;
    }

    // Check if message is still streaming
    const isStreaming = this.isMessageStreaming(element);

    if (isStreaming && !forceImmediate) {
      // Message is streaming - debounce and wait for completion
      this.debounceStreamingMessage(messageId, element);
      return;
    }

    // Message is complete - extract and save immediately
    const extracted = this.extractMessage(element);
    if (extracted) {
      this.lastProcessedMessages.add(messageId);

      // Clear any pending debounce timer for this message
      const existingTimer = this.streamingMessages.get(messageId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
        this.streamingMessages.delete(messageId);
      }

      this.observerCallback(extracted);
      console.log(`ChatGPT adapter: Saved complete message ${messageId}${forceImmediate ? ' (immediate)' : ''}`);
    }
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
      console.log(`ChatGPT adapter: Streaming completed for ${messageId}`);
      this.streamingMessages.delete(messageId);

      // Reprocess the message (it should be complete now)
      const extracted = this.extractMessage(element);
      if (extracted && !this.lastProcessedMessages.has(messageId)) {
        this.lastProcessedMessages.add(messageId);
        this.observerCallback?.(extracted);
        console.log(`ChatGPT adapter: Saved streamed message ${messageId}`);
      }
    }, 2000); // 2 second delay after last update

    this.streamingMessages.set(messageId, timer);
  }

  /**
   * Generate unique ID for message element
   */
  private getMessageId(element: HTMLElement): string {
    const container = document.querySelector(SELECTORS.containerSelector);
    const messages = container?.querySelectorAll(SELECTORS.messageSelector);
    const index = messages ? Array.from(messages).indexOf(element) : -1;
    const conversationId = this.extractConversationId() || 'unknown';
    return `${conversationId}-${index}`;
  }

  /**
   * Get injection point for memory UI
   */
  getInjectionPoint(): HTMLElement | null {
    // Try sidebar first
    let injectionPoint = document.querySelector('main aside') as HTMLElement;
    
    // Fallback to main container
    if (!injectionPoint) {
      injectionPoint = document.querySelector('main > div:last-child') as HTMLElement;
    }

    return injectionPoint;
  }

  /**
   * Check if memory UI should be shown
   */
  shouldShowMemoryUI(): boolean {
    // Show UI if we have a valid conversation
    const conversationId = this.extractConversationId();
    
    // Only show in conversation view, not on home page
    return conversationId !== null;
  }
}

/**
 * Export singleton instance
 */
export const chatGPTAdapter = new ChatGPTAdapter();

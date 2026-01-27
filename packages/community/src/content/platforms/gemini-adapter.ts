/**
 * Gemini Platform Adapter
 * Handles message extraction and observation for Google Gemini (gemini.google.com)
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
 * Gemini DOM selectors (verified Jan 2025)
 */
const SELECTORS: PlatformSelectors = {
  containerSelector: 'chat-window, main',
  messageSelector: '.conversation-container > .model-response-container, .conversation-container > .user-query',
  contentSelector: '.model-response-text, .user-query-text, .markdown, message-content',
  codeBlockSelector: 'pre code',
  injectionPointSelector: 'aside, .sidebar',
};

/**
 * Gemini feature support
 */
const FEATURES: PlatformFeatures = {
  supportsStreaming: true,
  supportsCodeBlocks: true,
  supportsAttachments: true,
  supportsRegeneration: true,
};

/**
 * Gemini Platform Adapter Implementation
 */
class GeminiAdapter implements IPlatformAdapter {
  private observer: MutationObserver | null = null;
  private messageCallback: ((message: ExtractedMessage) => void) | null = null;
  private processedMessages = new Set<string>(); // Track fully processed messages
  private streamingMessages = new Map<string, number>(); // Track streaming messages with debounce timers
  private messageContentMap = new Map<string, string>(); // Track last content for each message
  private processedContents = new Set<string>(); // Track processed message contents for deduplication

  /**
   * Get platform configuration
   */
  getConfig(): PlatformConfig {
    return {
      platformId: 'gemini' as Platform,
      selectors: SELECTORS,
      urlPattern: /^https:\/\/gemini\.google\.com/,
      conversationIdExtractor: (url: string) => {
        // Gemini URL patterns:
        // https://gemini.google.com/app/{conversation-id}
        // https://gemini.google.com/chat/{conversation-id}
        const match = url.match(/\/(?:app|chat)\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      },
      features: FEATURES,
    };
  }

  /**
   * Check if current URL is Gemini
   */
  isCurrentPlatform(url: string): boolean {
    return this.getConfig().urlPattern.test(url);
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    console.log('[Gemini Adapter] Initializing...');
    this.processedMessages.clear();
    this.processedContents.clear();
    this.messageContentMap.clear();
    this.streamingMessages.clear();
    console.log('[Gemini Adapter] Ready');
  }

  /**
   * Extract conversation ID from URL
   * Gemini format: https://gemini.google.com/app/{conversation-id}
   */
  extractConversationId(): string | null {
    const match = window.location.pathname.match(/\/(?:app|chat)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Get injection point for UI
   * Gemini might have a sidebar or suitable container
   */
  getInjectionPoint(): HTMLElement | null {
    // Try to find sidebar or suitable container
    return document.querySelector('aside') || document.querySelector('.sidebar') || null;
  }

  /**
   * Start observing messages
   */
  async observeMessages(callback: (message: ExtractedMessage) => void): Promise<void> {
    this.messageCallback = callback;

    console.log('[Gemini Adapter] Starting message observation...');

    // Process existing messages with retry mechanism
    // This ensures we catch messages that appear during/right after initialization
    await this.processExistingMessagesWithRetry();

    // Watch for new messages
    this.startMutationObserver();
  }

  /**
   * Process existing messages with retry mechanism
   * This catches messages that appear during/after initialization
   */
  private async processExistingMessagesWithRetry(maxRetries = 5, delayMs = 300): Promise<void> {
    let previousCount = 0;

    for (let i = 0; i < maxRetries; i++) {
      const messageElements = this.getAllMessageElements();
      const currentCount = messageElements.length;

      console.log(`[Gemini Adapter] Processing existing messages (attempt ${i + 1}/${maxRetries}, found ${currentCount} messages)`);

      messageElements.forEach(element => {
        // Process existing messages immediately - they're already complete
        this.processMessage(element as HTMLElement, true);
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

    console.log(`[Gemini Adapter] Finished processing existing messages (total: ${previousCount})`);
  }

  /**
   * Get all message elements from DOM
   */
  private getAllMessageElements(): Element[] {
    // Try multiple selector strategies to find messages
    const selectors = [
      '.conversation-container > .model-response-container',
      '.conversation-container > .user-query',
      '[class*="message"]',
      'message-content',
    ];

    const elements: Element[] = [];
    for (const selector of selectors) {
      const found = document.querySelectorAll(selector);
      if (found.length > 0) {
        elements.push(...Array.from(found));
      }
    }

    return elements;
  }

  /**
   * Start mutation observer for new messages
   */
  private startMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;

              // Check if this is a message element
              if (this.isMessageElement(element)) {
                this.processMessage(element);
              } else {
                // Check if element contains messages
                const messages = this.getAllMessageElements();
                messages.forEach(msg => this.processMessage(msg as HTMLElement));
              }
            }
          });
        }

        // Handle streaming updates (text changes)
        if (mutation.type === 'characterData') {
          const element = (mutation.target as Node).parentElement;
          if (element) {
            const message = this.findParentMessage(element);
            if (message) {
              this.processMessage(message as HTMLElement);
            }
          }
        }
      }
    });

    // Observe the body for new messages
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    console.log('[Gemini Adapter] Mutation observer started');
  }

  /**
   * Check if element is a message element
   */
  private isMessageElement(element: HTMLElement): boolean {
    return (
      element.classList.contains('model-response-container') ||
      element.classList.contains('user-query') ||
      element.tagName.toLowerCase() === 'message-content' ||
      Array.from(element.classList).some(cls => cls.includes('message'))
    );
  }

  /**
   * Find parent message element
   */
  private findParentMessage(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;
    while (current && current !== document.body) {
      if (this.isMessageElement(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Process a single message element
   */
  private processMessage(element: HTMLElement, forceImmediate = false): void {
    if (!this.messageCallback) return;

    try {
      const message = this.extractMessageFromElement(element);
      if (!message || !message.content) {
        return;
      }

      // Check for duplicate content (same text already processed)
      if (this.processedContents.has(message.content)) {
        return; // Skip duplicate content
      }

      // Create a stable ID for this message element
      const messageId = this.getMessageId(element);

      // Check if this exact content has already been saved
      if (this.processedMessages.has(messageId)) {
        return;
      }

      // If forceImmediate, save right away (for existing messages)
      if (forceImmediate) {
        this.processedMessages.add(messageId);
        this.processedContents.add(message.content);
        this.messageContentMap.set(messageId, message.content);

        // Clear any pending timer
        const existingTimer = this.streamingMessages.get(messageId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          this.streamingMessages.delete(messageId);
        }

        this.messageCallback(message);
        console.log(`[Gemini Adapter] Saved complete message ${messageId} (immediate)`);
        return;
      }

      // Check if content is still changing (streaming)
      const lastContent = this.messageContentMap.get(messageId);
      if (lastContent !== undefined && lastContent !== message.content) {
        // Content changed - message is still streaming
        this.debounceStreamingMessage(messageId, element, message.content);
        return;
      }

      // First time seeing this message or content hasn't changed
      if (lastContent === undefined) {
        this.messageContentMap.set(messageId, message.content);
        this.debounceStreamingMessage(messageId, element, message.content);
        return;
      }

      // Content is stable - save the message
      if (!this.processedMessages.has(messageId)) {
        this.processedMessages.add(messageId);
        this.processedContents.add(message.content);
        this.messageCallback(message);
        console.log(`[Gemini Adapter] Saved complete message ${messageId}`);
      }
    } catch (error) {
      console.error('[Gemini Adapter] Error processing message:', error);
    }
  }

  /**
   * Debounce streaming messages - only save when streaming stops
   */
  private debounceStreamingMessage(messageId: string, element: HTMLElement, content: string): void {
    // Update content tracker
    this.messageContentMap.set(messageId, content);

    // Clear existing timer for this message
    const existingTimer = this.streamingMessages.get(messageId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer - if no updates for 2 seconds, consider it complete
    const timer = window.setTimeout(() => {
      console.log(`[Gemini Adapter] Streaming completed for ${messageId}`);
      this.streamingMessages.delete(messageId);

      // Reprocess the message (it should be complete now)
      const message = this.extractMessageFromElement(element);
      if (message && !this.processedMessages.has(messageId) && !this.processedContents.has(message.content)) {
        this.processedMessages.add(messageId);
        this.processedContents.add(message.content);
        this.messageCallback?.(message);
        console.log(`[Gemini Adapter] Saved streamed message ${messageId}`);
      }
    }, 2000); // 2 second delay after last update

    this.streamingMessages.set(messageId, timer);
  }

  /**
   * Generate stable ID for message element
   */
  private getMessageId(element: HTMLElement): string {
    // Try to use any ID attribute or create ID from DOM position
    if (element.id) {
      return `gemini-${element.id}`;
    }

    // Fallback: use position in DOM
    const messages = this.getAllMessageElements();
    const index = Array.from(messages).indexOf(element);
    const conversationId = this.extractConversationId() || 'unknown';
    return `${conversationId}-${index}`;
  }

  /**
   * Extract message data from DOM element
   */
  private extractMessageFromElement(
    element: HTMLElement,
    index?: number
  ): ExtractedMessage | null {
    try {
      // Determine role based on element classes or structure
      const role = this.determineRole(element);
      if (!role) {
        return null; // Not a valid message element
      }

      // Extract content
      const contentElement = this.findContentElement(element);
      if (!contentElement) {
        return null;
      }

      // Extract text content
      const rawText = contentElement.textContent || '';

      // Extract code blocks
      const codeBlocks = this.extractCodeBlocks(element);

      // Clean text (remove code blocks that will be in metadata)
      let cleanText = rawText;
      codeBlocks.forEach(block => {
        cleanText = cleanText.replace(block.code, '');
      });

      // Normalize whitespace: collapse multiple spaces and newlines
      cleanText = cleanText
        .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
        .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
        .trim();

      if (!cleanText && codeBlocks.length === 0) {
        return null;
      }

      const conversationId = this.extractConversationId();
      if (!conversationId) {
        return null;
      }

      return {
        role,
        content: cleanText,
        timestamp: Date.now(),
        conversationId,
        metadata: {
          codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
          messageIndex: index,
        },
      };
    } catch (error) {
      console.error('[Gemini Adapter] Error extracting message:', error);
      return null;
    }
  }

  /**
   * Determine message role from element
   */
  private determineRole(element: HTMLElement): Role | null {
    // Check for user message indicators
    if (
      element.classList.contains('user-query') ||
      element.querySelector('.user-query') ||
      element.classList.contains('user-message')
    ) {
      return 'user';
    }

    // Check for assistant/model message indicators
    if (
      element.classList.contains('model-response-container') ||
      element.querySelector('.model-response-text') ||
      element.classList.contains('assistant-message') ||
      element.classList.contains('model-response')
    ) {
      return 'assistant';
    }

    // Check data attributes
    const roleAttr = element.getAttribute('data-role') || element.getAttribute('role');
    if (roleAttr === 'user' || roleAttr === 'assistant') {
      return roleAttr as Role;
    }

    // Default to assistant if we found a message but can't determine role
    // This is safer than returning null for valid messages
    return 'assistant';
  }

  /**
   * Find content element within message
   */
  private findContentElement(element: HTMLElement): HTMLElement | null {
    // Try specific content selectors
    const selectors = [
      '.model-response-text',
      '.user-query-text',
      '.markdown',
      'message-content',
      '.message-content',
    ];

    for (const selector of selectors) {
      const contentEl = element.querySelector(selector);
      if (contentEl) {
        return contentEl as HTMLElement;
      }
    }

    // Fallback to the element itself if no content element found
    return element;
  }

  /**
   * Extract message from DOM element
   */
  extractMessage(element: HTMLElement): ExtractedMessage | null {
    return this.extractMessageFromElement(element);
  }

  /**
   * Check if memory UI should be shown
   */
  shouldShowMemoryUI(): boolean {
    const conversationId = this.extractConversationId();
    return conversationId !== null;
  }

  /**
   * Extract code blocks from message
   */
  private extractCodeBlocks(element: HTMLElement): ExtractedCodeBlock[] {
    const blocks: ExtractedCodeBlock[] = [];

    // Gemini uses pre > code structure
    const preElements = element.querySelectorAll('pre');

    preElements.forEach((preElement) => {
      // Check if pre has a code child - if so, extract from code element
      const codeElement = preElement.querySelector('code');
      const targetElement = codeElement || preElement;

      const code = targetElement.textContent?.trim();
      if (!code) return;

      // Try to detect language from class or data attribute
      let language: string | undefined;

      // Check for language class (e.g., "language-python")
      const classes = targetElement.className.split(' ');
      const langClass = classes.find(c => c.startsWith('language-'));
      if (langClass) {
        language = langClass.replace('language-', '');
      }

      // Check for data-language attribute
      const dataLang = targetElement.getAttribute('data-language');
      if (dataLang) {
        language = dataLang;
      }

      // ExtractedCodeBlock requires language to be non-optional, default to plaintext
      blocks.push({ language: language || 'plaintext', code });
    });

    return blocks;
  }

  /**
   * Stop observing messages
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.messageCallback = null;
    console.log('[Gemini Adapter] Stopped observing');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopObserving();
    this.processedMessages.clear();
    this.processedContents.clear();
    this.messageContentMap.clear();

    // Clear all streaming timers
    this.streamingMessages.forEach(timer => clearTimeout(timer));
    this.streamingMessages.clear();

    console.log('[Gemini Adapter] Destroyed');
  }
}

// Export singleton instance
export const geminiAdapter = new GeminiAdapter();

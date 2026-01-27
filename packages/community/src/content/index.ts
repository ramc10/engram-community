/**
 * Main Content Script
 * Detects platform and initializes appropriate adapter
 * Coordinates message extraction and storage
 */

import { chatGPTAdapter } from './platforms/chatgpt-adapter';
import { claudeAdapter } from './platforms/claude-adapter';
import { perplexityAdapter } from './platforms/perplexity-adapter';
import { geminiAdapter } from './platforms/gemini-adapter';
import { genericAdapter } from './platforms/generic-adapter';
import { IPlatformAdapter } from '@engram/core';
import { sendInitRequest, sendSaveMessage } from '../lib/messages';
import { uiInjector } from './shared/ui-injector';

/**
 * Content script state
 */
class ContentScript {
  private adapter: IPlatformAdapter | null = null;
  private isInitialized = false;
  private deviceId: string | null = null;
  private messageCount = 0;
  private conversationId: string | null = null;
  private recentMessages: string[] = [];

  /**
   * Initialize content script
   */
  async initialize(): Promise<void> {
    try {
      console.log('[Engram Content] Initializing...');

      // Detect which platform we're on (always returns a platform, falls back to 'generic')
      const platform = this.detectPlatform();
      console.log('[Engram Content] Detected platform:', platform);

      // Get appropriate adapter
      this.adapter = this.getAdapter(platform);
      if (!this.adapter) {
        console.error('[Engram Content] No adapter found for platform:', platform);
        return;
      }

      // Initialize connection with background worker
      const initResponse = await sendInitRequest();
      if (!initResponse.success) {
        console.error('[Engram Content] Failed to initialize:', initResponse.error);
        return;
      }

      this.deviceId = initResponse.deviceId || null;
      console.log('[Engram Content] Connected to background, device ID:', this.deviceId);

      // Initialize platform adapter
      await this.adapter.initialize();
      console.log('[Engram Content] Adapter initialized');

      // Get conversation ID
      this.conversationId = this.adapter.extractConversationId?.() || null;
      console.log('[Engram Content] Conversation ID:', this.conversationId);

      // Start observing messages
      this.startObserving();

      // Inject UI
      this.injectUI();

      this.isInitialized = true;
      console.log('[Engram Content] Ready');
    } catch (error) {
      console.error('[Engram Content] Initialization failed:', error);
    }
  }

  /**
   * Detect which platform we're on.
   * Falls back to 'generic' for any web page without a dedicated adapter.
   */
  private detectPlatform(): string {
    const url = window.location.href;

    if (chatGPTAdapter.isCurrentPlatform(url)) {
      return 'chatgpt';
    }

    if (claudeAdapter.isCurrentPlatform(url)) {
      return 'claude';
    }

    if (perplexityAdapter.isCurrentPlatform(url)) {
      return 'perplexity';
    }

    if (geminiAdapter.isCurrentPlatform(url)) {
      return 'gemini';
    }

    return 'generic';
  }

  /**
   * Get adapter for platform
   */
  private getAdapter(platform: string): IPlatformAdapter | null {
    switch (platform) {
      case 'chatgpt':
        return chatGPTAdapter;
      case 'claude':
        return claudeAdapter;
      case 'perplexity':
        return perplexityAdapter;
      case 'gemini':
        return geminiAdapter;
      case 'generic':
        return genericAdapter;
      default:
        return null;
    }
  }

  /**
   * Inject UI into the page
   */
  private injectUI(): void {
    try {
      console.log('[Engram Content] Injecting UI...');

      // Get injection point from adapter
      const injectionPoint = this.adapter?.getInjectionPoint?.();
      
      if (injectionPoint) {
        // Inject inline into sidebar if available
        uiInjector.injectInline(injectionPoint, this.conversationId || undefined);
      } else {
        // Fallback to fixed position
        uiInjector.inject(document.body, this.conversationId || undefined);
      }

      console.log('[Engram Content] UI injected');
    } catch (error) {
      console.error('[Engram Content] Failed to inject UI:', error);
    }
  }

  /**
   * Update UI context with recent messages
   */
  private updateUIContext(): void {
    if (!uiInjector.isInjected()) return;

    // Build context from recent messages (last 3)
    const context = this.recentMessages.slice(-3).join('\n\n');
    uiInjector.updateContext(context);
  }

  /**
   * Start observing messages on the page
   */
  private startObserving(): void {
    if (!this.adapter) return;

    console.log('[Engram Content] Starting message observation');

    this.adapter.observeMessages(async (message) => {
      try {
        this.messageCount++;
        console.log(
          `[Engram Content] Message #${this.messageCount}:`,
          message.role,
          message.content.substring(0, 50) + '...'
        );

        // Add to recent messages for context
        this.recentMessages.push(message.content);
        if (this.recentMessages.length > 5) {
          this.recentMessages.shift(); // Keep only last 5
        }

        // Update UI context
        this.updateUIContext();

        // Send to background for storage
        const response = await sendSaveMessage(message);

        if (response.success) {
          console.log('[Engram Content] Message saved:', response.memoryId);
        } else {
          console.error('[Engram Content] Failed to save message:', response.error);
        }
      } catch (error) {
        console.error('[Engram Content] Error handling message:', error);
      }
    });
  }

  /**
   * Stop observing and cleanup
   */
  cleanup(): void {
    console.log('[Engram Content] Cleaning up...');

    // Remove UI
    uiInjector.remove();

    if (this.adapter) {
      this.adapter.stopObserving();
      this.adapter.destroy();
      this.adapter = null;
    }

    this.isInitialized = false;
    this.deviceId = null;
    this.messageCount = 0;
    this.conversationId = null;
    this.recentMessages = [];

    console.log('[Engram Content] Cleanup complete');
  }

  /**
   * Get initialization status
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messageCount;
  }
}

// Create singleton instance
const contentScript = new ContentScript();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    contentScript.initialize();
  });
} else {
  // DOM already loaded
  contentScript.initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentScript.cleanup();
});

// Listen for messages from background (for future features)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Engram Content] Received message from background:', message);
  
  // TODO: Handle commands from background
  // e.g., show/hide memory UI, refresh memories, etc.
  
  sendResponse({ received: true });
  return true;
});

// Export for testing
export { contentScript };

/**
 * Plasmo Content Script Entry Point
 * This file is automatically detected by Plasmo and injected into matching pages.
 * Runs on all websites to provide universal access to Engram memories.
 */

import type { PlasmoCSConfig } from "plasmo";

// Configure to run only on AI chat platforms for better security and faster Chrome Web Store review
export const config: PlasmoCSConfig = {
  matches: [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://www.perplexity.ai/*",
    "https://gemini.google.com/*"
  ],
  all_frames: false,
  run_at: "document_end"
};

// Direct implementation using platform adapters
import { chatGPTAdapter } from '../content/platforms/chatgpt-adapter';
import { claudeAdapter } from '../content/platforms/claude-adapter';
import { perplexityAdapter } from '../content/platforms/perplexity-adapter';
import { geminiAdapter } from '../content/platforms/gemini-adapter';
import { sendInitRequest, sendSaveMessage } from '../lib/messages';
import { PromptInterceptor } from '../content/shared/prompt-interceptor';

/**
 * Track current conversation ID to detect navigation
 */
let currentConversationId: string | null = null;
let currentInterceptor: PromptInterceptor | null = null;
let cleanupFunction: (() => void) | null = null;

/**
 * Extract conversation ID from URL
 */
function extractConversationId(url: string): string | null {
  const match = url.match(/\/c\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Initialize ChatGPT adapter
 */
async function initializeChatGPT() {
  try {
    console.log('[Engram] ChatGPT detected, initializing adapter...');

    // Cleanup previous instance if exists
    if (cleanupFunction) {
      console.log('[Engram] Cleaning up previous instance...');
      cleanupFunction();
      cleanupFunction = null;
    }

    if (currentInterceptor) {
      currentInterceptor.destroy();
      currentInterceptor = null;
    }

    // Update current conversation ID
    currentConversationId = extractConversationId(window.location.href);
    console.log('[Engram] Conversation ID:', currentConversationId || 'new chat');

    // Initialize background connection
    const initResponse = await sendInitRequest();
    if (!initResponse.success) {
      console.error('[Engram] Background init failed:', initResponse.error);
      return;
    }

    console.log('[Engram] Background connected, device ID:', initResponse.deviceId);

    // Initialize adapter
    await chatGPTAdapter.initialize();
    console.log('[Engram] Adapter initialized');

    // Initialize intelligent prompt interceptor with direct insertion mode
    currentInterceptor = new PromptInterceptor();
    await currentInterceptor.initialize(
      '#prompt-textarea', // ChatGPT textarea selector (contenteditable div)
      'button[data-testid*="send"], button[type="submit"]:not([disabled])', // ChatGPT send button selector
      true // Use direct insertion mode for ChatGPT
    );

    console.log('[Engram] Intelligent auto-injection ready (direct insertion mode)');

    // Start observing messages (now async with retries)
    await chatGPTAdapter.observeMessages(async (extractedMessage) => {
      console.log('[Engram] Message extracted:', {
        role: extractedMessage.role,
        contentLength: extractedMessage.content.length,
        conversationId: extractedMessage.conversationId
      });

      try {
        const saveResponse = await sendSaveMessage(extractedMessage);
        if (saveResponse.success) {
          console.log('[Engram] Message saved successfully');
        } else {
          console.error('[Engram] Failed to save message:', saveResponse.error);
        }
      } catch (error) {
        console.error('[Engram] Error saving message:', error);
      }
    });

    // Store cleanup function
    cleanupFunction = () => {
      chatGPTAdapter.stopObserving();
      chatGPTAdapter.destroy();
    };

    console.log('[Engram] Ready - monitoring ChatGPT messages (direct insertion mode)');
  } catch (error) {
    console.error('[Engram] ChatGPT initialization error:', error);
  }
}

/**
 * Initialize Claude adapter
 */
async function initializeClaude() {
  try {
      console.log('[Engram] Claude detected, initializing adapter...');

      // Initialize background connection
      const initResponse = await sendInitRequest();
      if (!initResponse.success) {
        console.error('[Engram] Background init failed:', initResponse.error);
        return;
      }

      console.log('[Engram] Background connected, device ID:', initResponse.deviceId);

      // Initialize adapter
      await claudeAdapter.initialize();
      console.log('[Engram] Adapter initialized');

      // Initialize intelligent prompt interceptor
      const interceptor = new PromptInterceptor();
      await interceptor.initialize(
        'div[contenteditable="true"]', // Claude contenteditable input
        'button[aria-label="Send message"]' // Claude send button (note: lowercase 'm')
      );

      console.log('[Engram] Intelligent auto-injection ready');

      // Start observing messages
      await claudeAdapter.observeMessages(async (extractedMessage) => {
        console.log('[Engram] Message extracted:', {
          role: extractedMessage.role,
          contentLength: extractedMessage.content.length,
          conversationId: extractedMessage.conversationId
        });

        try {
          const saveResponse = await sendSaveMessage(extractedMessage);
          if (saveResponse.success) {
            console.log('[Engram] Message saved successfully');
          } else {
            console.error('[Engram] Failed to save message:', saveResponse.error);
          }
        } catch (error) {
          console.error('[Engram] Error saving message:', error);
        }
      });

      console.log('[Engram] Ready - monitoring Claude messages');
  } catch (error) {
    console.error('[Engram] Claude initialization error:', error);
  }
}

/**
 * Initialize Gemini adapter
 */
async function initializeGemini() {
  try {
    console.log('[Engram] Gemini detected, initializing adapter...');

    // Initialize background connection
    const initResponse = await sendInitRequest();
    if (!initResponse.success) {
      console.error('[Engram] Background init failed:', initResponse.error);
      return;
    }

    console.log('[Engram] Background connected, device ID:', initResponse.deviceId);

    // Initialize adapter
    await geminiAdapter.initialize();
    console.log('[Engram] Adapter initialized');

    // Start observing messages
    await geminiAdapter.observeMessages(async (extractedMessage) => {
      console.log('[Engram] Message extracted:', {
        role: extractedMessage.role,
        contentLength: extractedMessage.content.length,
        conversationId: extractedMessage.conversationId
      });

      try {
        const saveResponse = await sendSaveMessage(extractedMessage);
        if (saveResponse.success) {
          console.log('[Engram] Message saved successfully');
        } else {
          console.error('[Engram] Failed to save message:', saveResponse.error);
        }
      } catch (error) {
        console.error('[Engram] Error saving message:', error);
      }
    });

    console.log('[Engram] Ready - monitoring Gemini messages');
  } catch (error) {
    console.error('[Engram] Gemini initialization error:', error);
  }
}

/**
 * Initialize Perplexity adapter
 */
async function initializePerplexity() {
  try {
    console.log('[Engram] Perplexity detected, initializing adapter...');

    // Initialize background connection
    const initResponse = await sendInitRequest();
    if (!initResponse.success) {
      console.error('[Engram] Background init failed:', initResponse.error);
      return;
    }

    console.log('[Engram] Background connected, device ID:', initResponse.deviceId);

    // Initialize adapter
    await perplexityAdapter.initialize();
    console.log('[Engram] Adapter initialized');

    // Start observing messages
    await perplexityAdapter.observeMessages(async (extractedMessage) => {
      console.log('[Engram] Message extracted:', {
        role: extractedMessage.role,
        contentLength: extractedMessage.content.length,
        conversationId: extractedMessage.conversationId
      });

      try {
        const saveResponse = await sendSaveMessage(extractedMessage);
        if (saveResponse.success) {
          console.log('[Engram] Message saved successfully');
        } else {
          console.error('[Engram] Failed to save message:', saveResponse.error);
        }
      } catch (error) {
        console.error('[Engram] Error saving message:', error);
      }
    });

    console.log('[Engram] Ready - monitoring Perplexity messages');
  } catch (error) {
    console.error('[Engram] Perplexity initialization error:', error);
  }
}

/**
 * Initialize generic mode for non-AI sites.
 * On generic sites, we don't auto-inject UI - users can access memories
 * via the extension popup or side panel when needed.
 */
async function initializeGeneric() {
  // Don't auto-inject memory panel on every website
  // Users can access memories via the extension popup/sidepanel
  console.log('[Engram] Generic site - memory access available via extension popup');
}

/**
 * Main initialization function
 */
async function initialize() {
  try {
    console.log('[Engram] Plasmo content script starting...');

    // Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // Detect platform and initialize
    const url = window.location.href;
    console.log('[Engram] URL:', url);

    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      await initializeChatGPT();

      // Monitor for navigation changes (ChatGPT is a SPA)
      setupNavigationMonitoring();
    } else if (url.includes('claude.ai')) {
      await initializeClaude();
    } else if (url.includes('gemini.google.com')) {
      await initializeGemini();
    } else if (url.includes('perplexity.ai')) {
      await initializePerplexity();
    } else {
      // Generic site - provide memory access UI
      await initializeGeneric();
    }
  } catch (error) {
    console.error('[Engram] Content script error:', error);
  }
}

/**
 * Set up navigation monitoring for SPAs like ChatGPT
 */
function setupNavigationMonitoring() {
  console.log('[Engram] Setting up navigation monitoring...');

  let lastUrl = window.location.href;

  // Monitor URL changes using MutationObserver on the URL bar
  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('[Engram] URL changed:', currentUrl);
      lastUrl = currentUrl;

      const newConversationId = extractConversationId(currentUrl);
      if (newConversationId !== currentConversationId) {
        console.log('[Engram] New conversation detected, re-initializing...');
        initializeChatGPT();
      }
    }
  });

  // Observe the entire document for changes
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    console.log('[Engram] Popstate event detected');
    const newConversationId = extractConversationId(window.location.href);
    if (newConversationId !== currentConversationId) {
      console.log('[Engram] New conversation detected via popstate, re-initializing...');
      initializeChatGPT();
    }
  });

  // Listen for pushstate/replacestate
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    const newConversationId = extractConversationId(window.location.href);
    if (newConversationId !== currentConversationId) {
      console.log('[Engram] New conversation detected via pushState, re-initializing...');
      initializeChatGPT();
    }
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    const newConversationId = extractConversationId(window.location.href);
    if (newConversationId !== currentConversationId) {
      console.log('[Engram] New conversation detected via replaceState, re-initializing...');
      initializeChatGPT();
    }
  };

  console.log('[Engram] Navigation monitoring active');
}

// Start initialization
initialize();

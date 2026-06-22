/**
 * Plasmo Content Script Entry Point
 * This file is automatically detected by Plasmo and injected into matching pages.
 * Runs on all websites to provide universal access to Engram memories.
 */

import type { PlasmoCSConfig} from "plasmo";

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

/**
 * Navigation/cleanup coordination state.
 *
 * All four target sites are SPAs: route changes happen via history API without a
 * full page load, so observers must be torn down and re-initialized on navigation
 * or they leak across conversations (R6). `activeCleanup` always destroys whichever
 * adapter is currently running.
 */
let currentConversationId: string | null = null;
let activeCleanup: (() => void) | null = null;
let lastPath: string = typeof location !== 'undefined' ? location.pathname : '';
let navMonitorInstalled = false;

/**
 * Extract conversation ID from URL (ChatGPT-specific; used for logging only)
 */
function extractConversationId(url: string): string | null {
  const match = url.match(/\/c\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Detect the active platform from a URL.
 */
function detectPlatform(url: string): string {
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return 'chatgpt';
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('gemini.google.com')) return 'gemini';
  if (url.includes('perplexity.ai')) return 'perplexity';
  return 'generic';
}

/**
 * Tear down whichever adapter is currently active.
 */
function cleanupActive(): void {
  if (activeCleanup) {
    try { activeCleanup(); } catch (e) { console.error('[Engram] Adapter cleanup error:', e); }
    activeCleanup = null;
  }
}

/**
 * Re-run platform detection + init after an SPA navigation.
 */
async function reinitialize(): Promise<void> {
  cleanupActive();
  const platform = detectPlatform(window.location.href);
  switch (platform) {
    case 'chatgpt': return initializeChatGPT();
    case 'claude': return initializeClaude();
    case 'gemini': return initializeGemini();
    case 'perplexity': return initializePerplexity();
    default: return initializeGeneric();
  }
}

/**
 * Initialize ChatGPT adapter
 */
async function initializeChatGPT() {
  try {
    console.log('[Engram] ChatGPT detected, initializing adapter...');

    // Cleanup previous instance if exists
    cleanupActive();

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
    activeCleanup = () => {
      chatGPTAdapter.stopObserving();
      chatGPTAdapter.destroy();
    };

    console.log('[Engram] Ready - monitoring ChatGPT messages');
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

      // Tear down any previous instance (SPA navigation)
      cleanupActive();

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

      activeCleanup = () => {
        claudeAdapter.stopObserving();
        claudeAdapter.destroy();
      };

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

    // Tear down any previous instance (SPA navigation)
    cleanupActive();

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

    activeCleanup = () => {
      geminiAdapter.stopObserving();
      geminiAdapter.destroy();
    };

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

    // Tear down any previous instance (SPA navigation)
    cleanupActive();

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

    activeCleanup = () => {
      perplexityAdapter.stopObserving();
      perplexityAdapter.destroy();
    };

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

    const platform = detectPlatform(url);
    switch (platform) {
      case 'chatgpt': await initializeChatGPT(); break;
      case 'claude': await initializeClaude(); break;
      case 'gemini': await initializeGemini(); break;
      case 'perplexity': await initializePerplexity(); break;
      default: await initializeGeneric(); break;
    }

    // All target sites are SPAs — monitor history navigation so observers are
    // re-initialized (and the previous one torn down) on every conversation change.
    if (platform !== 'generic') {
      setupNavigationMonitoring();
    }
  } catch (error) {
    console.error('[Engram] Content script error:', error);
  }
}

/**
 * Set up navigation monitoring for SPA route changes.
 *
 * Installed once per page load (history is patched globally). Fires on any
 * pathname change — across all supported platforms — and re-detects the platform,
 * so it keeps working even if the user navigates between products in the same tab.
 */
function setupNavigationMonitoring() {
  if (navMonitorInstalled) return;
  navMonitorInstalled = true;

  console.log('[Engram] Setting up navigation monitoring...');

  const onNavigation = () => {
    const newPath = window.location.pathname;
    if (newPath === lastPath) return; // ignore query/hash-only changes
    lastPath = newPath;
    currentConversationId = extractConversationId(window.location.href);
    console.log('[Engram] SPA navigation detected →', newPath, '; re-initializing');
    void reinitialize();
  };

  // Back/forward navigation
  window.addEventListener('popstate', onNavigation);

  // Programmatic navigation (patch once)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    onNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    onNavigation();
  };

  console.log('[Engram] Navigation monitoring active (all platforms)');
}

// Start initialization
initialize();

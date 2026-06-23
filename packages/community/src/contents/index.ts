/**
 * Plasmo Content Script Entry Point
 * This file is automatically detected by Plasmo and injected into matching pages.
 * Runs on all websites to provide universal access to Engram memories.
 */

import type { PlasmoCSConfig} from "plasmo";

// Runs on every website: AI platforms get conversation capture; all other sites
// get the generic observer (ambient page-visit metadata, gated by the user's
// capture policy) plus the manual "Save page" handler. http(s) only — excludes
// file://, chrome://, etc. Privacy controls live in Settings → Web Capture.
export const config: PlasmoCSConfig = {
  matches: [
    "https://*/*",
    "http://*/*"
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
import { shouldCapturePageVisit, buildPageVisitMessage, buildArticleMessage, hostnameOf } from '../content/shared/capture-policy';
import { getCaptureConfig, getVisitThrottle, recordVisit } from '../lib/capture-config';
import { SAVE_PAGE_COMMAND } from '../lib/context-menus';

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
 *
 * Records an ambient `page_visit` (url + title metadata only) when the capture
 * policy allows it — i.e. capture is enabled, not paused, ambient page visits are
 * on, the host isn't on the denylist, and this host hasn't been recorded within
 * the throttle window. All policy is applied here; the background just stores it.
 */
async function initializeGeneric() {
  try {
    const url = window.location.href;
    const config = await getCaptureConfig();
    const throttle = await getVisitThrottle();

    if (!shouldCapturePageVisit(url, config, throttle)) {
      return;
    }

    const host = hostnameOf(url);
    if (!host) return;

    const response = await sendSaveMessage(buildPageVisitMessage(url, document.title || ''));
    if (response.success) {
      await recordVisit(host, Date.now());
      console.log('[Engram] Recorded page visit for', host);
    } else {
      console.warn('[Engram] Page visit not saved:', response.error);
    }
  } catch (error) {
    console.error('[Engram] Generic capture error:', error);
  }
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

/**
 * Best-effort readable-text extraction for "Save page". Prefers the semantic
 * <article>/<main> region, falling back to the body. Intentionally lightweight
 * (no Readability dependency); capped to keep the saved memory reasonable.
 */
function extractArticleText(): string {
  const el =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.body;
  const text = (el as HTMLElement | null)?.innerText || '';
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 50000);
}

// Handle the "Save page to Engram" command from the background context menu.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === SAVE_PAGE_COMMAND) {
    (async () => {
      try {
        const body = extractArticleText();
        if (!body) {
          sendResponse({ success: false, error: 'No readable content on this page' });
          return;
        }
        const response = await sendSaveMessage(
          buildArticleMessage(window.location.href, body)
        );
        sendResponse(response);
      } catch (error) {
        sendResponse({ success: false, error: String(error) });
      }
    })();
    return true; // keep the message channel open for the async response
  }
  return undefined;
});

// Start initialization
initialize();

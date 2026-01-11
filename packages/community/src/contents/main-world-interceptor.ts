/**
 * Main World Network Interceptor
 * This runs in the PAGE's main world (not isolated content script world)
 * Configured with world: "MAIN" in Plasmo config
 */

import type { PlasmoCSConfig } from "plasmo";

// CRITICAL: This makes the script run in MAIN world, not isolated world
export const config: PlasmoCSConfig = {
  matches: [
    "https://claude.ai/*"
  ],
  world: "MAIN", // Run in main page context, not isolated
  run_at: "document_start" // Run early to intercept fetch
};

// This code runs in the MAIN world (same as Claude's JavaScript)
console.log('[Engram Main World] Initializing network interceptor...');

// Store reference to original fetch
const originalFetch = window.fetch;

// Storage for queued injection
let queuedInjection: {
  originalPrompt: string;
  enrichedPrompt: string;
  timestamp: number;
} | null = null;

// Listen for messages from isolated content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'ENGRAM_QUEUE_INJECTION') {
    queuedInjection = {
      originalPrompt: event.data.originalPrompt,
      enrichedPrompt: event.data.enrichedPrompt,
      timestamp: Date.now()
    };
    console.log('[Engram Main World] Queued injection:', {
      originalLength: event.data.originalPrompt.length,
      enrichedLength: event.data.enrichedPrompt.length
    });
  } else if (event.data.type === 'ENGRAM_CLEAR_INJECTION') {
    queuedInjection = null;
    console.log('[Engram Main World] Cleared injection');
  }
});

// Override fetch in main world
window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
  const [resource, config] = args;
  const url = typeof resource === 'string'
    ? resource
    : resource instanceof URL
    ? resource.toString()
    : resource.url;

  // Log ALL requests for ChatGPT debugging (not just POST)
  if (url.includes('chatgpt.com') || url.includes('openai.com')) {
    console.log('[Engram Main World] ChatGPT request:', {
      method: config?.method || 'GET',
      url: url,
      hasBody: !!config?.body
    });

    // Log body for POST/PUT requests
    if ((config?.method === 'POST' || config?.method === 'PUT') && config?.body) {
      try {
        const bodyPreview = typeof config.body === 'string'
          ? config.body.substring(0, 300)
          : JSON.stringify(config.body).substring(0, 300);

        // Skip logging binary/compressed data
        if (!bodyPreview.startsWith('{"0":')) {
          console.log('[Engram Main World] ChatGPT body preview:', bodyPreview);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }

  // Check if this is a Claude API request
  const isClaudeAPI = (
    url.includes('/api/') &&
    config?.method === 'POST' &&
    config?.body &&
    (
      url.includes('chat_conversations') ||
      url.includes('completion') ||
      url.includes('append') ||
      url.includes('message')
    )
  );

  // Check if this is a ChatGPT API request
  const isChatGPTAPI = (
    config?.method === 'POST' &&
    config?.body &&
    (
      url.includes('/backend-api/conversation') ||
      url.includes('/backend-api/chat') ||
      url.includes('/backend-anon/conversation') ||
      // Broader match for ChatGPT API
      (url.includes('chatgpt.com') && url.includes('/backend'))
    )
  );

  if ((isClaudeAPI || isChatGPTAPI) && queuedInjection) {
    console.log('[Engram Main World] Intercepted API request!', { url, isChatGPT: isChatGPTAPI, isClaude: isClaudeAPI });

    const age = Date.now() - queuedInjection.timestamp;
    if (age < 3000) { // 3 second window
      try {
        const bodyText = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
        console.log('[Engram Main World] Request body preview:', bodyText.substring(0, 200));

        const body = JSON.parse(bodyText);
        console.log('[Engram Main World] Body keys:', Object.keys(body));

        let modified = false;

        // Try different prompt locations in request body
        if (body.prompt) {
          console.log('[Engram Main World] Found body.prompt');
          if (body.prompt.trim() === queuedInjection.originalPrompt.trim()) {
            body.prompt = queuedInjection.enrichedPrompt;
            modified = true;
            console.log('[Engram Main World] ✅ Replaced body.prompt');
          }
        }

        if (body.message && typeof body.message === 'string') {
          console.log('[Engram Main World] Found body.message');
          if (body.message.trim() === queuedInjection.originalPrompt.trim()) {
            body.message = queuedInjection.enrichedPrompt;
            modified = true;
            console.log('[Engram Main World] ✅ Replaced body.message');
          }
        }

        if (body.text) {
          console.log('[Engram Main World] Found body.text');
          if (body.text.trim() === queuedInjection.originalPrompt.trim()) {
            body.text = queuedInjection.enrichedPrompt;
            modified = true;
            console.log('[Engram Main World] ✅ Replaced body.text');
          }
        }

        // Check for nested structures
        if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
          console.log('[Engram Main World] Found body.messages array');
          const lastMsg = body.messages[body.messages.length - 1];

          if (lastMsg.content) {
            const content = typeof lastMsg.content === 'string' ? lastMsg.content : lastMsg.content.text;
            if (content && content.trim() === queuedInjection.originalPrompt.trim()) {
              if (typeof lastMsg.content === 'string') {
                lastMsg.content = queuedInjection.enrichedPrompt;
              } else {
                lastMsg.content.text = queuedInjection.enrichedPrompt;
              }
              modified = true;
              console.log('[Engram Main World] ✅ Replaced body.messages[].content');
            }
          }
        }

        if (modified) {
          console.log('[Engram Main World] 🎉 Successfully modified request!');
          const modifiedConfig = {
            ...config,
            body: JSON.stringify(body)
          };

          // Clear the queued injection
          queuedInjection = null;

          // Send the modified request
          return originalFetch.call(window, resource, modifiedConfig);
        } else {
          console.warn('[Engram Main World] ⚠️ Could not find prompt in request body');
          console.log('[Engram Main World] Expected:', queuedInjection.originalPrompt.substring(0, 50));
          console.log('[Engram Main World] Full body:', body);
        }
      } catch (error) {
        console.error('[Engram Main World] Error modifying request:', error);
      }
    } else {
      console.log('[Engram Main World] Injection expired (age:', age, 'ms)');
      queuedInjection = null;
    }
  }

  // Default: pass through
  return originalFetch.call(window, ...args);
};

console.log('[Engram Main World] ✅ Network interceptor installed successfully');

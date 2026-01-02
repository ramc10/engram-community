/**
 * Inject Network Interceptor into Main World
 * This code runs in the page's main world, not the isolated content script world
 */

export function injectNetworkInterceptor(): void {
  // Create a script element that will run in the main page context
  const script = document.createElement('script');

  script.textContent = `
    (function() {
      console.log('[Engram Network Injector] Installing in main world...');

      // Store reference to original fetch
      const originalFetch = window.fetch;

      // Storage for queued injection
      let queuedInjection = null;

      // Listen for messages from content script
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        if (event.data.type === 'ENGRAM_QUEUE_INJECTION') {
          queuedInjection = {
            originalPrompt: event.data.originalPrompt,
            enrichedPrompt: event.data.enrichedPrompt,
            timestamp: Date.now()
          };
          console.log('[Engram Network Injector] Queued injection:', {
            originalLength: event.data.originalPrompt.length,
            enrichedLength: event.data.enrichedPrompt.length
          });
        } else if (event.data.type === 'ENGRAM_CLEAR_INJECTION') {
          queuedInjection = null;
          console.log('[Engram Network Injector] Cleared injection');
        }
      });

      // Override fetch
      window.fetch = async function(...args) {
        const [resource, config] = args;
        const url = typeof resource === 'string' ? resource : resource.url;

        // Log all POST requests for debugging
        if (config?.method === 'POST') {
          console.log('[Engram Network Injector] POST request:', url);
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

        if (isClaudeAPI && queuedInjection) {
          console.log('[Engram Network Injector] Intercepted Claude API request!');

          const age = Date.now() - queuedInjection.timestamp;
          if (age < 3000) { // 3 second window
            try {
              const bodyText = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
              console.log('[Engram Network Injector] Request body preview:', bodyText.substring(0, 200));

              const body = JSON.parse(bodyText);
              console.log('[Engram Network Injector] Body keys:', Object.keys(body));

              let modified = false;

              // Try different prompt locations in request body
              if (body.prompt) {
                console.log('[Engram Network Injector] Found body.prompt');
                if (body.prompt.trim() === queuedInjection.originalPrompt.trim()) {
                  body.prompt = queuedInjection.enrichedPrompt;
                  modified = true;
                  console.log('[Engram Network Injector] ✅ Replaced body.prompt');
                }
              }

              if (body.message && typeof body.message === 'string') {
                console.log('[Engram Network Injector] Found body.message');
                if (body.message.trim() === queuedInjection.originalPrompt.trim()) {
                  body.message = queuedInjection.enrichedPrompt;
                  modified = true;
                  console.log('[Engram Network Injector] ✅ Replaced body.message');
                }
              }

              if (body.text) {
                console.log('[Engram Network Injector] Found body.text');
                if (body.text.trim() === queuedInjection.originalPrompt.trim()) {
                  body.text = queuedInjection.enrichedPrompt;
                  modified = true;
                  console.log('[Engram Network Injector] ✅ Replaced body.text');
                }
              }

              // Check for nested structures
              if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
                console.log('[Engram Network Injector] Found body.messages array');
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
                    console.log('[Engram Network Injector] ✅ Replaced body.messages[].content');
                  }
                }
              }

              if (modified) {
                console.log('[Engram Network Injector] 🎉 Successfully modified request!');
                const modifiedConfig = {
                  ...config,
                  body: JSON.stringify(body)
                };

                // Clear the queued injection
                queuedInjection = null;

                // Send the modified request
                return originalFetch.call(window, resource, modifiedConfig);
              } else {
                console.warn('[Engram Network Injector] ⚠️ Could not find prompt in request body');
                console.log('[Engram Network Injector] Expected:', queuedInjection.originalPrompt.substring(0, 50));
                console.log('[Engram Network Injector] Full body:', body);
              }
            } catch (error) {
              console.error('[Engram Network Injector] Error modifying request:', error);
            }
          } else {
            console.log('[Engram Network Injector] Injection expired (age:', age, 'ms)');
            queuedInjection = null;
          }
        }

        // Default: pass through
        return originalFetch.call(window, ...args);
      };

      console.log('[Engram Network Injector] ✅ Installed successfully');
    })();
  `;

  // Inject script into page
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Clean up the script element

  console.log('[Engram] Network interceptor injected into main world');
}

/**
 * Queue an injection from content script world
 */
export function queueInjectionInMainWorld(originalPrompt: string, enrichedPrompt: string): void {
  window.postMessage({
    type: 'ENGRAM_QUEUE_INJECTION',
    originalPrompt,
    enrichedPrompt
  }, '*');
}

/**
 * Clear injection from content script world
 */
export function clearInjectionInMainWorld(): void {
  window.postMessage({
    type: 'ENGRAM_CLEAR_INJECTION'
  }, '*');
}

/**
 * Network Interceptor
 * Intercepts fetch/XHR requests to inject memories into Claude API calls
 */

export interface MessageToInject {
  originalPrompt: string;
  enrichedPrompt: string;
  timestamp: number;
}

export class NetworkInterceptor {
  private messageToInject: MessageToInject | null = null;
  private originalFetch: typeof fetch;
  private isInitialized = false;

  constructor() {
    this.originalFetch = window.fetch;
  }

  /**
   * Initialize the network interceptor
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[Network Interceptor] Already initialized');
      return;
    }

    console.log('[Network Interceptor] Initializing...');
    this.interceptFetch();
    this.isInitialized = true;
    console.log('[Network Interceptor] Ready');
  }

  /**
   * Queue a message to be injected on next API call
   */
  queueInjection(originalPrompt: string, enrichedPrompt: string): void {
    this.messageToInject = {
      originalPrompt,
      enrichedPrompt,
      timestamp: Date.now(),
    };
    console.log('[Network Interceptor] Queued injection:', {
      originalLength: originalPrompt.length,
      enrichedLength: enrichedPrompt.length,
    });
  }

  /**
   * Clear queued injection
   */
  clearInjection(): void {
    this.messageToInject = null;
  }

  /**
   * Intercept fetch API
   */
  private interceptFetch(): void {
    const originalFetch = this.originalFetch;

    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [resource, config] = args;
      const url = typeof resource === 'string'
        ? resource
        : resource instanceof URL
        ? resource.toString()
        : resource.url;

      // Log all POST requests for debugging
      if (config?.method === 'POST') {
        console.log('[Network Interceptor] POST request detected:', url);
      }

      // Check if this is a Claude API message send request
      // Claude API patterns: /api/organizations/.../chat_conversations/...
      // or /api/append_message, /api/chat, etc.
      const isClaudeAPI = (
        url.includes('/api/') &&
        config?.method === 'POST' &&
        (
          url.includes('chat_conversations') ||
          url.includes('append_message') ||
          url.includes('completion') ||
          url.includes('message')
        )
      );

      if (isClaudeAPI) {
        console.log('[Network Interceptor] Intercepted Claude API request:', url);

        // Check if we have a message to inject
        if (this.messageToInject) {
          const injection = this.messageToInject;

          // Check if injection is still fresh (within 2 seconds)
          const age = Date.now() - injection.timestamp;
          if (age < 2000) {
            console.log('[Network Interceptor] Attempting to inject enriched prompt');

            try {
              // Parse the request body
              const bodyText = config.body as string;
              if (!bodyText) {
                console.warn('[Network Interceptor] No request body found');
                return originalFetch.call(window, ...args);
              }

              console.log('[Network Interceptor] Request body (first 200 chars):', bodyText.substring(0, 200));
              const body = JSON.parse(bodyText);
              console.log('[Network Interceptor] Parsed body keys:', Object.keys(body));

              // Find and replace the prompt in the request
              if (body.prompt) {
                console.log('[Network Interceptor] Found prompt in body.prompt');
                // Check if it matches our original prompt (might be trimmed)
                if (body.prompt.trim() === injection.originalPrompt.trim()) {
                  console.log('[Network Interceptor] Replacing prompt with enriched version');
                  body.prompt = injection.enrichedPrompt;

                  // Update the request config
                  const modifiedConfig = {
                    ...config,
                    body: JSON.stringify(body),
                  };

                  // Clear the injection
                  this.clearInjection();

                  // Send modified request
                  return originalFetch.call(window, resource, modifiedConfig);
                } else {
                  console.log('[Network Interceptor] Prompt mismatch, not injecting');
                  console.log('[Network Interceptor] Expected:', injection.originalPrompt.substring(0, 50));
                  console.log('[Network Interceptor] Got:', body.prompt.substring(0, 50));
                }
              }

              // Check for messages array (alternative format)
              if (body.messages && Array.isArray(body.messages)) {
                console.log('[Network Interceptor] Found messages array');
                const lastMessage = body.messages[body.messages.length - 1];
                if (lastMessage && lastMessage.content) {
                  const content = typeof lastMessage.content === 'string'
                    ? lastMessage.content
                    : lastMessage.content.text || lastMessage.content[0]?.text;

                  if (content && content.trim() === injection.originalPrompt.trim()) {
                    console.log('[Network Interceptor] Replacing message content with enriched version');

                    if (typeof lastMessage.content === 'string') {
                      lastMessage.content = injection.enrichedPrompt;
                    } else if (lastMessage.content.text) {
                      lastMessage.content.text = injection.enrichedPrompt;
                    } else if (lastMessage.content[0]?.text) {
                      lastMessage.content[0].text = injection.enrichedPrompt;
                    }

                    // Update the request config
                    const modifiedConfig = {
                      ...config,
                      body: JSON.stringify(body),
                    };

                    // Clear the injection
                    this.clearInjection();

                    // Send modified request
                    return originalFetch.call(window, resource, modifiedConfig);
                  }
                }
              }
            } catch (error) {
              console.error('[Network Interceptor] Error modifying request:', error);
            }
          } else {
            console.log('[Network Interceptor] Injection expired (age:', age, 'ms)');
            this.clearInjection();
          }
        }
      }

      // Default: pass through unmodified
      return originalFetch.call(window, ...args);
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.isInitialized) {
      // Restore original fetch
      window.fetch = this.originalFetch;
      this.isInitialized = false;
      console.log('[Network Interceptor] Destroyed');
    }
  }
}

/**
 * Network Interceptor
 * Intercepts fetch/XHR requests to inject memories into Claude API calls
 */

export interface MessageToInject {
  originalPrompt: string;
  enrichedPrompt: string;
  timestamp: number;
}

/**
 * Extract the plain-text string from a Claude-style content value.
 * Handles: string | { text: string } | [{ type: "text", text: string }, …]
 */
export function extractText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textBlock = content.find((b: any) => b && b.type === 'text');
    return textBlock?.text ?? null;
  }
  if (content && typeof content === 'object' && 'text' in (content as any)) {
    return (content as any).text ?? null;
  }
  return null;
}

/**
 * Write enriched text back into content, preserving its original shape.
 */
export function writeText(content: unknown, enriched: string): unknown {
  if (typeof content === 'string') return enriched;
  if (Array.isArray(content)) {
    return content.map((b: any) =>
      b && b.type === 'text' ? { ...b, text: enriched } : b
    );
  }
  if (content && typeof content === 'object' && 'text' in (content as any)) {
    return { ...(content as any), text: enriched };
  }
  return enriched;
}

/**
 * Loose prompt match: true when either side contains the other after trimming.
 */
export function promptsMatch(bodyValue: string, original: string): boolean {
  const a = bodyValue.trim();
  const b = original.trim();
  return a === b || a.includes(b) || b.includes(a);
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

              let modified = false;

              // Try body.prompt
              if (body.prompt && typeof body.prompt === 'string') {
                console.log('[Network Interceptor] Found prompt in body.prompt');
                if (promptsMatch(body.prompt, injection.originalPrompt)) {
                  body.prompt = injection.enrichedPrompt;
                  modified = true;
                  console.log('[Network Interceptor] ✅ Replaced body.prompt');
                }
              }

              // Try body.messages[] – handles string, {text}, and [{type:"text",text}] content
              if (!modified && body.messages && Array.isArray(body.messages)) {
                console.log('[Network Interceptor] Found messages array');
                const lastMessage = body.messages[body.messages.length - 1];
                if (lastMessage && lastMessage.content != null) {
                  const extracted = extractText(lastMessage.content);
                  if (extracted && promptsMatch(extracted, injection.originalPrompt)) {
                    lastMessage.content = writeText(lastMessage.content, injection.enrichedPrompt);
                    modified = true;
                    console.log('[Network Interceptor] ✅ Replaced body.messages[].content');
                  }
                }
              }

              if (modified) {
                const modifiedConfig = {
                  ...config,
                  body: JSON.stringify(body),
                };
                this.clearInjection();
                return originalFetch.call(window, resource, modifiedConfig);
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

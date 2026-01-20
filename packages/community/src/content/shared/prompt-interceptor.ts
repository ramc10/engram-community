/**
 * Prompt Interceptor
 * Monitors user input and automatically injects relevant memories before sending
 */

import { getEmbeddingService, type SimilarityResult, type MemoryWithEmbedding } from '../../lib/embedding-service';
import { sendMessage, MessageType } from '../../lib/messages';
import type { Memory, MemoryWithMemA, UUID } from '@engram/core';

/**
 * Configuration
 */
const CONFIG = {
  DEBOUNCE_MS: 500, // Wait time before computing similarity
  MIN_QUERY_LENGTH: 10, // Minimum characters to trigger matching
  CONTEXT_MARKER: '[Engram Context]', // Marker to identify injected content
  MAX_CONTEXT_LENGTH: 500, // Max characters per memory in context
};

/**
 * Prompt Interceptor
 * Handles intelligent memory injection
 */
export class PromptInterceptor {
  private inputElement: HTMLTextAreaElement | HTMLElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private embeddingsService = getEmbeddingService();
  private memories: MemoryWithEmbedding[] = [];
  private currentMatches: SimilarityResult[] = [];
  private debounceTimer: number | null = null;
  private indicator: HTMLElement | null = null;
  private isProcessing = false;
  private useDirectInsertion = false; // Flag to use direct textarea insertion instead of network interception

  /**
   * Initialize the interceptor
   * @param useDirectInsertion - If true, directly inserts into textarea instead of network interception (for ChatGPT)
   */
  async initialize(textareaSelector: string, sendButtonSelector: string, useDirectInsertion = false): Promise<void> {
    this.useDirectInsertion = useDirectInsertion;
    console.log('[Engram Interceptor] Initializing...');

    // Find input element and send button
    await this.waitForElements(textareaSelector, sendButtonSelector);

    if (!this.inputElement || !this.sendButton) {
      console.error('[Engram Interceptor] Failed to find input element or send button');
      console.log('[Engram Interceptor] Tried selectors:', { textareaSelector, sendButtonSelector });
      return;
    }

    console.log('[Engram Interceptor] Elements found');

    // Note: Main world network interceptor is loaded separately by Plasmo
    // (see contents/main-world-interceptor.ts with world: "MAIN")

    // Initialize embedding service
    await this.embeddingsService.initialize();

    // Load and embed memories
    await this.loadMemories();

    // Attach event listeners
    this.attachListeners();

    // Create indicator element
    this.createIndicator();

    console.log('[Engram Interceptor] Ready!');
  }

  /**
   * Wait for elements to appear in DOM
   */
  private async waitForElements(textareaSelector: string, sendButtonSelector: string): Promise<void> {
    const maxAttempts = 20;
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      this.inputElement = document.querySelector(textareaSelector);
      this.sendButton = document.querySelector(sendButtonSelector);

      if (this.inputElement && this.sendButton) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Get text content from input element (works with both textarea and contenteditable)
   */
  private getInputText(): string {
    if (!this.inputElement) return '';

    if (this.inputElement instanceof HTMLTextAreaElement || this.inputElement instanceof HTMLInputElement) {
      return this.inputElement.value;
    } else {
      // Contenteditable div
      return this.inputElement.textContent || this.inputElement.innerText || '';
    }
  }

  /**
   * Set text content in input element (works with both textarea and contenteditable)
   */
  private setInputText(text: string): void {
    if (!this.inputElement) return;

    if (this.inputElement instanceof HTMLTextAreaElement || this.inputElement instanceof HTMLInputElement) {
      this.inputElement.value = text;
      // Trigger input event for React
      this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Contenteditable div - use multiple strategies to trigger React update
      // Focus the element first
      this.inputElement.focus();

      // Select all existing content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(this.inputElement);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Method 1: Use execCommand (deprecated but most reliable for contenteditable)
      try {
        document.execCommand('selectAll', false);
        document.execCommand('delete', false);
        document.execCommand('insertText', false, text);
      } catch (e) {
        console.warn('[Engram Interceptor] execCommand failed, using fallback:', e);
        // Fallback: Direct DOM manipulation
        this.inputElement.textContent = text;
      }

      // Move cursor to end
      range.selectNodeContents(this.inputElement);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Dispatch multiple events to ensure React picks up the change
      this.inputElement.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      this.inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Load memories and generate embeddings
   */
  private async loadMemories(): Promise<void> {
    try {
      console.log('[Engram Interceptor] Loading memories...');

      // Fetch memories from storage
      const response = await sendMessage<{
        type: MessageType.GET_MEMORIES;
        filter?: { limit: number };
      }>({
        type: MessageType.GET_MEMORIES,
        filter: {
          limit: 200, // Load recent memories for auto-injection (balanced performance)
        },
      });

      if (!response.success || !response.memories) {
        console.log('[Engram Interceptor] No memories found');
        return;
      }

      const memories = response.memories as Memory[];
      console.log(`[Engram Interceptor] Loaded ${memories.length} memories`);

      // Generate embeddings
      this.memories = await this.embeddingsService.embedMemories(memories);

      console.log('[Engram Interceptor] Embeddings generated');
    } catch (error) {
      console.error('[Engram Interceptor] Failed to load memories:', error);
    }
  }

  /**
   * Attach event listeners
   */
  private attachListeners(): void {
    if (!this.inputElement || !this.sendButton) return;

    // Monitor input element changes
    this.inputElement.addEventListener('input', this.handleInput.bind(this));

    // Intercept send button click
    this.sendButton.addEventListener('click', this.handleSend.bind(this), true);

    // Intercept Enter key
    this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this) as unknown as EventListener, true);
  }

  /**
   * Handle input changes
   */
  private handleInput(): void {
    if (!this.inputElement) return;

    const query = this.getInputText().trim();

    console.log('[Engram Interceptor] Input changed, length:', query.length);

    // Clear previous debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce similarity computation
    if (query.length >= CONFIG.MIN_QUERY_LENGTH) {
      console.log('[Engram Interceptor] Query long enough, scheduling similarity check...');
      this.debounceTimer = window.setTimeout(() => {
        this.computeSimilarity(query);
      }, CONFIG.DEBOUNCE_MS);
    } else {
      console.log('[Engram Interceptor] Query too short, minimum is', CONFIG.MIN_QUERY_LENGTH);
      this.currentMatches = [];
      this.updateIndicator();
    }
  }

  /**
   * Find similar memories with link-aware retrieval (Phase 2)
   *
   * Algorithm:
   * 1. Get top-5 memories by semantic similarity
   * 2. Expand results with their linked memories
   * 3. De-duplicate results
   * 4. Re-sort by hybrid score
   * 5. Limit to max 10 results
   *
   * @param query Search query
   * @returns Array of similar memories (up to 10)
   */
  private async findSimilarWithLinks(query: string): Promise<SimilarityResult[]> {
    // Step 1: Get top-5 by semantic similarity
    const topResults = await this.embeddingsService.findSimilar(query, this.memories, {
      maxResults: 5,
      threshold: 0.5,
    });

    if (topResults.length === 0) {
      return [];
    }

    // Step 2: Expand with linked memories
    const expanded = new Set<UUID>();
    const results: SimilarityResult[] = [...topResults];

    for (const result of topResults) {
      expanded.add(result.memory.id);

      // Check if memory has links
      const memoryWithLinks = result.memory as MemoryWithMemA;
      if (memoryWithLinks.links && memoryWithLinks.links.length > 0) {
        for (const link of memoryWithLinks.links) {
          // Only add if not already included and under limit
          if (!expanded.has(link.memoryId) && expanded.size < 10) {
            // Find the linked memory in our memory list
            const linkedMemory = this.memories.find(m => m.id === link.memoryId);

            if (linkedMemory) {
              // Add with decayed score (linked memories have lower priority)
              results.push({
                memory: linkedMemory,
                score: result.score * link.score * 0.8, // Decay factor: 0.8
              });
              expanded.add(link.memoryId);
            }
          }
        }
      }
    }

    // Step 3: Sort by score and limit to 10
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Compute similarity and find matches
   */
  private async computeSimilarity(query: string): Promise<void> {
    if (this.isProcessing) {
      console.log('[Engram Interceptor] Already processing, skipping...');
      return;
    }

    try {
      this.isProcessing = true;

      console.log('[Engram Interceptor] Computing similarity for query:', query.substring(0, 50) + '...');
      console.log('[Engram Interceptor] Total memories to search:', this.memories.length);

      // Find similar memories with link-aware retrieval (Phase 2)
      this.currentMatches = await this.findSimilarWithLinks(query);

      console.log(`[Engram Interceptor] Found ${this.currentMatches.length} relevant memories (with links)`);

      if (this.currentMatches.length > 0) {
        console.log('[Engram Interceptor] Top matches:', this.currentMatches.map(m => ({
          score: (m.score * 100).toFixed(1) + '%',
          text: (m.memory.content.text || '').substring(0, 50) + '...'
        })));
      }

      // Update indicator
      this.updateIndicator();
    } catch (error) {
      console.error('[Engram Interceptor] Failed to compute similarity:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle send button click
   */
  private async handleSend(event: MouseEvent): Promise<void> {
    console.log('[Engram Interceptor] Send button clicked, matches:', this.currentMatches.length);

    if (this.currentMatches.length > 0) {
      console.log('[Engram Interceptor] Intercepting send to inject memories...');
      event.preventDefault();
      event.stopPropagation();

      await this.injectAndSend();
    }
  }

  /**
   * Handle Enter key
   */
  private async handleKeyDown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Enter' && !event.shiftKey) {
      console.log('[Engram Interceptor] Enter key pressed, matches:', this.currentMatches.length);

      if (this.currentMatches.length > 0) {
        console.log('[Engram Interceptor] Intercepting Enter to inject memories...');
        event.preventDefault();
        event.stopPropagation();

        await this.injectAndSend();
      }
    }
  }

  /**
   * Inject memories and send
   */
  private async injectAndSend(): Promise<void> {
    if (!this.inputElement || !this.sendButton) {
      console.error('[Engram Interceptor] Missing input element or send button');
      return;
    }

    const originalQuery = this.getInputText().trim();

    console.log('[Engram Interceptor] Preparing to inject memories...');
    console.log('[Engram Interceptor] Original query:', originalQuery.substring(0, 100) + '...');

    // Check if already injected
    if (originalQuery.includes(CONFIG.CONTEXT_MARKER)) {
      console.log('[Engram Interceptor] Already injected, just sending...');
      // Already injected, just send
      this.sendButton.click();
      return;
    }

    // Build context from matches
    const context = this.buildContext(this.currentMatches);

    console.log('[Engram Interceptor] Built context length:', context.length);

    // Inject context
    const enrichedPrompt = `${originalQuery}

${CONFIG.CONTEXT_MARKER}:
${context}`;

    console.log('[Engram Interceptor] Enriched prompt length:', enrichedPrompt.length);

    if (this.useDirectInsertion) {
      // ChatGPT mode: Directly insert into textarea
      console.log('[Engram Interceptor] Using direct insertion mode (ChatGPT)');

      // Set the enriched prompt directly in the input
      this.setInputText(enrichedPrompt);

      // Small delay to ensure React picks up the change
      await new Promise(resolve => setTimeout(resolve, 200));

      // Click send
      console.log('[Engram Interceptor] Clicking send button...');
      this.sendButton.click();
    } else {
      // Claude mode: Queue for network interception
      console.log('[Engram Interceptor] Using network interception mode (Claude)');

      // Queue the enriched prompt in main world network interceptor via postMessage
      window.postMessage({
        type: 'ENGRAM_QUEUE_INJECTION',
        originalPrompt: originalQuery,
        enrichedPrompt: enrichedPrompt
      }, '*');
      console.log('[Engram Interceptor] Queued enriched prompt for network injection (main world)');

      // Small delay to ensure message is received by main world
      await new Promise(resolve => setTimeout(resolve, 100));

      // Click send - let React send the original query
      // Main world network interceptor will replace it in the API request
      console.log('[Engram Interceptor] Clicking send button...');
      this.sendButton.click();
    }

    // Clear matches
    this.currentMatches = [];
    this.updateIndicator();
  }

  /**
   * Build context string from matches
   */
  private buildContext(matches: SimilarityResult[]): string {
    return matches
      .map((match, index) => {
        const text = match.memory.content.text || '';
        const truncated = text.length > CONFIG.MAX_CONTEXT_LENGTH
          ? text.substring(0, CONFIG.MAX_CONTEXT_LENGTH) + '...'
          : text;

        return `${index + 1}. [Score: ${(match.score * 100).toFixed(0)}%] ${truncated}`;
      })
      .join('\n\n');
  }

  /**
   * Create indicator element
   */
  private createIndicator(): void {
    this.indicator = document.createElement('div');
    this.indicator.id = 'engram-memory-indicator';
    this.indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      display: none;
      align-items: center;
      gap: 6px;
      z-index: 10000;
      transition: all 0.3s ease;
    `;

    this.indicator.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
        <rect width="128" height="128" rx="28" fill="black"/>
        <g transform="translate(64, 64)">
          <circle cx="0" cy="0" r="38" fill="none" stroke="white" stroke-width="1.5" opacity="0.08"/>
          <path d="M -18 -14 Q -26 -14 -26 -4 Q -26 6 -18 6 Q -18 -4 -18 -14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M 18 -14 Q 26 -14 26 -4 Q 26 6 18 6 Q 18 -4 18 -14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="-18" y1="-4" x2="18" y2="-4" stroke="white" stroke-width="2" opacity="0.15"/>
          <circle cx="-22" cy="-8" r="1.8" fill="white" opacity="0.6"/>
          <circle cx="22" cy="-8" r="1.8" fill="white" opacity="0.6"/>
          <circle cx="-22" cy="0" r="1.8" fill="white" opacity="0.6"/>
          <circle cx="22" cy="0" r="1.8" fill="white" opacity="0.6"/>
          <circle cx="0" cy="-4" r="2" fill="white" opacity="0.8"/>
          <line x1="-22" y1="-8" x2="0" y2="-4" stroke="white" stroke-width="1" opacity="0.12"/>
          <line x1="22" y1="-8" x2="0" y2="-4" stroke="white" stroke-width="1" opacity="0.12"/>
          <line x1="-22" y1="0" x2="0" y2="-4" stroke="white" stroke-width="1" opacity="0.12"/>
          <line x1="22" y1="0" x2="0" y2="-4" stroke="white" stroke-width="1" opacity="0.12"/>
          <path d="M -14 10 Q 0 12 14 10" fill="none" stroke="white" stroke-width="1.5" opacity="0.2" stroke-linecap="round"/>
          <path d="M -10 14 Q 0 15 10 14" fill="none" stroke="white" stroke-width="1.2" opacity="0.15" stroke-linecap="round"/>
        </g>
      </svg>
      <span id="engram-memory-count">0 memories</span>
    `;

    document.body.appendChild(this.indicator);
  }

  /**
   * Update indicator visibility and count
   */
  private updateIndicator(): void {
    if (!this.indicator) return;

    const countSpan = this.indicator.querySelector('#engram-memory-count');

    if (this.currentMatches.length > 0) {
      this.indicator.style.display = 'flex';
      if (countSpan) {
        countSpan.textContent = `+${this.currentMatches.length} ${
          this.currentMatches.length === 1 ? 'memory' : 'memories'
        }`;
      }
    } else {
      this.indicator.style.display = 'none';
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.indicator && this.indicator.parentNode) {
      this.indicator.parentNode.removeChild(this.indicator);
    }
  }
}

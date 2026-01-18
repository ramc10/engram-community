/**
 * Enrichment Service
 *
 * LLM-based metadata generation for memories
 * Implements memA Phase 1: Rich Note Construction
 *
 * @module enrichment-service
 */

import type {
  EnrichmentConfig,
  MemoryWithMemA,
} from '@engram/core';
import { getPremiumClient } from './premium-api-client';
import { getEnrichmentRetryQueue } from './enrichment-retry-queue';

// Declare chrome for TypeScript
declare const chrome: any;

// Internal types for enrichment
interface EnrichmentRequest {
  text: string;
  context?: string;
  memoryId?: string;
  platform?: string;
  role?: string;
  timestamp?: number;
  content?: string;
}

interface EnrichmentResponse {
  keywords: string[];
  tags: string[];
  context: string;
}

/**
 * Rate limiter for API calls
 * Prevents exceeding provider rate limits
 */
class RateLimiter {
  private calls: number[] = [];

  constructor(
    private maxCalls: number,
    private windowMs: number
  ) {}

  /**
   * Wait if necessary to respect rate limits
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove calls outside the time window
    this.calls = this.calls.filter(t => now - t < this.windowMs);

    // If at limit, wait until oldest call expires
    if (this.calls.length >= this.maxCalls) {
      const oldestCall = this.calls[0];
      const waitTime = this.windowMs - (now - oldestCall);

      if (waitTime > 0) {
        console.log(`[RateLimiter] Waiting ${waitTime}ms for rate limit`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.acquire(); // Retry
      }
    }

    // Record this call
    this.calls.push(now);
  }
}

/**
 * Enrichment Service
 *
 * Manages LLM-based enrichment of memories
 * - Non-blocking background queue
 * - Automatic retry with exponential backoff
 * - Rate limiting
 * - Cost tracking
 */
export class EnrichmentService {
  private queue: MemoryWithMemA[] = [];
  private processing = false;
  private rateLimiter: RateLimiter;
  private retryQueue = getEnrichmentRetryQueue();
  private totalCost = 0;
  private totalTokens = 0;
  private enrichedCount = 0;
  private failedCount = 0;
  private atomicMode = false;

  // Callback for persistence after enrichment completes
  // StorageService will set this to persist enriched memory to IndexedDB
  public onEnrichmentComplete?: (memory: MemoryWithMemA) => Promise<void>;

  // Callback for notifying user of permanent failures
  public onEnrichmentFailed?: (memoryId: string, error: string) => void;

  private retryProcessorInterval: NodeJS.Timeout | null = null;
  private retryProcessorTimeout: NodeJS.Timeout | null = null;

  constructor(private config: EnrichmentConfig) {
    // 60 calls per minute (conservative)
    this.rateLimiter = new RateLimiter(60, 60000);

    // Start retry processor only if chrome.storage is available
    // This prevents issues in test environments
    if (typeof chrome !== 'undefined' && chrome.storage) {
      this.startRetryProcessor();
    }
  }

  /**
   * Set atomic mode - when enabled, onEnrichmentComplete callback won't save
   * (used for single-pass atomic persistence)
   */
  setAtomicMode(enabled: boolean): void {
    this.atomicMode = enabled;
    console.log(`[Enrichment] Atomic mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if atomic mode is enabled
   */
  isAtomicMode(): boolean {
    return this.atomicMode;
  }

  /**
   * Enrich a memory with LLM-generated metadata
   * Non-blocking - adds to queue and returns immediately
   *
   * @param memory Memory to enrich (modified in-place)
   */
  async enrichMemory(memory: MemoryWithMemA): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Enrichment] Disabled, skipping');
      return;
    }

    // Check credentials based on provider
    let hasCredentials = false;
    if ((this.config.provider as string) === 'premium') {
      const client = getPremiumClient();
      hasCredentials = client.isAuthenticated();
    } else if (this.config.provider === 'local') {
      hasCredentials = !!this.config.localEndpoint;
    } else {
      hasCredentials = !!this.config.apiKey;
    }

    if (!hasCredentials) {
      console.warn('[Enrichment] No credentials configured for provider:', this.config.provider);
      return;
    }

    // Add to queue
    this.queue.push(memory);
    console.log(`[Enrichment] Queued memory ${memory.id}, queue size: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue().catch(err => {
        console.error('[Enrichment] Queue processing error:', err);
      });
    }
  }

  /**
   * Wait for the enrichment queue to be empty (all processing complete)
   * Used for testing or when atomic persistence requires enrichment to complete
   */
  async waitForQueue(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.processing || this.queue.length > 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`[Enrichment] Queue processing timeout after ${timeout}ms`);
      }
      // Wait 50ms before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Process enrichment queue
   * Processes memories in batches with rate limiting
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Get batch
        const batch = this.queue.splice(0, this.config.batchSize);
        console.log(`[Enrichment] Processing batch of ${batch.length} memories`);

        // Process batch in parallel
        await Promise.all(
          batch.map(memory => this.enrichSingle(memory))
        );

        // Save progress
        await this.saveCostEstimate();
      }
    } finally {
      this.processing = false;

      // SECURITY: Clear any remaining plaintext from queue
      // Only clear if memories have encrypted content (not in test mode)
      this.queue.forEach(mem => {
        if ((mem as any).encryptedContent && mem.content && mem.content.text !== null) {
          mem.content.text = null as any;
          mem.content.metadata = null as any;
        }
      });

      console.log(`[Enrichment] Queue processing complete, ${this.queue.length} items scrubbed`);
    }
  }

  /**
   * Enrich a single memory
   * On failure, adds to persistent retry queue
   */
  private async enrichSingle(memory: MemoryWithMemA): Promise<void> {
    try {
      await this.rateLimiter.acquire();

      const request: EnrichmentRequest = {
        memoryId: memory.id,
        text: memory.content.text,
        content: memory.content.text,
        platform: memory.platform,
        role: memory.content.role,
        timestamp: memory.timestamp,
      };

      const prompt = this.buildPrompt(request);
      const response = await this.callLLM(prompt);

      // Update memory in-place
      memory.keywords = response.keywords;
      memory.tags = response.tags;
      memory.context = response.context;
      memory.memAVersion = 1;

      // Track enrichment success
      this.enrichedCount++;

      console.log(`[Enrichment] Enriched memory ${memory.id}`, {
        keywords: memory.keywords,
        tags: memory.tags,
        context: memory.context,
      });

      // SECURITY: Clear plaintext from enriched memory
      // Only clear if memory has encrypted content (not in test mode)
      if ((memory as any).encryptedContent) {
        memory.content.text = null as any;
        memory.content.metadata = null as any;
        console.log(`[Enrichment] Cleared plaintext from ${memory.id}`);
      }

      // Remove from retry queue if it was there
      await this.retryQueue.remove(memory.id);

      // Persist enriched memory via callback (if set by StorageService)
      if (this.onEnrichmentComplete) {
        try {
          await this.onEnrichmentComplete(memory);
          console.log(`[Enrichment] Persisted enriched memory ${memory.id}`);
        } catch (persistError) {
          console.error(`[Enrichment] Failed to persist memory ${memory.id}:`, persistError);
          // Don't fail enrichment if persistence fails - memory object still has enriched data
        }
      }

    } catch (error) {
      const err = error as Error;
      console.error(`[Enrichment] Error enriching memory ${memory.id}:`, err);

      // Classify error type
      const errorType = this.classifyError(err);

      // Add to persistent retry queue
      await this.retryQueue.add(memory, err, errorType);

      // Increment failed count
      this.failedCount++;

      // Check if permanently failed
      const permanentlyFailed = await this.retryQueue.getPermanentlyFailed();
      const thisMemoryFailed = permanentlyFailed.find(item => item.memory.id === memory.id);

      if (thisMemoryFailed) {
        console.error(
          `[Enrichment] Memory ${memory.id} permanently failed after max retries`
        );

        // Notify user of permanent failure
        if (this.onEnrichmentFailed) {
          this.onEnrichmentFailed(memory.id, err.message);
        }
      } else {
        const stats = await this.retryQueue.getStats();
        console.log(
          `[Enrichment] Memory ${memory.id} added to retry queue ` +
          `(${stats.pendingRetries} pending retries)`
        );
      }
    }
  }

  /**
   * Classify error type for better retry logic
   */
  private classifyError(error: Error): 'network' | 'authentication' | 'server' | 'timeout' | 'unknown' {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return 'server';
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
      return 'network';
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('401') || message.includes('403') || message.includes('api key')) {
      return 'authentication';
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }

    // Server errors (500, 503, etc.)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return 'server';
    }

    return 'unknown';
  }

  /**
   * Start background retry processor
   * Checks retry queue every 30 seconds
   */
  private startRetryProcessor(): void {
    // Stop any existing processor
    this.stopRetryProcessor();

    // Process retries every 30 seconds
    this.retryProcessorInterval = setInterval(async () => {
      await this.processRetries();
    }, 30000);

    // Initial process after 5 seconds
    this.retryProcessorTimeout = setTimeout(async () => {
      await this.processRetries();
    }, 5000);
  }

  /**
   * Stop background retry processor
   * Useful for cleanup and testing
   */
  stopRetryProcessor(): void {
    if (this.retryProcessorInterval) {
      clearInterval(this.retryProcessorInterval);
      this.retryProcessorInterval = null;
    }

    if (this.retryProcessorTimeout) {
      clearTimeout(this.retryProcessorTimeout);
      this.retryProcessorTimeout = null;
    }
  }

  /**
   * Process items in retry queue that are ready for retry
   */
  private async processRetries(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const readyForRetry = await this.retryQueue.getReadyForRetry();

      if (readyForRetry.length === 0) {
        return;
      }

      console.log(`[Enrichment] Processing ${readyForRetry.length} items from retry queue`);

      // Process retries with rate limiting
      for (const item of readyForRetry) {
        await this.enrichSingle(item.memory);
      }
    } catch (error) {
      console.error('[Enrichment] Error processing retry queue:', error);
    }
  }

  /**
   * Build enrichment prompt for LLM
   *
   * Follows A-MEM paper guidelines for metadata extraction
   */
  private buildPrompt(request: EnrichmentRequest): string {
    return `Analyze this AI conversation message and extract structured metadata.

Message:
Platform: ${request.platform || 'unknown'}
Role: ${request.role || 'user'}
Timestamp: ${request.timestamp ? new Date(request.timestamp).toISOString() : 'unknown'}
Content: ${request.content || request.text}

Extract:
1. Keywords: 3-7 specific, meaningful terms (nouns, verbs, technical concepts)
   - Focus on: domain-specific terminology, key concepts, actionable items
   - Avoid: generic words, speaker names, time references
   - Examples: ["OAuth", "authentication", "JWT", "security"]

2. Tags: 3-5 broad categorical labels
   - Include: domain (programming, business, etc), topic, format
   - Examples: ["web development", "security", "tutorial"]

3. Context: One comprehensive sentence (max 150 chars)
   - Summarize: main topic, key points, purpose/intent
   - Example: "Discussion about implementing OAuth 2.0 authentication in React using JWT tokens"

Return valid JSON only:
{
  "keywords": ["keyword1", "keyword2", ...],
  "tags": ["tag1", "tag2", ...],
  "context": "One sentence summary"
}`;
  }

  /**
   * Call LLM API for enrichment
   * Handles OpenAI, Anthropic, local, and premium providers
   */
  private async callLLM(prompt: string): Promise<EnrichmentResponse> {
    if ((this.config.provider as string) === 'premium') {
      return this.callPremium(prompt);
    } else if (this.config.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else if (this.config.provider === 'anthropic') {
      return this.callAnthropic(prompt);
    } else if (this.config.provider === 'local') {
      return this.callLocal(prompt);
    } else {
      throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  /**
   * Call Premium API
   * Routes enrichment to premium server with LM Studio backend
   */
  private async callPremium(prompt: string): Promise<EnrichmentResponse> {
    const client = getPremiumClient();

    if (!client.isAuthenticated()) {
      throw new Error('Not authenticated with premium API. Please configure your license key in settings.');
    }

    // Extract content from prompt
    // The prompt contains the message content on the line after "Content: "
    // We only want the actual message content, not the extraction instructions
    const contentMatch = prompt.match(/Content: ([^\n]+)/);
    const content = contentMatch ? contentMatch[1].trim() : prompt;

    console.log('[Enrichment] Extracted content for Premium API:', content);

    try {
      const result = await client.enrich(content);

      return {
        keywords: result.keywords,
        tags: result.tags,
        context: result.context,
      };
    } catch (error) {
      console.error('[Enrichment] Premium API error:', error);
      throw new Error(`Premium API enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<EnrichmentResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You extract metadata from text. Respond only with JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    // Track usage
    if (data.usage) {
      this.totalTokens += data.usage.total_tokens;
      this.totalCost += this.calculateOpenAICost(data.usage.total_tokens, this.config.model);
    }

    const content = data.choices[0].message.content;
    return JSON.parse(content) as EnrichmentResponse;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<EnrichmentResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    // Track usage
    if (data.usage) {
      const totalTokens = data.usage.input_tokens + data.usage.output_tokens;
      this.totalTokens += totalTokens;
      this.totalCost += this.calculateAnthropicCost(
        data.usage.input_tokens,
        data.usage.output_tokens,
        this.config.model
      );
    }

    const content = data.content[0].text;

    // Anthropic doesn't have structured output, so parse JSON from text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response');
    }

    return JSON.parse(jsonMatch[0]) as EnrichmentResponse;
  }

  /**
   * Call local model (OpenAI-compatible endpoint)
   * Works with Ollama, LM Studio, LocalAI, etc.
   */
  private async callLocal(prompt: string): Promise<EnrichmentResponse> {
    if (!this.config.localEndpoint) {
      throw new Error('Local endpoint not configured');
    }

    // Ensure endpoint ends with /chat/completions for OpenAI compatibility
    let endpoint = this.config.localEndpoint.trim();
    if (!endpoint.endsWith('/chat/completions')) {
      // If endpoint is like http://localhost:11434/v1, append /chat/completions
      if (endpoint.endsWith('/v1')) {
        endpoint = `${endpoint}/chat/completions`;
      } else if (endpoint.endsWith('/')) {
        endpoint = `${endpoint}v1/chat/completions`;
      } else {
        endpoint = `${endpoint}/v1/chat/completions`;
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'llama3.2',
        messages: [
          {
            role: 'system',
            content: 'You extract metadata from text. Respond only with JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local model API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    // Local models don't have usage tracking, so we don't update costs
    // The response format should match OpenAI's structure
    const content = data.choices[0].message.content;

    // Try to parse JSON from the response
    try {
      return JSON.parse(content) as EnrichmentResponse;
    } catch {
      // If not valid JSON, try to extract JSON from text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in local model response');
      }
      return JSON.parse(jsonMatch[0]) as EnrichmentResponse;
    }
  }

  /**
   * Calculate OpenAI API cost
   * Prices as of December 2025
   */
  private calculateOpenAICost(tokens: number, model: string): number {
    const prices: Record<string, number> = {
      'gpt-4o-mini': 0.00000015, // $0.150 per 1M tokens
      'gpt-4o': 0.0000025, // $2.50 per 1M tokens
    };

    const pricePerToken = prices[model] || prices['gpt-4o-mini'];
    return tokens * pricePerToken;
  }

  /**
   * Calculate Anthropic API cost
   * Prices as of December 2025
   */
  private calculateAnthropicCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): number {
    const prices: Record<string, { input: number; output: number }> = {
      'claude-3-haiku-20240307': {
        input: 0.00000025, // $0.25 per 1M input tokens
        output: 0.00000125, // $1.25 per 1M output tokens
      },
      'claude-3-5-sonnet-20241022': {
        input: 0.000003, // $3 per 1M input tokens
        output: 0.000015, // $15 per 1M output tokens
      },
    };

    const price = prices[model] || prices['claude-3-haiku-20240307'];
    return (inputTokens * price.input) + (outputTokens * price.output);
  }

  /**
   * Save cost estimate to storage
   */
  private async saveCostEstimate(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          memACosts: {
            estimatedCost: this.totalCost,
            totalTokens: this.totalTokens,
            lastUpdated: Date.now(),
          },
        });
      }
    } catch (error) {
      console.error('[Enrichment] Failed to save cost estimate:', error);
    }
  }

  /**
   * Get current cost estimate
   */
  getCostEstimate(): { cost: number; tokens: number } {
    return {
      cost: this.totalCost,
      tokens: this.totalTokens,
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { size: number; processing: boolean } {
    return {
      size: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * Get enrichment statistics
   */
  async getStats(): Promise<{
    totalTokens: number;
    totalCost: number;
    enrichedCount: number;
    failedCount: number;
    retryQueue: {
      totalItems: number;
      pendingRetries: number;
      failedPermanently: number;
    };
  }> {
    const retryStats = await this.retryQueue.getStats();

    return {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      enrichedCount: this.enrichedCount,
      failedCount: this.failedCount,
      retryQueue: {
        totalItems: retryStats.totalItems,
        pendingRetries: retryStats.pendingRetries,
        failedPermanently: retryStats.failedPermanently,
      },
    };
  }

  /**
   * Get retry queue for manual inspection/management
   */
  getRetryQueue() {
    return this.retryQueue;
  }

  /**
   * Reset enrichment statistics
   */
  async resetStats(): Promise<void> {
    this.totalTokens = 0;
    this.totalCost = 0;
    this.enrichedCount = 0;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove('memACosts');
      }
    } catch (error) {
      console.error('[Enrichment] Failed to reset stats:', error);
    }
  }
}

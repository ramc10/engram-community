/**
 * Evolution Service
 *
 * Manages LLM-based evolution of memory metadata based on new information.
 *
 * **Phase 3: Memory Evolution**
 * - Detects when historical memories should update their metadata
 * - Tracks evolution history (last 10 versions)
 * - Supports rollback to any previous version
 * - Rate limiting and cost tracking
 *
 * **Evolution Criteria:**
 * - Conservative: only evolve if meaningful improvement
 * - Preserve original intent
 * - Add value, don't replace
 * - User can always revert
 *
 * **Algorithm:**
 * 1. New memory saved with links to existing memories
 * 2. Check each linked memory for evolution opportunity
 * 3. LLM decides if evolution warranted (conservative threshold)
 * 4. If yes, save current state to history and update metadata
 * 5. Regenerate embedding for evolved memory
 */

import type { EnrichmentConfig, MemoryWithMemA, EvolutionCheckRequest, EvolutionCheckResponse, EvolutionHistoryEntry, UUID } from '@engram/core';
import { getPremiumClient } from './premium-api-client';

/**
 * Evolution statistics for monitoring
 */
export interface EvolutionStats {
  evolutionsApplied: number;
  checksPerformed: number;
  totalCost: number;
  totalTokens: number;
  avgEvolutionsPerCheck: number;
}

/**
 * Rate Limiter for controlling API calls
 * Same pattern as EnrichmentService and LinkDetectionService
 */
class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxCalls: number,
    private timeWindowMs: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove timestamps outside the time window
    this.timestamps = this.timestamps.filter(
      ts => now - ts < this.timeWindowMs
    );

    // If at limit, wait until oldest call expires
    if (this.timestamps.length >= this.maxCalls) {
      const oldestCall = this.timestamps[0];
      const waitTime = this.timeWindowMs - (now - oldestCall) + 100; // +100ms buffer

      console.log(`[Evolution] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Retry after waiting
      return this.acquire();
    }

    // Record this call
    this.timestamps.push(now);
  }
}

/**
 * Evolution Service
 *
 * Follows the same pattern as EnrichmentService and LinkDetectionService
 */
export class EvolutionService {
  private rateLimiter: RateLimiter;
  private totalCost = 0;
  private totalTokens = 0;
  private evolutionsApplied = 0;
  private checksPerformed = 0;
  private currentTargetMemory: MemoryWithMemA | null = null;
  private currentNewMemory: MemoryWithMemA | null = null;

  constructor(private config: EnrichmentConfig) {
    // 60 calls per minute (same as other services)
    this.rateLimiter = new RateLimiter(60, 60000);
    console.log(`[Evolution] Initialized with provider: ${config.provider}, model: ${config.model}`);
  }

  /**
   * Check if a memory should evolve based on new information
   *
   * Algorithm:
   * 1. Compare current memory state vs new memory that links to it
   * 2. LLM decides if evolution is warranted
   * 3. If yes, provides updated keywords/tags/context
   *
   * @param targetMemory Memory to potentially evolve
   * @param newMemory New memory that might trigger evolution
   * @returns Evolution check response (shouldEvolve, updated metadata, reason)
   */
  async checkEvolution(
    targetMemory: MemoryWithMemA,
    newMemory: MemoryWithMemA
  ): Promise<EvolutionCheckResponse> {
    if (!this.config.enabled) {
      return { shouldEvolve: false, reason: 'Evolution disabled' };
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
      return { shouldEvolve: false, reason: 'No credentials configured' };
    }

    try {
      await this.rateLimiter.acquire();
      this.checksPerformed++;

      const request: EvolutionCheckRequest = {
        targetMemoryId: targetMemory.id,
        newMemoryId: newMemory.id,
        currentKeywords: targetMemory.keywords || [],
        currentTags: targetMemory.tags || [],
        currentContext: targetMemory.context || '',
      };

      // Store memories for premium provider to access
      this.currentTargetMemory = targetMemory;
      this.currentNewMemory = newMemory;

      const prompt = this.buildEvolutionPrompt(targetMemory, newMemory, request);
      const response = await this.callLLM(prompt);

      console.log(`[Evolution] Check result for ${targetMemory.id}: shouldEvolve=${response.shouldEvolve}, reason="${response.reason}"`);

      return response;

    } catch (error) {
      console.error(`[Evolution] Error checking evolution for ${targetMemory.id}:`, error);
      return { shouldEvolve: false, reason: 'Error during evolution check' };
    }
  }

  /**
   * Apply evolution to a memory
   *
   * 1. Save current state to history
   * 2. Update keywords/tags/context
   * 3. Record evolution metadata
   * 4. Maintain max 10 historical versions
   *
   * @param memory Memory to evolve
   * @param evolution Updated metadata from LLM
   * @param triggeredBy ID of memory that triggered this evolution
   */
  async applyEvolution(
    memory: MemoryWithMemA,
    evolution: EvolutionCheckResponse,
    triggeredBy: UUID
  ): Promise<void> {
    if (!evolution.shouldEvolve) {
      return;
    }

    // Initialize evolution metadata if needed
    if (!memory.evolution) {
      memory.evolution = {
        updateCount: 0,
        lastUpdated: Date.now(),
        triggeredBy: [],
        history: [],
      };
    }

    // Save current state to history BEFORE updating
    const historyEntry: EvolutionHistoryEntry = {
      keywords: memory.keywords || [],
      tags: memory.tags || [],
      context: memory.context || '',
      timestamp: Date.now(),
    };

    memory.evolution.history.push(historyEntry);

    // Maintain max 10 versions (keep most recent)
    if (memory.evolution.history.length > 10) {
      memory.evolution.history = memory.evolution.history.slice(-10);
    }

    // Update metadata with evolved values
    memory.keywords = evolution.keywords || memory.keywords;
    memory.tags = evolution.tags || memory.tags;
    memory.context = evolution.context || memory.context;

    // Update evolution tracking
    memory.evolution.updateCount++;
    memory.evolution.lastUpdated = Date.now();
    memory.evolution.triggeredBy.push(triggeredBy);

    // Keep last 10 trigger IDs
    if (memory.evolution.triggeredBy.length > 10) {
      memory.evolution.triggeredBy = memory.evolution.triggeredBy.slice(-10);
    }

    this.evolutionsApplied++;

    console.log(`[Evolution] Applied evolution to memory ${memory.id} (triggered by ${triggeredBy})`);
    console.log(`[Evolution] New metadata - keywords: ${evolution.keywords?.join(', ')}, tags: ${evolution.tags?.join(', ')}`);
  }

  /**
   * Revert memory to a previous version
   *
   * @param memory Memory to revert
   * @param versionIndex Index in history array (0 = oldest, -1 = most recent)
   * @returns true if reverted successfully
   */
  async revertEvolution(
    memory: MemoryWithMemA,
    versionIndex: number
  ): Promise<boolean> {
    if (!memory.evolution || memory.evolution.history.length === 0) {
      console.warn(`[Evolution] No history to revert for memory ${memory.id}`);
      return false;
    }

    // Handle negative indices (Python-style)
    const actualIndex = versionIndex < 0
      ? memory.evolution.history.length + versionIndex
      : versionIndex;

    if (actualIndex < 0 || actualIndex >= memory.evolution.history.length) {
      console.warn(`[Evolution] Invalid version index ${versionIndex} for memory ${memory.id}`);
      return false;
    }

    const targetVersion = memory.evolution.history[actualIndex];

    // Save current state before reverting (in case user wants to undo revert)
    const currentState: EvolutionHistoryEntry = {
      keywords: memory.keywords || [],
      tags: memory.tags || [],
      context: memory.context || '',
      timestamp: Date.now(),
    };

    // Revert to target version
    memory.keywords = targetVersion.keywords;
    memory.tags = targetVersion.tags;
    memory.context = targetVersion.context;

    // Update evolution metadata
    memory.evolution.lastUpdated = Date.now();

    // Add current state to history (before revert) to make it reversible
    memory.evolution.history.push(currentState);
    if (memory.evolution.history.length > 10) {
      memory.evolution.history = memory.evolution.history.slice(-10);
    }

    console.log(`[Evolution] Reverted memory ${memory.id} to version ${versionIndex} (${new Date(targetVersion.timestamp).toISOString()})`);
    return true;
  }

  /**
   * Build evolution check prompt for LLM
   *
   * Asks LLM to compare current state vs new information
   * and decide if metadata should be updated
   */
  private buildEvolutionPrompt(
    targetMemory: MemoryWithMemA,
    newMemory: MemoryWithMemA,
    request: EvolutionCheckRequest
  ): string {
    return `Analyze if a historical memory should update its metadata based on new information.

TARGET MEMORY (existing):
Content: ${targetMemory.content.text}
Current Keywords: ${request.currentKeywords.join(', ')}
Current Tags: ${request.currentTags.join(', ')}
Current Context: ${request.currentContext}
Created: ${new Date(targetMemory.timestamp).toISOString()}

NEW MEMORY (just captured):
Content: ${newMemory.content.text}
Keywords: ${newMemory.keywords?.join(', ') || 'none'}
Tags: ${newMemory.tags?.join(', ') || 'none'}
Context: ${newMemory.context || 'none'}
Created: ${new Date(newMemory.timestamp).toISOString()}

EVOLUTION CRITERIA:
Should the target memory evolve? Consider:
1. Does the new memory provide additional context or clarification?
2. Does it reveal new relationships or dependencies?
3. Does it add important details that enhance understanding?
4. Would updating the target memory improve future search/retrieval?

IMPORTANT:
- Only evolve if there's meaningful new information
- Don't evolve for tangentially related content
- Keep the original meaning intact
- Evolution should ADD value, not replace the original intent
- Be conservative - when in doubt, don't evolve

If evolution is warranted, provide:
- Updated keywords (merge existing + new insights, 3-7 terms total)
- Updated tags (broad categories, 3-5 tags total)
- Updated context (one comprehensive sentence, max 150 chars)
- Clear reason explaining why evolution improves the memory (max 100 chars)

Return valid JSON only:
{
  "shouldEvolve": true|false,
  "keywords": ["keyword1", "keyword2", ...],  // only if shouldEvolve=true
  "tags": ["tag1", "tag2", ...],              // only if shouldEvolve=true
  "context": "Enhanced one sentence summary", // only if shouldEvolve=true
  "reason": "Explanation of decision (max 100 chars)"
}`;
  }

  /**
   * Call LLM API (OpenAI/Anthropic/Local/Premium)
   * Same pattern as EnrichmentService and LinkDetectionService
   */
  private async callLLM(prompt: string): Promise<EvolutionCheckResponse> {
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
   * Routes evolution check to premium server with LM Studio backend
   */
  private async callPremium(_prompt: string): Promise<EvolutionCheckResponse> {
    const client = getPremiumClient();

    if (!client.isAuthenticated()) {
      throw new Error('Not authenticated with premium API. Please configure your license key in settings.');
    }

    if (!this.currentTargetMemory || !this.currentNewMemory) {
      throw new Error('No current memories available for premium API call');
    }

    try {
      const memory = {
        id: this.currentTargetMemory.id,
        content: this.currentTargetMemory.content.text,
        timestamp: this.currentTargetMemory.timestamp,
      } as any;

      const newInformation = this.currentNewMemory.content.text;

      const result = await client.checkEvolution(memory, newInformation);

      return {
        shouldEvolve: result.shouldEvolve,
        keywords: result.updatedContent ? undefined : (result as any).keywords,
        tags: result.updatedContent ? undefined : (result as any).tags,
        context: result.updatedContent || (result as any).context,
        reason: result.reason,
      };
    } catch (error) {
      console.error('[Evolution] Premium API error:', error);
      throw new Error(`Premium API evolution check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<EvolutionCheckResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing relationships between pieces of information and determining when historical data should be updated. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Deterministic output
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Track cost
    const tokens = data.usage.total_tokens;
    this.totalTokens += tokens;
    this.totalCost += this.calculateOpenAICost(tokens, this.config.model || 'gpt-4o-mini');

    return JSON.parse(content);
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<EvolutionCheckResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nRespond only with valid JSON.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Track cost
    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;
    this.totalTokens += inputTokens + outputTokens;
    this.totalCost += this.calculateAnthropicCost(
      inputTokens,
      outputTokens,
      this.config.model || 'claude-3-haiku-20240307'
    );

    // Extract JSON from response (Anthropic may wrap it in text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Call local model (OpenAI-compatible endpoint)
   */
  private async callLocal(prompt: string): Promise<EvolutionCheckResponse> {
    const endpoint = this.config.localEndpoint || 'http://localhost:11434/v1';
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'llama3.2',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing relationships between pieces of information and determining when historical data should be updated. Respond only with valid JSON.',
          },
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
      throw new Error(`Local model API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Try to parse directly first
    try {
      return JSON.parse(content);
    } catch {
      // Extract JSON from response (local models may wrap it in text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in local model response');
      }
      return JSON.parse(jsonMatch[0]);
    }
  }

  /**
   * Calculate OpenAI cost
   */
  private calculateOpenAICost(tokens: number, model: string): number {
    const prices: Record<string, number> = {
      'gpt-4o-mini': 0.00000015,  // $0.150 per 1M tokens
      'gpt-4o': 0.0000025,         // $2.50 per 1M tokens
    };

    const pricePerToken = prices[model] || prices['gpt-4o-mini'];
    return tokens * pricePerToken;
  }

  /**
   * Calculate Anthropic cost
   */
  private calculateAnthropicCost(inputTokens: number, outputTokens: number, model: string): number {
    const prices: Record<string, { input: number; output: number }> = {
      'claude-3-haiku-20240307': {
        input: 0.00000025,   // $0.25 per 1M input tokens
        output: 0.00000125,  // $1.25 per 1M output tokens
      },
      'claude-3-5-sonnet-20241022': {
        input: 0.000003,     // $3 per 1M input tokens
        output: 0.000015,    // $15 per 1M output tokens
      },
    };

    const price = prices[model] || prices['claude-3-haiku-20240307'];
    return (inputTokens * price.input) + (outputTokens * price.output);
  }

  /**
   * Get evolution statistics
   */
  getStats(): EvolutionStats {
    return {
      evolutionsApplied: this.evolutionsApplied,
      checksPerformed: this.checksPerformed,
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      avgEvolutionsPerCheck: this.checksPerformed > 0
        ? this.evolutionsApplied / this.checksPerformed
        : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalCost = 0;
    this.totalTokens = 0;
    this.evolutionsApplied = 0;
    this.checksPerformed = 0;
    console.log('[Evolution] Stats reset');
  }
}

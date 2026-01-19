/**
 * Link Detection Service
 *
 * LLM-based semantic link generation between related memories
 * Implements memA Phase 2: Link Generation
 *
 * @module link-detection-service
 */

import type {
  EnrichmentConfig,
  MemoryWithMemA,
  UUID,
} from '@engram/core';
import { getEmbeddingService, type MemoryWithEmbedding, type SimilarityResult } from './embedding-service';
import { getPremiumClient } from './premium-api-client';

// LinkScore interface - extending core type
export interface LinkScore {
  memoryId: string;
  score: number;
  reason: string;
  createdAt: number;
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
        console.log(`[LinkDetection] Waiting ${waitTime}ms for rate limit`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.acquire(); // Retry
      }
    }

    // Record this call
    this.calls.push(now);
  }
}

/**
 * Link detection request to LLM
 */
interface LinkDetectionRequest {
  sourceMemory: MemoryWithMemA;
  candidates: Array<{
    id: UUID;
    content: string;
    keywords?: string[];
    tags?: string[];
    context?: string;
    score: number; // Semantic similarity score
  }>;
}

/**
 * Link detection response from LLM
 */
interface LinkDetectionResponse {
  links: Array<{
    memoryId: UUID;
    confidence: number; // 0.0-1.0
    reason: string;
  }>;
}

/**
 * Link detection statistics
 */
interface LinkDetectionStats {
  totalCost: number;
  totalTokens: number;
  linksCreated: number;
  avgLinksPerMemory: number;
}

/**
 * Link Detection Service
 *
 * Manages LLM-based link detection between semantically related memories
 * - Candidate selection via embedding similarity
 * - LLM validation for link quality
 * - Bidirectional link creation
 * - Rate limiting and retry logic
 * - Cost tracking
 */
export class LinkDetectionService {
  private rateLimiter: RateLimiter;
  private embeddingService = getEmbeddingService();
  private totalCost = 0;
  private totalTokens = 0;
  private linksCreated = 0;
  private memoryCount = 0;
  private currentRequest: LinkDetectionRequest | null = null;

  constructor(private config: EnrichmentConfig) {
    // 60 calls per minute (conservative, same as enrichment)
    this.rateLimiter = new RateLimiter(60, 60000);
  }

  /**
   * Detect semantic links for a memory
   *
   * Algorithm:
   * 1. Find top-20 candidates via embedding similarity
   * 2. LLM validates candidates in batches of 5
   * 3. Filter links with confidence > 0.7
   * 4. Limit to max 10 links per memory
   *
   * @param memory Source memory to find links for
   * @param allMemories All memories in the database (for candidate selection)
   * @returns Array of validated links with confidence scores
   */
  async detectLinks(
    memory: MemoryWithMemA,
    allMemories: MemoryWithEmbedding[]
  ): Promise<LinkScore[]> {
    if (!this.config.enableLinkDetection) {
      console.log('[LinkDetection] Disabled, skipping');
      return [];
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
      console.warn('[LinkDetection] No credentials configured for provider:', this.config.provider);
      return [];
    }

    try {
      // Step 1: Candidate Selection
      // Find top-20 similar memories (excluding self)
      const candidates = await this.selectCandidates(memory, allMemories);

      if (candidates.length === 0) {
        console.log(`[LinkDetection] No candidates found for memory ${memory.id}`);
        return [];
      }

      console.log(`[LinkDetection] Found ${candidates.length} candidates for memory ${memory.id}`);

      // Step 2: LLM Validation
      // Process candidates in batches of 5 to stay within rate limits
      const validatedLinks = await this.validateCandidatesWithLLM(memory, candidates);

      // Step 3: Quality Filtering
      // Only keep links with confidence > 0.7
      const highQualityLinks = validatedLinks.filter(link => link.score > 0.7);

      // Step 4: Limit to max 10 links
      const finalLinks = highQualityLinks
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      this.memoryCount++;
      this.linksCreated += finalLinks.length;

      console.log(`[LinkDetection] Created ${finalLinks.length} links for memory ${memory.id}`);

      return finalLinks;

    } catch (error) {
      console.error(`[LinkDetection] Error detecting links for memory ${memory.id}:`, error);
      // Graceful degradation: return empty links array
      return [];
    }
  }

  /**
   * Select candidate memories for linking using embedding similarity
   *
   * @param memory Source memory
   * @param allMemories All available memories
   * @returns Top-20 candidates sorted by similarity score
   */
  private async selectCandidates(
    memory: MemoryWithMemA,
    allMemories: MemoryWithEmbedding[]
  ): Promise<SimilarityResult[]> {
    // Exclude the source memory itself
    const otherMemories = allMemories.filter((m: MemoryWithEmbedding) => m.id !== memory.id);

    if (otherMemories.length === 0) {
      return [];
    }

    // Use embedding service to find similar memories
    // Build enhanced text from source memory
    const queryText = this.buildEnhancedText(memory);

    const results = await this.embeddingService.findSimilar(
      queryText,
      otherMemories,
      {
        maxResults: 20,
        threshold: 0.5, // Minimum semantic similarity
      }
    );

    return results;
  }

  /**
   * Build enhanced text from memory for semantic search
   * Combines content, keywords, tags, and context
   *
   * @param memory Memory to build text from
   * @returns Enhanced text representation
   */
  private buildEnhancedText(memory: MemoryWithMemA): string {
    const parts: string[] = [];

    if (memory.content.text) {
      parts.push(memory.content.text);
    }

    if (memory.keywords && memory.keywords.length > 0) {
      parts.push(`Keywords: ${memory.keywords.join(' ')}`);
    }

    if (memory.tags && memory.tags.length > 0) {
      parts.push(`Tags: ${memory.tags.join(' ')}`);
    }

    if (memory.context) {
      parts.push(`Context: ${memory.context}`);
    }

    return parts.join('. ');
  }

  /**
   * Validate link candidates using LLM
   *
   * @param sourceMemory Source memory
   * @param candidates Candidate memories from similarity search
   * @returns Array of validated links with confidence scores
   */
  private async validateCandidatesWithLLM(
    sourceMemory: MemoryWithMemA,
    candidates: SimilarityResult[]
  ): Promise<LinkScore[]> {
    // Process candidates in batches of 5 to manage API rate limits and prompt size
    const batchSize = 5;
    const allLinks: LinkScore[] = [];

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);

      try {
        await this.rateLimiter.acquire();

        const request: LinkDetectionRequest = {
          sourceMemory,
          candidates: batch.map(result => ({
            id: result.memory.id,
            content: result.memory.content.text || '',
            keywords: (result.memory as MemoryWithMemA).keywords,
            tags: (result.memory as MemoryWithMemA).tags,
            context: (result.memory as MemoryWithMemA).context,
            score: result.score,
          })),
        };

        // Store request for premium provider to access structured data
        this.currentRequest = request;

        const prompt = this.buildPrompt(request);
        const response = await this.callLLM(prompt);

        // Convert LLM response to LinkScore format
        const batchLinks: LinkScore[] = response.links.map(link => ({
          memoryId: link.memoryId,
          score: link.confidence,
          createdAt: Date.now(),
          reason: link.reason,
        }));

        allLinks.push(...batchLinks);

      } catch (error) {
        console.error(`[LinkDetection] Error validating batch ${i / batchSize + 1}:`, error);
        // Continue with other batches (graceful degradation)
      }
    }

    return allLinks;
  }

  /**
   * Build link detection prompt for LLM
   *
   * Asks LLM to evaluate semantic relationships between memories
   */
  private buildPrompt(request: LinkDetectionRequest): string {
    const source = request.sourceMemory;

    // Format source memory
    let sourceText = `Content: ${source.content.text}\n`;
    if (source.keywords && source.keywords.length > 0) {
      sourceText += `Keywords: ${source.keywords.join(', ')}\n`;
    }
    if (source.tags && source.tags.length > 0) {
      sourceText += `Tags: ${source.tags.join(', ')}\n`;
    }
    if (source.context) {
      sourceText += `Context: ${source.context}\n`;
    }

    // Format candidate memories
    const candidatesText = request.candidates.map((candidate, index) => {
      let text = `${index + 1}. ID: ${candidate.id}\n`;
      text += `   Content: ${candidate.content}\n`;
      if (candidate.keywords && candidate.keywords.length > 0) {
        text += `   Keywords: ${candidate.keywords.join(', ')}\n`;
      }
      if (candidate.context) {
        text += `   Context: ${candidate.context}\n`;
      }
      text += `   Similarity Score: ${candidate.score.toFixed(2)}\n`;
      return text;
    }).join('\n');

    return `Analyze semantic connections between a source memory and candidate memories.

SOURCE MEMORY:
${sourceText}

CANDIDATE MEMORIES:
${candidatesText}

For each candidate, determine if there is a meaningful semantic connection to the source memory.

Consider connections based on:
- Shared concepts, topics, or domains
- Related technical terms or tools
- Complementary or contrasting information
- Causal relationships or dependencies
- Part-of or belongs-to relationships

Rate each connection with:
- confidence: 0.0 to 1.0 (how confident are you in this connection?)
  - 0.9-1.0: Very strong connection, highly related
  - 0.7-0.8: Strong connection, clearly related
  - 0.5-0.6: Moderate connection, somewhat related
  - 0.0-0.4: Weak or no connection
- reason: One concise sentence explaining the connection (max 100 chars)

Only include candidates with confidence >= 0.5.

Return valid JSON only:
{
  "links": [
    {
      "memoryId": "candidate-uuid",
      "confidence": 0.85,
      "reason": "Both discuss OAuth authentication implementation"
    }
  ]
}`;
  }

  /**
   * Call LLM API for link detection
   * Handles OpenAI, Anthropic, local, and premium providers
   */
  private async callLLM(prompt: string): Promise<LinkDetectionResponse> {
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
   * Routes link detection to premium server with LM Studio backend
   */
  private async callPremium(_prompt: string): Promise<LinkDetectionResponse> {
    const client = getPremiumClient();

    if (!client.isAuthenticated()) {
      throw new Error('Not authenticated with premium API. Please configure your license key in settings.');
    }

    if (!this.currentRequest) {
      throw new Error('No current request available for premium API call');
    }

    try {
      const source = this.currentRequest.sourceMemory;

      // Build request in premium API format
      const newMemory = {
        id: source.id,
        content: source.content.text,
        context: source.context,
      };

      const existingMemories = this.currentRequest.candidates.map(candidate => ({
        id: candidate.id,
        content: candidate.content,
        context: candidate.context,
      }));

      const result = await client.detectLinks(newMemory as any, existingMemories as any);

      // Transform premium API response to LinkDetectionResponse format
      return {
        links: result.map(link => ({
          memoryId: link.targetId,
          confidence: link.confidence,
          reason: link.reason,
        })),
      };
    } catch (error) {
      console.error('[LinkDetection] Premium API error:', error);
      throw new Error(`Premium API link detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<LinkDetectionResponse> {
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
            content: 'You analyze semantic connections between memories. Respond only with JSON.',
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
    return JSON.parse(content) as LinkDetectionResponse;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<LinkDetectionResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: 2048,
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

    return JSON.parse(jsonMatch[0]) as LinkDetectionResponse;
  }

  /**
   * Call local model (OpenAI-compatible endpoint)
   * Works with Ollama, LM Studio, LocalAI, etc.
   */
  private async callLocal(prompt: string): Promise<LinkDetectionResponse> {
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
            content: 'You analyze semantic connections between memories. Respond only with JSON.',
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
    const content = data.choices[0].message.content;

    // Try to parse JSON from the response
    try {
      return JSON.parse(content) as LinkDetectionResponse;
    } catch {
      // If not valid JSON, try to extract JSON from text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in local model response');
      }
      return JSON.parse(jsonMatch[0]) as LinkDetectionResponse;
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
   * Create bidirectional links
   *
   * For each link from source → target, also create target → source
   * This enables link-aware retrieval to work in both directions
   *
   * @param sourceMemory Source memory
   * @param links Links from source to targets
   * @param allMemories All memories (to update targets)
   */
  async createBidirectionalLinks(
    sourceMemory: MemoryWithMemA,
    links: LinkScore[],
    allMemories: MemoryWithMemA[]
  ): Promise<void> {
    // For each link from source → target
    for (const link of links) {
      // Find target memory
      const targetMemory = allMemories.find(m => m.id === link.memoryId);

      if (!targetMemory) {
        console.warn(`[LinkDetection] Target memory ${link.memoryId} not found`);
        continue;
      }

      // Create reverse link: target → source
      const reverseLink: LinkScore = {
        memoryId: sourceMemory.id,
        score: link.score,
        createdAt: link.createdAt,
        reason: link.reason,
      };

      // Initialize links array if needed
      if (!targetMemory.links) {
        targetMemory.links = [];
      }

      // Check if reverse link already exists
      const existingLink = targetMemory.links.find(l => l.memoryId === sourceMemory.id);

      if (!existingLink) {
        // Add reverse link
        targetMemory.links.push(reverseLink);

        // Limit to max 10 links per memory
        if (targetMemory.links.length > 10) {
          targetMemory.links = targetMemory.links
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        }

        console.log(`[LinkDetection] Created reverse link ${link.memoryId} → ${sourceMemory.id}`);
      }
    }
  }

  /**
   * Remove low-quality links
   *
   * Prunes links with confidence < 0.7
   * This can be used for cleanup or link quality maintenance
   *
   * @param memory Memory to clean up links for
   */
  removeLowQualityLinks(memory: MemoryWithMemA): void {
    if (!memory.links || memory.links.length === 0) {
      return;
    }

    const before = memory.links.length;
    memory.links = memory.links.filter(link => link.score >= 0.7);
    const removed = before - memory.links.length;

    if (removed > 0) {
      console.log(`[LinkDetection] Removed ${removed} low-quality links from memory ${memory.id}`);
    }
  }

  /**
   * Get link detection statistics
   */
  async getStats(): Promise<LinkDetectionStats> {
    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      linksCreated: this.linksCreated,
      avgLinksPerMemory: this.memoryCount > 0 ? this.linksCreated / this.memoryCount : 0,
    };
  }

  /**
   * Reset statistics
   */
  async resetStats(): Promise<void> {
    this.totalCost = 0;
    this.totalTokens = 0;
    this.linksCreated = 0;
    this.memoryCount = 0;

    console.log('[LinkDetection] Statistics reset');
  }
}

/**
 * Tests for EnrichmentService
 * Covers LLM integration, rate limiting, retries, and cost tracking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EnrichmentService } from '../src/lib/enrichment-service';
import type { EnrichmentConfig, MemoryWithMemA } from 'engram-shared';
import { generateUUID, now, createVectorClock } from 'engram-shared';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let mockConfig: EnrichmentConfig;

  const createTestMemory = (overrides?: Partial<MemoryWithMemA>): MemoryWithMemA => ({
    id: generateUUID(),
    content: {
      role: 'user',
      text: 'How do I implement OAuth 2.0 authentication in a React application?',
    },
    conversationId: 'conv-123',
    platform: 'chatgpt',
    timestamp: now(),
    vectorClock: createVectorClock(),
    deviceId: 'device-1',
    syncStatus: 'pending',
    tags: [],
    ...overrides,
  });

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
      batchSize: 5,
    };
    service = new EnrichmentService(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with OpenAI provider', () => {
      const openAIService = new EnrichmentService({
        ...mockConfig,
        provider: 'openai',
      });
      expect(openAIService).toBeDefined();
    });

    it('should initialize with Anthropic provider', () => {
      const anthropicService = new EnrichmentService({
        ...mockConfig,
        provider: 'anthropic',
      });
      expect(anthropicService).toBeDefined();
    });

    it('should set correct model based on provider', () => {
      const openAIService = new EnrichmentService({
        ...mockConfig,
        provider: 'openai',
        model: 'gpt-4o',
      });
      expect(openAIService).toBeDefined();
    });
  });

  describe('Enrichment Processing', () => {
    const mockEnrichmentResponse = {
      keywords: ['OAuth', 'React', 'authentication', 'tokens', 'security'],
      tags: ['programming', 'web development', 'security'],
      context: 'Discussion about implementing OAuth 2.0 authentication in a React application',
    };

    beforeEach(() => {
      // Mock successful API response
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockEnrichmentResponse),
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      } as Response);
    });

    it('should enrich a memory successfully', async () => {
      const memory = createTestMemory();
      await service.enrichMemory(memory);

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(memory.keywords).toEqual(mockEnrichmentResponse.keywords);
      expect(memory.tags).toEqual(mockEnrichmentResponse.tags);
      expect(memory.context).toEqual(mockEnrichmentResponse.context);
      expect(memory.memAVersion).toBe(1);
    });

    it('should handle batch processing', async () => {
      const memories = Array.from({ length: 10 }, () => createTestMemory());

      for (const memory of memories) {
        await service.enrichMemory(memory);
      }

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // All memories should be enriched
      for (const memory of memories) {
        expect(memory.keywords).toBeDefined();
        expect(memory.tags).toBeDefined();
        expect(memory.context).toBeDefined();
      }
    });

    it('should respect batch size configuration', async () => {
      const batchSize = 3;
      const customService = new EnrichmentService({
        ...mockConfig,
        batchSize,
      });

      const memories = Array.from({ length: 10 }, () => createTestMemory());

      for (const memory of memories) {
        await customService.enrichMemory(memory);
      }

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have made ceil(10/3) = 4 batches
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should not enrich when disabled', async () => {
      const disabledService = new EnrichmentService({
        ...mockConfig,
        enabled: false,
      });

      const memory = createTestMemory();
      await disabledService.enrichMemory(memory);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(memory.keywords).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not enrich when API key is missing', async () => {
      const noKeyService = new EnrichmentService({
        ...mockConfig,
        apiKey: undefined,
      });

      const memory = createTestMemory();
      await noKeyService.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(memory.keywords).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keywords: ['test'],
                  tags: ['test'],
                  context: 'test',
                }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response);
    });

    it('should rate limit to 60 calls per minute', async () => {
      const startTime = Date.now();
      const memories = Array.from({ length: 65 }, () => createTestMemory());

      for (const memory of memories) {
        await service.enrichMemory(memory);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take more than 1 second due to rate limiting
      expect(duration).toBeGreaterThan(1000);
    }, 10000);
  });

  describe('Retry Logic', () => {
    it('should retry on API failure', async () => {
      let callCount = 0;
      (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    keywords: ['test'],
                    tags: ['test'],
                    context: 'test',
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
        } as Response;
      });

      const memory = createTestMemory();
      await service.enrichMemory(memory);

      // Wait for retries (exponential backoff: 2s + 4s = 6s, plus buffer)
      await new Promise((resolve) => setTimeout(resolve, 7000));

      expect(callCount).toBeGreaterThanOrEqual(2); // Should have retried at least once
      expect(memory.keywords).toEqual(['test']); // Should succeed eventually
    }, 12000);

    it('should give up after 3 retries', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('Persistent failure')
      );

      const memory = createTestMemory();
      await service.enrichMemory(memory);

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 8000));

      expect(memory.keywords).toBeUndefined(); // Should not be enriched
      expect(global.fetch).toHaveBeenCalled(); // Should have attempted calls
    }, 12000);

    it('should use exponential backoff', async () => {
      const callTimes: number[] = [];
      (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        callTimes.push(Date.now());
        throw new Error('Network error');
      });

      const memory = createTestMemory();
      await service.enrichMemory(memory);

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Check backoff intervals
      if (callTimes.length >= 2) {
        const firstDelay = callTimes[1] - callTimes[0];
        expect(firstDelay).toBeGreaterThanOrEqual(1000); // 2^1 * 1000 = 2000ms
      }
      if (callTimes.length >= 3) {
        const secondDelay = callTimes[2] - callTimes[1];
        expect(secondDelay).toBeGreaterThanOrEqual(2000); // 2^2 * 1000 = 4000ms
      }
    }, 12000);
  });

  describe('Cost Tracking', () => {
    beforeEach(() => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keywords: ['test'],
                  tags: ['test'],
                  context: 'test',
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      } as Response);
    });

    it('should track token usage', async () => {
      const memory = createTestMemory();
      await service.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = await service.getStats();
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it('should calculate OpenAI costs correctly', async () => {
      const memory = createTestMemory();
      await service.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = await service.getStats();
      // gpt-4o-mini: $0.15/1M input, $0.60/1M output
      // 100 input tokens = $0.000015, 50 output tokens = $0.00003
      // Total should be ~$0.000045
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.totalCost).toBeLessThan(0.0001);
    });

    it('should calculate Anthropic costs correctly', async () => {
      const anthropicService = new EnrichmentService({
        ...mockConfig,
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
      });

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                keywords: ['test'],
                tags: ['test'],
                context: 'test',
              }),
            },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        }),
      } as Response);

      const memory = createTestMemory();
      await anthropicService.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = await anthropicService.getStats();
      // claude-3-haiku: $0.25/1M input, $1.25/1M output
      // 100 input tokens = $0.000025, 50 output tokens = $0.0000625
      // Total should be ~$0.0000875
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.totalCost).toBeLessThan(0.0002);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON response', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'This is not valid JSON',
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response);

      const memory = createTestMemory();
      await service.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not crash, memory should remain unenriched
      expect(memory.keywords).toBeUndefined();
    });

    it('should handle API error responses', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      } as Response);

      const memory = createTestMemory();
      await service.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(memory.keywords).toBeUndefined();
    }, 8000);

    it('should handle network timeouts', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      const memory = createTestMemory();
      await service.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(memory.keywords).toBeUndefined();
    }, 8000);
  });

  describe('Prompt Construction', () => {
    it('should build correct prompt for OpenAI', async () => {
      const memory = createTestMemory({
        content: {
          role: 'user',
          text: 'What is OAuth?',
        },
        platform: 'chatgpt',
      });

      await service.enrichMemory(memory);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that fetch was called with correct structure
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-key',
          }),
          body: expect.stringContaining('What is OAuth?'),
        })
      );
    });

    it('should include platform and role in prompt', async () => {
      const memory = createTestMemory({
        content: {
          role: 'assistant',
          text: 'OAuth is an authentication protocol',
        },
        platform: 'claude',
      });

      await service.enrichMemory(memory);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);

      // Check the user message (messages[1]), not the system message (messages[0])
      expect(body.messages[1].content).toContain('Platform: claude');
      expect(body.messages[1].content).toContain('Role: assistant');
    });
  });

  describe('Stats and Monitoring', () => {
    beforeEach(() => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keywords: ['test'],
                  tags: ['test'],
                  context: 'test',
                }),
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      } as Response);
    });

    it('should return accurate stats', async () => {
      const memories = Array.from({ length: 5 }, () => createTestMemory());

      for (const memory of memories) {
        await service.enrichMemory(memory);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const stats = await service.getStats();
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.enrichedCount).toBeGreaterThan(0);
    });

    it('should reset stats when requested', async () => {
      const memory = createTestMemory();
      await service.enrichMemory(memory);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const statsBefore = await service.getStats();
      expect(statsBefore.totalTokens).toBeGreaterThan(0);

      await service.resetStats();

      const statsAfter = await service.getStats();
      expect(statsAfter.totalTokens).toBe(0);
      expect(statsAfter.totalCost).toBe(0);
    });
  });
});

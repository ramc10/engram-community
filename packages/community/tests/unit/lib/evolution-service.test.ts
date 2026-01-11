/**
 * Tests for EvolutionService (Phase 3)
 * Covers evolution checking, application, rollback, cost tracking, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EvolutionService } from '../../../src/lib/evolution-service';
import type { EnrichmentConfig, MemoryWithMemA } from '@engram/core';
import { generateUUID, now, createVectorClock } from '@engram/core';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('EvolutionService', () => {
  let service: EvolutionService;
  let mockConfig: EnrichmentConfig;

  const createTestMemory = (overrides?: Partial<MemoryWithMemA>): MemoryWithMemA => ({
    id: generateUUID(),
    content: {
      role: 'user',
      text: 'How do I implement OAuth 2.0 authentication?',
    },
    conversationId: 'conv-123',
    platform: 'chatgpt',
    timestamp: now(),
    vectorClock: createVectorClock(),
    deviceId: 'device-1',
    syncStatus: 'pending',
    tags: ['programming'],
    keywords: ['OAuth', 'authentication'],
    context: 'Question about implementing OAuth 2.0 authentication',
    evolution: {
      updateCount: 0,
      lastUpdated: now(),
      triggeredBy: [],
      history: [],
    },
    ...overrides,
  });

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
      batchSize: 5,
      enableLinkDetection: true,
      enableEvolution: true,
    };
    service = new EvolutionService(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with OpenAI provider', () => {
      const openAIService = new EvolutionService({
        ...mockConfig,
        provider: 'openai',
      });
      expect(openAIService).toBeDefined();
    });

    it('should initialize with Anthropic provider', () => {
      const anthropicService = new EvolutionService({
        ...mockConfig,
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
      });
      expect(anthropicService).toBeDefined();
    });

    it('should initialize with local provider', () => {
      const localService = new EvolutionService({
        ...mockConfig,
        provider: 'local',
        localEndpoint: 'http://localhost:11434/v1',
      });
      expect(localService).toBeDefined();
    });
  });

  describe('Evolution Checking', () => {
    const mockEvolutionResponse = {
      shouldEvolve: true,
      keywords: ['OAuth', 'authentication', 'React', 'security', 'tokens'],
      tags: ['programming', 'web development'],
      context: 'Discussion about implementing OAuth 2.0 authentication in React applications',
      reason: 'New information adds React-specific context to OAuth implementation',
    };

    beforeEach(() => {
      // Mock successful API response
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockEvolutionResponse),
              },
            },
          ],
          usage: {
            prompt_tokens: 200,
            completion_tokens: 50,
            total_tokens: 250,
          },
        }),
      } as Response);
    });

    it('should check if memory should evolve', async () => {
      const targetMemory = createTestMemory({
        keywords: ['OAuth', 'authentication'],
        tags: ['programming'],
        context: 'Question about OAuth 2.0',
      });

      const newMemory = createTestMemory({
        content: {
          role: 'assistant',
          text: 'To implement OAuth 2.0 in React, you should use the Authorization Code flow with PKCE...',
        },
        keywords: ['OAuth', 'React', 'PKCE', 'tokens'],
        tags: ['programming', 'web development'],
        context: 'Explanation of OAuth 2.0 implementation in React',
      });

      const result = await service.checkEvolution(targetMemory, newMemory);

      expect(result.shouldEvolve).toBe(true);
      expect(result.keywords).toContain('React');
      expect(result.keywords).toContain('OAuth');
      expect(result.context).toContain('React');
      expect(result.reason).toBeTruthy();
    });

    it('should not evolve when content is not related', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: false,
                  keywords: ['OAuth', 'authentication'],
                  tags: ['programming'],
                  context: 'Question about OAuth 2.0',
                  reason: 'New memory is not related to OAuth authentication',
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 200,
            completion_tokens: 50,
            total_tokens: 250,
          },
        }),
      } as Response);

      const targetMemory = createTestMemory({
        keywords: ['OAuth', 'authentication'],
      });

      const newMemory = createTestMemory({
        content: {
          role: 'user',
          text: 'What is the weather like today?',
        },
        keywords: ['weather', 'forecast'],
        tags: ['general'],
        context: 'Question about weather',
      });

      const result = await service.checkEvolution(targetMemory, newMemory);

      expect(result.shouldEvolve).toBe(false);
    });

    it('should preserve original keywords when evolution adds new ones', async () => {
      const targetMemory = createTestMemory({
        keywords: ['OAuth', 'authentication'],
      });

      const newMemory = createTestMemory({
        keywords: ['React', 'frontend'],
      });

      const result = await service.checkEvolution(targetMemory, newMemory);

      expect(result.keywords).toContain('OAuth');
      expect(result.keywords).toContain('authentication');
    });

    it('should track cost of evolution check', async () => {
      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      await service.checkEvolution(targetMemory, newMemory);

      const stats = service.getStats();
      expect(stats.checksPerformed).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.totalCost).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('API error')
      );

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      const result = await service.checkEvolution(targetMemory, newMemory);

      // Should return shouldEvolve: false on error
      expect(result.shouldEvolve).toBe(false);
      expect(result.reason).toContain('Error');
    });

    it('should handle invalid JSON response', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Invalid JSON',
              },
            },
          ],
        }),
      } as Response);

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      const result = await service.checkEvolution(targetMemory, newMemory);

      // Should return shouldEvolve: false on parse error
      expect(result.shouldEvolve).toBe(false);
      expect(result.reason).toContain('Error');
    });

    it('should respect rate limiting', async () => {
      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      // Make 10 rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() =>
        service.checkEvolution(targetMemory, newMemory)
      );

      // Should not throw - rate limiter should queue requests
      await expect(Promise.all(promises)).resolves.toBeDefined();
    }, 15000); // 15 second timeout for rate limiting test
  });

  describe('Evolution Application', () => {
    it('should apply evolution to memory', async () => {
      const memory = createTestMemory({
        keywords: ['OAuth'],
        tags: ['programming'],
        context: 'Question about OAuth',
        evolution: {
          updateCount: 0,
          lastUpdated: now(),
          triggeredBy: [],
          history: [],
        },
      });

      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['OAuth', 'React', 'security'],
        tags: ['programming', 'web development'],
        context: 'Discussion about OAuth 2.0 in React applications',
        reason: 'Added React-specific context',
      };

      const triggerMemoryId = generateUUID();

      await service.applyEvolution(memory, evolutionResponse, triggerMemoryId);

      // Check metadata updated
      expect(memory.keywords).toEqual(evolutionResponse.keywords);
      expect(memory.tags).toEqual(evolutionResponse.tags);
      expect(memory.context).toBe(evolutionResponse.context);

      // Check evolution tracking updated
      expect(memory.evolution!.updateCount).toBe(1);
      expect(memory.evolution!.triggeredBy).toContain(triggerMemoryId);
      expect(memory.evolution!.history).toHaveLength(1);

      // Check history entry saved
      const historyEntry = memory.evolution!.history[0];
      expect(historyEntry.keywords).toEqual(['OAuth']);
      expect(historyEntry.tags).toEqual(['programming']);
      expect(historyEntry.context).toBe('Question about OAuth');
    });

    it('should maintain max 10 versions in history', async () => {
      const memory = createTestMemory({
        evolution: {
          updateCount: 0,
          lastUpdated: now(),
          triggeredBy: [],
          history: Array(10).fill(null).map((_, i) => ({
            keywords: [`keyword-${i}`],
            tags: [`tag-${i}`],
            context: `Context ${i}`,
            timestamp: now() - (10 - i) * 1000,
          })),
        },
      });

      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['new-keyword'],
        tags: ['new-tag'],
        context: 'New context',
        reason: 'Test',
      };

      await service.applyEvolution(memory, evolutionResponse, generateUUID());

      // Should still have max 10 versions
      expect(memory.evolution!.history).toHaveLength(10);

      // Oldest version should be removed
      expect(memory.evolution!.history[0].keywords).not.toContain('keyword-0');

      // Newest version should be the previous current state
      const latestHistory = memory.evolution!.history[memory.evolution!.history.length - 1];
      expect(latestHistory.keywords).toBeDefined();
    });

    it('should increment update count on each evolution', async () => {
      const memory = createTestMemory({
        evolution: {
          updateCount: 5,
          lastUpdated: now(),
          triggeredBy: [],
          history: [],
        },
      });

      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['test'],
        tags: ['test'],
        context: 'Test',
        reason: 'Test',
      };

      await service.applyEvolution(memory, evolutionResponse, generateUUID());

      expect(memory.evolution!.updateCount).toBe(6);
    });

    it('should track all triggering memory IDs', async () => {
      const memory = createTestMemory({
        evolution: {
          updateCount: 0,
          lastUpdated: now(),
          triggeredBy: [],
          history: [],
        },
      });

      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['test'],
        tags: ['test'],
        context: 'Test',
        reason: 'Test',
      };

      const triggerId1 = generateUUID();
      const triggerId2 = generateUUID();

      await service.applyEvolution(memory, evolutionResponse, triggerId1);
      await service.applyEvolution(memory, evolutionResponse, triggerId2);

      expect(memory.evolution!.triggeredBy).toContain(triggerId1);
      expect(memory.evolution!.triggeredBy).toContain(triggerId2);
      expect(memory.evolution!.triggeredBy).toHaveLength(2);
    });

    it('should update lastUpdated timestamp', async () => {
      const oldTimestamp = now() - 10000;
      const memory = createTestMemory({
        evolution: {
          updateCount: 0,
          lastUpdated: oldTimestamp,
          triggeredBy: [],
          history: [],
        },
      });

      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['test'],
        tags: ['test'],
        context: 'Test',
        reason: 'Test',
      };

      await service.applyEvolution(memory, evolutionResponse, generateUUID());

      expect(memory.evolution!.lastUpdated).toBeGreaterThan(oldTimestamp);
    });

    it('should initialize evolution metadata if missing', async () => {
      const memory = createTestMemory();
      delete (memory as any).evolution;

      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['test'],
        tags: ['test'],
        context: 'Test',
        reason: 'Test',
      };

      await service.applyEvolution(memory, evolutionResponse, generateUUID());

      expect(memory.evolution).toBeDefined();
      expect(memory.evolution!.updateCount).toBe(1);
      expect(memory.evolution!.history).toHaveLength(1);
    });

    it('should count applied evolutions in stats', async () => {
      const memory = createTestMemory();
      const evolutionResponse = {
        shouldEvolve: true,
        keywords: ['test'],
        tags: ['test'],
        context: 'Test',
        reason: 'Test',
      };

      await service.applyEvolution(memory, evolutionResponse, generateUUID());
      await service.applyEvolution(memory, evolutionResponse, generateUUID());

      const stats = service.getStats();
      expect(stats.evolutionsApplied).toBe(2);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track number of checks performed', async () => {
      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: false,
                  keywords: [],
                  tags: [],
                  context: '',
                  reason: 'Test',
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

      await service.checkEvolution(targetMemory, newMemory);
      await service.checkEvolution(targetMemory, newMemory);

      const stats = service.getStats();
      expect(stats.checksPerformed).toBe(2);
    });

    it('should track total tokens used', async () => {
      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: false,
                  keywords: [],
                  tags: [],
                  context: '',
                  reason: 'Test',
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

      await service.checkEvolution(targetMemory, newMemory);

      const stats = service.getStats();
      expect(stats.totalTokens).toBe(150);
    });

    it('should calculate correct cost for OpenAI', async () => {
      const openAIService = new EvolutionService({
        ...mockConfig,
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: false,
                  keywords: [],
                  tags: [],
                  context: '',
                  reason: 'Test',
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
            total_tokens: 1500,
          },
        }),
      } as Response);

      await openAIService.checkEvolution(targetMemory, newMemory);

      const stats = openAIService.getStats();
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.totalCost).toBeLessThan(0.01); // Should be very cheap
    });

    it('should calculate correct cost for Anthropic', async () => {
      const anthropicService = new EvolutionService({
        ...mockConfig,
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
      });

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                shouldEvolve: false,
                keywords: [],
                tags: [],
                context: '',
                reason: 'Test',
              }),
            },
          ],
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
          },
        }),
      } as Response);

      await anthropicService.checkEvolution(targetMemory, newMemory);

      const stats = anthropicService.getStats();
      expect(stats.totalCost).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('Network error')
      );

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      const result = await service.checkEvolution(targetMemory, newMemory);

      // Should gracefully handle errors
      expect(result.shouldEvolve).toBe(false);
      expect(result.reason).toContain('Error');
    });

    it('should handle API rate limit errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Rate limit exceeded' },
        }),
      } as Response);

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      const result = await service.checkEvolution(targetMemory, newMemory);

      // Should gracefully handle rate limit errors
      expect(result.shouldEvolve).toBe(false);
      expect(result.reason).toContain('Error');
    });

    it('should handle malformed LLM responses', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{ invalid json',
              },
            },
          ],
        }),
      } as Response);

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      const result = await service.checkEvolution(targetMemory, newMemory);

      // Should gracefully handle parse errors
      expect(result.shouldEvolve).toBe(false);
      expect(result.reason).toContain('Error');
    });

    it('should handle missing required fields in response', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: true,
                  // Missing keywords, tags, context
                }),
              },
            },
          ],
        }),
      } as Response);

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      const result = await service.checkEvolution(targetMemory, newMemory);

      // Should gracefully handle missing fields
      expect(result.shouldEvolve).toBe(false);
      expect(result.reason).toContain('Error');
    });
  });

  describe('Provider-Specific Behavior', () => {
    it('should use correct API endpoint for OpenAI', async () => {
      const openAIService = new EvolutionService({
        ...mockConfig,
        provider: 'openai',
      });

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: false,
                  keywords: [],
                  tags: [],
                  context: '',
                  reason: 'Test',
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

      await openAIService.checkEvolution(targetMemory, newMemory);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should use correct API endpoint for Anthropic', async () => {
      const anthropicService = new EvolutionService({
        ...mockConfig,
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
      });

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                shouldEvolve: false,
                keywords: [],
                tags: [],
                context: '',
                reason: 'Test',
              }),
            },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        }),
      } as Response);

      await anthropicService.checkEvolution(targetMemory, newMemory);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should use local endpoint for local provider', async () => {
      const localService = new EvolutionService({
        ...mockConfig,
        provider: 'local',
        localEndpoint: 'http://localhost:11434/v1',
      });

      const targetMemory = createTestMemory();
      const newMemory = createTestMemory();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldEvolve: false,
                  keywords: [],
                  tags: [],
                  context: '',
                  reason: 'Test',
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

      await localService.checkEvolution(targetMemory, newMemory);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.any(Object)
      );
    });
  });
});

/**
 * LinkDetectionService Test Suite
 *
 * Tests link detection, bidirectional linking, and LLM integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LinkDetectionService } from '../../../src/lib/link-detection-service';
import type { EnrichmentConfig, MemoryWithMemA } from '@engram/core';
import type { MemoryWithEmbedding } from '../../../src/lib/embedding-service';

interface LinkScore {
  memoryId: string;
  score: number;
  reason: string;
  createdAt: number;
}

// Create persistent mock for embedding service
const mockFindSimilar = jest.fn<any>();

jest.mock('../../../src/lib/embedding-service', () => ({
  getEmbeddingService: () => ({
    findSimilar: mockFindSimilar,
  }),
}));

describe('LinkDetectionService', () => {
  let service: LinkDetectionService;
  let mockConfig: EnrichmentConfig;
  let mockFetch: any;

  beforeEach(() => {
    // Clear mock call history but keep implementations
    mockFindSimilar.mockClear();

    // Mock configuration
    mockConfig = {
      enabled: true,
      enableLinkDetection: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
      batchSize: 5,
    };

    // Mock fetch API
    mockFetch = jest.fn<any>();
    (global as any).fetch = mockFetch;

    service = new LinkDetectionService(mockConfig);
  });

  describe('Link Detection', () => {
    it('should detect links for a memory with candidates', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'How to implement OAuth authentication?' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        keywords: ['OAuth', 'authentication', 'security'],
        context: 'Discussion about implementing OAuth 2.0',
      };

      const allMemories: MemoryWithEmbedding[] = [
        {
          id: 'memory-2',
          content: { role: 'assistant', text: 'JWT tokens are used for authentication' },
          conversationId: 'conv-2',
          platform: 'claude',
          timestamp: Date.now() - 1000,
          vectorClock: { 'device-1': 2 },
          deviceId: 'device-1',
          syncStatus: 'synced',
          tags: [],
          embedding: new Array(384).fill(0.5),
        },
        {
          id: 'memory-3',
          content: { role: 'user', text: 'How to secure API endpoints?' },
          conversationId: 'conv-3',
          platform: 'chatgpt',
          timestamp: Date.now() - 2000,
          vectorClock: { 'device-1': 3 },
          deviceId: 'device-1',
          syncStatus: 'synced',
          tags: [],
          embedding: new Array(384).fill(0.6),
        },
      ];

      // Mock embedding service to return candidates
      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.85 },
        { memory: allMemories[1], score: 0.75 },
      ]);

      // Mock LLM response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                links: [
                  { memoryId: 'memory-2', confidence: 0.9, reason: 'Both discuss authentication' },
                  { memoryId: 'memory-3', confidence: 0.8, reason: 'Related to API security' },
                ],
              }),
            },
          }],
          usage: { total_tokens: 200 },
        }),
      } as any);

      const links = await service.detectLinks(sourceMemory, allMemories);

      expect(links).toHaveLength(2);
      expect(links[0].memoryId).toBe('memory-2');
      expect(links[0].score).toBe(0.9);
      expect(links[0].reason).toBe('Both discuss authentication');
      expect(links[1].memoryId).toBe('memory-3');
      expect(links[1].score).toBe(0.8);
    });

    it('should return empty array when link detection is disabled', async () => {
      mockConfig.enableLinkDetection = false;
      service = new LinkDetectionService(mockConfig);

      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const links = await service.detectLinks(sourceMemory, []);

      expect(links).toEqual([]);
    });

    it('should return empty array when no API key is configured', async () => {
      mockConfig.apiKey = undefined;
      service = new LinkDetectionService(mockConfig);

      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const links = await service.detectLinks(sourceMemory, []);

      expect(links).toEqual([]);
    });

    it('should filter out links with confidence <= 0.7', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const allMemories: MemoryWithEmbedding[] = [
        {
          id: 'memory-2',
          content: { role: 'assistant', text: 'Related memory' },
          conversationId: 'conv-2',
          platform: 'claude',
          timestamp: Date.now(),
          vectorClock: { 'device-1': 2 },
          deviceId: 'device-1',
          syncStatus: 'synced',
          tags: [],
          embedding: new Array(384).fill(0.5),
        },
      ];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      // Mock LLM response with both high and low confidence
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                links: [
                  { memoryId: 'memory-2', confidence: 0.9, reason: 'Strong connection' },
                  { memoryId: 'memory-3', confidence: 0.6, reason: 'Weak connection' },
                  { memoryId: 'memory-4', confidence: 0.5, reason: 'Very weak' },
                ],
              }),
            },
          }],
          usage: { total_tokens: 150 },
        }),
      });

      const links = await service.detectLinks(sourceMemory, allMemories);

      // Only links with confidence > 0.7 should be returned
      expect(links).toHaveLength(1);
      expect(links[0].score).toBeGreaterThan(0.7);
    });

    it('should limit links to max 10 per memory', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      // Create 15 candidate memories
      const allMemories: MemoryWithEmbedding[] = Array.from({ length: 15 }, (_, i) => ({
        id: `memory-${i + 2}`,
        content: { role: 'assistant', text: `Related memory ${i}` },
        conversationId: `conv-${i}`,
        platform: 'claude' as const,
        timestamp: Date.now(),
        vectorClock: { 'device-1': i + 2 },
        deviceId: 'device-1',
        syncStatus: 'synced' as const,
        tags: [],
        embedding: new Array(384).fill(0.5 + i * 0.01),
      }));

      mockFindSimilar.mockResolvedValue(
        allMemories.slice(0, 20).map(m => ({ memory: m, score: 0.8 }))
      );

      // Mock LLM to return all 15 links with high confidence
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                links: Array.from({ length: 15 }, (_, i) => ({
                  memoryId: `memory-${i + 2}`,
                  confidence: 0.9 - i * 0.01, // Decreasing scores
                  reason: `Connection ${i}`,
                })),
              }),
            },
          }],
          usage: { total_tokens: 300 },
        }),
      });

      const links = await service.detectLinks(sourceMemory, allMemories);

      // Should be limited to 10 and sorted by score (highest first)
      expect(links).toHaveLength(10);
      expect(links[0].score).toBeGreaterThanOrEqual(links[9].score);
    });

    it('should return empty array when no candidates are found', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      mockFindSimilar.mockResolvedValue([]);

      const links = await service.detectLinks(sourceMemory, []);

      expect(links).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled(); // No LLM call if no candidates
    });
  });

  describe('Bidirectional Link Creation', () => {
    it('should create reverse links on target memories', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Source memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: [],
      };

      const targetMemory: MemoryWithMemA = {
        id: 'memory-2',
        content: { role: 'assistant', text: 'Target memory' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: [],
      };

      const allMemories = [sourceMemory, targetMemory];

      const links: LinkScore[] = [{
        memoryId: 'memory-2',
        score: 0.9,
        createdAt: Date.now(),
        reason: 'Test connection',
      }];

      await service.createBidirectionalLinks(sourceMemory, links, allMemories);

      // Target memory should now have a reverse link
      expect(targetMemory.links).toHaveLength(1);
      expect(targetMemory.links![0].memoryId).toBe('memory-1');
      expect(targetMemory.links![0].score).toBe(0.9);
      expect(targetMemory.links![0].reason).toBe('Test connection');
    });

    it('should not duplicate existing reverse links', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Source memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: [],
      };

      const targetMemory: MemoryWithMemA = {
        id: 'memory-2',
        content: { role: 'assistant', text: 'Target memory' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: [{
          memoryId: 'memory-1',
          score: 0.8,
          createdAt: Date.now() - 1000,
          reason: 'Existing link',
        }],
      };

      const allMemories = [sourceMemory, targetMemory];

      const links: LinkScore[] = [{
        memoryId: 'memory-2',
        score: 0.9,
        createdAt: Date.now(),
        reason: 'New connection',
      }];

      await service.createBidirectionalLinks(sourceMemory, links, allMemories);

      // Should still have only 1 link (not duplicated)
      expect(targetMemory.links).toHaveLength(1);
    });

    it('should limit target memories to max 10 links', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Source memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: [],
      };

      // Target memory already has 10 links
      const targetMemory: MemoryWithMemA = {
        id: 'memory-2',
        content: { role: 'assistant', text: 'Target memory' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: Array.from({ length: 10 }, (_, i) => ({
          memoryId: `memory-${i + 3}`,
          score: 0.7 + i * 0.01,
          createdAt: Date.now() - i * 1000,
          reason: `Link ${i}`,
        })),
      };

      const allMemories = [sourceMemory, targetMemory];

      const links: LinkScore[] = [{
        memoryId: 'memory-2',
        score: 0.95, // High score
        createdAt: Date.now(),
        reason: 'Very strong connection',
      }];

      await service.createBidirectionalLinks(sourceMemory, links, allMemories);

      // Should still have only 10 links (lowest score removed)
      expect(targetMemory.links).toHaveLength(10);
      // New high-score link should be included
      expect(targetMemory.links!.some(l => l.memoryId === 'memory-1')).toBe(true);
      // Lowest score should be removed
      expect(targetMemory.links!.every(l => l.score >= 0.7)).toBe(true);
    });
  });

  describe('Link Quality Management', () => {
    it('should remove low-quality links (< 0.7)', () => {
      const memory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        links: [
          { memoryId: 'memory-2', score: 0.9, createdAt: Date.now(), reason: 'Strong' },
          { memoryId: 'memory-3', score: 0.6, createdAt: Date.now(), reason: 'Weak' },
          { memoryId: 'memory-4', score: 0.8, createdAt: Date.now(), reason: 'Good' },
          { memoryId: 'memory-5', score: 0.5, createdAt: Date.now(), reason: 'Very weak' },
        ],
      };

      service.removeLowQualityLinks(memory);

      expect(memory.links).toHaveLength(2);
      expect(memory.links!.every(l => l.score >= 0.7)).toBe(true);
    });

    it('should handle memories with no links', () => {
      const memory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test memory' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      // Should not throw
      expect(() => service.removeLowQualityLinks(memory)).not.toThrow();
    });
  });

  describe('LLM Integration', () => {
    it('should call OpenAI API with correct format', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test query' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        keywords: ['test'],
      };

      const allMemories: MemoryWithEmbedding[] = [{
        id: 'memory-2',
        content: { role: 'assistant', text: 'Test response' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        embedding: new Array(384).fill(0.5),
      }];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"links":[]}' } }],
          usage: { total_tokens: 100 },
        }),
      });

      await service.detectLinks(sourceMemory, allMemories);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('gpt-4o-mini');
      expect(callBody.response_format).toEqual({ type: 'json_object' });
      expect(callBody.temperature).toBe(0.3);
    });

    it('should call Anthropic API with correct format', async () => {
      mockConfig.provider = 'anthropic';
      mockConfig.model = 'claude-3-haiku-20240307';
      service = new LinkDetectionService(mockConfig);

      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test query' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const allMemories: MemoryWithEmbedding[] = [{
        id: 'memory-2',
        content: { role: 'assistant', text: 'Test response' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        embedding: new Array(384).fill(0.5),
      }];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: '{"links":[]}' }],
          usage: { input_tokens: 50, output_tokens: 50 },
        }),
      });

      await service.detectLinks(sourceMemory, allMemories);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'sk-test-key',
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          }),
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-3-haiku-20240307');
      expect(callBody.max_tokens).toBe(2048);
    });

    it('should handle API errors gracefully', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test query' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const allMemories: MemoryWithEmbedding[] = [{
        id: 'memory-2',
        content: { role: 'assistant', text: 'Test response' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        embedding: new Array(384).fill(0.5),
      }];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      // Mock API error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const links = await service.detectLinks(sourceMemory, allMemories);

      // Should return empty array on error (graceful degradation)
      expect(links).toEqual([]);
    });
  });

  describe('Cost Tracking', () => {
    it('should track costs for OpenAI API calls', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test query' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const allMemories: MemoryWithEmbedding[] = [{
        id: 'memory-2',
        content: { role: 'assistant', text: 'Test response' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        embedding: new Array(384).fill(0.5),
      }];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"links":[]}' } }],
          usage: { total_tokens: 1000 },
        }),
      });

      await service.detectLinks(sourceMemory, allMemories);

      const stats = await service.getStats();

      expect(stats.totalTokens).toBe(1000);
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.totalCost).toBe(1000 * 0.00000015); // gpt-4o-mini pricing
    });

    it('should track average links per memory', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test query' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const allMemories: MemoryWithEmbedding[] = [{
        id: 'memory-2',
        content: { role: 'assistant', text: 'Test response' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        embedding: new Array(384).fill(0.5),
      }];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                links: [
                  { memoryId: 'memory-2', confidence: 0.9, reason: 'Connection' },
                  { memoryId: 'memory-3', confidence: 0.8, reason: 'Related' },
                ],
              }),
            },
          }],
          usage: { total_tokens: 200 },
        }),
      } as any);

      await service.detectLinks(sourceMemory, allMemories);

      const stats = await service.getStats();

      expect(stats.linksCreated).toBe(2);
      expect(stats.avgLinksPerMemory).toBe(2);
    });

    it('should reset statistics', async () => {
      const sourceMemory: MemoryWithMemA = {
        id: 'memory-1',
        content: { role: 'user', text: 'Test query' },
        conversationId: 'conv-1',
        platform: 'chatgpt',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 1 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
      };

      const allMemories: MemoryWithEmbedding[] = [{
        id: 'memory-2',
        content: { role: 'assistant', text: 'Test response' },
        conversationId: 'conv-2',
        platform: 'claude',
        timestamp: Date.now(),
        vectorClock: { 'device-1': 2 },
        deviceId: 'device-1',
        syncStatus: 'synced',
        tags: [],
        embedding: new Array(384).fill(0.5),
      }];

      mockFindSimilar.mockResolvedValue([
        { memory: allMemories[0], score: 0.8 },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"links":[{"memoryId":"memory-2","confidence":0.9,"reason":"Test"}]}' } }],
          usage: { total_tokens: 200 },
        }),
      } as any);

      await service.detectLinks(sourceMemory, allMemories);

      let stats = await service.getStats();
      expect(stats.totalTokens).toBe(200);
      expect(stats.linksCreated).toBe(1);

      await service.resetStats();

      stats = await service.getStats();
      expect(stats.totalTokens).toBe(0);
      expect(stats.linksCreated).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.avgLinksPerMemory).toBe(0);
    });
  });
});

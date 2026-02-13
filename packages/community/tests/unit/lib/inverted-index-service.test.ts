/**
 * InvertedIndexService Unit Tests
 *
 * Tests for the inverted index that provides O(1) keyword fallback search.
 * @see https://github.com/ramc10/engram-community/issues/78
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvertedIndexService } from '../../../src/lib/inverted-index-service';
import type { MemoryWithMemA, UUID } from '@engram/core';

// Helper to create a minimal enriched memory for testing
function createTestMemory(overrides: Partial<MemoryWithMemA> & { id: UUID }): MemoryWithMemA {
  return {
    conversationId: 'conv-1',
    platform: 'chatgpt',
    content: { role: 'user', text: null as any, metadata: null as any },
    timestamp: Date.now(),
    vectorClock: {},
    deviceId: 'device-1',
    syncStatus: 'pending',
    tags: [],
    ...overrides,
  } as MemoryWithMemA;
}

describe('InvertedIndexService', () => {
  let service: InvertedIndexService;

  beforeEach(() => {
    service = new InvertedIndexService();
  });

  describe('tokenize()', () => {
    it('should split text into lowercase tokens', () => {
      const tokens = service.tokenize('Hello World JavaScript');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('javascript');
    });

    it('should remove stopwords', () => {
      const tokens = service.tokenize('the quick brown fox and the lazy dog');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('and');
      expect(tokens).toContain('quick');
      expect(tokens).toContain('brown');
      expect(tokens).toContain('fox');
      expect(tokens).toContain('lazy');
      expect(tokens).toContain('dog');
    });

    it('should remove short tokens (< 2 chars)', () => {
      const tokens = service.tokenize('I am a developer');
      expect(tokens).not.toContain('i');
      expect(tokens).not.toContain('a');
      expect(tokens).toContain('developer');
    });

    it('should handle punctuation', () => {
      const tokens = service.tokenize('OAuth 2.0, JWT tokens; security!');
      expect(tokens).toContain('oauth');
      expect(tokens).toContain('jwt');
      expect(tokens).toContain('tokens');
      expect(tokens).toContain('security');
    });

    it('should handle hyphenated words', () => {
      const tokens = service.tokenize('client-side server-side end-to-end');
      expect(tokens).toContain('client-side');
      expect(tokens).toContain('server-side');
      expect(tokens).toContain('end-to-end');
    });

    it('should return empty array for empty/null input', () => {
      expect(service.tokenize('')).toEqual([]);
      expect(service.tokenize(null as any)).toEqual([]);
      expect(service.tokenize(undefined as any)).toEqual([]);
    });

    it('should handle all-stopword input', () => {
      const tokens = service.tokenize('the and or but is');
      expect(tokens).toEqual([]);
    });

    it('should deduplicate when used with extractTokens', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['javascript', 'testing'],
        tags: ['javascript', 'unit-test'],
      });
      const tokens = service.extractTokens(memory);
      const jsCount = tokens.filter(t => t === 'javascript').length;
      expect(jsCount).toBe(1);
    });
  });

  describe('extractTokens()', () => {
    it('should extract tokens from keywords', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['machine learning', 'neural networks'],
      });
      const tokens = service.extractTokens(memory);
      expect(tokens).toContain('machine');
      expect(tokens).toContain('learning');
      expect(tokens).toContain('neural');
      expect(tokens).toContain('networks');
    });

    it('should extract tokens from tags', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        tags: ['web development', 'security'],
      });
      const tokens = service.extractTokens(memory);
      expect(tokens).toContain('web');
      expect(tokens).toContain('development');
      expect(tokens).toContain('security');
    });

    it('should extract tokens from context', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        context: 'Discussion about implementing OAuth authentication in React',
      });
      const tokens = service.extractTokens(memory);
      expect(tokens).toContain('discussion');
      expect(tokens).toContain('implementing');
      expect(tokens).toContain('oauth');
      expect(tokens).toContain('authentication');
      expect(tokens).toContain('react');
    });

    it('should extract tokens from plaintext content', () => {
      const memory = createTestMemory({ id: 'mem-1' as UUID });
      const tokens = service.extractTokens(memory, 'How do I configure TypeScript with Jest?');
      expect(tokens).toContain('configure');
      expect(tokens).toContain('typescript');
      expect(tokens).toContain('jest');
    });

    it('should combine tokens from all sources', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['OAuth'],
        tags: ['security'],
        context: 'Authentication discussion',
      });
      const tokens = service.extractTokens(memory, 'How to implement JWT tokens');
      expect(tokens).toContain('oauth');
      expect(tokens).toContain('security');
      expect(tokens).toContain('authentication');
      expect(tokens).toContain('jwt');
      expect(tokens).toContain('tokens');
    });

    it('should handle memory with no enrichment data', () => {
      const memory = createTestMemory({ id: 'mem-1' as UUID });
      const tokens = service.extractTokens(memory);
      expect(tokens).toEqual([]);
    });
  });

  describe('addMemory()', () => {
    it('should add a memory to the index', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['javascript', 'testing'],
        tags: ['web development'],
      });

      service.addMemory('mem-1' as UUID, memory);

      const results = service.search('javascript');
      expect(results).toHaveLength(1);
      expect(results[0].memoryId).toBe('mem-1');
    });

    it('should handle update by replacing old tokens', () => {
      const memory1 = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['python', 'flask'],
      });

      service.addMemory('mem-1' as UUID, memory1);
      expect(service.search('python')).toHaveLength(1);

      // Update with new keywords
      const memory2 = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['javascript', 'react'],
      });

      service.addMemory('mem-1' as UUID, memory2);

      // Old tokens should be gone
      expect(service.search('python')).toHaveLength(0);
      expect(service.search('flask')).toHaveLength(0);
      // New tokens should be present
      expect(service.search('javascript')).toHaveLength(1);
      expect(service.search('react')).toHaveLength(1);
    });

    it('should index plaintext content', () => {
      const memory = createTestMemory({ id: 'mem-1' as UUID });

      service.addMemory('mem-1' as UUID, memory, 'How to deploy a Docker container');

      expect(service.search('docker')).toHaveLength(1);
      expect(service.search('container')).toHaveLength(1);
      expect(service.search('deploy')).toHaveLength(1);
    });

    it('should skip memory with no indexable tokens', () => {
      const memory = createTestMemory({ id: 'mem-1' as UUID });

      service.addMemory('mem-1' as UUID, memory);

      expect(service.getStats().memoryCount).toBe(0);
    });
  });

  describe('removeMemory()', () => {
    it('should remove a memory from the index', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['javascript'],
      });

      service.addMemory('mem-1' as UUID, memory);
      expect(service.search('javascript')).toHaveLength(1);

      service.removeMemory('mem-1' as UUID);
      expect(service.search('javascript')).toHaveLength(0);
    });

    it('should clean up empty posting lists', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['unique-keyword-xyz'],
      });

      service.addMemory('mem-1' as UUID, memory);
      expect(service.getStats().tokenCount).toBeGreaterThan(0);

      service.removeMemory('mem-1' as UUID);
      expect(service.getStats().tokenCount).toBe(0);
      expect(service.getStats().memoryCount).toBe(0);
    });

    it('should not affect other memories sharing a token', () => {
      const memory1 = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['javascript', 'react'],
      });
      const memory2 = createTestMemory({
        id: 'mem-2' as UUID,
        keywords: ['javascript', 'vue'],
      });

      service.addMemory('mem-1' as UUID, memory1);
      service.addMemory('mem-2' as UUID, memory2);

      service.removeMemory('mem-1' as UUID);

      const results = service.search('javascript');
      expect(results).toHaveLength(1);
      expect(results[0].memoryId).toBe('mem-2');
    });

    it('should handle removing non-existent memory gracefully', () => {
      expect(() => service.removeMemory('nonexistent' as UUID)).not.toThrow();
    });
  });

  describe('search()', () => {
    beforeEach(() => {
      // Seed the index with test data
      service.addMemory(
        'mem-1' as UUID,
        createTestMemory({
          id: 'mem-1' as UUID,
          keywords: ['javascript', 'react', 'hooks'],
          tags: ['web development', 'frontend'],
          context: 'Discussion about React hooks patterns for state management',
        })
      );
      service.addMemory(
        'mem-2' as UUID,
        createTestMemory({
          id: 'mem-2' as UUID,
          keywords: ['python', 'machine learning', 'tensorflow'],
          tags: ['data science', 'AI'],
          context: 'Tutorial on building neural networks with TensorFlow',
        })
      );
      service.addMemory(
        'mem-3' as UUID,
        createTestMemory({
          id: 'mem-3' as UUID,
          keywords: ['javascript', 'typescript', 'testing'],
          tags: ['web development', 'backend'],
          context: 'Guide to testing TypeScript applications with Jest',
        })
      );
    });

    it('should find memories by single keyword', () => {
      const results = service.search('python');
      expect(results).toHaveLength(1);
      expect(results[0].memoryId).toBe('mem-2');
    });

    it('should find multiple memories sharing a keyword', () => {
      const results = service.search('javascript');
      expect(results).toHaveLength(2);
      const ids = results.map(r => r.memoryId);
      expect(ids).toContain('mem-1');
      expect(ids).toContain('mem-3');
    });

    it('should rank by number of matching tokens', () => {
      // "javascript testing" matches mem-3 (both) and mem-1 (one)
      const results = service.search('javascript testing');
      expect(results[0].memoryId).toBe('mem-3');
      expect(results[0].matchCount).toBe(2);
      expect(results[0].score).toBe(1.0);
      expect(results[1].memoryId).toBe('mem-1');
      expect(results[1].matchCount).toBe(1);
      expect(results[1].score).toBe(0.5);
    });

    it('should return empty array for unmatched query', () => {
      const results = service.search('blockchain');
      expect(results).toEqual([]);
    });

    it('should return empty array for stopword-only query', () => {
      const results = service.search('the and or');
      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const results = service.search('');
      expect(results).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      const results = service.search('javascript', 1);
      expect(results).toHaveLength(1);
    });

    it('should be case-insensitive', () => {
      const results = service.search('JAVASCRIPT');
      expect(results).toHaveLength(2);
    });

    it('should match tokens from context', () => {
      const results = service.search('neural networks');
      expect(results).toHaveLength(1);
      expect(results[0].memoryId).toBe('mem-2');
    });

    it('should match tokens from tags', () => {
      const results = service.search('frontend');
      expect(results).toHaveLength(1);
      expect(results[0].memoryId).toBe('mem-1');
    });

    it('should use union semantics (any token matches)', () => {
      // "react python" should match both mem-1 (react) and mem-2 (python)
      const results = service.search('react python');
      expect(results).toHaveLength(2);
    });
  });

  describe('build()', () => {
    it('should build index from memory batch', () => {
      const memories: MemoryWithMemA[] = [
        createTestMemory({
          id: 'mem-1' as UUID,
          keywords: ['javascript'],
          tags: ['web'],
        }),
        createTestMemory({
          id: 'mem-2' as UUID,
          keywords: ['python'],
          tags: ['data'],
        }),
        createTestMemory({
          id: 'mem-3' as UUID,
          keywords: ['rust'],
          tags: ['systems'],
        }),
      ];

      service.build(memories);

      expect(service.isReady()).toBe(true);
      expect(service.getStats().memoryCount).toBe(3);
      expect(service.search('javascript')).toHaveLength(1);
      expect(service.search('python')).toHaveLength(1);
      expect(service.search('rust')).toHaveLength(1);
    });

    it('should clear previous index on rebuild', () => {
      service.addMemory(
        'old-mem' as UUID,
        createTestMemory({
          id: 'old-mem' as UUID,
          keywords: ['legacy'],
        })
      );

      service.build([
        createTestMemory({
          id: 'new-mem' as UUID,
          keywords: ['modern'],
        }),
      ]);

      expect(service.search('legacy')).toHaveLength(0);
      expect(service.search('modern')).toHaveLength(1);
    });

    it('should report progress', () => {
      const memories = Array.from({ length: 5 }, (_, i) =>
        createTestMemory({
          id: `mem-${i}` as UUID,
          keywords: [`keyword-${i}`],
        })
      );

      const progressCalls: Array<[number, number]> = [];
      service.build(memories, (current, total) => {
        progressCalls.push([current, total]);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      // Last call should be (5, 5)
      expect(progressCalls[progressCalls.length - 1]).toEqual([5, 5]);
    });

    it('should handle empty memory list', () => {
      service.build([]);

      expect(service.isReady()).toBe(true);
      expect(service.getStats().memoryCount).toBe(0);
      expect(service.getStats().tokenCount).toBe(0);
    });

    it('should skip memories with no indexable content', () => {
      const memories: MemoryWithMemA[] = [
        createTestMemory({ id: 'mem-1' as UUID }), // No keywords/tags/context
        createTestMemory({
          id: 'mem-2' as UUID,
          keywords: ['javascript'],
        }),
      ];

      service.build(memories);

      expect(service.getStats().memoryCount).toBe(1);
    });
  });

  describe('persist() and load()', () => {
    it('should persist and load the index', async () => {
      const mockDb = {
        searchIndex: {
          put: jest.fn<any>().mockResolvedValue(undefined),
          get: jest.fn<any>(),
        },
      };

      // Build an index
      service.addMemory(
        'mem-1' as UUID,
        createTestMemory({
          id: 'mem-1' as UUID,
          keywords: ['javascript', 'react'],
          tags: ['web development'],
          context: 'React hooks tutorial',
        })
      );
      service.addMemory(
        'mem-2' as UUID,
        createTestMemory({
          id: 'mem-2' as UUID,
          keywords: ['python', 'flask'],
        })
      );

      // Persist
      await service.persist(mockDb);

      // Verify put was called with correct structure
      expect(mockDb.searchIndex.put).toHaveBeenCalledTimes(1);
      const savedEntry = (mockDb.searchIndex.put as jest.Mock).mock.calls[0][0] as any;
      expect(savedEntry.tag).toBe('__inverted_index__');
      expect(savedEntry.data).toBeDefined();
      expect(savedEntry.data.memoryCount).toBe(2);

      // Load into a new service instance
      mockDb.searchIndex.get.mockResolvedValue(savedEntry);
      const newService = new InvertedIndexService();
      const loaded = await newService.load(mockDb);

      expect(loaded).toBe(true);
      expect(newService.isReady()).toBe(true);
      expect(newService.getStats().memoryCount).toBe(2);

      // Verify search works after load
      const jsResults = newService.search('javascript');
      expect(jsResults).toHaveLength(1);
      expect(jsResults[0].memoryId).toBe('mem-1');

      const pyResults = newService.search('python');
      expect(pyResults).toHaveLength(1);
      expect(pyResults[0].memoryId).toBe('mem-2');
    });

    it('should return false when no persisted index exists', async () => {
      const mockDb = {
        searchIndex: {
          get: jest.fn<any>().mockResolvedValue(null),
        },
      };

      const loaded = await service.load(mockDb);
      expect(loaded).toBe(false);
      expect(service.isReady()).toBe(false);
    });

    it('should handle persist errors gracefully', async () => {
      const mockDb = {
        searchIndex: {
          put: jest.fn<any>().mockRejectedValue(new Error('Write failed')),
        },
      };

      service.addMemory(
        'mem-1' as UUID,
        createTestMemory({
          id: 'mem-1' as UUID,
          keywords: ['test'],
        })
      );

      // Should not throw
      await expect(service.persist(mockDb)).resolves.not.toThrow();
    });

    it('should handle load errors gracefully', async () => {
      const mockDb = {
        searchIndex: {
          get: jest.fn<any>().mockRejectedValue(new Error('Read failed')),
        },
      };

      const loaded = await service.load(mockDb);
      expect(loaded).toBe(false);
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      service.addMemory(
        'mem-1' as UUID,
        createTestMemory({
          id: 'mem-1' as UUID,
          keywords: ['javascript', 'react'],
          tags: ['web'],
        })
      );
      service.addMemory(
        'mem-2' as UUID,
        createTestMemory({
          id: 'mem-2' as UUID,
          keywords: ['python'],
          tags: ['data'],
        })
      );

      const stats = service.getStats();
      expect(stats.memoryCount).toBe(2);
      expect(stats.tokenCount).toBeGreaterThan(0);
      expect(stats.estimatedBytes).toBeGreaterThan(0);
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });

    it('should return zero stats for empty index', () => {
      const stats = service.getStats();
      expect(stats.memoryCount).toBe(0);
      expect(stats.tokenCount).toBe(0);
      expect(stats.estimatedBytes).toBe(0);
      expect(stats.lastUpdated).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should clear the entire index', () => {
      service.addMemory(
        'mem-1' as UUID,
        createTestMemory({
          id: 'mem-1' as UUID,
          keywords: ['javascript'],
        })
      );

      service.clear();

      expect(service.isReady()).toBe(false);
      expect(service.getStats().memoryCount).toBe(0);
      expect(service.getStats().tokenCount).toBe(0);
      expect(service.search('javascript')).toHaveLength(0);
    });
  });

  describe('Performance characteristics', () => {
    it('should handle 10K+ memories efficiently', () => {
      const memories: MemoryWithMemA[] = Array.from({ length: 10000 }, (_, i) =>
        createTestMemory({
          id: `mem-${i}` as UUID,
          keywords: [`keyword-${i % 100}`, `topic-${i % 50}`],
          tags: [`tag-${i % 20}`],
          context: `Context for memory ${i} about topic ${i % 50}`,
        })
      );

      const buildStart = Date.now();
      service.build(memories);
      const buildTime = Date.now() - buildStart;

      expect(service.isReady()).toBe(true);
      expect(service.getStats().memoryCount).toBe(10000);

      // Search should be fast (< 10ms for any query)
      const searchStart = Date.now();
      const results = service.search('keyword-42 topic-25');
      const searchTime = Date.now() - searchStart;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(50); // Very generous threshold

      // Build should be reasonable (< 5s for 10K)
      expect(buildTime).toBeLessThan(5000);
    });

    it('should have sub-10ms search for large indexes', () => {
      // Build a large index
      const memories: MemoryWithMemA[] = Array.from({ length: 5000 }, (_, i) =>
        createTestMemory({
          id: `mem-${i}` as UUID,
          keywords: [`term-${i % 200}`, `concept-${i % 100}`],
          tags: [`category-${i % 30}`],
        })
      );

      service.build(memories);

      // Run multiple searches and measure
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        service.search(`term-${i * 20} concept-${i * 10}`);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in content', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['C++', 'C#', '.NET'],
      });

      service.addMemory('mem-1' as UUID, memory);

      // "net" should match ".NET"
      const results = service.search('net');
      expect(results).toHaveLength(1);
    });

    it('should handle very long content', () => {
      const longText = Array.from({ length: 1000 }, (_, i) => `word${i}`).join(' ');
      const memory = createTestMemory({ id: 'mem-1' as UUID });

      service.addMemory('mem-1' as UUID, memory, longText);

      expect(service.search('word500')).toHaveLength(1);
    });

    it('should handle unicode content', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['caf\u00e9', 'na\u00efve', 'r\u00e9sum\u00e9'],
      });

      service.addMemory('mem-1' as UUID, memory);

      const results = service.search('caf\u00e9');
      expect(results).toHaveLength(1);
    });

    it('should handle concurrent add and remove', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['temporary'],
      });

      service.addMemory('mem-1' as UUID, memory);
      service.removeMemory('mem-1' as UUID);
      service.addMemory('mem-1' as UUID, memory);

      expect(service.search('temporary')).toHaveLength(1);
      expect(service.getStats().memoryCount).toBe(1);
    });

    it('should handle duplicate addMemory calls', () => {
      const memory = createTestMemory({
        id: 'mem-1' as UUID,
        keywords: ['javascript'],
      });

      service.addMemory('mem-1' as UUID, memory);
      service.addMemory('mem-1' as UUID, memory);
      service.addMemory('mem-1' as UUID, memory);

      const results = service.search('javascript');
      expect(results).toHaveLength(1);
      expect(service.getStats().memoryCount).toBe(1);
    });
  });
});

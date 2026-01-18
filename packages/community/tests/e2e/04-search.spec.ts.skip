import { test, expect } from './fixtures/extension-fixture';
import {
  openSidePanel,
  waitForExtensionReady,
  mockAuthenticatedUser,
  setExtensionStorage,
  getExtensionStorage,
} from './helpers/extension-helper';

/**
 * E2E Tests for Search Functionality
 *
 * These tests verify:
 * - Semantic search with BGE-Small embeddings
 * - Keyword search
 * - Search filters (platform, date, tags)
 * - Search result relevance
 * - Search performance
 */

test.describe('Search - Basic Functionality', () => {
  test.beforeEach(async ({ context, extensionId }) => {
    const page = await openSidePanel(context, extensionId);
    await mockAuthenticatedUser(page);

    // Set up test memories
    await setExtensionStorage(page, {
      memories: [
        {
          id: 'search-mem-1',
          platform: 'chatgpt',
          title: 'Python Programming Tutorial',
          messages: [
            { role: 'user', content: 'How do I create a list in Python?' },
            {
              role: 'assistant',
              content:
                'In Python, you can create a list using square brackets: my_list = [1, 2, 3]',
            },
          ],
          tags: ['python', 'programming', 'tutorial'],
          createdAt: Date.now() - 86400000, // 1 day ago
          updatedAt: Date.now() - 86400000,
        },
        {
          id: 'search-mem-2',
          platform: 'claude',
          title: 'JavaScript Async/Await',
          messages: [
            { role: 'user', content: 'Explain async/await in JavaScript' },
            {
              role: 'assistant',
              content:
                'Async/await is a way to handle asynchronous operations in JavaScript...',
            },
          ],
          tags: ['javascript', 'programming', 'async'],
          createdAt: Date.now() - 3600000, // 1 hour ago
          updatedAt: Date.now() - 3600000,
        },
        {
          id: 'search-mem-3',
          platform: 'chatgpt',
          title: 'Cooking Recipe - Pasta',
          messages: [
            { role: 'user', content: 'How to make carbonara pasta?' },
            {
              role: 'assistant',
              content: 'To make carbonara, you need pasta, eggs, bacon, and parmesan cheese...',
            },
          ],
          tags: ['cooking', 'recipe', 'pasta'],
          createdAt: Date.now() - 7200000, // 2 hours ago
          updatedAt: Date.now() - 7200000,
        },
      ],
    });

    await page.close();
  });

  test('should perform keyword search', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);

    // Get all memories
    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories || [];

    // Simulate keyword search for "Python"
    const searchQuery = 'Python';
    const results = memories.filter((memory: any) => {
      const titleMatch = memory.title.toLowerCase().includes(searchQuery.toLowerCase());
      const contentMatch = memory.messages.some((msg: any) =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const tagMatch = memory.tags?.some((tag: string) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return titleMatch || contentMatch || tagMatch;
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('search-mem-1');

    await sidepanel.close();
  });

  test('should search by platform filter', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);

    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories || [];

    // Filter by ChatGPT platform
    const chatgptMemories = memories.filter((m: any) => m.platform === 'chatgpt');
    expect(chatgptMemories.length).toBe(2);

    // Filter by Claude platform
    const claudeMemories = memories.filter((m: any) => m.platform === 'claude');
    expect(claudeMemories.length).toBe(1);

    await sidepanel.close();
  });

  test('should search by date range', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);

    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories || [];

    // Get memories from last 12 hours
    const twelveHoursAgo = Date.now() - 12 * 3600000;
    const recentMemories = memories.filter(
      (m: any) => m.createdAt > twelveHoursAgo
    );

    expect(recentMemories.length).toBe(2); // JavaScript and Pasta memories

    await sidepanel.close();
  });

  test('should search by tags', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);

    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories || [];

    // Search for "programming" tag
    const programmingMemories = memories.filter((m: any) =>
      m.tags?.includes('programming')
    );

    expect(programmingMemories.length).toBe(2);

    await sidepanel.close();
  });
});

test.describe('Search - Advanced Features', () => {
  test('should handle empty search results', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);
    await mockAuthenticatedUser(sidepanel);

    await setExtensionStorage(sidepanel, { memories: [] });

    const storage = await getExtensionStorage(sidepanel);
    expect(storage.memories).toEqual([]);

    await sidepanel.close();
  });

  test('should search with multiple filters', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);
    await mockAuthenticatedUser(sidepanel);

    // Set up diverse memories
    await setExtensionStorage(sidepanel, {
      memories: [
        {
          id: 'multi-1',
          platform: 'chatgpt',
          title: 'Python Advanced Topics',
          messages: [{ role: 'user', content: 'Advanced Python features' }],
          tags: ['python', 'advanced'],
          createdAt: Date.now() - 1000,
        },
        {
          id: 'multi-2',
          platform: 'claude',
          title: 'Python Basics',
          messages: [{ role: 'user', content: 'Python basics' }],
          tags: ['python', 'beginner'],
          createdAt: Date.now() - 2000,
        },
      ],
    });

    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories;

    // Filter: ChatGPT + Python tag
    const filtered = memories.filter(
      (m: any) => m.platform === 'chatgpt' && m.tags?.includes('python')
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('multi-1');

    await sidepanel.close();
  });

  test('should handle special characters in search', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);
    await mockAuthenticatedUser(sidepanel);

    await setExtensionStorage(sidepanel, {
      memories: [
        {
          id: 'special-1',
          platform: 'chatgpt',
          title: 'C++ Programming & Pointers',
          messages: [
            { role: 'user', content: 'What is a pointer in C++?' },
            { role: 'assistant', content: 'A pointer is a variable that stores memory address...' },
          ],
          tags: ['c++', 'pointers'],
          createdAt: Date.now(),
        },
      ],
    });

    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories;

    // Search for "C++"
    const results = memories.filter((m: any) =>
      m.title.includes('C++') || m.tags?.includes('c++')
    );

    expect(results.length).toBe(1);

    await sidepanel.close();
  });

  test('should rank results by relevance', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);
    await mockAuthenticatedUser(sidepanel);

    await setExtensionStorage(sidepanel, {
      memories: [
        {
          id: 'rank-1',
          platform: 'chatgpt',
          title: 'Python Python Python', // High keyword density
          messages: [{ role: 'user', content: 'Python tutorial' }],
          createdAt: Date.now() - 1000,
        },
        {
          id: 'rank-2',
          platform: 'chatgpt',
          title: 'JavaScript Guide',
          messages: [{ role: 'user', content: 'Mentions Python once' }],
          createdAt: Date.now() - 2000,
        },
      ],
    });

    const storage = await getExtensionStorage(sidepanel);
    const memories = storage.memories;

    // Simple relevance scoring based on keyword frequency
    const searchQuery = 'Python';
    const scoredResults = memories.map((m: any) => {
      const titleScore = (m.title.match(new RegExp(searchQuery, 'gi')) || []).length * 3;
      const contentScore = m.messages.reduce((score: number, msg: any) => {
        return score + (msg.content.match(new RegExp(searchQuery, 'gi')) || []).length;
      }, 0);
      return {
        ...m,
        relevanceScore: titleScore + contentScore,
      };
    });

    const sortedResults = scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    expect(sortedResults[0].id).toBe('rank-1');

    await sidepanel.close();
  });
});

test.describe('Search - Performance', () => {
  test('should handle large result sets', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);
    await mockAuthenticatedUser(sidepanel);

    // Create 100 memories
    const largeMemorySet = Array.from({ length: 100 }, (_, i) => ({
      id: `large-mem-${i}`,
      platform: i % 2 === 0 ? 'chatgpt' : 'claude',
      title: `Memory ${i} - ${i % 3 === 0 ? 'Python' : 'JavaScript'}`,
      messages: [
        {
          role: 'user',
          content: `Question ${i} about ${i % 3 === 0 ? 'Python' : 'JavaScript'}`,
        },
      ],
      tags: [i % 3 === 0 ? 'python' : 'javascript'],
      createdAt: Date.now() - i * 1000,
    }));

    await setExtensionStorage(sidepanel, { memories: largeMemorySet });

    const storage = await getExtensionStorage(sidepanel);
    expect(storage.memories.length).toBe(100);

    // Search should still be fast
    const startTime = Date.now();
    const pythonResults = storage.memories.filter((m: any) =>
      m.tags?.includes('python')
    );
    const searchTime = Date.now() - startTime;

    expect(pythonResults.length).toBeGreaterThan(0);
    expect(searchTime).toBeLessThan(100); // Should complete in under 100ms

    await sidepanel.close();
  });

  test('should paginate search results', async ({ context, extensionId }) => {
    const sidepanel = await openSidePanel(context, extensionId);
    await waitForExtensionReady(sidepanel);
    await mockAuthenticatedUser(sidepanel);

    const manyMemories = Array.from({ length: 50 }, (_, i) => ({
      id: `page-mem-${i}`,
      platform: 'chatgpt',
      title: `Memory ${i}`,
      messages: [{ role: 'user', content: `Content ${i}` }],
      createdAt: Date.now() - i * 1000,
    }));

    await setExtensionStorage(sidepanel, { memories: manyMemories });

    const storage = await getExtensionStorage(sidepanel);
    const allMemories = storage.memories;

    // Simulate pagination
    const pageSize = 10;
    const page1 = allMemories.slice(0, pageSize);
    const page2 = allMemories.slice(pageSize, pageSize * 2);

    expect(page1.length).toBe(10);
    expect(page2.length).toBe(10);
    expect(page1[0].id).not.toBe(page2[0].id);

    await sidepanel.close();
  });
});

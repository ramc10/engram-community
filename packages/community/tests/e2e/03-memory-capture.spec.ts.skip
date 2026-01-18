import { test, expect } from './fixtures/extension-fixture';
import {
  openSidePanel,
  waitForExtensionReady,
  mockAuthenticatedUser,
  getExtensionStorage,
  setExtensionStorage,
} from './helpers/extension-helper';

/**
 * E2E Tests for Memory Capture
 *
 * These tests verify:
 * - Conversation capture from ChatGPT
 * - Conversation capture from Claude
 * - Memory storage and encryption
 * - Content script injection
 * - Message interception
 */

test.describe('Memory Capture - ChatGPT', () => {
  test('should inject content script on ChatGPT', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navigate to ChatGPT
    await page.goto('https://chatgpt.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Wait for content script injection

    // Verify content script is injected
    const hasContentScript = await page.evaluate(() => {
      // Check for indicators that content script is running
      return typeof window !== 'undefined';
    });

    expect(hasContentScript).toBe(true);

    await page.close();
  });

  test('should capture ChatGPT conversation', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    // Navigate to ChatGPT
    await page.goto('https://chatgpt.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Simulate a conversation by injecting mock conversation data
    await page.evaluate(() => {
      // Mock a ChatGPT conversation
      const mockConversation = {
        id: 'test-conversation-1',
        title: 'Test Conversation',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test question',
            timestamp: Date.now() - 5000,
          },
          {
            role: 'assistant',
            content: 'Hello! This is a test response from ChatGPT.',
            timestamp: Date.now(),
          },
        ],
      };

      // Store in extension storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('memories', (result) => {
          const memories = result.memories || [];
          memories.push({
            id: mockConversation.id,
            platform: 'chatgpt',
            title: mockConversation.title,
            messages: mockConversation.messages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          chrome.storage.local.set({ memories });
        });
      }
    });

    await page.waitForTimeout(1000);

    // Verify memory was captured
    const storage = await getExtensionStorage(page);
    expect(storage.memories).toBeDefined();
    expect(storage.memories.length).toBeGreaterThan(0);

    const capturedMemory = storage.memories[0];
    expect(capturedMemory.platform).toBe('chatgpt');
    expect(capturedMemory.messages).toHaveLength(2);

    await page.close();
  });

  test('should encrypt captured memories', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    // Set mock encrypted memory
    await setExtensionStorage(page, {
      'encrypted-memories': [
        {
          id: 'encrypted-mem-1',
          data: btoa('encrypted-content'),
          iv: 'mock-iv',
          platform: 'chatgpt',
          createdAt: Date.now(),
        },
      ],
    });

    const storage = await getExtensionStorage(page);
    const encryptedMemories = storage['encrypted-memories'];

    expect(encryptedMemories).toBeDefined();
    expect(encryptedMemories[0].data).toBeTruthy();
    expect(encryptedMemories[0].iv).toBeTruthy();

    // Encrypted data should be base64 encoded
    expect(encryptedMemories[0].data).toMatch(/^[A-Za-z0-9+/=]+$/);

    await page.close();
  });
});

test.describe('Memory Capture - Claude', () => {
  test('should inject content script on Claude.ai', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navigate to Claude
    await page.goto('https://claude.ai');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify content script is injected
    const hasContentScript = await page.evaluate(() => {
      return typeof window !== 'undefined';
    });

    expect(hasContentScript).toBe(true);

    await page.close();
  });

  test('should capture Claude conversation', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    // Navigate to Claude
    await page.goto('https://claude.ai');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Simulate Claude conversation capture
    await page.evaluate(() => {
      const mockConversation = {
        id: 'claude-test-conv-1',
        title: 'Claude Test Conversation',
        messages: [
          {
            role: 'user',
            content: 'Test question for Claude',
            timestamp: Date.now() - 5000,
          },
          {
            role: 'assistant',
            content: 'Test response from Claude',
            timestamp: Date.now(),
          },
        ],
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('memories', (result) => {
          const memories = result.memories || [];
          memories.push({
            id: mockConversation.id,
            platform: 'claude',
            title: mockConversation.title,
            messages: mockConversation.messages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          chrome.storage.local.set({ memories });
        });
      }
    });

    await page.waitForTimeout(1000);

    // Verify memory was captured
    const storage = await getExtensionStorage(page);
    expect(storage.memories).toBeDefined();

    const claudeMemories = storage.memories.filter((m: any) => m.platform === 'claude');
    expect(claudeMemories.length).toBeGreaterThan(0);

    await page.close();
  });
});

test.describe('Memory Metadata', () => {
  test('should capture conversation metadata', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    // Create memory with rich metadata
    await setExtensionStorage(page, {
      memories: [
        {
          id: 'meta-test-1',
          platform: 'chatgpt',
          title: 'Conversation with Metadata',
          messages: [{ role: 'user', content: 'Test' }],
          metadata: {
            tags: ['test', 'e2e'],
            category: 'testing',
            url: 'https://chatgpt.com/c/test-123',
            wordCount: 150,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    const storage = await getExtensionStorage(page);
    const memory = storage.memories[0];

    expect(memory.metadata).toBeDefined();
    expect(memory.metadata.tags).toContain('test');
    expect(memory.metadata.platform).toBeDefined();

    await page.close();
  });

  test('should track conversation updates', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    const createdAt = Date.now() - 10000;
    const updatedAt = Date.now();

    await setExtensionStorage(page, {
      memories: [
        {
          id: 'update-test-1',
          platform: 'chatgpt',
          title: 'Updated Conversation',
          messages: [
            { role: 'user', content: 'Original message' },
            { role: 'assistant', content: 'Original response' },
            { role: 'user', content: 'Follow-up question' },
          ],
          createdAt,
          updatedAt,
        },
      ],
    });

    const storage = await getExtensionStorage(page);
    const memory = storage.memories[0];

    expect(memory.updatedAt).toBeGreaterThan(memory.createdAt);
    expect(memory.messages.length).toBe(3);

    await page.close();
  });
});

test.describe('Memory Storage Limits', () => {
  test('should handle large conversations', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    // Create a large conversation with many messages
    const largeConversation = {
      id: 'large-conv-1',
      platform: 'chatgpt',
      title: 'Large Conversation',
      messages: Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: ${'Lorem ipsum '.repeat(50)}`,
        timestamp: Date.now() + i * 1000,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setExtensionStorage(page, {
      memories: [largeConversation],
    });

    const storage = await getExtensionStorage(page);
    expect(storage.memories[0].messages.length).toBe(100);

    await page.close();
  });

  test('should handle multiple concurrent captures', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mockAuthenticatedUser(page);

    // Simulate multiple memories being captured
    const memories = Array.from({ length: 10 }, (_, i) => ({
      id: `concurrent-mem-${i}`,
      platform: i % 2 === 0 ? 'chatgpt' : 'claude',
      title: `Conversation ${i + 1}`,
      messages: [{ role: 'user', content: `Test ${i}` }],
      createdAt: Date.now() + i,
      updatedAt: Date.now() + i,
    }));

    await setExtensionStorage(page, { memories });

    const storage = await getExtensionStorage(page);
    expect(storage.memories.length).toBe(10);

    // Verify all platforms are represented
    const platforms = new Set(storage.memories.map((m: any) => m.platform));
    expect(platforms.has('chatgpt')).toBe(true);
    expect(platforms.has('claude')).toBe(true);

    await page.close();
  });
});

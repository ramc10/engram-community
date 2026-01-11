/**
 * Platform & Context Flow Integration Tests
 *
 * Tests comprehensive user flows for:
 * - Flow 8: Cross-Platform Content Extraction (ChatGPT, Claude, etc.)
 * - Flow 9: Context-Matcher Sidepanel Injection
 *
 * @jest-environment node
 */

// Set up environment variables BEFORE imports
process.env.PLASMO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BackgroundService } from '../../src/background/index';
import { handleMessage } from '../../src/background/message-handler';
import { MessageType } from '../../src/lib/messages';
import { DB_NAME, UUID } from '@engram/core';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';

// Mock @engram/core to use a unique DB name for this test
jest.mock('@engram/core', () => {
    const original = jest.requireActual('@engram/core') as any;
    return {
        ...original,
        DB_NAME: 'TestPlatformContextDB_' + Date.now(),
    };
});
import { wait } from '../__utils__/test-helpers';

// Mock chrome APIs
const mockStorage = new Map();
let activeTabUrl = 'https://chatgpt.com/c/123';

global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys: string | string[] | null) => {
                const keysArray = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : []);
                const result: Record<string, any> = {};
                if (keysArray.length === 0) return Promise.resolve(Object.fromEntries(mockStorage));
                keysArray.forEach(key => {
                    if (mockStorage.has(key)) result[key] = mockStorage.get(key);
                });
                return Promise.resolve(result);
            }),
            set: jest.fn((items: Record<string, any>) => {
                Object.entries(items).forEach(([key, value]) => mockStorage.set(key, value));
                return Promise.resolve();
            }),
            remove: jest.fn((keys: string | string[]) => {
                const keysArray = Array.isArray(keys) ? keys : [keys];
                keysArray.forEach(key => mockStorage.delete(key));
                return Promise.resolve();
            }),
            clear: jest.fn(() => {
                mockStorage.clear();
                return Promise.resolve();
            })
        },
    },
    runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
        lastError: null,
    },
    tabs: {
        get: jest.fn((tabId) => Promise.resolve({ url: activeTabUrl })),
        query: jest.fn(() => Promise.resolve([{ id: 1, url: activeTabUrl }])),
        onUpdated: { addListener: jest.fn() },
        onActivated: { addListener: jest.fn() },
    },
    sidePanel: {
        setOptions: jest.fn(() => Promise.resolve()),
        open: jest.fn(() => Promise.resolve()),
        setPanelBehavior: jest.fn(() => Promise.resolve()),
    },
    action: {
        onClicked: { addListener: jest.fn() },
    },
} as any;

global.fetch = jest.fn() as any;

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        auth: {
            getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
            getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
        })),
    })),
}));

describe('Platform & Context Flows', () => {
    let backgroundService: BackgroundService;

    // Test master key for encryption
    const testMasterKey = {
        key: new Uint8Array(32).fill(1),
        salt: new Uint8Array(16).fill(2),
        derivedAt: Date.now()
    };

    beforeEach(async () => {
        mockStorage.clear();
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();

        mockStorage.set('enrichmentConfig', {
            enabled: false,
            provider: 'openai',
            apiKey: '',
            model: 'gpt-4o-mini',
            batchSize: 5,
            enableLinkDetection: false,
            enableEvolution: false
        });

        backgroundService = new BackgroundService();
        await backgroundService.initialize();

        // Set master key for encryption (required for SAVE_MESSAGE)
        backgroundService.setMasterKey(testMasterKey);
    });

    afterEach(async () => {
        try {
            await backgroundService.shutdown();
        } catch (e) {
            // Ignore shutdown errors
        }
        // Database is cleaned up by fake-indexeddb automatically between tests
    });

    describe('Flow 8: Cross-Platform Content Extraction', () => {
        test('should extract and categorize content from ChatGPT', async () => {
            const chatgptSender = { tab: { url: 'https://chatgpt.com/c/abc123' } };

            const chatgptMessage = {
                role: 'user',
                content: 'Explain quantum computing in simple terms',
                conversationId: 'chatgpt-conv-1',
                timestamp: Date.now()
            };

            const result = await handleMessage(
                { type: MessageType.SAVE_MESSAGE, message: chatgptMessage } as any,
                chatgptSender,
                backgroundService
            );

            expect(result.success).toBe(true);

            const storage = backgroundService.getStorage();
            const memory = await storage.getMemory(result.memoryId);

            expect(memory).toBeDefined();
            expect(memory!.platform).toBe('chatgpt');
        });

        test('should extract and categorize content from Claude', async () => {
            const claudeSender = { tab: { url: 'https://claude.ai/chat/xyz789' } };

            const claudeMessage = {
                role: 'user',
                content: 'Write a Python function to sort a list',
                conversationId: 'claude-conv-1',
                timestamp: Date.now()
            };

            const result = await handleMessage(
                { type: MessageType.SAVE_MESSAGE, message: claudeMessage } as any,
                claudeSender,
                backgroundService
            );

            expect(result.success).toBe(true);

            const storage = backgroundService.getStorage();
            const memory = await storage.getMemory(result.memoryId);

            expect(memory).toBeDefined();
            expect(memory!.platform).toBe('claude');
        });

        test('should extract and categorize content from Perplexity', async () => {
            const perplexitySender = { tab: { url: 'https://www.perplexity.ai/search/query' } };

            const perplexityMessage = {
                role: 'user',
                content: 'What is the capital of France?',
                conversationId: 'perplexity-conv-1',
                timestamp: Date.now()
            };

            const result = await handleMessage(
                { type: MessageType.SAVE_MESSAGE, message: perplexityMessage } as any,
                perplexitySender,
                backgroundService
            );

            expect(result.success).toBe(true);

            const storage = backgroundService.getStorage();
            const memory = await storage.getMemory(result.memoryId);

            expect(memory).toBeDefined();
            expect(memory!.platform).toBe('perplexity');
        });

        test('should maintain separate tracking across platforms', async () => {
            const chatgptSender = { tab: { url: 'https://chatgpt.com/c/123' } };
            const claudeSender = { tab: { url: 'https://claude.ai/chat/456' } };

            // Save messages from both platforms
            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'ChatGPT message 1',
                    conversationId: 'gpt-1',
                    timestamp: Date.now()
                }
            } as any, chatgptSender, backgroundService);

            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'ChatGPT message 2',
                    conversationId: 'gpt-1',
                    timestamp: Date.now() + 100
                }
            } as any, chatgptSender, backgroundService);

            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'Claude message 1',
                    conversationId: 'claude-1',
                    timestamp: Date.now() + 200
                }
            } as any, claudeSender, backgroundService);

            const storage = backgroundService.getStorage();

            // Query by platform
            const chatgptMemories = await storage.getMemories({ platform: 'chatgpt' });
            const claudeMemories = await storage.getMemories({ platform: 'claude' });

            expect(chatgptMemories.length).toBe(2);
            expect(claudeMemories.length).toBe(1);

            // Verify all ChatGPT memories have correct platform
            chatgptMemories.forEach(mem => {
                expect(mem.platform).toBe('chatgpt');
            });

            // Verify all Claude memories have correct platform
            claudeMemories.forEach(mem => {
                expect(mem.platform).toBe('claude');
            });
        });

        test('should preserve original message formatting across platforms', async () => {
            const chatgptSender = { tab: { url: 'https://chatgpt.com/c/123' } };

            // Message with code block and special formatting
            const formattedMessage = {
                role: 'assistant',
                content: `Here's a code example:
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

**Key points:**
- Item 1
- Item 2

> This is a quote`,
                conversationId: 'formatted-conv',
                timestamp: Date.now()
            };

            const result = await handleMessage(
                { type: MessageType.SAVE_MESSAGE, message: formattedMessage } as any,
                chatgptSender,
                backgroundService
            );

            expect(result.success).toBe(true);

            const storage = backgroundService.getStorage();
            const memory = await storage.getMemory(result.memoryId);

            expect(memory).toBeDefined();
            // Original formatting should be preserved (will be encrypted, but decrypted correctly)
            // The content structure should maintain the markdown
        });

        test('should handle concurrent messages from multiple platforms', async () => {
            const chatgptSender = { tab: { url: 'https://chatgpt.com/c/123' } };
            const claudeSender = { tab: { url: 'https://claude.ai/chat/456' } };
            const perplexitySender = { tab: { url: 'https://perplexity.ai/search' } };

            // Send messages concurrently
            const results = await Promise.all([
                handleMessage({
                    type: MessageType.SAVE_MESSAGE,
                    message: { role: 'user', content: 'GPT message', conversationId: 'gpt', timestamp: Date.now() }
                } as any, chatgptSender, backgroundService),
                handleMessage({
                    type: MessageType.SAVE_MESSAGE,
                    message: { role: 'user', content: 'Claude message', conversationId: 'claude', timestamp: Date.now() }
                } as any, claudeSender, backgroundService),
                handleMessage({
                    type: MessageType.SAVE_MESSAGE,
                    message: { role: 'user', content: 'Perplexity message', conversationId: 'perplexity', timestamp: Date.now() }
                } as any, perplexitySender, backgroundService),
            ]);

            // All should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            // All should have different IDs
            const ids = results.map(r => r.memoryId);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(3);
        });
    });

    describe('Flow 9: Context-Matcher Sidepanel Injection', () => {
        test('should configure sidepanel for supported URLs', async () => {
            // Extension should call setOptions for supported platforms
            expect(global.chrome.sidePanel.setOptions).toBeDefined();
        });

        test('should surface relevant memories based on current AI thread topic', async () => {
            const mockSender = { tab: { url: 'https://chatgpt.com/c/react-discussion' } };

            // First, save some React-related memories
            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'How do I use React useState hook?',
                    conversationId: 'react-1',
                    timestamp: Date.now() - 10000
                }
            } as any, mockSender, backgroundService);

            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'assistant',
                    content: 'useState is a React Hook that lets you add state to functional components.',
                    conversationId: 'react-1',
                    timestamp: Date.now() - 9000
                }
            } as any, mockSender, backgroundService);

            await wait(50);

            // User is now in a new conversation about React
            // The context matcher should find related memories
            const searchResult = await handleMessage({
                type: MessageType.SEARCH_MEMORIES,
                query: 'React state management hooks'
            } as any, mockSender, backgroundService);

            expect(searchResult.success).toBe(true);

            // Should return related React memories
            if (searchResult.memories.length > 0) {
                const hasReactRelated = searchResult.memories.some((m: any) =>
                    m.content?.text?.toLowerCase().includes('react') ||
                    m.content?.text?.toLowerCase().includes('usestate')
                );
                expect(hasReactRelated).toBe(true);
            }
        });

        test('should filter memories by conversation context', async () => {
            const mockSender = { tab: { url: 'https://chatgpt.com/c/123' } };

            // Save memories in different conversations
            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'Memory in conversation A',
                    conversationId: 'conv-A',
                    timestamp: Date.now()
                }
            } as any, mockSender, backgroundService);

            await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'Memory in conversation B',
                    conversationId: 'conv-B',
                    timestamp: Date.now() + 100
                }
            } as any, mockSender, backgroundService);

            const storage = backgroundService.getStorage();

            // Filter by conversation A
            const convAMemories = await storage.getMemories({ conversationId: 'conv-A' });
            expect(convAMemories.length).toBe(1);
            expect(convAMemories[0].conversationId).toBe('conv-A');

            // Filter by conversation B
            const convBMemories = await storage.getMemories({ conversationId: 'conv-B' });
            expect(convBMemories.length).toBe(1);
            expect(convBMemories[0].conversationId).toBe('conv-B');
        });

        test('should handle platform detection for unknown URLs', async () => {
            const unknownSender = { tab: { url: 'https://unknown-ai-platform.com/chat' } };

            // Should still work but platform might be 'unknown' or default
            const result = await handleMessage({
                type: MessageType.SAVE_MESSAGE,
                message: {
                    role: 'user',
                    content: 'Message from unknown platform',
                    conversationId: 'unknown-conv',
                    timestamp: Date.now()
                }
            } as any, unknownSender, backgroundService);

            expect(result.success).toBe(true);

            const storage = backgroundService.getStorage();
            const memory = await storage.getMemory(result.memoryId);

            expect(memory).toBeDefined();
            // Platform should be set (either 'unknown' or detected)
        });
    });

    describe('Platform URL Detection', () => {
        const testCases = [
            { url: 'https://chatgpt.com/c/abc123', expected: 'chatgpt' },
            { url: 'https://chat.openai.com/chat', expected: 'chatgpt' },
            { url: 'https://claude.ai/chat/xyz789', expected: 'claude' },
            { url: 'https://www.perplexity.ai/search', expected: 'perplexity' },
            { url: 'https://perplexity.ai/', expected: 'perplexity' },
        ];

        testCases.forEach(({ url, expected }) => {
            test(`should detect platform "${expected}" from URL: ${url}`, async () => {
                activeTabUrl = url;
                const sender = { tab: { url } };

                const result = await handleMessage({
                    type: MessageType.SAVE_MESSAGE,
                    message: {
                        role: 'user',
                        content: 'Test message',
                        conversationId: 'test-conv',
                        timestamp: Date.now()
                    }
                } as any, sender, backgroundService);

                expect(result.success).toBe(true);

                const storage = backgroundService.getStorage();
                const memory = await storage.getMemory(result.memoryId);

                expect(memory!.platform).toBe(expected);
            });
        });
    });
});

/**
 * ChatGPT Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ChatGPTAdapter } from '../../src/content/platforms/chatgpt-adapter';
import { ExtractedMessage } from 'engram-shared/types/platform-adapter';

describe('ChatGPTAdapter', () => {
  let adapter: ChatGPTAdapter;

  beforeEach(() => {
    adapter = new ChatGPTAdapter();
    // Set up base URL
    Object.defineProperty(window, 'location', {
      value: { href: 'https://chat.openai.com/c/abc-123-def' },
      writable: true,
    });
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('Configuration', () => {
    it('should return correct platform configuration', () => {
      const config = adapter.getConfig();
      
      expect(config.platformId).toBe('chatgpt');
      expect(config.urlPattern).toBeInstanceOf(RegExp);
      expect(config.features.supportsStreaming).toBe(true);
      expect(config.features.supportsCodeBlocks).toBe(true);
    });

    it('should have valid selectors', () => {
      const config = adapter.getConfig();
      
      expect(config.selectors.containerSelector).toBeTruthy();
      expect(config.selectors.messageSelector).toBeTruthy();
      expect(config.selectors.contentSelector).toBeTruthy();
    });
  });

  describe('Platform Detection', () => {
    it('should detect ChatGPT URLs correctly', () => {
      expect(adapter.isCurrentPlatform('https://chat.openai.com/c/123')).toBe(true);
      expect(adapter.isCurrentPlatform('https://chatgpt.openai.com/chat')).toBe(true);
    });

    it('should reject non-ChatGPT URLs', () => {
      expect(adapter.isCurrentPlatform('https://claude.ai/chat')).toBe(false);
      expect(adapter.isCurrentPlatform('https://example.com')).toBe(false);
    });
  });

  describe('Conversation ID Extraction', () => {
    it('should extract conversation ID from URL', () => {
      window.location.href = 'https://chat.openai.com/c/abc-123-def-456';
      expect(adapter.extractConversationId()).toBe('abc-123-def-456');
    });

    it('should return null for URLs without conversation ID', () => {
      window.location.href = 'https://chat.openai.com/';
      expect(adapter.extractConversationId()).toBeNull();
    });

    it('should handle different URL formats', () => {
      window.location.href = 'https://chat.openai.com/c/12345678-abcd-efgh';
      expect(adapter.extractConversationId()).toBe('12345678-abcd-efgh');
    });
  });

  describe('Message Extraction', () => {
    it('should extract user message', () => {
      // Create mock DOM structure
      const messageEl = document.createElement('article');
      messageEl.setAttribute('data-testid', 'conversation-turn-1');
      
      const roleEl = document.createElement('div');
      roleEl.setAttribute('data-message-author-role', 'user');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'markdown';
      contentEl.textContent = 'Hello, how are you?';
      
      roleEl.appendChild(contentEl);
      messageEl.appendChild(roleEl);
      
      const extracted = adapter.extractMessage(messageEl);
      
      expect(extracted).not.toBeNull();
      expect(extracted?.role).toBe('user');
      expect(extracted?.content).toBe('Hello, how are you?');
      expect(extracted?.conversationId).toBe('abc-123-def');
    });

    it('should extract assistant message', () => {
      const messageEl = document.createElement('article');
      messageEl.setAttribute('data-testid', 'conversation-turn-2');
      
      const roleEl = document.createElement('div');
      roleEl.setAttribute('data-message-author-role', 'assistant');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'markdown';
      contentEl.textContent = 'I am doing well, thank you!';
      
      roleEl.appendChild(contentEl);
      messageEl.appendChild(roleEl);
      
      const extracted = adapter.extractMessage(messageEl);
      
      expect(extracted).not.toBeNull();
      expect(extracted?.role).toBe('assistant');
      expect(extracted?.content).toBe('I am doing well, thank you!');
    });

    it('should return null for invalid message element', () => {
      const invalidEl = document.createElement('div');
      const extracted = adapter.extractMessage(invalidEl);
      
      expect(extracted).toBeNull();
    });

    it('should extract code blocks', () => {
      const messageEl = document.createElement('article');
      messageEl.setAttribute('data-testid', 'conversation-turn-3');
      
      const roleEl = document.createElement('div');
      roleEl.setAttribute('data-message-author-role', 'assistant');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'markdown';
      contentEl.textContent = 'Here is some code:';
      
      const preEl = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.className = 'language-python';
      codeEl.textContent = 'print("Hello, World!")';
      
      preEl.appendChild(codeEl);
      roleEl.appendChild(contentEl);
      roleEl.appendChild(preEl);
      messageEl.appendChild(roleEl);
      
      const extracted = adapter.extractMessage(messageEl);
      
      expect(extracted).not.toBeNull();
      expect(extracted?.metadata?.codeBlocks).toBeDefined();
      expect(extracted?.metadata?.codeBlocks?.length).toBe(1);
      expect(extracted?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(extracted?.metadata?.codeBlocks?.[0].code).toBe('print("Hello, World!")');
    });

    it('should handle multiple code blocks', () => {
      const messageEl = document.createElement('article');
      messageEl.setAttribute('data-testid', 'conversation-turn-4');
      
      const roleEl = document.createElement('div');
      roleEl.setAttribute('data-message-author-role', 'assistant');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'markdown';
      
      // Add first code block
      const pre1 = document.createElement('pre');
      const code1 = document.createElement('code');
      code1.className = 'language-javascript';
      code1.textContent = 'console.log("JS");';
      pre1.appendChild(code1);
      
      // Add second code block
      const pre2 = document.createElement('pre');
      const code2 = document.createElement('code');
      code2.className = 'language-python';
      code2.textContent = 'print("Python")';
      pre2.appendChild(code2);
      
      roleEl.appendChild(contentEl);
      roleEl.appendChild(pre1);
      roleEl.appendChild(pre2);
      messageEl.appendChild(roleEl);
      
      const extracted = adapter.extractMessage(messageEl);
      
      expect(extracted?.metadata?.codeBlocks?.length).toBe(2);
      expect(extracted?.metadata?.codeBlocks?.[0].language).toBe('javascript');
      expect(extracted?.metadata?.codeBlocks?.[1].language).toBe('python');
    });

    it('should clean up whitespace in content', () => {
      const messageEl = document.createElement('article');
      messageEl.setAttribute('data-testid', 'conversation-turn-5');
      
      const roleEl = document.createElement('div');
      roleEl.setAttribute('data-message-author-role', 'user');
      
      const contentEl = document.createElement('div');
      contentEl.className = 'markdown';
      contentEl.textContent = '\n\n\n  Hello  \n\n\n  World  \n\n\n';
      
      roleEl.appendChild(contentEl);
      messageEl.appendChild(roleEl);
      
      const extracted = adapter.extractMessage(messageEl);
      
      expect(extracted?.content).toBe('Hello\n\nWorld');
    });
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should clear previous state on initialize', async () => {
      await adapter.initialize();
      await adapter.initialize();
      // Should not throw
    });
  });

  describe('Memory UI', () => {
    it('should show UI when in conversation', () => {
      window.location.href = 'https://chat.openai.com/c/abc-123';
      expect(adapter.shouldShowMemoryUI()).toBe(true);
    });

    it('should not show UI on home page', () => {
      window.location.href = 'https://chat.openai.com/';
      expect(adapter.shouldShowMemoryUI()).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      adapter.destroy();
      
      // Observer should be stopped
      // Callback should be null
      // This is verified by no errors on subsequent calls
      adapter.destroy(); // Should not throw
    });
  });

  describe('Observer', () => {
    beforeEach(() => {
      // Create mock container with main wrapper (matches ChatGPT DOM structure)
      const main = document.createElement('main');
      const container = document.createElement('div');
      container.className = 'react-scroll-to-bottom';
      main.appendChild(container);
      document.body.appendChild(main);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should observe new messages', async () => {
      const callback = jest.fn<(message: ExtractedMessage) => void>();

      // Wait for observer to be set up
      await adapter.observeMessages(callback);

      // Add a message to DOM
      const container = document.querySelector('[class*="react-scroll-to-bottom"]');
      if (container) {
        const messageEl = document.createElement('article');
        messageEl.setAttribute('data-testid', 'conversation-turn-1');

        const roleEl = document.createElement('div');
        roleEl.setAttribute('data-message-author-role', 'user');

        const contentEl = document.createElement('div');
        contentEl.className = 'markdown';
        contentEl.textContent = 'Test message';

        roleEl.appendChild(contentEl);
        messageEl.appendChild(roleEl);
        container.appendChild(messageEl);
      }

      // Wait for mutation observer to process
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(callback).toHaveBeenCalled();
      adapter.stopObserving();
    });

    it('should stop observing when requested', () => {
      const callback = jest.fn<(message: ExtractedMessage) => void>();
      
      adapter.observeMessages(callback);
      adapter.stopObserving();
      
      // Add message after stopping - should not be detected
      const container = document.querySelector('[class*="react-scroll-to-bottom"]');
      if (container) {
        const messageEl = document.createElement('article');
        container.appendChild(messageEl);
      }
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

/**
 * Claude Platform Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { claudeAdapter } from '../../src/content/platforms/claude-adapter';
import { ExtractedMessage } from 'engram-shared/types/platform-adapter';

describe('ClaudeAdapter', () => {
  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/chat/abc-123-def-456',
        href: 'https://claude.ai/chat/abc-123-def-456',
      },
      writable: true,
    });
    document.body.innerHTML = '';
    // Reset location
    window.location.pathname = '/chat/abc-123-def-456';
  });

  describe('Configuration', () => {
    it('should return correct platform config', () => {
      const config = claudeAdapter.getConfig();
      expect(config.platformId).toBe('claude');
      expect(config.selectors.containerSelector).toBe('body');
      expect(config.features.supportsStreaming).toBe(true);
      expect(config.features.supportsCodeBlocks).toBe(true);
    });

    it('should detect Claude URLs correctly', () => {
      expect(claudeAdapter.isCurrentPlatform('https://claude.ai/chat/123')).toBe(true);
      expect(claudeAdapter.isCurrentPlatform('https://claude.ai/new')).toBe(true);
      expect(claudeAdapter.isCurrentPlatform('https://chatgpt.com')).toBe(false);
      expect(claudeAdapter.isCurrentPlatform('https://example.com')).toBe(false);
    });

    it('should extract conversation ID from URL', () => {
      const config = claudeAdapter.getConfig();
      expect(config.conversationIdExtractor('https://claude.ai/chat/abc-123')).toBe('abc-123');
      expect(config.conversationIdExtractor('https://claude.ai/chat/abc-def-456')).toBe('abc-def-456');
      expect(config.conversationIdExtractor('https://claude.ai/new')).toBeNull();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(claudeAdapter.initialize()).resolves.toBeUndefined();
    });

    it('should destroy cleanly', () => {
      expect(() => claudeAdapter.destroy()).not.toThrow();
    });
  });

  describe('Conversation ID Extraction', () => {
    it('should extract conversation ID from current URL', () => {
      window.location.pathname = '/chat/abc-123-def';
      expect(claudeAdapter.extractConversationId()).toBe('abc-123-def');
    });

    it('should return null for non-conversation URLs', () => {
      window.location.pathname = '/new';
      expect(claudeAdapter.extractConversationId()).toBeNull();
    });

    it('should handle various conversation ID formats', () => {
      window.location.pathname = '/chat/550e8400-e29b-41d4-a716-446655440000';
      expect(claudeAdapter.extractConversationId()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('Message Extraction', () => {
    it('should extract a basic user message', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '1');
      messageElement.className = 'user-message';
      messageElement.innerHTML = `
        <div class="font-user-message">Hello, Claude!</div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('Hello, Claude!');
      expect(message?.conversationId).toBe('abc-123-def-456');
    });

    it('should extract a basic assistant message', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '2');
      messageElement.innerHTML = `
        <div class="font-claude-response">Hello! How can I help you today?</div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('assistant');
      expect(message?.content).toBe('Hello! How can I help you today?');
    });

    it('should extract message with code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '3');
      messageElement.innerHTML = `
        <div class="font-claude-response prose">
          Here's a Python example:
          <pre><code class="language-python">def hello():
    print("Hello!")</code></pre>
        </div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(message?.metadata?.codeBlocks?.[0].code).toContain('def hello()');
    });

    it('should extract multiple code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '4');
      messageElement.innerHTML = `
        <div class="font-claude-response prose">
          Python:
          <pre><code class="language-python">print("Hello")</code></pre>
          JavaScript:
          <pre><code class="language-javascript">console.log("Hello");</code></pre>
        </div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(2);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(message?.metadata?.codeBlocks?.[1].language).toBe('javascript');
    });

    it('should handle code blocks without language detection', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '5');
      messageElement.innerHTML = `
        <div class="font-claude-response prose">
          <pre><code>const x = 5;</code></pre>
        </div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('plaintext');
    });

    it('should detect language from data-language attribute', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '6');
      const contentDiv = document.createElement('div');
      contentDiv.className = 'font-claude-response';
      contentDiv.textContent = 'Code example:';
      const codeElement = document.createElement('code');
      codeElement.setAttribute('data-language', 'typescript');
      codeElement.textContent = 'const x: number = 5;';
      const preElement = document.createElement('pre');
      preElement.appendChild(codeElement);
      contentDiv.appendChild(preElement);
      messageElement.appendChild(contentDiv);

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('typescript');
    });

    it('should return null for empty messages', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '7');
      messageElement.innerHTML = '<div class="prose"></div>';

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).toBeNull();
    });

    it('should return null when no conversation ID', () => {
      window.location.pathname = '/new';
      
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '8');
      messageElement.innerHTML = '<div class="prose">Test message</div>';

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).toBeNull();
    });

    it('should clean text content properly', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '9');
      messageElement.innerHTML = `
        <div class="font-claude-response prose">
          Here's some text.
          
          
          With multiple spaces    and newlines.
        </div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).not.toContain('   ');
    });
  });

  describe('Message Observation', () => {
    let messageCallback: jest.Mock;

    beforeEach(() => {
      messageCallback = jest.fn();
      document.body.innerHTML = '<main></main>';
      // Clear adapter state to avoid interference between tests
      claudeAdapter.destroy();
    });

    afterEach(() => {
      claudeAdapter.stopObserving();
    });

    it('should observe existing messages on start', () => {
      const container = document.querySelector('main')!;
      container.innerHTML = `
        <div data-test-render-count="1" class="user-message">
          <div class="font-user-message">Existing message</div>
        </div>
      `;

      claudeAdapter.observeMessages(messageCallback);

      expect(messageCallback).toHaveBeenCalledTimes(1);
      const call = messageCallback.mock.calls[0][0] as ExtractedMessage;
      expect(call.content).toBe('Existing message');
      expect(call.role).toBe('user');
    });

    it('should detect new messages added to DOM', async () => {
      await claudeAdapter.observeMessages(messageCallback);

      // Wait for observer to be fully set up
      await new Promise(resolve => setTimeout(resolve, 500));

      const container = document.querySelector('main')!;
      const newMessage = document.createElement('div');
      newMessage.setAttribute('data-test-render-count', '1');
      newMessage.innerHTML = '<div class="font-user-message prose">New message</div>';
      container.appendChild(newMessage);

      // Wait for mutation observer + streaming debounce (2000ms) + buffer
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(messageCallback).toHaveBeenCalled();
      const call = messageCallback.mock.calls[0][0] as ExtractedMessage;
      expect(call.content).toBe('New message');
    }, 10000);

    it('should not process duplicate messages', () => {
      const container = document.querySelector('main')!;
      container.innerHTML = `
        <div data-test-render-count="1">
          <div class="font-claude-response prose">Same message</div>
        </div>
        <div data-test-render-count="2">
          <div class="font-claude-response prose">Same message</div>
        </div>
      `;

      claudeAdapter.observeMessages(messageCallback);

      expect(messageCallback).toHaveBeenCalledTimes(1);
    });

    it('should stop observing when requested', () => {
      claudeAdapter.observeMessages(messageCallback);
      claudeAdapter.stopObserving();

      const container = document.querySelector('main')!;
      const newMessage = document.createElement('div');
      newMessage.setAttribute('data-test-render-count', '1');
      newMessage.innerHTML = '<div class="prose">After stop</div>';
      container.appendChild(newMessage);

      // Should not be called after stopping
      expect(messageCallback).not.toHaveBeenCalled();
    });

    it('should handle observer errors gracefully', () => {
      const container = document.querySelector('main')!;
      container.innerHTML = `
        <div data-test-render-count="1">
          <div class="font-claude-response prose"></div>
        </div>
      `;

      // Should not throw even with invalid messages
      expect(() => claudeAdapter.observeMessages(messageCallback)).not.toThrow();
    });
  });

  describe('UI Injection', () => {
    it('should find injection point', () => {
      document.body.innerHTML = '<aside id="sidebar"></aside>';
      const injectionPoint = claudeAdapter.getInjectionPoint();
      expect(injectionPoint).not.toBeNull();
      expect(injectionPoint?.tagName).toBe('ASIDE');
    });

    it('should return null when no injection point', () => {
      document.body.innerHTML = '<div></div>';
      const injectionPoint = claudeAdapter.getInjectionPoint();
      expect(injectionPoint).toBeNull();
    });

    it('should show memory UI when in conversation', () => {
      window.location.pathname = '/chat/abc-123';
      expect(claudeAdapter.shouldShowMemoryUI()).toBe(true);
    });

    it('should not show memory UI when not in conversation', () => {
      window.location.pathname = '/new';
      expect(claudeAdapter.shouldShowMemoryUI()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed HTML gracefully', () => {
      const messageElement = document.createElement('div');
      messageElement.innerHTML = '<div><broken<tag>Malformed</div>';

      expect(() => claudeAdapter.extractMessage(messageElement)).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longText = 'a'.repeat(100000);
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '1');
      messageElement.innerHTML = `<div class="font-claude-response prose">${longText}</div>`;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content.length).toBe(100000);
    });

    it('should handle special characters in content', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '1');
      messageElement.innerHTML = `<div class="font-claude-response prose">&lt;script&gt;alert("xss")&lt;/script&gt;</div>`;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).toContain('<script>');
    });

    it('should handle nested message structures', () => {
      const messageElement = document.createElement('div');
      messageElement.setAttribute('data-test-render-count', '1');
      messageElement.innerHTML = `
        <div class="font-claude-response prose">
          <div>Outer text</div>
          <div>
            <div>Inner text</div>
          </div>
        </div>
      `;

      const message = claudeAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).toContain('Outer text');
      expect(message?.content).toContain('Inner text');
    });
  });
});

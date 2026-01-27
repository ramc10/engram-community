/**
 * Gemini Platform Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { geminiAdapter } from '../../src/content/platforms/gemini-adapter';
import type { ExtractedMessage } from '@engram/core';

describe('GeminiAdapter', () => {
  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/app/test-conversation-123',
        href: 'https://gemini.google.com/app/test-conversation-123',
      },
      writable: true,
    });
    document.body.innerHTML = '';
    // Reset location
    window.location.pathname = '/app/test-conversation-123';
  });

  afterEach(() => {
    geminiAdapter.destroy();
  });

  describe('Configuration', () => {
    it('should return correct platform config', () => {
      const config = geminiAdapter.getConfig();
      expect(config.platformId).toBe('gemini');
      expect(config.selectors.containerSelector).toBe('chat-window, main');
      expect(config.features.supportsStreaming).toBe(true);
      expect(config.features.supportsCodeBlocks).toBe(true);
    });

    it('should detect Gemini URLs correctly', () => {
      expect(geminiAdapter.isCurrentPlatform('https://gemini.google.com/app/123')).toBe(true);
      expect(geminiAdapter.isCurrentPlatform('https://gemini.google.com/chat/456')).toBe(true);
      expect(geminiAdapter.isCurrentPlatform('https://gemini.google.com/')).toBe(true);
      expect(geminiAdapter.isCurrentPlatform('https://chatgpt.com')).toBe(false);
      expect(geminiAdapter.isCurrentPlatform('https://example.com')).toBe(false);
    });

    it('should extract conversation ID from URL', () => {
      const config = geminiAdapter.getConfig();
      expect(config.conversationIdExtractor('https://gemini.google.com/app/abc-123')).toBe('abc-123');
      expect(config.conversationIdExtractor('https://gemini.google.com/chat/test_conv_456')).toBe('test_conv_456');
      expect(config.conversationIdExtractor('https://gemini.google.com/')).toBeNull();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(geminiAdapter.initialize()).resolves.toBeUndefined();
    });

    it('should destroy cleanly', () => {
      expect(() => geminiAdapter.destroy()).not.toThrow();
    });
  });

  describe('Conversation ID Extraction', () => {
    it('should extract conversation ID from current URL', () => {
      window.location.pathname = '/app/test-conv-123';
      expect(geminiAdapter.extractConversationId()).toBe('test-conv-123');
    });

    it('should extract conversation ID from chat URL pattern', () => {
      window.location.pathname = '/chat/another-conv-456';
      expect(geminiAdapter.extractConversationId()).toBe('another-conv-456');
    });

    it('should return null for non-conversation URLs', () => {
      window.location.pathname = '/';
      expect(geminiAdapter.extractConversationId()).toBeNull();
    });

    it('should handle various conversation ID formats', () => {
      window.location.pathname = '/app/550e8400-e29b-41d4-a716-446655440000';
      expect(geminiAdapter.extractConversationId()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('Message Extraction', () => {
    it('should extract a basic user message', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'user-query-container';
      messageElement.innerHTML = `
        <div class="query-text">Hello, Gemini!</div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('Hello, Gemini!');
      expect(message?.conversationId).toBe('test-conversation-123');
    });

    it('should extract a basic assistant message', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = `
        <div class="model-response-text">Hello! How can I help you today?</div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('assistant');
      expect(message?.content).toBe('Hello! How can I help you today?');
    });

    it('should extract message with code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = `
        <div class="model-response-text markdown">
          Here's a Python example:
          <pre><code class="language-python">def hello():
    print("Hello!")</code></pre>
        </div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(message?.metadata?.codeBlocks?.[0].code).toContain('def hello()');
    });

    it('should extract multiple code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = `
        <div class="model-response-text markdown">
          Python:
          <pre><code class="language-python">print("Hello")</code></pre>
          JavaScript:
          <pre><code class="language-javascript">console.log("Hello");</code></pre>
        </div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(2);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(message?.metadata?.codeBlocks?.[1].language).toBe('javascript');
    });

    it('should handle code blocks without language detection', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = `
        <div class="model-response-text">
          <pre><code>const x = 5;</code></pre>
        </div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('plaintext');
    });

    it('should detect language from data-language attribute', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'model-response-text';
      contentDiv.textContent = 'Code example:';
      const codeElement = document.createElement('code');
      codeElement.setAttribute('data-language', 'typescript');
      codeElement.textContent = 'const x: number = 5;';
      const preElement = document.createElement('pre');
      preElement.appendChild(codeElement);
      contentDiv.appendChild(preElement);
      messageElement.appendChild(contentDiv);

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('typescript');
    });

    it('should return null for empty messages', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = '<div class="model-response-text"></div>';

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).toBeNull();
    });

    it('should return null when no conversation ID', () => {
      window.location.pathname = '/';

      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = '<div class="model-response-text">Test message</div>';

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).toBeNull();
    });

    it('should return null for messages without specific content selectors', () => {
      // With updated adapter, we don't fallback to element text
      // This prevents capturing random UI elements
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.textContent = 'Direct text content';

      const message = geminiAdapter.extractMessage(messageElement);

      // Should return null because there's no .model-response-text or .query-text child
      expect(message).toBeNull();
    });

    it('should normalize whitespace in extracted content', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'user-query-container';
      messageElement.innerHTML = `
        <div class="query-text">
          This   has    multiple



          newlines   and   spaces
        </div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).not.toContain('   ');
      expect(message?.content).not.toMatch(/\n{3,}/);
    });
  });

  describe('Message Observation', () => {
    beforeEach(async () => {
      await geminiAdapter.initialize();
    });

    it('should process existing messages with retry', async () => {
      // Create a mock message in the DOM - directly append to body
      // The adapter now searches for .user-query-container and .response-container directly
      const messageElement = document.createElement('div');
      messageElement.className = 'user-query-container';
      messageElement.innerHTML = '<div class="query-text">Test message</div>';

      document.body.appendChild(messageElement);

      const messages: ExtractedMessage[] = [];
      const callback = (msg: ExtractedMessage) => messages.push(msg);

      await geminiAdapter.observeMessages(callback);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content).toBe('Test message');
    });

    it('should observe new messages via MutationObserver', async () => {
      const messages: ExtractedMessage[] = [];
      const callback = (msg: ExtractedMessage) => messages.push(msg);

      await geminiAdapter.observeMessages(callback);

      // Wait a bit for observer to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add a new message to the DOM
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = '<div class="model-response-text">New message</div>';
      document.body.appendChild(messageElement);

      // Wait for debounce and processing
      await new Promise(resolve => setTimeout(resolve, 2500));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some(m => m.content === 'New message')).toBe(true);
    });

    it('should debounce streaming messages', async () => {
      const messages: ExtractedMessage[] = [];
      const callback = (msg: ExtractedMessage) => messages.push(msg);

      await geminiAdapter.observeMessages(callback);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a message element
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      const textElement = document.createElement('div');
      textElement.className = 'model-response-text';
      textElement.textContent = 'Streaming';
      messageElement.appendChild(textElement);
      document.body.appendChild(messageElement);

      // Simulate streaming by updating text multiple times
      await new Promise(resolve => setTimeout(resolve, 100));
      textElement.textContent = 'Streaming...';

      await new Promise(resolve => setTimeout(resolve, 100));
      textElement.textContent = 'Streaming message complete';

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should only have saved the message once after streaming completed
      const streamingMessages = messages.filter(m => m.content.includes('Streaming'));
      expect(streamingMessages.length).toBe(1);
      expect(streamingMessages[0].content).toBe('Streaming message complete');
    });

    it('should deduplicate processed messages', async () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'user-query-container';
      messageElement.innerHTML = '<div class="query-text">Duplicate test</div>';
      document.body.appendChild(messageElement);

      const messages: ExtractedMessage[] = [];
      const callback = (msg: ExtractedMessage) => messages.push(msg);

      await geminiAdapter.observeMessages(callback);

      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      const initialCount = messages.length;

      // Trigger mutation that would reprocess the same message
      messageElement.innerHTML = '<div class="query-text">Duplicate test</div>';

      // Wait for potential reprocessing
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should not have added duplicate
      expect(messages.length).toBe(initialCount);
    });

    it('should stop observing when stopObserving is called', async () => {
      const messages: ExtractedMessage[] = [];
      const callback = (msg: ExtractedMessage) => messages.push(msg);

      await geminiAdapter.observeMessages(callback);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stop observing
      geminiAdapter.stopObserving();

      // Add a new message
      const messageElement = document.createElement('div');
      messageElement.className = 'user-query-container';
      messageElement.innerHTML = '<div class="query-text">Should not be captured</div>';
      document.body.appendChild(messageElement);

      // Wait to see if it gets processed
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should not have captured the message
      expect(messages.every(m => m.content !== 'Should not be captured')).toBe(true);
    });
  });

  describe('UI Integration', () => {
    it('should return injection point if available', () => {
      const aside = document.createElement('aside');
      document.body.appendChild(aside);

      const injectionPoint = geminiAdapter.getInjectionPoint();
      expect(injectionPoint).toBe(aside);
    });

    it('should return null if no injection point available', () => {
      const injectionPoint = geminiAdapter.getInjectionPoint();
      expect(injectionPoint).toBeNull();
    });

    it('should show memory UI when conversation ID exists', () => {
      window.location.pathname = '/app/test-123';
      expect(geminiAdapter.shouldShowMemoryUI()).toBe(true);
    });

    it('should not show memory UI when no conversation ID', () => {
      window.location.pathname = '/';
      expect(geminiAdapter.shouldShowMemoryUI()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed HTML gracefully', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = '<div><span>Nested <b>content</b></span></div>';

      expect(() => geminiAdapter.extractMessage(messageElement)).not.toThrow();
    });

    it('should handle messages with only code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'response-container';
      messageElement.innerHTML = `
        <div class="model-response-text">
          <pre><code class="language-python">print("only code")</code></pre>
        </div>
      `;

      const message = geminiAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
    });

    it('should return null for elements without role indicators', () => {
      // With updated adapter, unknown elements are not captured
      // This prevents capturing random UI elements
      const messageElement = document.createElement('div');
      messageElement.innerHTML = '<div>Generic message</div>';

      const message = geminiAdapter.extractMessage(messageElement);

      // Should return null - unknown elements are not processed
      expect(message).toBeNull();
    });
  });
});

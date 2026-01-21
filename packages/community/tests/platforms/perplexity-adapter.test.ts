/**
 * Perplexity Platform Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { perplexityAdapter } from '../../src/content/platforms/perplexity-adapter';
import type { ExtractedMessage } from '@engram/core';

describe('PerplexityAdapter', () => {
  let mockLocation: { pathname: string; href: string };

  beforeEach(() => {
    // Create a mock location object with writable properties
    mockLocation = {
      pathname: '/search/test-search-id',
      href: 'https://www.perplexity.ai/search/test-search-id',
    };

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = '';
  });

  afterEach(() => {
    perplexityAdapter.destroy();
  });

  describe('Configuration', () => {
    it('should return correct platform config', () => {
      const config = perplexityAdapter.getConfig();
      expect(config.platformId).toBe('perplexity');
      expect(config.selectors.containerSelector).toBe('main');
      expect(config.features.supportsStreaming).toBe(true);
      expect(config.features.supportsCodeBlocks).toBe(true);
    });

    it('should detect Perplexity URLs correctly', () => {
      expect(perplexityAdapter.isCurrentPlatform('https://www.perplexity.ai/search/123')).toBe(true);
      expect(perplexityAdapter.isCurrentPlatform('https://perplexity.ai/search/abc')).toBe(true);
      expect(perplexityAdapter.isCurrentPlatform('https://chatgpt.com')).toBe(false);
      expect(perplexityAdapter.isCurrentPlatform('https://example.com')).toBe(false);
    });

    it('should extract conversation ID from URL', () => {
      const config = perplexityAdapter.getConfig();
      expect(config.conversationIdExtractor('https://www.perplexity.ai/search/abc-123')).toBe('abc-123');
      expect(config.conversationIdExtractor('https://perplexity.ai/search/test_id')).toBe('test_id');
      expect(config.conversationIdExtractor('https://perplexity.ai/')).toBeNull();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(perplexityAdapter.initialize()).resolves.toBeUndefined();
    });

    it('should destroy cleanly', () => {
      expect(() => perplexityAdapter.destroy()).not.toThrow();
    });
  });

  describe('Conversation ID Extraction', () => {
    it('should extract conversation ID from current URL', () => {
      window.location.pathname = '/search/abc-123-def';
      expect(perplexityAdapter.extractConversationId()).toBe('abc-123-def');
    });

    it('should return null for non-search URLs', () => {
      window.location.pathname = '/';
      expect(perplexityAdapter.extractConversationId()).toBeNull();
    });

    it('should handle various conversation ID formats', () => {
      window.location.pathname = '/search/test_search_2024';
      expect(perplexityAdapter.extractConversationId()).toBe('test_search_2024');
    });

    it('should handle IDs with hyphens and underscores', () => {
      window.location.pathname = '/search/abc-123_def-456';
      expect(perplexityAdapter.extractConversationId()).toBe('abc-123_def-456');
    });
  });

  describe('Message Extraction', () => {
    it('should extract a basic user message', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'MessageContainer user';
      messageElement.innerHTML = `
        <div class="MessageContent">What is quantum computing?</div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('What is quantum computing?');
      expect(message?.conversationId).toBe('test-search-id');
    });

    it('should extract a basic assistant message', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'MessageContainer';
      messageElement.innerHTML = `
        <div class="prose">Quantum computing is a type of computing...</div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.role).toBe('assistant');
      expect(message?.content).toBe('Quantum computing is a type of computing...');
    });

    it('should extract message with code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          Here's a Python example:
          <pre><code class="language-python">def quantum_gate():
    return "Hadamard"</code></pre>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(message?.metadata?.codeBlocks?.[0].code).toContain('def quantum_gate()');
    });

    it('should extract multiple code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          Python:
          <pre><code class="language-python">print("Hello")</code></pre>
          JavaScript:
          <pre><code class="language-javascript">console.log("World");</code></pre>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(2);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('python');
      expect(message?.metadata?.codeBlocks?.[1].language).toBe('javascript');
    });

    it('should handle code blocks without language detection', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          <pre><code>const x = 5;</code></pre>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('plaintext');
    });

    it('should detect language from parent pre element', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      const preElement = document.createElement('pre');
      preElement.className = 'language-typescript';
      const codeElement = document.createElement('code');
      codeElement.textContent = 'const x: number = 5;';
      preElement.appendChild(codeElement);
      messageElement.appendChild(preElement);

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks?.[0].language).toBe('typescript');
    });

    it('should extract sources/citations', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          According to research, quantum computing...
          <div class="source">
            <a href="https://example.com/quantum">Source 1</a>
          </div>
          <div class="citation">
            <a href="https://arxiv.org/quantum-paper">arXiv Paper</a>
          </div>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.sources).toBeDefined();
      expect(message?.metadata?.sources?.length).toBeGreaterThan(0);
      expect(message?.metadata?.sources).toContain('https://example.com/quantum');
      expect(message?.metadata?.sources).toContain('https://arxiv.org/quantum-paper');
    });

    it('should deduplicate sources', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          <a href="https://example.com">Example</a>
          <a href="https://example.com">Example Again</a>
          <a href="https://other.com">Other</a>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.sources?.length).toBe(2);
      expect(message?.metadata?.sources).toContain('https://example.com');
      expect(message?.metadata?.sources).toContain('https://other.com');
    });

    it('should return null for empty messages', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = '<div class="prose"></div>';

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).toBeNull();
    });

    it('should return null when no conversation ID', () => {
      window.location.pathname = '/';
      
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = '<div class="prose">Test message</div>';

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).toBeNull();
    });

    it('should clean text content properly', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          Here's some text.
          
          
          With multiple spaces    and newlines.
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).not.toContain('   ');
    });
  });

  describe('Message Observation', () => {
    let messageCallback: jest.Mock;

    beforeEach(() => {
      messageCallback = jest.fn();
      document.body.innerHTML = '<main></main>';
    });

    afterEach(() => {
      perplexityAdapter.stopObserving();
    });

    it('should observe existing messages on start', () => {
      const container = document.querySelector('main')!;
      container.innerHTML = `
        <div class="MessageContainer user">
          <div class="MessageContent">Existing message</div>
        </div>
      `;

      perplexityAdapter.observeMessages(messageCallback);

      expect(messageCallback).toHaveBeenCalledTimes(1);
      const call = messageCallback.mock.calls[0][0] as ExtractedMessage;
      expect(call.content).toBe('Existing message');
      expect(call.role).toBe('user');
    });

    it('should detect new messages added to DOM', async () => {
      await perplexityAdapter.observeMessages(messageCallback);

      // Wait for observer to be fully set up
      await new Promise(resolve => setTimeout(resolve, 500));

      const container = document.querySelector('main')!;
      const newMessage = document.createElement('div');
      newMessage.className = 'message';
      newMessage.innerHTML = '<div class="prose">New message</div>';
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
        <div class="message">
          <div class="prose">Same message</div>
        </div>
        <div class="message">
          <div class="prose">Same message</div>
        </div>
      `;

      perplexityAdapter.observeMessages(messageCallback);

      expect(messageCallback).toHaveBeenCalledTimes(1);
    });

    it('should stop observing when requested', () => {
      perplexityAdapter.observeMessages(messageCallback);
      perplexityAdapter.stopObserving();

      const container = document.querySelector('main')!;
      const newMessage = document.createElement('div');
      newMessage.className = 'message';
      newMessage.innerHTML = '<div class="prose">After stop</div>';
      container.appendChild(newMessage);

      // Should not be called after stopping
      expect(messageCallback).not.toHaveBeenCalled();
    });

    it('should handle observer errors gracefully', () => {
      const container = document.querySelector('main')!;
      container.innerHTML = `
        <div class="message">
          <div class="prose"></div>
        </div>
      `;

      // Should not throw even with invalid messages
      expect(() => perplexityAdapter.observeMessages(messageCallback)).not.toThrow();
    });

    it('should detect messages in nested structures', async () => {
      await perplexityAdapter.observeMessages(messageCallback);

      // Wait for observer to be fully set up
      await new Promise(resolve => setTimeout(resolve, 500));

      const container = document.querySelector('main')!;
      const wrapper = document.createElement('div');
      wrapper.className = 'conversation-wrapper';
      const newMessage = document.createElement('div');
      newMessage.className = 'MessageContainer';
      newMessage.innerHTML = '<div class="prose">Nested message</div>';
      wrapper.appendChild(newMessage);
      container.appendChild(wrapper);

      // Wait for mutation observer + streaming debounce (2000ms) + buffer
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(messageCallback).toHaveBeenCalled();
      const call = messageCallback.mock.calls[0][0] as ExtractedMessage;
      expect(call.content).toBe('Nested message');
    }, 10000);
  });

  describe('UI Injection', () => {
    it('should find injection point', () => {
      document.body.innerHTML = '<aside id="sidebar"></aside>';
      const injectionPoint = perplexityAdapter.getInjectionPoint();
      expect(injectionPoint).not.toBeNull();
      expect(injectionPoint?.tagName).toBe('ASIDE');
    });

    it('should find injection point with class', () => {
      document.body.innerHTML = '<div class="sidebar"></div>';
      const injectionPoint = perplexityAdapter.getInjectionPoint();
      expect(injectionPoint).not.toBeNull();
    });

    it('should return null when no injection point', () => {
      document.body.innerHTML = '<div></div>';
      const injectionPoint = perplexityAdapter.getInjectionPoint();
      expect(injectionPoint).toBeNull();
    });

    it('should show memory UI when in search', () => {
      window.location.pathname = '/search/abc-123';
      expect(perplexityAdapter.shouldShowMemoryUI()).toBe(true);
    });

    it('should not show memory UI when not in search', () => {
      window.location.pathname = '/';
      expect(perplexityAdapter.shouldShowMemoryUI()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed HTML gracefully', () => {
      const messageElement = document.createElement('div');
      messageElement.innerHTML = '<div><broken<tag>Malformed</div>';

      expect(() => perplexityAdapter.extractMessage(messageElement)).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longText = 'a'.repeat(100000);
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `<div class="prose">${longText}</div>`;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content.length).toBe(100000);
    });

    it('should handle special characters in content', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `<div class="prose">&lt;script&gt;alert("xss")&lt;/script&gt;</div>`;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).toContain('<script>');
    });

    it('should handle nested message structures', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          <div>Outer text</div>
          <div>
            <div>Inner text</div>
          </div>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.content).toContain('Outer text');
      expect(message?.content).toContain('Inner text');
    });

    it('should handle messages with only code blocks', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          <pre><code class="language-python">print("Only code")</code></pre>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.codeBlocks).toHaveLength(1);
    });

    it('should handle messages with only sources', () => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="prose">
          Some text with sources
          <a href="https://example.com/1">Source 1</a>
          <a href="https://example.com/2">Source 2</a>
        </div>
      `;

      const message = perplexityAdapter.extractMessage(messageElement);

      expect(message).not.toBeNull();
      expect(message?.metadata?.sources?.length).toBe(2);
    });
  });
});

/**
 * Plasmo Content Script Entry Point
 * This file is automatically detected by Plasmo and injected into matching pages
 */

import type { PlasmoCSConfig } from "plasmo";

// Configure which sites this content script runs on
export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://www.perplexity.ai/*"
  ],
  all_frames: false,
  run_at: "document_end"
};

// Direct implementation using platform adapters
import { chatGPTAdapter } from '../content/platforms/chatgpt-adapter';
import { claudeAdapter } from '../content/platforms/claude-adapter';
import { sendInitRequest, sendSaveMessage } from '../lib/messages';
import { PromptInterceptor } from '../content/shared/prompt-interceptor';

/**
 * Simple initialization
 */
(async () => {
  try {
    console.log('[Engram] Plasmo content script starting...');

    // Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // Detect platform
    const url = window.location.href;
    console.log('[Engram] URL:', url);

    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      console.log('[Engram] ChatGPT detected, initializing adapter...');

      // Initialize background connection
      const initResponse = await sendInitRequest();
      if (!initResponse.success) {
        console.error('[Engram] Background init failed:', initResponse.error);
        return;
      }

      console.log('[Engram] Background connected, device ID:', initResponse.deviceId);

      // Initialize adapter
      await chatGPTAdapter.initialize();
      console.log('[Engram] Adapter initialized');

      // Initialize intelligent prompt interceptor with direct insertion mode
      const interceptor = new PromptInterceptor();
      await interceptor.initialize(
        '#prompt-textarea', // ChatGPT textarea selector (contenteditable div)
        'button[data-testid*="send"], button[type="submit"]:not([disabled])', // ChatGPT send button selector
        true // Use direct insertion mode for ChatGPT
      );

      console.log('[Engram] Intelligent auto-injection ready (direct insertion mode)');

      // Start observing messages (now async with retries)
      await chatGPTAdapter.observeMessages(async (extractedMessage) =>{

        console.log('[Engram] Message extracted:', {
          role: extractedMessage.role,
          contentLength: extractedMessage.content.length,
          conversationId: extractedMessage.conversationId
        });

        try {
          const saveResponse = await sendSaveMessage(extractedMessage);
          if (saveResponse.success) {
            console.log('[Engram] Message saved successfully');
          } else {
            console.error('[Engram] Failed to save message:', saveResponse.error);
          }
        } catch (error) {
          console.error('[Engram] Error saving message:', error);
        }
      });

      console.log('[Engram] Ready - monitoring ChatGPT messages (direct insertion mode)');
    } else if (url.includes('claude.ai')) {
      console.log('[Engram] Claude detected, initializing adapter...');

      // Initialize background connection
      const initResponse = await sendInitRequest();
      if (!initResponse.success) {
        console.error('[Engram] Background init failed:', initResponse.error);
        return;
      }

      console.log('[Engram] Background connected, device ID:', initResponse.deviceId);

      // Initialize adapter
      await claudeAdapter.initialize();
      console.log('[Engram] Adapter initialized');

      // Initialize intelligent prompt interceptor
      const interceptor = new PromptInterceptor();
      await interceptor.initialize(
        'div[contenteditable="true"]', // Claude contenteditable input
        'button[aria-label="Send message"]' // Claude send button (note: lowercase 'm')
      );

      console.log('[Engram] Intelligent auto-injection ready');

      // Start observing messages
      await claudeAdapter.observeMessages(async (extractedMessage) => {
        console.log('[Engram] Message extracted:', {
          role: extractedMessage.role,
          contentLength: extractedMessage.content.length,
          conversationId: extractedMessage.conversationId
        });

        try {
          const saveResponse = await sendSaveMessage(extractedMessage);
          if (saveResponse.success) {
            console.log('[Engram] Message saved successfully');
          } else {
            console.error('[Engram] Failed to save message:', saveResponse.error);
          }
        } catch (error) {
          console.error('[Engram] Error saving message:', error);
        }
      });

      console.log('[Engram] Ready - monitoring Claude messages');
    } else {
      console.log('[Engram] Platform not yet supported:', url);
    }
  } catch (error) {
    console.error('[Engram] Content script error:', error);
  }
})();

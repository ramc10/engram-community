/**
 * Manual "Save to memory" context-menu actions (Phase 4c).
 *
 * Two user-initiated captures, independent of the ambient page_visit observer:
 *  - "Save selection to Engram": uses the text Chrome already provides in
 *    info.selectionText, so it needs no page injection or host permission — it
 *    works on any page with just the `contextMenus` permission.
 *  - "Save page to Engram": asks the content script in the active tab to extract
 *    the readable article body and save it. Works wherever the content script
 *    runs (universal once the manifest opens to <all_urls>).
 *
 * Both respect the kill switch / pause (canManuallyCapture).
 */

import type { BackgroundService } from '../background/index';
import { handleMessage } from '../background/message-handler';
import { MessageType } from './messages';
import { getCaptureConfig } from './capture-config';
import { buildSelectionMessage, canManuallyCapture } from '../content/shared/capture-policy';

export const MENU_SAVE_SELECTION = 'engram-save-selection';
export const MENU_SAVE_PAGE = 'engram-save-page';

/** Command the content script understands for "Save page". */
export const SAVE_PAGE_COMMAND = 'ENGRAM_SAVE_PAGE';

/** (Re)create the capture context-menu items. Safe to call repeatedly. */
export function registerCaptureContextMenus(): void {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SAVE_SELECTION,
      title: 'Save selection to Engram',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_PAGE,
      title: 'Save page to Engram',
      contexts: ['page'],
    });
  });
}

/**
 * Wire the context-menu click handler. Selection saves are handled entirely in
 * the background (no page access); page saves are delegated to the content script.
 */
export function registerContextMenuClickHandler(service: BackgroundService): void {
  if (!chrome.contextMenus?.onClicked) return;

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      const config = await getCaptureConfig();
      if (!canManuallyCapture(config)) {
        console.log('[Engram] Manual capture is paused/disabled — ignoring context menu');
        return;
      }

      if (info.menuItemId === MENU_SAVE_SELECTION) {
        const text = (info.selectionText || '').trim();
        const url = tab?.url;
        if (!text || !url) return;

        const message = buildSelectionMessage(url, text);
        const response = await handleMessage(
          { type: MessageType.SAVE_MESSAGE, message } as never,
          { tab } as never,
          service
        );
        console.log('[Engram] Saved selection:', (response as { success?: boolean }).success);
      } else if (info.menuItemId === MENU_SAVE_PAGE) {
        if (!tab?.id) return;
        // The content script extracts the article body and saves it.
        chrome.tabs.sendMessage(tab.id, { type: SAVE_PAGE_COMMAND }, () => {
          // Swallow "no receiver" errors on pages without the content script.
          void chrome.runtime.lastError;
        });
      }
    } catch (error) {
      console.error('[Engram] Context-menu capture error:', error);
    }
  });
}

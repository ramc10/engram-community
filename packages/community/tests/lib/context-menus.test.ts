/**
 * Context-menu manual-save dispatch tests (Phase 4c).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const handleMessage = jest.fn<any>().mockResolvedValue({ success: true });
const getCaptureConfig = jest.fn<any>();

jest.mock('../../src/background/message-handler', () => ({ handleMessage }));
jest.mock('../../src/lib/capture-config', () => ({ getCaptureConfig }));

import {
  registerContextMenuClickHandler,
  MENU_SAVE_SELECTION,
  MENU_SAVE_PAGE,
  SAVE_PAGE_COMMAND,
} from '../../src/lib/context-menus';

const allow = { enabled: true, paused: false, ambientPageVisits: true, deniedHosts: [] };

/** Install a capturing chrome.contextMenus.onClicked mock and return a trigger. */
function setupMenu() {
  let listener: (info: any, tab: any) => void = () => {};
  const sendMessage = jest.fn();
  (global as any).chrome = {
    ...(global as any).chrome,
    contextMenus: {
      removeAll: jest.fn((cb?: () => void) => cb && cb()),
      create: jest.fn(),
      onClicked: { addListener: (fn: any) => { listener = fn; } },
    },
    tabs: { sendMessage },
    runtime: { ...(global as any).chrome?.runtime, lastError: undefined },
  };
  registerContextMenuClickHandler({} as any);
  return {
    click: (info: any, tab: any) => listener(info, tab),
    sendMessage,
  };
}

describe('context-menu manual save', () => {
  beforeEach(() => {
    handleMessage.mockClear();
    getCaptureConfig.mockResolvedValue(allow);
  });

  it('dispatches a SAVE_MESSAGE with a selection capture', async () => {
    const { click } = setupMenu();
    click(
      { menuItemId: MENU_SAVE_SELECTION, selectionText: '  hello world  ' },
      { url: 'https://example.com/a', id: 1 }
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(handleMessage).toHaveBeenCalledTimes(1);
    const msg = handleMessage.mock.calls[0][0] as any;
    expect(msg.type).toBe('SAVE_MESSAGE');
    expect(msg.message.kind).toBe('selection');
    expect(msg.message.content).toBe('hello world');
    expect(msg.message.url).toBe('https://example.com/a');
  });

  it('asks the content script to save the page for a page click', async () => {
    const { click, sendMessage } = setupMenu();
    click({ menuItemId: MENU_SAVE_PAGE }, { url: 'https://example.com/', id: 7 });
    await new Promise((r) => setTimeout(r, 0));

    expect(handleMessage).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(7, { type: SAVE_PAGE_COMMAND }, expect.any(Function));
  });

  it('does nothing when capture is paused', async () => {
    getCaptureConfig.mockResolvedValue({ ...allow, paused: true });
    const { click } = setupMenu();
    click(
      { menuItemId: MENU_SAVE_SELECTION, selectionText: 'hi' },
      { url: 'https://example.com/', id: 1 }
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it('ignores an empty selection', async () => {
    const { click } = setupMenu();
    click(
      { menuItemId: MENU_SAVE_SELECTION, selectionText: '   ' },
      { url: 'https://example.com/', id: 1 }
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(handleMessage).not.toHaveBeenCalled();
  });
});

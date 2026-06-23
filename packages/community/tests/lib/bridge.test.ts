/**
 * Native-messaging bridge outbox + drain tests (Phase 5a).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getBridgeOutbox,
  enqueueBridge,
  dequeueBridge,
  drainBridgeOutbox,
  toBridgePayload,
  type BridgePayload,
} from '../../src/lib/bridge';

/** Simulate a persistent chrome.storage.local backing for bridgeOutbox. */
function backStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: any) =>
    Promise.resolve({ [key]: store[key as string] })
  );
  (chrome.storage.local.set as jest.Mock).mockImplementation((items: any) => {
    Object.assign(store, items);
    return Promise.resolve();
  });
  return store;
}

const payload = (id: string): BridgePayload => ({
  id,
  kind: 'chat',
  conversationId: 'c1',
  platform: 'generic',
  role: 'user',
  text: 't',
  timestamp: 1,
  deviceId: 'd1',
  tags: [],
});

describe('bridge outbox', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('starts empty', async () => {
    backStorage();
    expect(await getBridgeOutbox()).toEqual([]);
  });

  it('enqueues without duplicates and preserves order', async () => {
    backStorage();
    await enqueueBridge('a');
    await enqueueBridge('b');
    await enqueueBridge('a');
    expect(await getBridgeOutbox()).toEqual(['a', 'b']);
  });

  it('dequeues the given ids', async () => {
    backStorage({ bridgeOutbox: ['a', 'b', 'c'] });
    await dequeueBridge(['b']);
    expect(await getBridgeOutbox()).toEqual(['a', 'c']);
  });
});

describe('toBridgePayload', () => {
  it('maps a decrypted memory to the wire payload', () => {
    const p = toBridgePayload(
      {
        id: 'm1',
        kind: 'page_visit',
        conversationId: 'generic:x.com:2026-01-02',
        platform: 'generic',
        content: { role: 'capture', text: null },
        timestamp: 5,
        deviceId: 'd1',
        tags: ['t'],
        keywords: ['k'],
        vectorClock: {},
        syncStatus: 'pending',
      } as any,
      'the page title'
    );
    expect(p).toMatchObject({
      id: 'm1',
      kind: 'page_visit',
      role: 'capture',
      text: 'the page title',
      keywords: ['k'],
    });
  });
});

describe('drainBridgeOutbox', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('sends each payload and clears the outbox', async () => {
    backStorage({ bridgeOutbox: ['a', 'b'] });
    const sent: string[] = [];
    const count = await drainBridgeOutbox({
      load: async (id) => payload(id),
      send: (p) => sent.push(p.id),
    });
    expect(count).toBe(2);
    expect(sent).toEqual(['a', 'b']);
    expect(await getBridgeOutbox()).toEqual([]);
  });

  it('drops unsendable (null) entries without sending', async () => {
    backStorage({ bridgeOutbox: ['gone', 'b'] });
    const sent: string[] = [];
    const count = await drainBridgeOutbox({
      load: async (id) => (id === 'gone' ? null : payload(id)),
      send: (p) => sent.push(p.id),
    });
    expect(count).toBe(1);
    expect(sent).toEqual(['b']);
    expect(await getBridgeOutbox()).toEqual([]);
  });

  it('stops on a send error, leaving the failed id and the rest queued', async () => {
    backStorage({ bridgeOutbox: ['a', 'b', 'c'] });
    const sent: string[] = [];
    const count = await drainBridgeOutbox({
      load: async (id) => payload(id),
      send: (p) => {
        if (p.id === 'b') throw new Error('port closed');
        sent.push(p.id);
      },
    });
    expect(count).toBe(1);
    expect(sent).toEqual(['a']);
    // 'a' was delivered + dequeued; 'b' (failed) and 'c' remain.
    expect(await getBridgeOutbox()).toEqual(['b', 'c']);
  });
});

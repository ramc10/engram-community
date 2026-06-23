/**
 * Native-messaging bridge runtime (the chrome-API glue).
 *
 * Connects to the `com.engram.host` native host and drains the outbox, decrypting
 * each memory in-process so only plaintext crosses the local IPC channel and
 * nothing plaintext is ever persisted. Pure orchestration + outbox logic lives in
 * bridge.ts (and is unit-tested there); this module is the thin, untestable-in-
 * jsdom binding to chrome.runtime.connectNative + the master key.
 */

import type { BackgroundService } from '../background/index';
import type { MemoryWithMemA } from '@engram/core';
import {
  NATIVE_HOST_NAME,
  drainBridgeOutbox,
  toBridgePayload,
  type BridgePayload,
} from './bridge';

/**
 * Load + decrypt one memory into a wire payload.
 * - Returns null when the memory is gone (drop it from the outbox).
 * - Throws when it can't be decrypted *right now* (e.g. the vault is locked), so
 *   the drain stops and retries later without losing data.
 */
async function loadDecryptedPayload(
  service: BackgroundService,
  id: string
): Promise<BridgePayload | null> {
  const memory = (await service.getStorage().getMemory(id)) as MemoryWithMemA | null;
  if (!memory) return null;

  const encrypted = (memory as { encryptedContent?: unknown }).encryptedContent;
  if (!encrypted) {
    // Already plaintext (unexpected, but forward what we have).
    return toBridgePayload(memory, memory.content?.text || '');
  }

  if (!service.hasMasterKey()) {
    throw new Error('Vault locked — deferring bridge delivery');
  }
  const masterKey = service.getMasterKey();
  if (!masterKey) throw new Error('Master key unavailable');

  const bytes = await service.getCrypto().decrypt(encrypted as never, masterKey.key);
  const decoded = JSON.parse(new TextDecoder().decode(bytes)) as { text?: string };
  return toBridgePayload(memory, decoded.text || '');
}

/**
 * Connect to the native host and flush the outbox. Best-effort: if the host
 * isn't installed (connectNative throws / immediately disconnects), pending ids
 * stay queued for a future attempt. Never throws to its caller.
 */
export async function runBridge(service: BackgroundService): Promise<void> {
  if (!chrome.runtime?.connectNative) return;

  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  } catch (err) {
    console.warn('[Bridge] Native host unavailable:', err);
    return;
  }

  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
    const msg = chrome.runtime.lastError?.message;
    if (msg) console.warn('[Bridge] Native host disconnected:', msg);
  });

  try {
    const sent = await drainBridgeOutbox({
      load: (id) => loadDecryptedPayload(service, id),
      send: (payload) => {
        if (disconnected) throw new Error('Native host disconnected');
        port.postMessage(payload);
      },
    });
    if (sent > 0) console.log(`[Bridge] Delivered ${sent} memories to the native host`);
  } catch (err) {
    console.warn('[Bridge] Drain stopped:', err);
  } finally {
    try {
      port.disconnect();
    } catch {
      /* already gone */
    }
  }
}

/**
 * Native-messaging bridge (extension → local MCP store).
 *
 * Streams memories to the `com.engram.host` native messaging host, which is the
 * single writer to ~/.engram/engram.db (the SQLite database the MCP server reads).
 *
 * Design (see REVAMP_PLAN.md, Phase 5):
 *  - The outbox stores only memory **IDs** in chrome.storage.local — never
 *    plaintext at rest. On drain, the service worker loads each memory, decrypts
 *    it in-process, and sends the plaintext payload over the local IPC channel.
 *  - The host writes idempotently by id (INSERT OR REPLACE), so re-sending after a
 *    service-worker restart is safe. IDs are dequeued only after a successful send.
 *  - This keeps E2E encryption intact at rest while the MCP store stays plaintext
 *    (and searchable) locally.
 */

import type { MemoryWithMemA } from '@engram/core';

export const NATIVE_HOST_NAME = 'com.engram.host';
const OUTBOX_KEY = 'bridgeOutbox';

/** Plaintext payload sent to the native host for one memory. */
export interface BridgePayload {
  id: string;
  kind: string;
  conversationId: string;
  platform: string;
  role: string;
  text: string;
  timestamp: number;
  deviceId: string;
  tags: string[];
  keywords?: string[];
  context?: string;
}

// --------------------------------------------------------------------------
// Outbox (memory IDs pending delivery to the host)
// --------------------------------------------------------------------------

export async function getBridgeOutbox(): Promise<string[]> {
  try {
    const result = await chrome.storage.local.get(OUTBOX_KEY);
    const ids = result[OUTBOX_KEY];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

/** Add a memory id to the outbox (deduped, preserves order). */
export async function enqueueBridge(id: string): Promise<void> {
  try {
    const ids = await getBridgeOutbox();
    if (ids.includes(id)) return;
    await chrome.storage.local.set({ [OUTBOX_KEY]: [...ids, id] });
  } catch {
    // storage unavailable — best effort
  }
}

/** Remove ids from the outbox. */
export async function dequeueBridge(done: string[]): Promise<void> {
  if (done.length === 0) return;
  try {
    const ids = await getBridgeOutbox();
    const remaining = ids.filter((id) => !done.includes(id));
    await chrome.storage.local.set({ [OUTBOX_KEY]: remaining });
  } catch {
    // storage unavailable — best effort
  }
}

/** Build the plaintext payload sent to the host from a decrypted memory. */
export function toBridgePayload(memory: MemoryWithMemA, text: string): BridgePayload {
  return {
    id: memory.id,
    kind: memory.kind || 'chat',
    conversationId: memory.conversationId,
    platform: memory.platform,
    role: memory.content?.role || 'capture',
    text,
    timestamp: memory.timestamp,
    deviceId: memory.deviceId,
    tags: memory.tags || [],
    ...(memory.keywords ? { keywords: memory.keywords } : {}),
    ...(memory.context ? { context: memory.context } : {}),
  };
}

/**
 * Drain the outbox, sending each memory's plaintext payload via `send`.
 *
 * Dependencies are injected so the orchestration is testable without chrome's
 * native-messaging APIs:
 *  - `load(id)` resolves the decrypted BridgePayload, or null if it can't be
 *    produced (memory deleted, or undecryptable). Null entries are dropped.
 *  - `send(payload)` delivers one payload (e.g. port.postMessage). Throwing stops
 *    the drain, leaving the remaining ids queued for the next attempt.
 *
 * Returns the number of payloads successfully sent.
 */
export async function drainBridgeOutbox(deps: {
  load: (id: string) => Promise<BridgePayload | null>;
  send: (payload: BridgePayload) => void;
}): Promise<number> {
  const ids = await getBridgeOutbox();
  let sent = 0;

  for (const id of ids) {
    let payload: BridgePayload | null;
    try {
      payload = await deps.load(id);
    } catch {
      // Transient load failure — leave it queued and stop to retry later.
      break;
    }

    if (!payload) {
      // Permanently unsendable (gone/undecryptable) — drop it.
      await dequeueBridge([id]);
      continue;
    }

    try {
      deps.send(payload);
    } catch {
      // Channel error — stop; this id and the rest stay queued.
      break;
    }

    await dequeueBridge([id]);
    sent++;
  }

  return sent;
}

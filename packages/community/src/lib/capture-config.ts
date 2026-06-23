/**
 * Persistence for the generic-capture privacy settings (CaptureConfig).
 *
 * Stored in chrome.storage.local under "captureConfig", merged over defaults so
 * new fields pick up sane values for existing users. Mirrors the enrichmentConfig
 * pattern but needs no encryption (no secrets here).
 */

import {
  type CaptureConfig,
  DEFAULT_CAPTURE_CONFIG,
} from '../content/shared/capture-policy';

const STORAGE_KEY = 'captureConfig';

export async function getCaptureConfig(): Promise<CaptureConfig> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return { ...DEFAULT_CAPTURE_CONFIG, ...(result[STORAGE_KEY] || {}) };
  } catch {
    // chrome.storage unavailable (e.g. tests) — fall back to defaults
    return { ...DEFAULT_CAPTURE_CONFIG };
  }
}

export async function setCaptureConfig(
  updates: Partial<CaptureConfig>
): Promise<CaptureConfig> {
  const next = { ...(await getCaptureConfig()), ...updates };
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } catch {
    // chrome.storage unavailable (e.g. tests) — return the merged value anyway
  }
  return next;
}

/** Add a host to the user denylist (deduped). */
export async function denyHost(host: string): Promise<CaptureConfig> {
  const config = await getCaptureConfig();
  const h = host.trim().toLowerCase();
  if (!h || config.deniedHosts.includes(h)) return config;
  return setCaptureConfig({ deniedHosts: [...config.deniedHosts, h] });
}

/** Remove a host from the user denylist. */
export async function allowHost(host: string): Promise<CaptureConfig> {
  const config = await getCaptureConfig();
  const h = host.trim().toLowerCase();
  return setCaptureConfig({ deniedHosts: config.deniedHosts.filter((d) => d !== h) });
}

// ---------------------------------------------------------------------------
// Page-visit throttle state (host → last capture ms), persisted so the
// per-host-per-hour throttle survives page reloads and SW restarts.
// ---------------------------------------------------------------------------

const THROTTLE_KEY = 'pageVisitThrottle';

export async function getVisitThrottle(): Promise<Map<string, number>> {
  try {
    const result = await chrome.storage.local.get(THROTTLE_KEY);
    return new Map(Object.entries(result[THROTTLE_KEY] || {}));
  } catch {
    return new Map();
  }
}

export async function recordVisit(host: string, timestamp: number): Promise<void> {
  try {
    const map = await getVisitThrottle();
    map.set(host, timestamp);
    await chrome.storage.local.set({ [THROTTLE_KEY]: Object.fromEntries(map) });
  } catch {
    // chrome.storage unavailable — best effort
  }
}


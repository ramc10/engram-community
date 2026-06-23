/**
 * captureConfig persistence/merge tests (Phase 4a).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getCaptureConfig,
  setCaptureConfig,
  denyHost,
  allowHost,
  getVisitThrottle,
  recordVisit,
} from '../../src/lib/capture-config';
import { DEFAULT_CAPTURE_CONFIG } from '../../src/content/shared/capture-policy';

const storedConfig = (value: unknown) =>
  (chrome.storage.local.get as jest.Mock).mockResolvedValue(
    { captureConfig: value } as never
  );

const storedThrottle = (value: unknown) =>
  (chrome.storage.local.get as jest.Mock).mockResolvedValue(
    { pageVisitThrottle: value } as never
  );

describe('capture-config', () => {
  beforeEach(() => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue(
      { captureConfig: undefined } as never
    );
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined as never);
  });

  it('returns defaults when nothing is stored', async () => {
    await expect(getCaptureConfig()).resolves.toEqual(DEFAULT_CAPTURE_CONFIG);
  });

  it('merges stored values over defaults (new fields keep defaults)', async () => {
    storedConfig({ paused: true });
    const cfg = await getCaptureConfig();
    expect(cfg.paused).toBe(true);
    expect(cfg.enabled).toBe(DEFAULT_CAPTURE_CONFIG.enabled);
    expect(cfg.ambientPageVisits).toBe(DEFAULT_CAPTURE_CONFIG.ambientPageVisits);
  });

  it('setCaptureConfig merges updates over current and returns them', async () => {
    storedConfig({ ambientPageVisits: true });
    const setSpy = jest.spyOn(chrome.storage.local, 'set');
    const next = await setCaptureConfig({ ambientPageVisits: false });
    expect(next.ambientPageVisits).toBe(false);
    expect(setSpy).toHaveBeenCalledWith({
      captureConfig: expect.objectContaining({ ambientPageVisits: false }),
    });
  });

  it('denyHost adds a normalized host without duplicates', async () => {
    storedConfig({ deniedHosts: ['a.com'] });
    const next = await denyHost('  B.COM ');
    expect(next.deniedHosts).toEqual(['a.com', 'b.com']);
  });

  it('denyHost is a no-op for an already-denied host', async () => {
    storedConfig({ deniedHosts: ['a.com'] });
    const next = await denyHost('a.com');
    expect(next.deniedHosts).toEqual(['a.com']);
  });

  it('allowHost removes a host from the denylist', async () => {
    storedConfig({ deniedHosts: ['a.com', 'b.com'] });
    const next = await allowHost('a.com');
    expect(next.deniedHosts).toEqual(['b.com']);
  });
});

describe('page-visit throttle', () => {
  beforeEach(() => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue(
      { pageVisitThrottle: undefined } as never
    );
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined as never);
  });

  it('returns an empty map when nothing is stored', async () => {
    const map = await getVisitThrottle();
    expect(map.size).toBe(0);
  });

  it('reads stored entries into a Map', async () => {
    storedThrottle({ 'example.com': 123 });
    const map = await getVisitThrottle();
    expect(map.get('example.com')).toBe(123);
  });

  it('recordVisit persists alongside existing entries', async () => {
    storedThrottle({ 'a.com': 1 });
    const setSpy = chrome.storage.local.set as jest.Mock;
    await recordVisit('b.com', 2);
    expect(setSpy).toHaveBeenCalledWith({
      pageVisitThrottle: { 'a.com': 1, 'b.com': 2 },
    });
  });
});

/**
 * captureConfig persistence/merge tests (Phase 4a).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getCaptureConfig,
  setCaptureConfig,
  denyHost,
  allowHost,
} from '../../src/lib/capture-config';
import { DEFAULT_CAPTURE_CONFIG } from '../../src/content/shared/capture-policy';

const storedConfig = (value: unknown) =>
  (chrome.storage.local.get as jest.Mock).mockResolvedValue(
    { captureConfig: value } as never
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

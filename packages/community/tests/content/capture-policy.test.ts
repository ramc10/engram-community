/**
 * Capture policy tests (Phase 4a) — the generic web observer's privacy + throttle rules.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_CAPTURE_CONFIG,
  PAGE_VISIT_THROTTLE_MS,
  hostnameOf,
  isHostDenied,
  shouldCapturePageVisit,
  canManuallyCapture,
  buildPageVisitMessage,
  buildSelectionMessage,
  buildArticleMessage,
  type CaptureConfig,
} from '../../src/content/shared/capture-policy';

const cfg = (over: Partial<CaptureConfig> = {}): CaptureConfig => ({
  ...DEFAULT_CAPTURE_CONFIG,
  ...over,
});

describe('hostnameOf', () => {
  it('extracts a lowercase hostname', () => {
    expect(hostnameOf('https://Example.COM/path')).toBe('example.com');
  });
  it('returns null for non-URLs', () => {
    expect(hostnameOf('not a url')).toBeNull();
  });
});

describe('isHostDenied', () => {
  it('denies government and military TLDs', () => {
    expect(isHostDenied('irs.gov', cfg())).toBe(true);
    expect(isHostDenied('hmrc.gov.uk', cfg())).toBe(true);
    expect(isHostDenied('army.mil', cfg())).toBe(true);
  });
  it('denies finance/health hostname keywords', () => {
    expect(isHostDenied('my.bank.com', cfg())).toBe(true);
    expect(isHostDenied('online-banking.example.com', cfg())).toBe(true);
    expect(isHostDenied('patient.hospital.org', cfg())).toBe(true);
  });
  it('honours the user denylist', () => {
    expect(isHostDenied('private.example.com', cfg({ deniedHosts: ['private.example.com'] }))).toBe(true);
  });
  it('allows ordinary sites', () => {
    expect(isHostDenied('en.wikipedia.org', cfg())).toBe(false);
    expect(isHostDenied('news.ycombinator.com', cfg())).toBe(false);
  });
});

describe('shouldCapturePageVisit', () => {
  const url = 'https://en.wikipedia.org/wiki/Memory';

  it('captures an allowed site with no prior visit', () => {
    expect(shouldCapturePageVisit(url, cfg(), new Map(), 1000)).toBe(true);
  });

  it('respects the kill switch and pause', () => {
    expect(shouldCapturePageVisit(url, cfg({ enabled: false }), new Map(), 1000)).toBe(false);
    expect(shouldCapturePageVisit(url, cfg({ paused: true }), new Map(), 1000)).toBe(false);
  });

  it('respects the ambient toggle', () => {
    expect(shouldCapturePageVisit(url, cfg({ ambientPageVisits: false }), new Map(), 1000)).toBe(false);
  });

  it('suppresses denied hosts', () => {
    expect(shouldCapturePageVisit('https://chase.bank.com/', cfg(), new Map(), 1000)).toBe(false);
  });

  it('throttles repeat visits to the same host within the window', () => {
    const last = new Map<string, number>([['en.wikipedia.org', 1000]]);
    expect(shouldCapturePageVisit(url, cfg(), last, 1000 + PAGE_VISIT_THROTTLE_MS - 1)).toBe(false);
    expect(shouldCapturePageVisit(url, cfg(), last, 1000 + PAGE_VISIT_THROTTLE_MS)).toBe(true);
  });

  it('returns false for unparseable URLs', () => {
    expect(shouldCapturePageVisit('chrome://newtab', cfg(), new Map(), 1000)).toBe(false);
  });
});

describe('canManuallyCapture', () => {
  it('is allowed unless killed or paused', () => {
    expect(canManuallyCapture(cfg())).toBe(true);
    expect(canManuallyCapture(cfg({ enabled: false }))).toBe(false);
    expect(canManuallyCapture(cfg({ paused: true }))).toBe(false);
  });
  it('is allowed even when ambient page visits are off (manual is independent)', () => {
    expect(canManuallyCapture(cfg({ ambientPageVisits: false }))).toBe(true);
  });
});

describe('message builders', () => {
  const t = Date.UTC(2026, 0, 2, 12);

  it('buildPageVisitMessage carries kind/role/url and synthetic conversationId', () => {
    const m = buildPageVisitMessage('https://example.com/a', '  Example Title  ', t);
    expect(m.kind).toBe('page_visit');
    expect(m.role).toBe('capture');
    expect(m.content).toBe('Example Title');
    expect(m.url).toBe('https://example.com/a');
    expect(m.conversationId).toBe('generic:example.com:2026-01-02');
  });

  it('buildPageVisitMessage falls back to host when title is empty', () => {
    expect(buildPageVisitMessage('https://example.com/a', '', t).content).toBe('example.com');
  });

  it('buildSelectionMessage and buildArticleMessage set their kinds', () => {
    expect(buildSelectionMessage('https://x.com/', ' hi ', t).kind).toBe('selection');
    expect(buildSelectionMessage('https://x.com/', ' hi ', t).content).toBe('hi');
    expect(buildArticleMessage('https://x.com/', ' body ', t).kind).toBe('article');
  });
});

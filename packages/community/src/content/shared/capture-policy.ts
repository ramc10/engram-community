/**
 * Capture policy — pure, dependency-free rules for the generic web observer.
 *
 * Decides *whether* and *what* to capture on arbitrary websites, independent of
 * any browser API so it can be unit-tested. The content script supplies the
 * current config and a per-host "last captured" map; this module answers yes/no
 * and builds the capture payload.
 *
 * Privacy model (see REVAMP_PLAN.md, Phase 4):
 *  - `enabled: false` is the kill switch — nothing is captured, ever.
 *  - `paused: true` temporarily suppresses all capture.
 *  - ambient `page_visit` metadata is captured automatically only when
 *    `ambientPageVisits` is on and the host is not denied.
 *  - a built-in denylist suppresses obviously sensitive sites (finance, health,
 *    government) even when ambient capture is on. It is a best-effort safety net,
 *    not exhaustive; users add their own hosts via `deniedHosts`.
 */

import { genericConversationId, type ExtractedMessage } from '@engram/core';

/** Minimum gap between automatic page_visit records for the same host. */
export const PAGE_VISIT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

export interface CaptureConfig {
  /** Master switch. When false, nothing is captured at all (kill switch). */
  enabled: boolean;
  /** Automatically record lightweight page_visit metadata on allowed sites. */
  ambientPageVisits: boolean;
  /** Temporary pause — suppresses all capture while true. */
  paused: boolean;
  /** User-specified hostnames to never capture (in addition to the built-in denylist). */
  deniedHosts: string[];
}

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  enabled: true,
  ambientPageVisits: true,
  paused: false,
  deniedHosts: [],
};

/**
 * Built-in sensitive-host patterns. Best-effort, non-exhaustive — covers
 * government TLDs and common finance/health hostname keywords. Users can add
 * more via deniedHosts; this only ever *suppresses*, never forces, capture.
 */
const SENSITIVE_HOST_PATTERNS: RegExp[] = [
  /(^|\.)gov(\.[a-z]{2,})?$/i, // example.gov, example.gov.uk
  /(^|\.)mil(\.[a-z]{2,})?$/i, // military
  /\bbank(ing)?\b/i,
  /\bcredit-?union\b/i,
  /\b(health|medical|patient|clinic|hospital|insurance|pharmacy)\b/i,
];

/** Extract a lowercase hostname from an http(s) URL, or null otherwise. */
export function hostnameOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Whether a host must never be captured — either matched by the built-in
 * sensitive-site patterns or present in the user's deniedHosts list.
 */
export function isHostDenied(host: string, config: CaptureConfig): boolean {
  const h = host.toLowerCase();
  if (config.deniedHosts.some((d) => d.toLowerCase() === h)) return true;
  return SENSITIVE_HOST_PATTERNS.some((re) => re.test(h));
}

/**
 * Decide whether an automatic page_visit should be recorded for this URL now.
 * Applies: kill switch, pause, ambient toggle, denylist, and per-host throttle.
 *
 * @param lastCaptureByHost map of host → last capture timestamp (ms)
 */
export function shouldCapturePageVisit(
  url: string,
  config: CaptureConfig,
  lastCaptureByHost: Map<string, number>,
  now: number = Date.now()
): boolean {
  if (!config.enabled || config.paused || !config.ambientPageVisits) return false;

  const host = hostnameOf(url);
  if (!host) return false;
  if (isHostDenied(host, config)) return false;

  const last = lastCaptureByHost.get(host);
  if (last !== undefined && now - last < PAGE_VISIT_THROTTLE_MS) return false;

  return true;
}

/** Whether manual ("Save to memory") captures are allowed right now. */
export function canManuallyCapture(config: CaptureConfig): boolean {
  return config.enabled && !config.paused;
}

/** Build an ambient page_visit capture payload (url + title metadata only). */
export function buildPageVisitMessage(
  url: string,
  title: string,
  now: number = Date.now()
): ExtractedMessage {
  const host = hostnameOf(url) || 'unknown';
  return {
    role: 'capture',
    kind: 'page_visit',
    content: title?.trim() || host,
    url,
    conversationId: genericConversationId(url, now),
    timestamp: now,
  };
}

/** Build a manual selection capture payload (highlighted text + source url). */
export function buildSelectionMessage(
  url: string,
  selectedText: string,
  now: number = Date.now()
): ExtractedMessage {
  return {
    role: 'capture',
    kind: 'selection',
    content: selectedText.trim(),
    url,
    conversationId: genericConversationId(url, now),
    timestamp: now,
  };
}

/** Build a manual article capture payload (readable page body). */
export function buildArticleMessage(
  url: string,
  body: string,
  now: number = Date.now()
): ExtractedMessage {
  return {
    role: 'capture',
    kind: 'article',
    content: body.trim(),
    url,
    conversationId: genericConversationId(url, now),
    timestamp: now,
  };
}

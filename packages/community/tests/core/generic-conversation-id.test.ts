/**
 * Tests for genericConversationId — the synthetic conversation grouping used by
 * non-chat ("generic") captures (Phase 3 data model).
 */

import { describe, it, expect } from '@jest/globals';
import { genericConversationId } from '@engram/core';

describe('genericConversationId', () => {
  const jan2 = Date.UTC(2026, 0, 2, 15, 30); // 2026-01-02 15:30 UTC

  it('groups by hostname and UTC day', () => {
    expect(genericConversationId('https://example.com/some/path?q=1', jan2)).toBe(
      'generic:example.com:2026-01-02'
    );
  });

  it('is stable across different paths/times on the same host+day', () => {
    const a = genericConversationId('https://news.site/a', Date.UTC(2026, 0, 2, 1));
    const b = genericConversationId('https://news.site/b/c', Date.UTC(2026, 0, 2, 23));
    expect(a).toBe(b);
  });

  it('separates different days', () => {
    const day1 = genericConversationId('https://x.com/', Date.UTC(2026, 0, 2));
    const day2 = genericConversationId('https://x.com/', Date.UTC(2026, 0, 3));
    expect(day1).not.toBe(day2);
  });

  it('separates different hosts', () => {
    expect(genericConversationId('https://a.com/', jan2)).not.toBe(
      genericConversationId('https://b.com/', jan2)
    );
  });

  it('falls back to a stable host for non-URL input', () => {
    expect(genericConversationId('not a url', jan2)).toBe('generic:unknown:2026-01-02');
  });
});

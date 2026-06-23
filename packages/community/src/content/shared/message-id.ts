/**
 * Stable, position-independent message identity for capture dedup.
 *
 * Adapters previously keyed dedup on DOM position (`${conversationId}-${index}`),
 * which breaks on virtualized / re-ordering message lists: a recycled node gets a
 * new index (→ duplicate emission) or a new message reuses an old index (→ dropped
 * emission). Hashing the message *content* instead makes the identity stable across
 * re-render, reorder, and node recycling.
 *
 * The dedup key must be computed from the message's FINAL content (role + text),
 * never a partial streaming snapshot — otherwise each streamed chunk hashes to a
 * different id and the same message emits repeatedly. Callers must guard in-flight
 * streaming separately (per DOM element), and only compute this id at emission time.
 */

/**
 * Collapse whitespace and trim so trivial reflow/formatting differences don't
 * change a message's identity.
 */
export function normalizeText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Deterministic 32-bit string hash (djb2/xor variant), returned base-36.
 * Synchronous by design — dedup runs in hot MutationObserver paths where an
 * async SubtleCrypto digest would be unusable. Non-cryptographic: collisions
 * are irrelevant because keys are already scoped by conversation + role.
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // force 32-bit
  }
  return Math.abs(hash).toString(36);
}

/**
 * Compute a stable dedup key for a message from its final content.
 * Scoped by conversation so identical text in different conversations stays distinct.
 */
export function computeMessageId(
  conversationId: string | null,
  role: string,
  text: string
): string {
  const convo = conversationId || 'unknown';
  return `${convo}:${role}:${hashString(normalizeText(text))}`;
}

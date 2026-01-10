# Encryption Verification Guide

This document explains how to verify that memories are properly encrypted in IndexedDB.

## How Encryption Works

1. **Saving a Memory** ([message-handler.ts:232-273](packages/community/src/background/message-handler.ts#L232-L273)):
   - Content is encrypted with master key using XChaCha20-Poly1305
   - Memory object stores:
     - `content.text`: `"[ENCRYPTED]"` (placeholder only)
     - `encryptedContent`: Complete EncryptedBlob (version, algorithm, nonce, ciphertext)
   - Plaintext content is passed separately to enrichment service
   - **Plaintext is NEVER persisted to IndexedDB**

2. **Enrichment** ([storage.ts:633-650](packages/community/src/lib/storage.ts#L633-L650)):
   - Uses plaintext content temporarily for LLM analysis
   - Extracts keywords, tags, and context
   - Enriched metadata is saved to memory object
   - **Content remains encrypted in storage**

3. **Retrieval** ([message-handler.ts:295-340](packages/community/src/background/message-handler.ts)):
   - Memories are fetched with encrypted content
   - `encryptedContent` is decrypted on-the-fly
   - Decrypted content is returned to the UI
   - **Original encrypted blob remains in IndexedDB**

## Verification Steps

### Step 1: Open Chrome DevTools

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Find "Engram Memory Extension"
4. Click "service worker" to open DevTools

### Step 2: Inspect IndexedDB

In the DevTools Console, run:

```javascript
// Open IndexedDB
const dbRequest = indexedDB.open('EngramDB', 2);

dbRequest.onsuccess = (event) => {
  const db = event.target.result;
  const transaction = db.transaction(['memories'], 'readonly');
  const store = transaction.objectStore('memories');
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = () => {
    const memories = getAllRequest.result;
    console.log('Total memories:', memories.length);

    // Check first memory
    if (memories.length > 0) {
      const memory = memories[0];
      console.log('Memory ID:', memory.id);
      console.log('Content Text (should be "[ENCRYPTED]"):', memory.content.text);
      console.log('Has encryptedContent:', !!memory.encryptedContent);
      console.log('Encrypted Blob:', memory.encryptedContent);
      console.log('Keywords (enriched):', memory.keywords);
      console.log('Tags (enriched):', memory.tags);
      console.log('Context (enriched):', memory.context);

      // Verify encryption
      if (memory.content.text === '[ENCRYPTED]' && memory.encryptedContent) {
        console.log('✅ ENCRYPTION VERIFIED: Content is encrypted');
        console.log('✅ Enrichment metadata present:', {
          hasKeywords: !!memory.keywords,
          hasTags: !!memory.tags,
          hasContext: !!memory.context
        });
      } else {
        console.log('❌ WARNING: Content may not be encrypted!');
      }
    }
  };
};
```

### Step 3: Expected Results

For properly encrypted memories with enrichment:

```javascript
{
  id: "some-uuid",
  conversationId: "conv-uuid",
  platform: "chatgpt",

  // ✅ Content should be placeholder only
  content: {
    role: "assistant",
    text: "[ENCRYPTED]",  // ← Placeholder, not real content
    metadata: {}
  },

  // ✅ Encrypted blob with complete encryption metadata
  encryptedContent: {
    version: 1,
    algorithm: "xchacha20-poly1305",
    nonce: "base64-encoded-nonce...",
    ciphertext: "base64-encoded-encrypted-data..."
  },

  // ✅ Enriched metadata (from LLM analysis of plaintext)
  keywords: ["OAuth", "authentication", "security", ...],
  tags: ["web development", "security", ...],
  context: "Discussion about OAuth 2.0 implementation...",

  // Standard fields
  timestamp: 1704672000000,
  vectorClock: {...},
  deviceId: "device-uuid",
  syncStatus: "pending",
  memAVersion: 1
}
```

### Step 4: Verify No Plaintext Leakage

Run this script to check ALL memories for plaintext leakage:

```javascript
const dbRequest = indexedDB.open('EngramDB', 2);

dbRequest.onsuccess = (event) => {
  const db = event.target.result;
  const transaction = db.transaction(['memories'], 'readonly');
  const store = transaction.objectStore('memories');
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = () => {
    const memories = getAllRequest.result;
    let encryptedCount = 0;
    let plaintextCount = 0;
    let enrichedCount = 0;

    memories.forEach(memory => {
      // Check encryption
      if (memory.content.text === '[ENCRYPTED]' && memory.encryptedContent) {
        encryptedCount++;
      } else {
        plaintextCount++;
        console.warn('⚠️  Plaintext memory found:', memory.id, memory.content.text.substring(0, 50));
      }

      // Check enrichment
      if (memory.keywords || memory.tags || memory.context) {
        enrichedCount++;
      }
    });

    console.log('=== ENCRYPTION AUDIT ===');
    console.log('Total memories:', memories.length);
    console.log('✅ Encrypted:', encryptedCount);
    console.log('❌ Plaintext:', plaintextCount);
    console.log('🤖 Enriched:', enrichedCount);

    if (plaintextCount === 0) {
      console.log('✅ ALL MEMORIES ENCRYPTED - NO PLAINTEXT LEAKAGE');
    } else {
      console.log('❌ WARNING: Some memories not encrypted!');
    }
  };
};
```

## What to Look For

### ✅ Correct Encryption

- `content.text` = `"[ENCRYPTED]"` (exact string)
- `encryptedContent` exists with `version`, `algorithm`, `nonce`, `ciphertext`
- `keywords`, `tags`, `context` present (if enrichment enabled)
- No plaintext visible in IndexedDB storage

### ❌ Encryption Issues

- `content.text` contains readable text (not `"[ENCRYPTED]"`)
- Missing `encryptedContent` field
- `encryptedContent` is empty or malformed
- Actual message content visible in DevTools

## Code References

- **Encryption**: [message-handler.ts:232-255](packages/community/src/background/message-handler.ts#L232-L255)
- **Plaintext for Enrichment**: [message-handler.ts:268-273](packages/community/src/background/message-handler.ts#L268-L273)
- **Storage with Plaintext**: [storage.ts:262-276](packages/community/src/lib/storage.ts#L262-L276)
- **Background Enrichment**: [storage.ts:633-650](packages/community/src/lib/storage.ts#L633-L650)

## Security Notes

1. **Master Key Never Stored**: Master key is derived from password using Argon2id and kept in memory only
2. **E2E Encryption**: All content encrypted before IndexedDB storage
3. **Temporary Plaintext**: Plaintext content only exists in memory during enrichment, never persisted
4. **Enrichment Security**: Keywords/tags/context are stored in plaintext (needed for search), but original content remains encrypted

## Related Issues

- **Fixed**: [TESTING_SUMMARY.md#critical-security-fix](TESTING_SUMMARY.md) - Encryption bug where enrichment received `"[ENCRYPTED]"` instead of plaintext
- **Fixed**: Content extraction regex sending full prompt to LLM instead of just content

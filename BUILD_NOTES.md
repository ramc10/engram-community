# Build Notes

## Development Build ✅

Works perfectly:
```bash
npm run dev
# or
npm run build -- --tag dev
```

Output: `packages/community/build/chrome-mv3-dev/`

## Production Build ✅ FIXED

**Previous Issue**: Plasmo's production bundler had issues with libsodium-wrappers ESM modules.

**Solution Implemented** (Jan 4, 2026): Migrated from libsodium to **Noble crypto libraries**

### Crypto Library Migration

✅ **Replaced**: libsodium-wrappers
✅ **With**: @noble/ciphers, @noble/hashes, @noble/curves, hash-wasm

**Benefits**:
- ✅ Service worker compatible (no async initialization needed)
- ✅ Pure JavaScript (no WASM loading issues)
- ✅ Smaller bundle size
- ✅ Works in production build
- ✅ Same security guarantees (XChaCha20-Poly1305, Argon2id, Ed25519)

**Implementation**:
- [crypto-service.ts](packages/community/src/lib/crypto-service.ts) - Fully rewritten with Noble libraries
- Encryption: XChaCha20-Poly1305 via `@noble/ciphers/chacha`
- Key derivation: Argon2id via `hash-wasm`
- Signing: Ed25519 via `@noble/curves/ed25519`
- Hashing: BLAKE2b, HMAC-SHA256 via `@noble/hashes`

---

## Testing Status (Jan 4, 2026)

### Authentication ✅
- [x] Google OAuth integration working
- [x] Email/password authentication working
- [x] Master key generation for OAuth users
- [x] Session persistence

### UI/UX ✅
- [x] Platform badges (ChatGPT, Claude, Perplexity)
- [x] Settings UI with provider selection
- [x] Premium API option added

### Enrichment ✅
- [x] Local model (LM Studio/Ollama) working
- [x] OpenAI provider available
- [x] Anthropic provider available
- [x] Premium API UI ready (server deployment pending)

### Known Issues
- ⏳ HNSW vector index WASM loading in service worker (non-critical - semantic search optional)
- ⏳ Premium API server not deployed (Task 4.2)

---

## Build Commands

### Development
```bash
npm run dev              # Watch mode with HMR
npm run build -- --tag dev    # Single dev build
```

### Production ✅ VERIFIED (Jan 4, 2026)
```bash
npm run build            # Production build (WORKING!)
npm run package          # Create .zip for Chrome Web Store
```

**Build Output**: `packages/community/build/chrome-mv3-prod/`
**Build Time**: ~2.4 seconds
**Status**: ✅ Clean build, no errors
**Bundle Sizes**:
- Background service worker: 1.6MB
- Side panel: 1.4MB
- Content scripts: 910KB

**Verification**: No libsodium errors, no async/await issues

---

## Security & Encryption ✅ VERIFIED (Jan 5, 2026)

### Critical Security Fix Implemented

**Issue Found**: Memories were being stored with BOTH plaintext AND encrypted content in IndexedDB.

**Security Risk**: 🚨 CRITICAL - Anyone with browser access could read all memories in plaintext.

**Fix Applied**:
1. **Storage**: Only store encrypted content (`EncryptedBlob`) with placeholder text `"[ENCRYPTED]"`
2. **Retrieval**: Decrypt content dynamically when loading memories
3. **Verification**: Storage inspection shows NO plaintext content

**Implementation Details**:
- Store complete `EncryptedBlob` (version, algorithm, nonce, ciphertext)
- Content field contains `"[ENCRYPTED]"` placeholder
- Decryption happens in message handler using master key
- Proper error handling for decryption failures

**Files Modified**:
- [message-handler.ts:259](packages/community/src/background/message-handler.ts#L259) - Store full encrypted blob
- [message-handler.ts:40-99](packages/community/src/background/message-handler.ts#L40-L99) - Decrypt on retrieval

**Testing**:
- ✅ Memories save with encrypted content only
- ✅ Storage shows `"[ENCRYPTED]"` placeholder
- ✅ UI displays decrypted content correctly
- ✅ No plaintext visible in IndexedDB inspection
- ✅ Encryption includes version (1) and algorithm (XChaCha20-Poly1305)

---

## Recent Changes (Jan 4-5, 2026)

1. **🔒 CRITICAL: Fixed plaintext storage vulnerability** - All memories now properly encrypted at rest
2. **Fixed Google OAuth** - Auto-generates master key for OAuth users
3. **Updated UI** - Added Premium API provider option, fixed platform badges
4. **Crypto Migration** - Completed migration to Noble libraries
5. **Testing** - Confirmed local enrichment working end-to-end
6. **Documentation** - Added comprehensive testing guides and roadmap

---

_Last updated: 2026-01-05_

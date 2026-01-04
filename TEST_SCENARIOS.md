# Engram Extension - End-to-End Test Scenarios

## Prerequisites
- [ ] Extension loaded in Chrome without errors
- [ ] Supabase project configured and accessible
- [ ] LM Studio installed (optional, for enrichment tests)

---

## Test Suite 1: Authentication & Onboarding

### TC1.1: First-Time User Registration
**Steps:**
1. Navigate to https://chatgpt.com (or claude.ai/perplexity.ai)
2. Click Engram extension icon to open side panel
3. Click "Sign Up"
4. Enter email: `test@example.com`
5. Enter password: `TestPassword123!`
6. Confirm password: `TestPassword123!`
7. Click "Create Account"

**Expected:**
- ✅ Account created successfully
- ✅ Success toast: "Account created!"
- ✅ User automatically logged in
- ✅ Side panel shows main interface (not auth screen)
- ✅ User record created in Supabase `auth.users` table

**Console Logs:**
```
[Auth] User registered: <user-id>
[Engram] Master key set in memory
```

---

### TC1.2: User Login (Existing Account)
**Steps:**
1. Log out if logged in
2. Open side panel
3. Enter email: `test@example.com`
4. Enter password: `TestPassword123!`
5. Click "Log In"

**Expected:**
- ✅ Login successful
- ✅ Success toast: "Logged in successfully!"
- ✅ Side panel shows main interface
- ✅ Session persisted (reload extension, user stays logged in)

---

### TC1.3: Google OAuth Login
**Steps:**
1. Open side panel (logged out)
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Authorize the application

**Expected:**
- ✅ Google popup opens
- ✅ OAuth flow completes
- ✅ User logged in via Google
- ✅ Success toast: "Signed in with Google!"

**Note:** Requires Google provider enabled in Supabase Dashboard

---

### TC1.4: Invalid Credentials
**Steps:**
1. Open side panel
2. Enter email: `test@example.com`
3. Enter password: `WrongPassword123!`
4. Click "Log In"

**Expected:**
- ❌ Login fails
- ❌ Error toast: "Invalid credentials" or similar
- ❌ User remains on login screen

---

## Test Suite 2: Basic Memory Operations (No Enrichment)

### TC2.1: Save First Memory
**Steps:**
1. Log in to extension
2. Have a conversation on ChatGPT/Claude/Perplexity
3. Select text from the conversation
4. Click "Save Memory" button in side panel (or use capture UI)
5. Add optional title/tags if UI allows
6. Confirm save

**Expected:**
- ✅ Memory saved successfully
- ✅ Success toast: "Memory saved!"
- ✅ Memory appears in memory list in side panel
- ✅ Memory stored encrypted in IndexedDB
- ✅ Console log: `[Storage] Memory saved: <memory-id>`

**Verify in DevTools:**
```javascript
// Open Console in side panel
chrome.storage.local.get(null, (data) => console.log(data));
// Should show encrypted memory data
```

---

### TC2.2: View Memory Details
**Steps:**
1. Open side panel
2. Click on a saved memory from the list

**Expected:**
- ✅ Memory content displayed
- ✅ Shows: title, content, timestamp, platform
- ✅ Content is decrypted and readable
- ✅ Metadata visible (platform icon, date)

---

### TC2.3: Search Memories (Text Search)
**Steps:**
1. Save multiple memories with different content
2. Use search bar in side panel
3. Search for keyword present in one memory: "test keyword"

**Expected:**
- ✅ Search results filtered
- ✅ Only matching memories shown
- ✅ Non-matching memories hidden
- ✅ Search is case-insensitive

---

### TC2.4: Delete Memory
**Steps:**
1. Open side panel
2. Select a memory
3. Click "Delete" button
4. Confirm deletion

**Expected:**
- ✅ Confirmation dialog appears
- ✅ After confirmation, memory deleted
- ✅ Memory removed from list
- ✅ Success toast: "Memory deleted!"
- ✅ Memory removed from IndexedDB

---

### TC2.5: Update/Edit Memory
**Steps:**
1. Open side panel
2. Select a memory
3. Click "Edit" button
4. Modify title or content
5. Save changes

**Expected:**
- ✅ Edit UI appears
- ✅ Changes saved successfully
- ✅ Updated memory shows new content
- ✅ Timestamp updated
- ✅ Console log: `[Storage] Memory updated: <memory-id>`

---

## Test Suite 3: Enrichment with LM Studio

### TC3.1: Configure LM Studio Enrichment
**Prerequisites:**
- LM Studio running with server at `http://localhost:1234`
- Model loaded: `llama-3.2-3b-instruct` (or similar)

**Steps:**
1. Open side panel
2. Go to Settings
3. Enable enrichment
4. Select provider: "LM Studio"
5. Enter endpoint: `http://localhost:1234`
6. Save settings

**Expected:**
- ✅ Settings saved
- ✅ Success toast: "Settings saved!"
- ✅ Console log: `[Enrichment] Initialized with provider: lmstudio`

---

### TC3.2: Save Memory with Enrichment
**Steps:**
1. Ensure enrichment is enabled (TC3.1)
2. Save a new memory with substantial content
3. Wait for enrichment to complete

**Expected:**
- ✅ Memory saved
- ✅ Enrichment process starts
- ✅ Loading indicator shows "Enriching..."
- ✅ After completion, memory has:
  - Keywords extracted
  - Tags generated
  - Summary/context added
- ✅ Console logs:
  ```
  [Enrichment] Processing memory: <memory-id>
  [Enrichment] Keywords: [...]
  [Enrichment] Tags: [...]
  [Enrichment] Complete!
  ```

---

### TC3.3: Semantic Search with Embeddings
**Steps:**
1. Save multiple enriched memories
2. Use semantic search (if available in UI)
3. Search for concept (not exact keyword): "machine learning techniques"

**Expected:**
- ✅ Semantically similar memories returned
- ✅ Results ranked by relevance
- ✅ Vector embeddings used for search
- ✅ Console log: `[HNSW] Search results: <count> matches`

---

### TC3.4: Link Detection Between Memories
**Steps:**
1. Save memory A: "I learned about React hooks today"
2. Save memory B: "useState is my favorite React hook"
3. View memory B

**Expected:**
- ✅ Link detected between A and B
- ✅ Related memory (A) shown in sidebar
- ✅ Click on link navigates to related memory
- ✅ Console log: `[Links] Detected <count> related memories`

---

### TC3.5: Memory Evolution Tracking
**Steps:**
1. Save memory: "Learning Python - Day 1: Variables"
2. Later, save updated memory: "Learning Python - Day 2: Functions"
3. Update first memory with new insights

**Expected:**
- ✅ Evolution detected
- ✅ Version history maintained
- ✅ Can view previous versions
- ✅ Console log: `[Evolution] Memory evolved: <memory-id>`

---

## Test Suite 4: Premium Mode Testing

### TC4.1: Configure Premium API
**Steps:**
1. Open side panel → Settings
2. Switch provider to "Premium API"
3. Enter license key: `test-license-key-123`
4. Save settings

**Expected:**
- ✅ Settings saved
- ✅ Authentication with premium API attempted
- ✅ If valid key: Success toast
- ✅ If invalid key: Error toast
- ✅ Console log: `[PremiumAPI] Authenticating...`

---

### TC4.2: Premium Enrichment
**Steps:**
1. Configure premium API (TC4.1)
2. Save a memory
3. Verify enrichment happens via premium API

**Expected:**
- ✅ Request sent to premium API endpoint
- ✅ Enrichment data received
- ✅ Memory enriched with keywords/tags
- ✅ Console log: `[PremiumAPI] Enrichment successful`

---

### TC4.3: Rate Limiting
**Steps:**
1. Using premium API
2. Save 10+ memories rapidly
3. Exceed rate limit

**Expected:**
- ✅ Rate limit error received
- ✅ User notified: "Rate limit exceeded"
- ✅ Graceful fallback (queue or retry)
- ✅ Console log: `[PremiumAPI] Rate limit: <limit> requests/min`

---

### TC4.4: License Key Expiration
**Steps:**
1. Use expired or invalid license key
2. Attempt to use premium features

**Expected:**
- ❌ Authentication fails
- ❌ Error toast: "Invalid or expired license"
- ❌ Premium features disabled
- ❌ Falls back to local mode or shows upgrade prompt

---

## Test Suite 5: Error Handling & Edge Cases

### TC5.1: LM Studio Offline
**Steps:**
1. Configure LM Studio enrichment
2. Stop LM Studio server
3. Save a memory

**Expected:**
- ❌ Enrichment fails gracefully
- ❌ Error toast: "LM Studio not available"
- ✅ Memory still saved (without enrichment)
- ✅ Console error: `[Enrichment] Failed to connect to LM Studio`

---

### TC5.2: Network Offline
**Steps:**
1. Disconnect from internet
2. Try to sync or use cloud features
3. Save memories locally

**Expected:**
- ✅ Local operations continue to work
- ✅ Memories saved to IndexedDB
- ❌ Cloud sync fails with appropriate error
- ✅ Error toast: "Offline mode - sync will resume when online"

---

### TC5.3: Invalid Memory Data
**Steps:**
1. Try to save memory with:
   - Empty content
   - Excessively large content (>10MB)
   - Special characters / emojis

**Expected:**
- ❌ Empty content: Validation error
- ❌ Too large: Error toast "Memory too large (max 10MB)"
- ✅ Special chars/emojis: Handled correctly, encrypted properly

---

### TC5.4: Encryption/Decryption Failure
**Steps:**
1. Manually corrupt encrypted data in IndexedDB
2. Try to view the memory

**Expected:**
- ❌ Decryption fails
- ❌ Error toast: "Failed to decrypt memory"
- ✅ Other memories still accessible
- ✅ Console error: `[CryptoService] Decryption failed`

---

### TC5.5: Malformed API Response
**Steps:**
1. Use enrichment with mock server returning invalid JSON
2. Save a memory

**Expected:**
- ❌ Enrichment fails gracefully
- ❌ Error logged to console
- ✅ Memory saved without enrichment
- ✅ No crash or infinite loading

---

## Test Suite 6: Data Persistence & Security

### TC6.1: Data Persistence After Reload
**Steps:**
1. Save multiple memories
2. Close and reopen Chrome
3. Open extension side panel

**Expected:**
- ✅ All memories still present
- ✅ User session maintained (if "Remember me" enabled)
- ✅ No data loss
- ✅ Encrypted data in IndexedDB intact

---

### TC6.2: Master Key Derivation
**Steps:**
1. Register new user with password: `TestPass123`
2. Check console for master key derivation

**Expected:**
- ✅ Console log: `[CryptoService] Deriving master key...`
- ✅ Argon2id used for key derivation
- ✅ Salt generated and stored
- ✅ Key derivation takes ~1-2 seconds (intentional slowdown for security)

---

### TC6.3: End-to-End Encryption Verification
**Steps:**
1. Save a memory with content: "Secret information"
2. Open DevTools → Application → IndexedDB
3. Inspect `EngramDB` → `memories` store
4. View raw encrypted data

**Expected:**
- ✅ Content is encrypted (unreadable binary/base64)
- ✅ No plaintext "Secret information" visible
- ✅ Nonce and ciphertext present
- ✅ Console log: `[CryptoService] Encrypted with XChaCha20-Poly1305`

---

### TC6.4: Multi-Device Sync (If Enabled)
**Steps:**
1. Set up cloud sync (premium feature)
2. Save memory on Device A
3. Login on Device B with same account
4. Wait for sync

**Expected:**
- ✅ Memory appears on Device B
- ✅ Encrypted during transmission
- ✅ Decrypted successfully on Device B
- ✅ Console log: `[CloudSync] Synced <count> memories`

---

## Test Suite 7: UI/UX Testing

### TC7.1: Responsive Design
**Steps:**
1. Resize side panel to minimum width
2. Resize to maximum width
3. Test on different screen resolutions

**Expected:**
- ✅ UI adapts to panel width
- ✅ No horizontal scrolling
- ✅ Text wraps appropriately
- ✅ Buttons remain accessible

---

### TC7.2: Theme Switching (If Available)
**Steps:**
1. Switch between light/dark themes
2. Verify all UI elements

**Expected:**
- ✅ Theme switches correctly
- ✅ All text readable in both themes
- ✅ Colors consistent
- ✅ Theme preference saved

---

### TC7.3: Toast Notifications
**Steps:**
1. Perform various actions (save, delete, update)
2. Verify toast messages appear

**Expected:**
- ✅ Success toasts (green) for successful operations
- ❌ Error toasts (red) for failures
- ✅ Toasts auto-dismiss after 3-5 seconds
- ✅ Multiple toasts stack properly

---

### TC7.4: Loading States
**Steps:**
1. Perform slow operations (enrichment, search)
2. Observe loading indicators

**Expected:**
- ✅ Loading spinner/skeleton shown
- ✅ UI disabled during loading
- ✅ No double-submit possible
- ✅ Loading text descriptive: "Enriching memory..."

---

## Test Suite 8: Platform Compatibility

### TC8.1: ChatGPT Integration
**Steps:**
1. Navigate to https://chatgpt.com
2. Open Engram side panel
3. Have a conversation
4. Save memory from chat

**Expected:**
- ✅ Side panel opens
- ✅ Chat content detectable
- ✅ Memory captures conversation correctly
- ✅ Platform tagged as "chatgpt"

---

### TC8.2: Claude Integration
**Steps:**
1. Navigate to https://claude.ai
2. Repeat TC8.1 steps

**Expected:**
- ✅ Works identically to ChatGPT
- ✅ Platform tagged as "claude"

---

### TC8.3: Perplexity Integration
**Steps:**
1. Navigate to https://www.perplexity.ai
2. Repeat TC8.1 steps

**Expected:**
- ✅ Works identically to ChatGPT
- ✅ Platform tagged as "perplexity"

---

### TC8.4: Unsupported Site
**Steps:**
1. Navigate to https://google.com
2. Try to open Engram side panel

**Expected:**
- ❌ Side panel disabled/not available
- ❌ Extension icon grayed out (or shows "Not available on this site")

---

## Test Suite 9: Performance Testing

### TC9.1: Large Memory Volume
**Steps:**
1. Save 100+ memories
2. Open side panel
3. Scroll through memory list

**Expected:**
- ✅ List loads within 2 seconds
- ✅ Smooth scrolling (60fps)
- ✅ Virtual scrolling or pagination implemented
- ✅ No memory leaks after extended use

---

### TC9.2: Large Individual Memory
**Steps:**
1. Save memory with 5MB of text
2. View and edit the memory

**Expected:**
- ✅ Saves within 5 seconds
- ✅ Loads within 3 seconds
- ✅ Editing remains responsive
- ✅ No browser freeze

---

### TC9.3: Concurrent Operations
**Steps:**
1. Save multiple memories simultaneously
2. While enrichment is running, perform search
3. Update a memory while another is being saved

**Expected:**
- ✅ Operations queued properly
- ✅ No race conditions
- ✅ All operations complete successfully
- ✅ Console shows operation order clearly

---

## Test Suite 10: Security Testing

### TC10.1: XSS Prevention
**Steps:**
1. Save memory with content: `<script>alert('XSS')</script>`
2. View the memory

**Expected:**
- ✅ Script not executed
- ✅ Content sanitized or escaped
- ✅ No alert popup
- ✅ Content displayed safely

---

### TC10.2: SQL Injection Prevention (If Using SQL)
**Steps:**
1. Search for: `'; DROP TABLE memories; --`
2. Save memory with similar content

**Expected:**
- ✅ Input sanitized
- ✅ No database operations executed
- ✅ Search/save works normally

---

### TC10.3: Session Hijacking Resistance
**Steps:**
1. Login to extension
2. Copy session token from storage (if accessible)
3. Try to use in different browser/profile

**Expected:**
- ❌ Session not transferable
- ❌ Invalid session error
- ✅ User must login again

---

## Summary Checklist

### Critical Path (Must Pass)
- [ ] User can register/login
- [ ] User can save memories
- [ ] User can view saved memories
- [ ] Memories are encrypted at rest
- [ ] Data persists after reload
- [ ] No console errors in normal operation

### Important (Should Pass)
- [ ] Enrichment works with LM Studio
- [ ] Search returns correct results
- [ ] Premium mode functions correctly
- [ ] Error handling graceful
- [ ] UI responsive and intuitive

### Nice to Have (Can Have Issues)
- [ ] Theme switching
- [ ] Multi-device sync
- [ ] Advanced search features
- [ ] Performance optimizations

---

## Test Execution Log

| Test Case | Status | Date | Notes |
|-----------|--------|------|-------|
| TC1.1 | ⏳ Not Run | - | - |
| TC1.2 | ⏳ Not Run | - | - |
| ... | ... | ... | ... |

---

**Next Steps After Testing:**
1. Document all bugs found
2. Prioritize fixes (P0, P1, P2)
3. Create GitHub issues for each bug
4. Re-test after fixes
5. Prepare for production deployment

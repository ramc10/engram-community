# Manual Testing Guide - Engram Extension

**Date**: January 4, 2026
**Objective**: Execute comprehensive testing before Chrome Web Store submission

---

## Setup

### 1. Load the Test Helpers

1. Build the dev extension: `npm run build -- --tag dev`
2. Load in Chrome: `chrome://extensions` → Load unpacked → `build/chrome-mv3-dev/`
3. Open DevTools for the extension:
   - Background: Click "service worker" link in extension details
   - Side panel: Right-click → Inspect
4. Load test helpers in console:
   ```javascript
   // Copy-paste the entire test-helpers.js file into console
   ```

### 2. Test Environment

- **Browser**: Chrome (latest)
- **Build**: chrome-mv3-dev
- **Platforms**: ChatGPT, Claude AI, Perplexity
- **Network**: Normal, then test offline scenarios

---

## Test Execution

### Priority 1: Security & Encryption ✅ CRITICAL

#### TEST 1: Verify Encryption

**Objective**: Ensure memories are encrypted in storage

1. Save a test memory: "This is plaintext test data 12345"
2. Open DevTools console
3. Run: `await checkEncryption()`
4. **Expected**:
   - ✅ Storage keys listed
   - ✅ Memory data looks encrypted (base64/binary, not readable plaintext)
   - ✅ Should see "ciphertext" or "nonce" fields
5. **FAIL if**: You can read "This is plaintext test data" in raw storage

**Manual Check**:
1. Open `chrome://extensions/`
2. Find Engram → Click "Details" → "Inspect views: service worker"
3. In console: `chrome.storage.local.get(null, console.log)`
4. Verify no plaintext memory content visible

---

#### TEST 2: Check for Plaintext Secrets

**Objective**: Ensure master keys and tokens are not exposed

1. Run: `await checkForPlaintextSecrets()`
2. **Expected**:
   - ✅ "No obvious plaintext secrets found"
3. **FAIL if**: Warnings about master_key, password, or secret in plaintext

---

### Priority 2: Error Handling ✅ CRITICAL

#### TEST 3: Offline Mode

**Objective**: Extension works gracefully when offline

**Setup**: Chrome DevTools → Network tab → Throttling: "Offline"

1. **Test**: Try to save a memory while offline
   - **Expected**: Memory saved locally (check memories list)
   - **Expected**: No crash or white screen error

2. **Test**: Search existing memories while offline
   - **Expected**: Search works on cached memories

3. **Test**: Try to log in while offline (log out first)
   - **Expected**: Clear error message "No internet connection"

4. **Go back online**: Uncheck "Offline" in Network tab
   - **Expected**: Extension reconnects gracefully

---

#### TEST 4: Invalid API Keys

**Objective**: Graceful handling of auth failures

1. **Test**: Configure invalid OpenAI API key
   - Go to Settings → LLM Provider → OpenAI
   - Enter: `sk-invalid12345`
   - Save settings
   - Try to save a memory with enrichment enabled
   - **Expected**: Clear error message (not just silent failure)
   - **Expected**: Memory still saves (enrichment fails gracefully)

2. **Test**: Configure invalid LM Studio endpoint
   - Go to Settings → LLM Provider → Local Model
   - Enter endpoint: `http://localhost:9999` (port nothing's running on)
   - Try to save memory with enrichment
   - **Expected**: Error "Cannot connect to local model"
   - **Expected**: Memory still saves

---

#### TEST 5: Network Interruption

**Objective**: Handle mid-request failures

1. **Setup**: Chrome DevTools → Network → Slow 3G
2. **Test**: Save a memory
   - **Expected**: Shows "Saving..." indicator
   - **Expected**: Eventually completes or times out gracefully
3. **Setup**: While enriching, go offline (Network → Offline)
   - **Expected**: Enrichment fails gracefully, memory already saved

---

### Priority 3: Edge Cases ✅ IMPORTANT

#### TEST 6: Special Characters

**Objective**: Handle emoji, Unicode, and special characters

1. **Test Emoji**:
   - Save memory: `🚀 Testing emoji support 🎉 ✨ 💡`
   - **Expected**: Displays correctly in memory list
   - **Expected**: Search works with emoji

2. **Test Unicode**:
   - Save memory: `中文 العربية 한글 עברית Ελληνικά`
   - **Expected**: Displays correctly (no garbled characters)

3. **Test Code Blocks**:
   ```
   Save memory:
   Testing code blocks:
   ```python
   def hello():
       print("Hello, World!")
   ```
   ```
   - **Expected**: Preserves formatting (or displays cleanly)

4. **Test URLs**:
   - Save memory: `Check https://example.com and https://github.com`
   - **Expected**: URLs preserved in content

---

#### TEST 7: XSS Prevention

**Objective**: Ensure scripts don't execute

⚠️ **CRITICAL SECURITY TEST**

1. **Test Script Tag**:
   - Save memory: `<script>alert('XSS test')</script>`
   - **Expected**: Script does NOT execute (no alert popup)
   - **Expected**: Shows as text or sanitized

2. **Test Image XSS**:
   - Save memory: `<img src=x onerror=alert('XSS')>`
   - **Expected**: No alert popup
   - **Expected**: Sanitized or escaped

3. **Test Event Handler**:
   - Save memory: `<div onclick="alert('XSS')">Click me</div>`
   - **Expected**: Not clickable or sanitized

**CRITICAL**: If any of these execute JavaScript, this is a BLOCKER. Must fix before launch.

---

#### TEST 8: Very Long Content

**Objective**: Handle large memories

1. **Test**: Generate long content
   ```javascript
   // In DevTools console
   const longText = 'A'.repeat(10000);
   // Save as memory
   ```

2. **Test**: Save memory with 10,000 characters
   - **Expected**: Saves successfully
   - **Expected**: UI shows preview with "Read more" or truncation
   - **Expected**: Expand works correctly

3. **Test**: Try to save 1MB+ content (should be rejected)
   - **Expected**: Validation error "Content too large"

---

#### TEST 9: Edge Case Searches

**Objective**: Search handles special inputs

1. **Test**: Empty search
   - Clear search box
   - **Expected**: Shows all memories

2. **Test**: No results
   - Search: `xyznotfoundtest123`
   - **Expected**: "No memories found" message (not blank screen)

3. **Test**: Special characters in search
   - Search: `* ? [ ] ( ) { }`
   - **Expected**: Doesn't crash, treats as literal

4. **Test**: Case insensitivity
   - Save memory: "ChatGPT is awesome"
   - Search: "chatgpt"
   - **Expected**: Finds the memory

---

### Priority 4: Performance ⚡ MEDIUM

#### TEST 10: Memory Usage

**Objective**: Extension doesn't leak memory

1. Open Chrome Task Manager: Shift+Esc
2. Find "Extension: Engram"
3. Note memory usage (e.g., 45 MB)
4. Use extension for 5-10 minutes (save memories, search, etc.)
5. Check memory again
6. **Expected**: Memory stable (not continuously growing)
7. **FAIL if**: Memory grows from 45 MB → 200 MB → 400 MB

---

#### TEST 11: Large Dataset

**Objective**: Performance with many memories

**Note**: This requires creating test data. You can:
- Option A: Manually save 50-100 test memories
- Option B: Use the test helper to generate bulk data (requires code)

1. Create 50+ memories
2. **Test**: Scroll through memory list
   - **Expected**: Smooth scrolling (no lag)

3. **Test**: Search with many memories
   - **Expected**: Results appear quickly (<1 second)

4. **Test**: Expand a memory
   - **Expected**: Instant expansion (no delay)

---

### Priority 5: Functionality Checks ✅ IMPORTANT

#### TEST 12: Platform Detection

1. Navigate to `chatgpt.com`
   - **Expected**: ChatGPT logo on memories from this site

2. Navigate to `claude.ai`
   - **Expected**: Claude logo displays correctly

3. Navigate to `perplexity.ai`
   - **Expected**: Perplexity logo displays correctly

4. Navigate to `google.com`
   - **Expected**: Extension inactive or shows "Not supported"

---

#### TEST 13: Settings Persistence

1. Open Settings
2. Change LLM Provider to OpenAI
3. Enter an API key (can be fake for this test)
4. Enable enrichment toggle
5. Close extension
6. Re-open extension
7. **Expected**: Settings preserved (provider, API key, toggles)

---

#### TEST 14: Auto-Refresh

1. Open extension in one tab
2. Save a memory
3. **Expected**: Memory appears immediately (auto-refresh)

---

### Priority 6: Production Build Verification ✅ CRITICAL

#### TEST 15: Production Build

**Objective**: Ensure prod build works identically to dev

1. Build production: `npm run build`
2. Load `build/chrome-mv3-prod/` in Chrome
3. **Re-run these critical tests**:
   - ✅ TEST 1: Encryption
   - ✅ TEST 2: Plaintext secrets
   - ✅ TEST 4: Invalid API keys (error handling)
   - ✅ TEST 7: XSS prevention
   - ✅ TEST 12: Platform detection
   - ✅ Google OAuth sign-in

4. **Expected**: All tests pass identically to dev build

---

## Test Results Template

After each test, record results:

```
TEST X: [Test Name]
Status: ✅ PASS / ❌ FAIL / ⏸️ BLOCKED
Notes: [Any observations]
Issues: [If failed, describe issue]
Screenshots: [Attach if applicable]
```

---

## Quick Test Checklist

**Must Pass Before v0.1.0:**
- [ ] TEST 1: Encryption verified
- [ ] TEST 2: No plaintext secrets
- [ ] TEST 3: Offline mode works
- [ ] TEST 4: API errors handled
- [ ] TEST 7: XSS prevented (CRITICAL!)
- [ ] TEST 8: Long content works
- [ ] TEST 12: Platform detection works
- [ ] TEST 15: Production build works

**Should Pass:**
- [ ] TEST 5: Network interruption handled
- [ ] TEST 6: Special characters work
- [ ] TEST 9: Edge case searches work
- [ ] TEST 10: No memory leaks
- [ ] TEST 13: Settings persist
- [ ] TEST 14: Auto-refresh works

**Nice to Pass (Can fix in v0.2.0):**
- [ ] TEST 11: Performance with 100+ memories

---

## When You Find a Bug

1. **Note the test that failed**
2. **Reproduce the bug** (try 2-3 times)
3. **Open DevTools Console** and check for errors
4. **Take a screenshot** if visual issue
5. **Record**:
   - What you did (steps to reproduce)
   - What you expected
   - What actually happened
   - Console errors (if any)

---

## After Testing

Create a test report:

```markdown
# Test Report - [Date]

## Summary
- Tests Run: X
- Passed: X
- Failed: X

## Critical Issues
1. [Issue if any]

## Non-Critical Issues
1. [Issue if any]

## Sign-off
- [ ] Ready for Chrome Web Store
- [ ] Needs fixes first
```

---

## Need Help?

If you encounter issues during testing:
1. Check console for error messages
2. Check TESTING_PLAN.md for detailed test specs
3. Document the issue and we'll fix it together

---

_Happy Testing! 🧪_

# Premium API Extension Testing Guide

**Date**: January 6, 2026
**Purpose**: Manual testing guide for Premium API integration with Chrome extension
**Prerequisites**: API running at http://localhost:3000, Extension built with Premium API URL

---

## Pre-Testing Checklist

### 1. Verify API is Running
```bash
# Check all Docker containers are healthy
cd /Users/rc/Projects/engram-premium-api
docker-compose ps

# Expected: All containers showing "healthy"
```

```bash
# Test API health endpoint
curl http://localhost:3000/health

# Expected: {"status":"ok",...}
```

### 2. Verify Extension Build
```bash
cd /Users/rc/Projects/engram-community/packages/community

# Check .env has Premium API URL
cat .env | grep PREMIUM

# Expected: PLASMO_PUBLIC_PREMIUM_API_URL=http://localhost:3000
```

### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select: `/Users/rc/Projects/engram-community/packages/community/build/chrome-mv3-prod`
5. Verify extension loaded without errors

---

## Test Suite 4: Extension Integration

### TC-PREM-4.1: Settings UI - Provider Selection

**Steps**:
1. Click Engram extension icon in Chrome toolbar
2. Click "Settings" (gear icon)
3. Locate "Enrichment Provider" dropdown

**Expected**:
- ✅ "Premium API" option visible in dropdown
- ✅ Other options: "Local Model", "OpenAI", "Anthropic", "None"

**Screenshot**: Save as `settings-provider-dropdown.png`

---

### TC-PREM-4.2: Settings UI - License Input

**Steps**:
1. In Settings, select "Premium API" from provider dropdown
2. Observe the API key/license field

**Expected**:
- ✅ Field label changes to "License Key" (not "API Key")
- ✅ Placeholder shows "ENGRAM-XXXX-XXXX-XXXX-XXXX" format
- ✅ Help text mentions Premium API features

**Screenshot**: Save as `settings-premium-selected.png`

---

### TC-PREM-4.3: License Configuration & Validation

**Steps**:
1. In Settings with Premium API selected
2. Enter test license: `ENGRAM-A9R4-TLC6-69H9-RH3Z`
3. Click "Save Settings" or "Test Connection" button
4. Wait for validation

**Expected Results**:
- ✅ Success message appears: "Premium API configured successfully" or similar
- ✅ License validated against http://localhost:3000/auth/login
- ✅ User tier displayed: "PRO" or "Professional"
- ✅ Rate limit shown: "100 requests/hour"

**Check Browser Console** (`F12` > Console tab):
```
Should see:
✅ [Premium] Authentication successful
✅ [Premium] User: test@example.com
✅ [Premium] Tier: PRO
❌ NO errors about CORS, network, or invalid license
```

**If Errors Occur**:
- "Invalid license key" → Check license was entered correctly
- "Network error" → Verify API is running: `docker-compose ps`
- "CORS error" → Check docker-compose.yml has `ALLOWED_ORIGINS=*`

**Screenshot**: Save as `license-configured-success.png`

---

### TC-PREM-4.4: Invalid License Error Handling

**Steps**:
1. In Settings, enter invalid license: `ENGRAM-INVALID-TEST-XXXX-XXXX`
2. Click "Save Settings"

**Expected**:
- ✅ Clear error message displayed in UI (not just console)
- ✅ Message: "Invalid license key" or "Authentication failed"
- ✅ Settings not saved
- ✅ User can try again

**Screenshot**: Save as `invalid-license-error.png`

---

### TC-PREM-4.5: End-to-End Memory Save with Premium Enrichment ⭐

**This is the most important test!**

**Setup**:
1. Configure valid license (from TC-PREM-4.3)
2. Navigate to https://chatgpt.com or https://claude.ai
3. Open Engram side panel (click extension icon)

**Steps**:
1. Have a conversation with the AI:
   - Ask: "Explain how Docker containers work and why they're useful for microservices"
   - Wait for AI response (should be substantial, 2-3 paragraphs)

2. Save the conversation:
   - Click "Save Memory" button in Engram panel
   - OR use keyboard shortcut if configured
   - Enter a title: "Docker containers for microservices"

3. Wait for save to complete:
   - Watch for success message
   - Note: Should take 1-2 seconds (enrichment happening)

**Expected Results**:
- ✅ Memory saved successfully
- ✅ Success notification appears
- ✅ Memory appears in memory list with:
   - Title: "Docker containers for microservices"
   - Content: Encrypted ciphertext (not visible directly)
   - Keywords: Should include "Docker", "containers", "microservices"
   - Tags: Should include "Technology", "DevOps", or similar
   - Platform badge: ChatGPT or Claude logo

**Verify in Browser Console**:
```javascript
// Open DevTools (F12) > Console
// Check for these log messages:
✅ [Premium] Enrichment request sent
✅ [Premium] Received enrichment: {keywords: [...], tags: [...]}
✅ [Memory] Saved with encryption
✅ [Memory] Enrichment applied
```

**Verify Encryption** (Critical!):
```javascript
// In Console, inspect IndexedDB
// Application tab > IndexedDB > engram-memories > memories
// Click on the saved memory
// Check the 'content' field:
✅ Should see: {version: 1, algorithm: "...", nonce: "...", ciphertext: "..."}
❌ Should NOT see: Plain text content
```

**Verify Backend Logging**:
```bash
# Check API logs
docker-compose logs --tail=20 api

# Should see:
✅ [Enrich] Enrichment request from user
✅ [Enrich] LLM call successful
✅ [Enrich] Response sent

# Verify database (memory content should NOT be logged)
docker-compose exec -T postgres psql -U engram -d engram_premium \
  -c "SELECT * FROM usage_logs ORDER BY timestamp DESC LIMIT 1;"

# Check:
✅ endpoint: /enrich
✅ status_code: 200
✅ llm_model: llama-3.2-3b-instruct
✅ llm_tokens: (some number)
❌ NO 'content' or 'ciphertext' columns
```

**Screenshots**:
- `memory-save-success.png` - Success notification
- `memory-list-enriched.png` - Memory with keywords/tags visible
- `indexeddb-encrypted.png` - IndexedDB showing encrypted content

---

### TC-PREM-4.6: Search with Premium-Enriched Memories

**Prerequisites**: Complete TC-PREM-4.5 first (have saved memories)

**Steps**:
1. Save 3-5 more memories on different topics using Premium API
2. In Engram panel, use the search box
3. Search for a keyword that was generated by premium enrichment
   - Example: If LLM tagged a memory with "microservices", search for that

**Expected**:
- ✅ Search finds memories by premium-generated keywords
- ✅ Search finds memories by premium-generated tags
- ✅ Results show highlighted matches
- ✅ Search is fast (< 500ms)

**Test Searches**:
- Search by LLM keyword: "Docker"
- Search by LLM tag: "Technology"
- Search by original content: "containers"
- Search with partial match: "micro"

**Screenshot**: Save as `search-with-premium-tags.png`

---

### TC-PREM-4.7: Provider Switching

**Steps**:
1. Go to Settings
2. Current provider: Premium API (with valid license)
3. Switch to "Local Model"
4. Save settings
5. Save a new memory
6. Switch back to "Premium API"
7. Save another memory

**Expected**:
- ✅ Switch to Local works without errors
- ✅ Memory saved with local enrichment (if LM Studio running)
- ✅ Switch back to Premium works
- ✅ Next memory uses Premium API again
- ✅ NO errors in console during switches
- ✅ Settings persist after browser restart

**Verify**:
```javascript
// Check chrome.storage for persisted settings
chrome.storage.local.get(['enrichmentProvider', 'premiumLicense'], console.log)

// Expected:
// {enrichmentProvider: "premium", premiumLicense: "ENGRAM-A9R4-..."}
```

**Screenshot**: Save as `provider-switching.png`

---

## Test Suite 6: Security & Privacy (Extension Level)

### TC-PREM-6.1: Verify Encryption with Premium API

**Critical Privacy Test**

**Steps**:
1. Save memory with Premium enrichment (from TC-PREM-4.5)
2. Open Chrome DevTools > Application tab
3. Navigate to: IndexedDB > engram-memories > memories
4. Click on any saved memory
5. Inspect the `content` field

**Expected - Encrypted Content**:
```javascript
{
  version: 1,
  algorithm: "xchacha20poly1305",
  nonce: "base64-encoded-nonce-here...",
  ciphertext: "base64-encoded-ciphertext-here..."
}
```

**Verification Checklist**:
- ✅ Content is an object with 4 fields: version, algorithm, nonce, ciphertext
- ✅ Ciphertext is long base64 string (not readable text)
- ✅ Nonce is present and unique per memory
- ✅ Algorithm is "xchacha20poly1305"
- ❌ NO plain text visible anywhere in IndexedDB
- ❌ NO unencrypted content in chrome.storage

**Screenshot**: Save as `encryption-verified-indexeddb.png`

---

### TC-PREM-6.2: API Key/License Security

**Steps**:
1. Open Chrome DevTools > Application tab
2. Check chrome.storage.local
3. Check chrome.storage.session
4. Check IndexedDB

**Expected**:
- ✅ License key stored securely (possibly encrypted itself)
- ✅ JWT token NOT in localStorage (should be sessionStorage or memory)
- ✅ NO plaintext API keys in any storage
- ✅ Console logs don't expose license key

**Verify**:
```javascript
// Check all storage
chrome.storage.local.get(null, console.log)
chrome.storage.session.get(null, console.log)

// JWT should be ephemeral, license should be encrypted or hashed
```

**Screenshot**: Save as `storage-security-check.png`

---

## Test Suite 5: Error Handling (Extension Level)

### TC-PREM-5.1: API Unreachable from Extension

**Steps**:
1. Configure Premium API with valid license
2. Stop the API: `docker-compose stop api`
3. Try to save a memory with enrichment enabled

**Expected**:
- ✅ Clear error message in extension UI
- ✅ Message: "Premium API unavailable" or "Enrichment service offline"
- ✅ Memory still saved locally (without enrichment)
- OR ✅ Memory queued for later enrichment
- ✅ User informed of degraded functionality
- ❌ NO silent failures

**Check Console**:
```
Should see:
⚠️ [Premium] API unreachable
⚠️ [Memory] Saved without enrichment
✅ [Memory] Will retry enrichment when online
```

**Recovery Test**:
1. Restart API: `docker-compose start api`
2. Wait 10 seconds
3. Try saving another memory

**Expected**:
- ✅ Extension automatically reconnects
- ✅ Enrichment works again
- ✅ NO need to reload extension

**Screenshot**: Save as `api-offline-error.png`

---

### TC-PREM-5.2: Network Timeout Simulation

**Steps**:
1. Open Chrome DevTools > Network tab
2. Throttle to "Slow 3G"
3. Save a memory with Premium enrichment

**Expected**:
- ✅ Loading state shown in UI
- ✅ Timeout after reasonable duration (10-30s)
- ✅ Clear timeout message
- ✅ Memory saved locally even if enrichment times out
- ✅ User can retry

**Screenshot**: Save as `network-timeout.png`

---

## Test Suite 7: Performance (Extension Level)

### TC-PREM-7.2: Concurrent Enrichments

**Steps**:
1. Open multiple AI chat tabs (ChatGPT, Claude, Perplexity)
2. Have conversations in each
3. Quickly save all 3 memories (within 5 seconds)

**Expected**:
- ✅ All 3 enrichment requests succeed
- ✅ No rate limit errors (PRO tier: 100/hour)
- ✅ All memories saved with enrichment
- ✅ UI responsive during concurrent requests

**Check Console** for concurrent requests:
```
✅ [Premium] Request 1 sent
✅ [Premium] Request 2 sent
✅ [Premium] Request 3 sent
✅ [Premium] Response 1 received
✅ [Premium] Response 2 received
✅ [Premium] Response 3 received
```

**Screenshot**: Save as `concurrent-enrichments.png`

---

## Test Results Template

Copy this template for recording results:

```markdown
## Test Session: [Date]

### TC-PREM-4.1: Settings UI - Provider Selection
- [ ] Premium API option visible
- [ ] Dropdown works correctly
- **Result**: PASS / FAIL
- **Screenshot**: settings-provider-dropdown.png
- **Notes**:

### TC-PREM-4.3: License Configuration
- [ ] Valid license accepted
- [ ] Success message shown
- [ ] Tier/limits displayed
- **Result**: PASS / FAIL
- **Screenshot**: license-configured-success.png
- **Notes**:

### TC-PREM-4.5: E2E Memory Save ⭐
- [ ] Memory saved successfully
- [ ] Enrichment applied (keywords/tags)
- [ ] Encryption verified
- [ ] No content in backend
- **Result**: PASS / FAIL
- **Screenshots**:
  - memory-save-success.png
  - memory-list-enriched.png
  - indexeddb-encrypted.png
- **Keywords Generated**:
- **Tags Generated**:
- **Notes**:

### TC-PREM-6.1: Encryption Verification
- [ ] Content is EncryptedBlob
- [ ] No plaintext in IndexedDB
- [ ] Ciphertext is base64
- **Result**: PASS / FAIL
- **Screenshot**: encryption-verified-indexeddb.png
- **Notes**:

### TC-PREM-5.1: API Offline Handling
- [ ] Error message shown
- [ ] Memory saved without enrichment
- [ ] Recovery after API restart
- **Result**: PASS / FAIL
- **Screenshot**: api-offline-error.png
- **Notes**:
```

---

## Troubleshooting Guide

### Issue: "Premium API not responding"
**Check**:
1. `docker-compose ps` - all containers healthy?
2. `curl http://localhost:3000/health` - API responding?
3. Extension console - CORS errors?

**Fix**:
- Restart API: `docker-compose restart api`
- Check firewall blocking localhost:3000
- Verify .env has correct API URL

### Issue: "Invalid license key"
**Check**:
1. License copied correctly (no spaces)
2. License format: ENGRAM-XXXX-XXXX-XXXX-XXXX
3. API database has the license

**Fix**:
```bash
# Check database
docker-compose exec -T postgres psql -U engram -d engram_premium \
  -c "SELECT * FROM licenses WHERE license_key = 'ENGRAM-A9R4-TLC6-69H9-RH3Z';"
```

### Issue: "Enrichment not working"
**Check**:
1. LM Studio running on Mac (port 1234)
2. API logs: `docker-compose logs api | grep LM_STUDIO`
3. Premium provider actually selected in settings

**Fix**:
- Start LM Studio
- Check model loaded: `curl http://localhost:1234/v1/models`
- Verify API can reach it: check docker-compose.yml `host.docker.internal`

### Issue: "Memory not encrypted"
**CRITICAL - Contact developer immediately**

This is a security bug. Check:
1. Content field should be object with ciphertext
2. If plain text visible, STOP and investigate

---

## Success Criteria

Extension integration is considered **ready for production** when:

- ✅ All TC-PREM-4.x tests pass (Extension Integration)
- ✅ TC-PREM-6.1 passes (Encryption verification)
- ✅ TC-PREM-5.1 passes (Error handling)
- ✅ No console errors during normal usage
- ✅ Premium features work seamlessly
- ✅ Privacy maintained (no plaintext storage)

---

_Created: January 6, 2026_
_For: Engram Premium API v0.1.0_
_Extension: chrome-mv3-prod build_

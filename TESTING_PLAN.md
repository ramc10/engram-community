# Phase 4.1 - Comprehensive Testing Plan

**Date**: January 4, 2026
**Build**: chrome-mv3-dev (for testing), chrome-mv3-prod (for verification)
**Objective**: Complete all remaining testing before Chrome Web Store submission

---

## Testing Categories

### ✅ Already Tested (Completed)
- [x] Google OAuth authentication
- [x] Email/password authentication
- [x] Master key generation for OAuth users
- [x] Session persistence
- [x] Platform badges (ChatGPT, Claude, Perplexity)
- [x] Settings UI with provider selection
- [x] Local model enrichment (LM Studio/Ollama)
- [x] Basic memory operations (create, read)
- [x] Production build verification

### 🔄 Remaining Tests (To Complete)

---

## Test Suite 1: Error Handling 🚨

**Priority**: High
**Estimated Time**: 2-3 hours

### TC-ERR-1: Offline Mode Testing

**Objective**: Verify extension works gracefully when offline

#### TC-ERR-1.1: Memory Operations Offline
- [ ] **Setup**: Disconnect from internet
- [ ] **Action**: Save a new memory
- [ ] **Expected**: Memory saved locally, queued for sync when online
- [ ] **Action**: Search existing memories
- [ ] **Expected**: Search works with locally stored memories
- [ ] **Action**: View existing memories
- [ ] **Expected**: All cached memories display correctly

#### TC-ERR-1.2: Authentication Offline
- [ ] **Setup**: Already authenticated, go offline
- [ ] **Expected**: User remains logged in (session from local storage)
- [ ] **Setup**: Not authenticated, go offline
- [ ] **Action**: Try to log in
- [ ] **Expected**: Clear error message "No internet connection. Please connect and try again."

#### TC-ERR-1.3: Enrichment Offline
- [ ] **Setup**: Offline mode
- [ ] **Action**: Save a memory with enrichment enabled
- [ ] **Expected**: Memory saved without enrichment, or queued for enrichment when online

---

### TC-ERR-2: API Failure Handling

**Objective**: Verify graceful degradation when APIs fail

#### TC-ERR-2.1: Supabase API Failures
- [ ] **Test**: Block `*.supabase.co` in browser (simulate Supabase down)
- [ ] **Action**: Try to log in
- [ ] **Expected**: Error message "Unable to connect to authentication service. Please try again later."
- [ ] **Action**: Save memory (while already authenticated)
- [ ] **Expected**: Memory saves locally, sync fails gracefully with retry

#### TC-ERR-2.2: Enrichment API Failures
- [ ] **Test**: Configure invalid OpenAI API key
- [ ] **Action**: Save memory with enrichment enabled
- [ ] **Expected**: Clear error "Invalid API key" or "Enrichment failed"
- [ ] **Test**: Configure valid API key but wrong endpoint
- [ ] **Expected**: Error "Unable to connect to enrichment service"

#### TC-ERR-2.3: Local Model API Failures
- [ ] **Test**: Configure LM Studio endpoint but LM Studio not running
- [ ] **Action**: Save memory with enrichment enabled
- [ ] **Expected**: Error "Local model not responding. Check LM Studio is running."
- [ ] **Test**: LM Studio running but wrong port
- [ ] **Expected**: Clear connection error message

---

### TC-ERR-3: Malformed Data Handling

**Objective**: Verify extension handles corrupt or unexpected data

#### TC-ERR-3.1: Malformed API Responses
- [ ] **Test**: Mock enrichment API returns invalid JSON
- [ ] **Expected**: Error caught, memory saved without enrichment
- [ ] **Test**: Mock enrichment API returns empty response
- [ ] **Expected**: Memory saved, enrichment skipped with log message

#### TC-ERR-3.2: Corrupt Local Storage
- [ ] **Test**: Manually corrupt chrome.storage.local data
- [ ] **Action**: Reload extension
- [ ] **Expected**: Extension initializes, shows error, offers "Reset" option

#### TC-ERR-3.3: Invalid Memory Data
- [ ] **Test**: Try to save memory with empty content
- [ ] **Expected**: Validation error "Memory content cannot be empty"
- [ ] **Test**: Try to save memory with only whitespace
- [ ] **Expected**: Either trimmed and saved, or validation error

---

### TC-ERR-4: Network Errors

**Objective**: Verify handling of network issues

#### TC-ERR-4.1: Slow Network
- [ ] **Test**: Throttle network to "Slow 3G" in DevTools
- [ ] **Action**: Save memory
- [ ] **Expected**: Shows loading indicator, eventually completes or times out gracefully
- [ ] **Action**: Enrich memory
- [ ] **Expected**: Shows "Enriching..." with timeout after 30s

#### TC-ERR-4.2: Network Timeout
- [ ] **Test**: Block specific API endpoint mid-request
- [ ] **Expected**: Request times out with clear message
- [ ] **Expected**: Retry logic kicks in (if implemented)

---

## Test Suite 2: Edge Cases 🔍

**Priority**: High
**Estimated Time**: 2-3 hours

### TC-EDGE-1: Memory Content Edge Cases

#### TC-EDGE-1.1: Very Long Memories
- [ ] **Test**: Save memory with 10,000+ character content
- [ ] **Expected**: Memory saves successfully
- [ ] **Expected**: UI displays with "Read more" or pagination
- [ ] **Expected**: Search still works
- [ ] **Test**: Save memory exceeding MAX_MEMORY_SIZE (10MB from config)
- [ ] **Expected**: Validation error "Memory too large"

#### TC-EDGE-1.2: Special Characters
- [ ] **Test**: Memory with emoji: "🚀 Testing emoji support 🎉"
- [ ] **Expected**: Displays correctly
- [ ] **Test**: Memory with code blocks and formatting: ` ```python\nprint("hello")\n``` `
- [ ] **Expected**: Preserved correctly
- [ ] **Test**: Memory with special Unicode: "中文 العربية 한글 עברית"
- [ ] **Expected**: Displays correctly
- [ ] **Test**: Memory with SQL injection attempt: `'; DROP TABLE memories; --`
- [ ] **Expected**: Saved as literal string, no SQL executed (we use NoSQL/IndexedDB anyway)
- [ ] **Test**: Memory with XSS attempt: `<script>alert('xss')</script>`
- [ ] **Expected**: Sanitized or escaped, script doesn't execute

#### TC-EDGE-1.3: Memory with URLs and Markdown
- [ ] **Test**: Memory containing URLs: "Check https://example.com for info"
- [ ] **Expected**: URL preserved (optionally made clickable)
- [ ] **Test**: Memory with markdown: "**bold** _italic_ [link](url)"
- [ ] **Expected**: Stored as-is (rendered if markdown supported)

---

### TC-EDGE-2: Search Edge Cases

#### TC-EDGE-2.1: Search Queries
- [ ] **Test**: Empty search query
- [ ] **Expected**: Shows all memories
- [ ] **Test**: Very long search query (1000+ chars)
- [ ] **Expected**: Handles gracefully, may return no results
- [ ] **Test**: Special characters in search: `"* ? [ ] ( ) { }"`
- [ ] **Expected**: Doesn't break search, treats as literal characters
- [ ] **Test**: Case sensitivity: Search "CHATGPT" when memory says "ChatGPT"
- [ ] **Expected**: Case-insensitive match found

#### TC-EDGE-2.2: No Results Scenarios
- [ ] **Test**: Search for term that doesn't exist
- [ ] **Expected**: "No memories found" message
- [ ] **Test**: Filter by platform with no memories from that platform
- [ ] **Expected**: Clear empty state

---

### TC-EDGE-3: Concurrency and Race Conditions

#### TC-EDGE-3.1: Rapid Actions
- [ ] **Test**: Save multiple memories in quick succession (10+ memories)
- [ ] **Expected**: All memories saved, no data loss
- [ ] **Test**: Save memory while another is still enriching
- [ ] **Expected**: Both operations complete successfully
- [ ] **Test**: Search while memories are being enriched
- [ ] **Expected**: Search works on available data

#### TC-EDGE-3.2: Multiple Tabs
- [ ] **Test**: Open extension in two different tabs
- [ ] **Action**: Save memory in Tab 1
- [ ] **Expected**: Memory appears in Tab 2 (via auto-refresh)
- [ ] **Action**: Update settings in Tab 1
- [ ] **Expected**: Settings update in Tab 2

---

## Test Suite 3: Memory CRUD Operations 🗂️

**Priority**: High
**Estimated Time**: 1-2 hours

### TC-CRUD-1: Create Memory (Already Tested ✅)
- [x] Save memory from ChatGPT
- [x] Save memory from Claude
- [x] Save memory from Perplexity
- [x] Memory encrypted and stored

### TC-CRUD-2: Read Memory (Already Tested ✅)
- [x] View memory in list
- [x] Expand/collapse memory
- [x] Search and filter memories

### TC-CRUD-3: Update Memory

**Note**: Check if update functionality exists in UI

#### TC-CRUD-3.1: Edit Memory Content
- [ ] **Check**: Is there an "Edit" button on memory cards?
- [ ] **If YES**: Test editing memory content
- [ ] **Expected**: Content updates, re-encrypted, timestamp preserved
- [ ] **If NO**: Add to feature roadmap (not blocking for v0.1.0)

#### TC-CRUD-3.2: Update Memory Tags/Metadata
- [ ] **Test**: Add tags to existing memory (if supported)
- [ ] **Test**: Update enrichment data
- [ ] **Expected**: Updates saved correctly

### TC-CRUD-4: Delete Memory

**Note**: Check if delete functionality exists in UI

#### TC-CRUD-4.1: Single Memory Delete
- [ ] **Check**: Is there a "Delete" button on memory cards?
- [ ] **Action**: Click delete on a memory
- [ ] **Expected**: Confirmation dialog "Are you sure?"
- [ ] **Action**: Confirm deletion
- [ ] **Expected**: Memory removed from list and storage
- [ ] **Action**: Try to search for deleted memory
- [ ] **Expected**: Not found

#### TC-CRUD-4.2: Delete with Related Memories
- [ ] **Test**: Delete memory that has links to other memories
- [ ] **Expected**: Links updated/removed in related memories
- [ ] **OR**: Warning "This memory is linked to X other memories"

#### TC-CRUD-4.3: Bulk Delete
- [ ] **Check**: Can select multiple memories?
- [ ] **If YES**: Test bulk delete
- [ ] **If NO**: Add to roadmap

---

## Test Suite 4: Performance Testing 📊

**Priority**: Medium
**Estimated Time**: 2-3 hours

### TC-PERF-1: Large Dataset Testing

#### TC-PERF-1.1: Import/Create Many Memories
- [ ] **Setup**: Create script to generate 100 test memories
- [ ] **Action**: Import all memories
- [ ] **Measure**: Time to import
- [ ] **Expected**: <10 seconds for 100 memories

#### TC-PERF-1.2: UI Performance with 100+ Memories
- [ ] **Test**: Scroll through memory list
- [ ] **Expected**: Smooth scrolling (60 FPS)
- [ ] **Test**: Search with 100+ memories
- [ ] **Measure**: Search latency
- [ ] **Expected**: <500ms response time

#### TC-PERF-1.3: Memory Usage
- [ ] **Test**: Monitor extension memory usage with 100+ memories
- [ ] **Tool**: Chrome Task Manager
- [ ] **Expected**: <100MB RAM usage
- [ ] **Test**: Memory leaks - use extension for 1 hour
- [ ] **Expected**: Memory usage stable (no continuous growth)

---

### TC-PERF-2: Enrichment Performance

#### TC-PERF-2.1: Single Enrichment
- [ ] **Test**: Enrich one memory with local model
- [ ] **Measure**: Time from save to enrichment complete
- [ ] **Expected**: <5 seconds (depends on model speed)

#### TC-PERF-2.2: Batch Enrichment
- [ ] **Test**: Save 10 memories in quick succession
- [ ] **Observe**: How enrichment queue handles load
- [ ] **Expected**: All enrichments complete without errors
- [ ] **Expected**: No UI blocking or freezing

---

### TC-PERF-3: Startup Performance

#### TC-PERF-3.1: Extension Load Time
- [ ] **Test**: Reload extension
- [ ] **Measure**: Time until side panel is interactive
- [ ] **Expected**: <500ms

#### TC-PERF-3.2: Cold Start (First Use)
- [ ] **Test**: Fresh install, first open
- [ ] **Measure**: Time to show login screen
- [ ] **Expected**: <1 second

---

## Test Suite 5: Security Testing 🔒

**Priority**: High
**Estimated Time**: 1-2 hours

### TC-SEC-1: Encryption Verification

#### TC-SEC-1.1: Memory Encryption
- [ ] **Test**: Save a memory
- [ ] **Action**: Inspect chrome.storage.local raw data
- [ ] **Expected**: Content is encrypted (not readable plaintext)
- [ ] **Expected**: Nonce is present and unique

#### TC-SEC-1.2: Master Key Security
- [ ] **Test**: Inspect storage for master key
- [ ] **Expected**: Master key is NOT stored in plaintext
- [ ] **Expected**: Master key derived from password or securely generated

#### TC-SEC-1.3: Session Token Security
- [ ] **Test**: Inspect storage for session tokens
- [ ] **Expected**: Tokens stored securely
- [ ] **Test**: Log out
- [ ] **Expected**: Tokens cleared from storage

---

### TC-SEC-2: XSS and Injection Prevention

#### TC-SEC-2.1: Content Sanitization
- [ ] **Test**: Memory with `<img src=x onerror=alert('xss')>`
- [ ] **Expected**: Script doesn't execute when viewing memory
- [ ] **Test**: Memory with `<iframe src="javascript:alert('xss')">`
- [ ] **Expected**: iframe blocked or sandboxed

---

## Test Suite 6: Cross-Platform Testing 🌐

**Priority**: Medium
**Estimated Time**: 1 hour

### TC-PLAT-1: Platform Detection

#### TC-PLAT-1.1: ChatGPT
- [ ] **Test**: Navigate to chatgpt.com
- [ ] **Expected**: Platform detected as "chatgpt"
- [ ] **Expected**: Platform logo displays correctly

#### TC-PLAT-1.2: Claude
- [ ] **Test**: Navigate to claude.ai
- [ ] **Expected**: Platform detected as "claude"
- [ ] **Expected**: Platform logo displays correctly

#### TC-PLAT-1.3: Perplexity
- [ ] **Test**: Navigate to perplexity.ai
- [ ] **Expected**: Platform detected as "perplexity"
- [ ] **Expected**: Platform logo displays correctly

#### TC-PLAT-1.4: Unknown Platform
- [ ] **Test**: Navigate to random website
- [ ] **Expected**: Extension inactive or shows "Not supported on this site"

---

## Test Suite 7: Regression Testing 🔄

**Priority**: Medium
**Estimated Time**: 1 hour

### TC-REG-1: Re-test Previously Fixed Issues

#### TC-REG-1.1: Google OAuth
- [ ] **Test**: Sign in with Google (OAuth)
- [ ] **Expected**: ✅ Master key auto-generated
- [ ] **Expected**: ✅ UI updates after successful login
- [ ] **Expected**: ✅ Session persists after reload

#### TC-REG-1.2: Platform Badges
- [ ] **Test**: View memories from different platforms
- [ ] **Expected**: ✅ Correct platform logo (not generic "AI" badge)
- [ ] **Expected**: ✅ Claude logo displays correctly
- [ ] **Expected**: ✅ Perplexity logo displays correctly

#### TC-REG-1.3: Premium API Option
- [ ] **Test**: Open settings
- [ ] **Expected**: ✅ "Premium API (Engram Cloud)" option visible
- [ ] **Expected**: ✅ Label changes to "License Key" for premium
- [ ] **Expected**: ✅ Placeholder is "engram-lic-..." for premium

---

## Test Execution Guidelines

### How to Run Tests

1. **Dev Build**: Use `chrome-mv3-dev` for most testing (hot reload)
2. **Prod Build**: Run final verification on `chrome-mv3-prod`
3. **DevTools**: Keep console open to catch errors
4. **Screenshots**: Take screenshots of errors or unexpected behavior
5. **Logging**: Note all console warnings/errors

### Test Environment

- **Browser**: Chrome latest stable
- **OS**: macOS (Darwin 24.3.0)
- **Extension**: Engram Community Edition
- **Build**: chrome-mv3-dev (primary), chrome-mv3-prod (verification)

### Test Data

Create test data sets:
- **Small**: 5-10 memories
- **Medium**: 50 memories
- **Large**: 100+ memories

### Recording Results

For each test:
- [ ] **PASS**: ✅ Works as expected
- [ ] **FAIL**: ❌ Doesn't work, note issue
- [ ] **BLOCKED**: ⏸️ Can't test (missing feature/dependency)
- [ ] **SKIP**: ⏭️ Not applicable

---

## Success Criteria

### Must Pass (Blocking for v0.1.0)
- ✅ All error handling tests pass
- ✅ No critical bugs in normal operation
- ✅ Security tests pass (encryption working)
- ✅ Performance acceptable with 100 memories

### Should Pass (Important but not blocking)
- ✅ Edge cases handled gracefully
- ✅ CRUD operations work (if implemented)
- ✅ No console errors during normal use

### Nice to Pass (Can fix in v0.2.0)
- Performance with 1000+ memories
- Advanced edge cases
- Perfect error messages

---

## Test Report Template

After completing all tests, create a summary report:

```markdown
# Test Report - Phase 4.1 Complete Testing

**Date**: [Date]
**Tester**: [Name]
**Build**: chrome-mv3-[dev/prod]

## Summary
- Total Tests: X
- Passed: X (X%)
- Failed: X (X%)
- Blocked: X
- Skipped: X

## Critical Issues Found
1. [Issue description]
2. [Issue description]

## Non-Critical Issues Found
1. [Issue description]

## Recommendations
- [Recommendation]

## Sign-off
- [ ] Ready for Chrome Web Store submission
- [ ] Needs fixes before submission
```

---

## Next Steps After Testing

1. Fix any critical bugs found
2. Document known issues
3. Update TESTING_SUMMARY.md
4. Proceed to Task 4.3 (Chrome Web Store prep)

---

_Created: January 4, 2026_

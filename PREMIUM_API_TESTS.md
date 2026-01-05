# Premium API Integration - Test Suite

**Date**: January 5, 2026
**API URL**: http://localhost:3000
**Test License**: ENGRAM-A9R4-TLC6-69H9-RH3Z (PRO tier)
**Status**: Deployed locally on Mac Mini M4 Pro

---

## Pre-Test Setup

### Prerequisites
- [ ] Docker services running: `docker-compose ps` shows all healthy
- [ ] LM Studio running with llama-3.2-3b-instruct model
- [ ] Extension rebuilt with Premium API URL
- [ ] Extension loaded in Chrome (chrome-mv3-prod)

### Quick Verification
```bash
# Check API is responding
curl http://localhost:3000/health

# Check LM Studio is accessible
curl http://localhost:1234/v1/models
```

---

## Test Suite 1: API Health & Configuration ✅

### TC-PREM-1.1: Health Endpoint
- [x] **Action**: `curl http://localhost:3000/health`
- [x] **Expected**: Returns `{"status":"ok","environment":"production","version":"0.1.0"}`
- [x] **Result**: ✅ PASSED (Jan 5, 2026)

### TC-PREM-1.2: Docker Services Status
- [x] **Action**: `docker-compose ps`
- [x] **Expected**: All containers healthy (postgres, redis, api)
- [x] **Result**: ✅ PASSED (Jan 5, 2026)

### TC-PREM-1.3: LM Studio Connection
- [x] **Action**: API calls LM Studio via host.docker.internal:1234
- [x] **Expected**: Container can reach Mac's LM Studio
- [x] **Result**: ✅ PASSED (verified via enrichment test)

---

## Test Suite 2: Authentication & License Management ✅

### TC-PREM-2.1: License Validation (Valid License)
- [x] **Action**: Login with `ENGRAM-A9R4-TLC6-69H9-RH3Z`
- [x] **Expected**: Returns JWT token, user info, license details
- [x] **Response**:
  ```json
  {
    "success": true,
    "token": "eyJhbGci...",
    "user": {"id": "...", "email": "test@example.com"},
    "license": {"tier": "PRO", "rateLimit": 100, "expiresAt": null}
  }
  ```
- [x] **Result**: ✅ PASSED (Jan 5, 2026)

### TC-PREM-2.2: License Validation (Invalid License)
- [ ] **Action**: Login with invalid license `ENGRAM-XXXX-XXXX-XXXX-XXXX`
- [ ] **Expected**: Returns error "Invalid license key"
- [ ] **Test**: Try from extension settings

### TC-PREM-2.3: JWT Token Expiration
- [ ] **Action**: Use expired JWT token for API call
- [ ] **Expected**: Returns 401 Unauthorized with clear message
- [ ] **Test**: Decode token, verify expiry is 7 days

### TC-PREM-2.4: Missing Authorization Header
- [ ] **Action**: Call `/enrich` without Authorization header
- [ ] **Expected**: Returns "Missing or invalid authorization header"
- [ ] **Test**: `curl -X POST http://localhost:3000/enrich -d '{}'`

### TC-PREM-2.5: Malformed JWT Token
- [ ] **Action**: Call `/enrich` with invalid Bearer token
- [ ] **Expected**: Returns "Authentication failed" or JWT error
- [ ] **Test**: `curl -H "Authorization: Bearer invalid_token" ...`

---

## Test Suite 3: Memory Enrichment API ✅

### TC-PREM-3.1: Basic Enrichment (Valid Content)
- [x] **Action**: Enrich "I learned about React hooks today"
- [x] **Expected**: Returns keywords, tags, context from LLM
- [x] **Response**:
  ```json
  {
    "success": true,
    "enrichment": {
      "keywords": ["React", "hooks"],
      "tags": ["Programming", "Development", "Learning"],
      "context": "Discussion about learning a new programming concept"
    },
    "usage": {"tokens": 201, "model": "llama-3.2-3b-instruct"}
  }
  ```
- [x] **Result**: ✅ PASSED (Jan 5, 2026)

### TC-PREM-3.2: Empty Content
- [ ] **Action**: Enrich with empty string `{"content": ""}`
- [ ] **Expected**: Returns 400 "content (string) is required"
- [ ] **Test**: Verify error handling in extension

### TC-PREM-3.3: Long Content (Max Length)
- [ ] **Action**: Enrich with 9,999 characters
- [ ] **Expected**: Succeeds normally
- [ ] **Action**: Enrich with 10,001 characters
- [ ] **Expected**: Returns 400 "content exceeds maximum length of 10,000 characters"

### TC-PREM-3.4: Special Characters & Encoding
- [ ] **Action**: Enrich content with emojis, unicode, special chars
- [ ] **Content**: "Learning 日本語 programming 🚀 with React ⚛️"
- [ ] **Expected**: Handles correctly, returns valid enrichment

### TC-PREM-3.5: Multiple Rapid Requests (Rate Limiting)
- [ ] **Action**: Send 10 requests in quick succession
- [ ] **Expected**: All succeed (PRO tier has 100/hour limit)
- [ ] **Action**: Create FREE tier license, send 15 requests
- [ ] **Expected**: First 10 succeed, then rate limit errors

### TC-PREM-3.6: LLM Response Parsing
- [ ] **Action**: Verify JSON extraction from LLM response
- [ ] **Expected**: Handles both pure JSON and markdown-wrapped JSON
- [ ] **Test**: Check logs for parsing errors

---

## Test Suite 4: Extension Integration 🔄

### TC-PREM-4.1: Settings UI - Provider Selection
- [ ] **Action**: Open extension settings
- [ ] **Expected**: "Premium API" option visible in provider dropdown
- [ ] **Screenshot**: Settings panel with premium option

### TC-PREM-4.2: Settings UI - License Input
- [ ] **Action**: Select "Premium API" provider
- [ ] **Expected**: Input field changes to "License Key"
- [ ] **Expected**: Placeholder shows "ENGRAM-XXXX-XXXX-XXXX-XXXX"

### TC-PREM-4.3: License Configuration & Validation
- [ ] **Action**: Enter test license `ENGRAM-A9R4-TLC6-69H9-RH3Z`
- [ ] **Action**: Click "Save Settings"
- [ ] **Expected**: Success message "Premium API configured successfully"
- [ ] **Expected**: Settings persist after reload

### TC-PREM-4.4: Invalid License Error Handling
- [ ] **Action**: Enter invalid license in settings
- [ ] **Action**: Save and try to enrich
- [ ] **Expected**: Clear error message in UI (not just console)
- [ ] **Expected**: Fallback to local mode or show setup prompt

### TC-PREM-4.5: End-to-End Memory Save with Premium Enrichment
- [ ] **Setup**: Configure Premium API with valid license
- [ ] **Action**: Save a memory from ChatGPT/Claude
- [ ] **Expected**: Memory saved with encrypted content
- [ ] **Expected**: Memory enriched with keywords/tags from Premium API
- [ ] **Expected**: Usage logged in backend database
- [ ] **Verify**: Check PostgreSQL for usage_logs entry

### TC-PREM-4.6: Search with Premium-Enriched Memories
- [ ] **Setup**: Save 5 memories with premium enrichment
- [ ] **Action**: Search using keywords generated by premium API
- [ ] **Expected**: Relevant memories found
- [ ] **Action**: Search using tags generated by premium API
- [ ] **Expected**: Tagged memories returned

### TC-PREM-4.7: Provider Switching
- [ ] **Action**: Switch from Premium to Local provider
- [ ] **Expected**: Enrichment uses local LM Studio
- [ ] **Action**: Switch from Local back to Premium
- [ ] **Expected**: Enrichment uses Premium API again
- [ ] **Verify**: No errors in console during switches

---

## Test Suite 5: Error Handling & Edge Cases 🚨

### TC-PREM-5.1: API Unreachable
- [ ] **Setup**: Stop docker containers `docker-compose down`
- [ ] **Action**: Try to save memory with premium enrichment
- [ ] **Expected**: Clear error "Premium API unavailable"
- [ ] **Expected**: Memory still saved (without enrichment) OR queued

### TC-PREM-5.2: LM Studio Offline
- [ ] **Setup**: Stop LM Studio, keep API running
- [ ] **Action**: Trigger enrichment
- [ ] **Expected**: API returns 500 with error message
- [ ] **Expected**: Extension shows "Enrichment service unavailable"

### TC-PREM-5.3: Database Connection Loss
- [ ] **Setup**: Stop postgres container
- [ ] **Action**: Try to authenticate
- [ ] **Expected**: API returns database error
- [ ] **Expected**: Extension shows retry prompt

### TC-PREM-5.4: Redis Connection Loss
- [ ] **Setup**: Stop redis container
- [ ] **Action**: Make API calls
- [ ] **Expected**: Rate limiting disabled but API still works
- [ ] **Note**: Redis is for caching, not critical path

### TC-PREM-5.5: Network Timeout
- [ ] **Test**: Simulate slow network (Chrome DevTools > Network > Slow 3G)
- [ ] **Action**: Save memory with enrichment
- [ ] **Expected**: Shows loading state, completes or times out gracefully
- [ ] **Expected**: No hanging UI, clear timeout message

### TC-PREM-5.6: Malformed API Response
- [ ] **Test**: Mock API returns invalid JSON
- [ ] **Expected**: Extension catches error, shows "Enrichment failed"
- [ ] **Expected**: Memory still saved without enrichment

---

## Test Suite 6: Security & Privacy 🔒

### TC-PREM-6.1: Memory Content Encryption
- [ ] **Action**: Save memory via premium API
- [ ] **Verify**: Check IndexedDB - content should be encrypted ciphertext
- [ ] **Expected**: No plaintext content in browser storage
- [ ] **Expected**: Only encrypted EncryptedBlob stored

### TC-PREM-6.2: API Key/License Security
- [ ] **Verify**: License key sent via HTTPS (or localhost)
- [ ] **Verify**: JWT token not exposed in extension storage (only sessionStorage)
- [ ] **Verify**: No API keys logged in console

### TC-PREM-6.3: Backend Data Privacy
- [ ] **Action**: Check PostgreSQL usage_logs table
- [ ] **Verify**: Memory content NOT stored in database
- [ ] **Verify**: Only metadata logged (timestamps, tokens, endpoints)
- [ ] **Query**: `SELECT * FROM usage_logs LIMIT 5;`

### TC-PREM-6.4: CORS Configuration
- [ ] **Test**: Call API from different origin
- [ ] **Expected**: CORS allows chrome-extension://* origins
- [ ] **Verify**: docker-compose.yml has `ALLOWED_ORIGINS=*` for dev

---

## Test Suite 7: Performance & Scalability ⚡

### TC-PREM-7.1: Single Enrichment Latency
- [ ] **Action**: Time a single enrichment request
- [ ] **Expected**: < 3 seconds for local LM Studio
- [ ] **Measure**: Check `usage.tokens` and response time

### TC-PREM-7.2: Concurrent Enrichments
- [ ] **Action**: Save 5 memories simultaneously
- [ ] **Expected**: All complete without errors
- [ ] **Expected**: No rate limit errors (within tier limits)

### TC-PREM-7.3: Large Batch Performance
- [ ] **Action**: Import 50 memories with enrichment enabled
- [ ] **Expected**: Progress indicator shows status
- [ ] **Expected**: All complete within reasonable time (~5 min)

### TC-PREM-7.4: Database Performance
- [ ] **Setup**: Create 1000 usage_log entries
- [ ] **Action**: Query recent usage
- [ ] **Expected**: Fast queries (< 100ms)
- [ ] **Check**: PostgreSQL indexes exist

### TC-PREM-7.5: Memory Pressure
- [ ] **Action**: Save 100+ memories with premium enrichment
- [ ] **Monitor**: Docker container memory usage
- [ ] **Expected**: API container uses < 512MB RAM
- [ ] **Check**: `docker stats`

---

## Test Suite 8: Development & Deployment 🚀

### TC-PREM-8.1: Docker Build Reproducibility
- [ ] **Action**: `docker-compose build --no-cache`
- [ ] **Expected**: Clean build succeeds
- [ ] **Expected**: No TypeScript errors

### TC-PREM-8.2: Container Restart Resilience
- [ ] **Action**: `docker-compose restart api`
- [ ] **Expected**: API comes back healthy
- [ ] **Expected**: Extension reconnects automatically

### TC-PREM-8.3: Database Migration
- [ ] **Action**: `docker-compose exec api npm run db:migrate`
- [ ] **Expected**: Migrations apply successfully
- [ ] **Verify**: Check prisma schema matches database

### TC-PREM-8.4: Logs & Monitoring
- [ ] **Action**: Trigger various API calls
- [ ] **Check**: `docker-compose logs -f api`
- [ ] **Expected**: Structured logs, no errors
- [ ] **Expected**: Request/response times logged

### TC-PREM-8.5: Environment Variables
- [ ] **Verify**: All required env vars set in docker-compose.yml
- [ ] **Check**: JWT_SECRET, DATABASE_URL, LM_STUDIO_URL
- [ ] **Test**: Missing env var causes clear error message

---

## Test Execution Checklist

### Daily Testing (5 min)
- [ ] Health check: `curl http://localhost:3000/health`
- [ ] Docker status: `docker-compose ps`
- [ ] Quick enrichment test via extension

### Before Commits (15 min)
- [ ] Run core test suites (1, 2, 3)
- [ ] Verify no regressions in extension
- [ ] Check docker logs for errors

### Before Deployment (1 hour)
- [ ] Run all test suites
- [ ] Performance testing
- [ ] Security verification
- [ ] Update this document with results

---

## Test Results Summary

| Suite | Tests | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| 1. Health & Config | 3 | 3 | 0 | 0 | ✅ Complete |
| 2. Authentication | 5 | 1 | 0 | 4 | 🔄 In Progress |
| 3. Enrichment API | 6 | 1 | 0 | 5 | 🔄 In Progress |
| 4. Extension Integration | 7 | 0 | 0 | 7 | ⏳ Pending |
| 5. Error Handling | 6 | 0 | 0 | 6 | ⏳ Pending |
| 6. Security & Privacy | 4 | 0 | 0 | 4 | ⏳ Pending |
| 7. Performance | 5 | 0 | 0 | 5 | ⏳ Pending |
| 8. Development | 5 | 0 | 0 | 5 | ⏳ Pending |
| **Total** | **41** | **5** | **0** | **36** | **12% Complete** |

---

## Known Issues

*None yet - this is a new deployment*

---

## Next Testing Session

**Priority Tests to Run**:
1. TC-PREM-4.3: Configure extension with license (end-to-end)
2. TC-PREM-4.5: Save memory with premium enrichment
3. TC-PREM-5.1: API unreachable error handling
4. TC-PREM-6.1: Verify encryption still works
5. TC-PREM-7.1: Measure enrichment latency

**Estimated Time**: 30-45 minutes

---

_Last Updated: January 5, 2026_
_Test Environment: Mac Mini M4 Pro, Docker 24.x, Chrome latest_

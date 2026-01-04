# Testing Reset Guide

**Before starting comprehensive testing, clear all test data for a fresh start.**

---

## Quick Start: Clear All Test Data

### Step 1: Load the Extension
```bash
cd packages/community
npm run build -- --tag dev
```

Then load `build/chrome-mv3-dev/` in Chrome at `chrome://extensions`

### Step 2: Open DevTools Console
1. Go to `chrome://extensions/`
2. Find **Engram** extension
3. Click **"service worker"** link (under "Inspect views")
4. DevTools console will open

### Step 3: Load Clear Script
Copy and paste the **entire contents** of [clear-test-data.js](packages/community/clear-test-data.js) into the console and press Enter.

### Step 4: Clear Data
Run one of these commands:

**Option A: Nuclear Option (Clear Everything)**
```javascript
await clearAllTestData()
```
This clears:
- ✅ All memories
- ✅ Authentication (logs you out)
- ✅ All settings
- ✅ Everything in storage

**Option B: Quick Reset (Recommended for Testing)**
```javascript
await quickReset()
```
This clears:
- ✅ All memories
- ❌ Auth preserved (stay logged in)
- ❌ Settings preserved

**Option C: Clear Only Memories**
```javascript
await clearMemoriesOnly()
```
Keeps auth and settings, removes all memories.

**Option D: Logout Only**
```javascript
await clearAuthOnly()
```
Logs you out, keeps memories and settings.

### Step 5: Reload Extension
1. Go to `chrome://extensions/`
2. Find **Engram**
3. Click the **reload** icon (circular arrow)

### Step 6: Verify Clean State
```javascript
await viewStorageStatus()
```

Expected output:
```
chrome.storage.local:
  Total keys: 0 (or minimal if you kept auth/settings)
  Auth keys: 0
  Memory keys: 0
  Settings keys: 0
```

---

## Before Each Test

For a consistent testing experience:

1. **Start fresh**: `await quickReset()`
2. **Check status**: `await viewStorageStatus()`
3. **Run test**: Follow MANUAL_TESTING_GUIDE.md
4. **Reset again**: `await quickReset()` before next test

---

## Common Scenarios

### Scenario 1: "I want to test from scratch (like a new user)"
```javascript
await clearAllTestData()
// Then reload extension
// You'll see login screen - like first-time user
```

### Scenario 2: "I want to test with fresh memories but stay logged in"
```javascript
await clearMemoriesOnly()
// Then reload extension
// Still logged in, but no memories
```

### Scenario 3: "I want to test multiple quick scenarios"
```javascript
// Test 1
await quickReset()
// ... run test ...

// Test 2
await quickReset()
// ... run test ...

// Test 3
await quickReset()
// ... run test ...
```

### Scenario 4: "I want to see what's currently stored"
```javascript
await viewStorageStatus()
// Shows breakdown of all stored data
```

---

## Troubleshooting

### "Functions not found"
**Cause**: Clear script not loaded

**Fix**: Copy-paste the entire [clear-test-data.js](packages/community/clear-test-data.js) file into console

### "Permission denied" or errors
**Cause**: Wrong console (not extension context)

**Fix**:
1. Make sure you're in the **service worker** console
2. Not the webpage console
3. Go to `chrome://extensions` → Engram → "service worker" link

### "Data still there after clearing"
**Cause**: Extension not reloaded

**Fix**: Must reload extension after clearing:
- `chrome://extensions` → Click reload icon on Engram extension

---

## Manual Clearing (Without Script)

If the script doesn't work, you can manually clear:

### Clear All Data (Manual)
1. Go to `chrome://extensions/`
2. Find **Engram**
3. Click **"Remove"** to uninstall
4. Delete folder: `packages/community/build/chrome-mv3-dev/`
5. Rebuild: `npm run build -- --tag dev`
6. Load unpacked extension again

### Clear IndexedDB (Manual)
1. Open Chrome DevTools (F12)
2. Application tab → Storage → IndexedDB
3. Right-click "EngramDB" → Delete database

### Clear Chrome Storage (Manual)
1. `chrome://extensions/` → Engram → "service worker"
2. In console:
   ```javascript
   chrome.storage.local.clear(() => console.log('Cleared'))
   ```

---

## After Clearing - First Test

Verify clean state works:

1. ✅ Extension loads without errors
2. ✅ Shows login screen (if cleared auth)
3. ✅ No console errors
4. ✅ Sign in works
5. ✅ Can save first memory
6. ✅ Memory appears in list

If all ✅, you're ready to start comprehensive testing!

---

## Next Steps

After clearing and verifying clean state:

1. **Go to**: [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md)
2. **Start with**: TEST 1 (Encryption verification)
3. **Work through**: Priority tests (1-7, 12, 15)
4. **Document**: Results as you go

---

_Good luck with testing! 🧪_

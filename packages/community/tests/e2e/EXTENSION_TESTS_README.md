# Extension E2E Tests - Local Testing Guide

## ⚠️ Important: CI Limitations

**Chrome extension E2E tests currently work LOCALLY but not in CI/CD (GitHub Actions).**

This is a known limitation when testing Chrome extensions in headless CI environments:
- Chrome extensions require a real display server
- Headless modes (including `--headless=new`) have limited extension support
- Service workers don't reliably initialize in CI headless environments
- Xvfb (virtual display) has compatibility issues with Chrome extensions

## ✅ Running Extension Tests Locally

The full E2E test suite works perfectly when run locally in headed mode.

### Prerequisites

1. **Build the extension:**
   ```bash
   npm run build
   ```

2. **Install Playwright browsers (one-time):**
   ```bash
   npx playwright install chromium
   ```

### Running Tests

**All extension tests (with visible browser):**
```bash
npm run test:e2e:headed
```

**Interactive UI mode (recommended for development):**
```bash
npm run test:e2e:ui
```

**Debug mode:**
```bash
npm run test:e2e:debug
```

**Run specific test file:**
```bash
npx playwright test tests/e2e/01-extension-installation.spec.ts.skip --headed
```

Note: Extension tests are currently suffixed with `.skip` to prevent CI failures.

## 📝 Re-enabling Extension Tests for Local Development

To run the extension tests locally, remove the `.skip` suffix:

```bash
# Re-enable all extension tests
cd packages/community/tests/e2e
mv 01-extension-installation.spec.ts.skip 01-extension-installation.spec.ts
mv 02-authentication.spec.ts.skip 02-authentication.spec.ts
mv 03-memory-capture.spec.ts.skip 03-memory-capture.spec.ts
mv 04-search.spec.ts.skip 04-search.spec.ts
mv 05-settings.spec.ts.skip 05-settings.spec.ts

# Run tests
npm run test:e2e:headed
```

## 📊 What Works in CI

The CI environment runs basic Playwright infrastructure tests:
- ✅ `00-minimal.spec.ts` - Verifies Playwright works
- ✅ `00-smoke.spec.ts` - Basic browser operations

These ensure the test infrastructure is functional, even though extension-specific tests require local execution.

## 🔧 Test Coverage

### Extension Installation (15 tests) - `01-extension-installation.spec.ts.skip`
- Extension loads successfully
- Popup opens and renders
- Manifest validation
- Service worker verification
- Required permissions

### Authentication Flow (11 tests) - `02-authentication.spec.ts.skip`
- User registration and login
- Session persistence
- Password encryption
- Logout functionality
- Edge cases (expired sessions, corrupted data)

### Memory Capture (9 tests) - `03-memory-capture.spec.ts.skip`
- Content script injection (ChatGPT, Claude)
- Conversation capture
- Memory encryption
- Metadata capture
- Large conversation handling

### Search Functionality (11 tests) - `04-search.spec.ts.skip`
- Keyword search
- Platform/date/tag filtering
- Multi-filter combinations
- Result relevance ranking
- Large result sets and pagination

### Settings Configuration (17 tests) - `05-settings.spec.ts.skip`
- Settings persistence
- Sync configuration
- AI service configuration
- Privacy settings
- UI preferences
- Settings export/import

**Total: 63+ test cases**

## 🎯 Recommended Workflow

### For Development
```bash
# 1. Make changes to extension code
# 2. Build extension
npm run build

# 3. Run tests in UI mode (best for iterating)
npm run test:e2e:ui

# 4. Or run specific test file
npx playwright test tests/e2e/01-extension-installation.spec.ts.skip --headed
```

### For Pre-commit Testing
```bash
# Run full extension test suite
npm run test:e2e:headed
```

### For CI Verification
```bash
# Run just the infrastructure tests (what CI runs)
npm run test:e2e
```

## 🔍 Debugging Failed Tests

1. **Use UI mode:**
   ```bash
   npm run test:e2e:ui
   ```
   - See test execution step-by-step
   - Inspect DOM, network, console
   - Time travel through test execution

2. **Use debug mode:**
   ```bash
   npm run test:e2e:debug
   ```
   - Pauses at breakpoints
   - Step through test code

3. **Check screenshots/videos:**
   - Failed tests automatically capture screenshots
   - Videos saved to `tests/e2e/test-results/`

4. **Enable verbose logging:**
   ```bash
   DEBUG=pw:api npx playwright test --headed
   ```

## 🚀 Future: CI Support

To enable extension tests in CI, we would need:

1. **Option A: Use real display server**
   - Run CI with full Xorg server (heavy, slow)
   - Services like BrowserStack, Sauce Labs

2. **Option B: Mock extension behavior**
   - Test extension logic without actual Chrome extension
   - Unit/integration tests instead of E2E

3. **Option C: Wait for better headless support**
   - Chrome team improving extension support in headless mode
   - Monitor Playwright/Chrome updates

For now, **local headed testing provides comprehensive coverage** of all extension functionality.

## 📖 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
- [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode)
- [Debugging Tests](https://playwright.dev/docs/debug)

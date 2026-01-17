# E2E Tests with Playwright

End-to-end tests for the Engram browser extension using Playwright.

## Setup

### Prerequisites

1. **Build the extension** before running tests:
   ```bash
   npm run build
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Run all E2E tests (headless)
```bash
npm run test:e2e
```

### Run tests with browser visible
```bash
npm run test:e2e:headed
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run tests with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run specific test file
```bash
npx playwright test tests/e2e/01-extension-installation.spec.ts
```

### Run tests matching a pattern
```bash
npx playwright test --grep "authentication"
```

## Test Structure

```
tests/e2e/
├── fixtures/
│   └── extension-fixture.ts      # Custom Playwright fixtures
├── helpers/
│   └── extension-helper.ts       # Helper functions for tests
├── 01-extension-installation.spec.ts   # Extension loading tests
├── 02-authentication.spec.ts           # Auth flow tests
├── 03-memory-capture.spec.ts          # Memory capture tests
├── 04-search.spec.ts                  # Search functionality tests
├── 05-settings.spec.ts                # Settings configuration tests
├── global-setup.ts                    # Global setup
├── global-teardown.ts                 # Global teardown
└── README.md                          # This file
```

## Test Coverage

### ✅ Extension Installation (01-extension-installation.spec.ts)
- Extension loads successfully
- Popup and side panel open correctly
- Manifest is valid
- Service worker is running
- Required permissions are granted

### ✅ Authentication (02-authentication.spec.ts)
- User registration flow
- User login flow
- Session persistence
- Logout functionality
- Password encryption
- Expired session handling

### ✅ Memory Capture (03-memory-capture.spec.ts)
- Content script injection on ChatGPT and Claude
- Conversation capture from both platforms
- Memory encryption
- Metadata capture
- Large conversation handling
- Concurrent capture support

### ✅ Search (04-search.spec.ts)
- Keyword search
- Platform filtering
- Date range filtering
- Tag-based search
- Multi-filter search
- Result relevance ranking
- Large result set handling
- Pagination

### ✅ Settings (05-settings.spec.ts)
- Settings page accessibility
- Setting persistence
- Sync configuration
- AI service configuration
- Privacy settings (error reporting)
- UI preferences (theme, display)
- Platform configuration
- Settings export/import

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from './fixtures/extension-fixture';
import { openExtensionPopup, waitForExtensionReady } from './helpers/extension-helper';

test.describe('Feature Name', () => {
  test('should do something', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Your test code here

    await popup.close();
  });
});
```

### Available Helper Functions

- `launchBrowserWithExtension()` - Launch browser with extension loaded
- `getExtensionId(context)` - Get the extension ID
- `openExtensionPopup(context, extensionId)` - Open extension popup
- `openSidePanel(context, extensionId)` - Open extension side panel
- `waitForExtensionReady(page)` - Wait for extension UI to be ready
- `clearExtensionStorage(page)` - Clear extension storage
- `getExtensionStorage(page)` - Get all extension storage data
- `setExtensionStorage(page, data)` - Set extension storage data
- `mockAuthenticatedUser(page, userData?)` - Mock authenticated user session
- `takeDebugScreenshot(page, name)` - Take screenshot for debugging

## Configuration

Playwright configuration is in `playwright.config.ts`.

Key settings:
- **Test directory**: `./tests/e2e`
- **Reporter**: HTML report + list
- **Browser**: Chromium (Chrome with extension support)
- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure
- **Videos**: On failure

## Debugging Tests

### Visual debugging with UI mode
```bash
npm run test:e2e:ui
```
This opens an interactive UI where you can:
- See all tests
- Run tests step by step
- See screenshots and videos
- Inspect DOM
- View network requests

### Debug mode with browser visible
```bash
npm run test:e2e:debug
```
This pauses test execution at breakpoints.

### Console logging
Use `console.log()` in tests - output appears in test results.

### Screenshots
Failed tests automatically capture screenshots in `tests/e2e/test-results/`.

## CI/CD Integration

E2E tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

GitHub Actions workflow:
1. Builds the extension
2. Installs Playwright browsers
3. Runs all E2E tests
4. Uploads artifacts on failure (screenshots, videos, reports)

## Troubleshooting

### Extension not loading
- Ensure you've built the extension: `npm run build`
- Check that `build/chrome-mv3-dev/` exists
- Verify `manifest.json` is present in build directory

### Browser not found
- Install Playwright browsers: `npx playwright install chromium`

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Add more `waitForTimeout()` calls if UI is slow to load
- Check if extension service worker is running

### Storage not persisting
- Tests use temporary browser contexts
- Each test starts with clean storage
- Use `setExtensionStorage()` to pre-populate data

## Best Practices

1. **Always close pages/contexts** after tests
2. **Use fixtures** for common setup (extension-fixture.ts)
3. **Mock data** instead of relying on external services
4. **Test one thing** per test case
5. **Use descriptive test names** that explain what's being tested
6. **Add comments** for complex test logic
7. **Keep tests independent** - don't rely on test execution order
8. **Use helper functions** to reduce code duplication

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Chrome Extension Testing](https://playwright.dev/docs/chrome-extensions)

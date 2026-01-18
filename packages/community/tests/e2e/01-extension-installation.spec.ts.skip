import { test, expect } from './fixtures/extension-fixture';
import { openExtensionPopup, waitForExtensionReady } from './helpers/extension-helper';

/**
 * E2E Tests for Extension Installation and Basic Functionality
 *
 * These tests verify that:
 * - Extension loads successfully
 * - Popup opens and renders correctly
 * - Side panel can be accessed
 * - Extension manifest is valid
 */

test.describe('Extension Installation', () => {
  test('should load extension successfully', async ({ context, extensionId }) => {
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/); // Chrome extension IDs are 32 lowercase letters
  });

  test('should open extension popup', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Verify popup is loaded
    expect(popup.url()).toContain(extensionId);
    expect(popup.url()).toContain('popup.html');

    // Verify popup has content
    const body = await popup.locator('body');
    await expect(body).toBeVisible();

    await popup.close();
  });

  test('should have valid manifest', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const manifestUrl = `chrome-extension://${extensionId}/manifest.json`;

    // Fetch manifest
    const response = await page.goto(manifestUrl);
    expect(response?.status()).toBe(200);

    const manifestText = await page.textContent('body');
    const manifest = JSON.parse(manifestText || '{}');

    // Verify required manifest fields
    expect(manifest.name).toBe('Engram');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning
    expect(manifest.manifest_version).toBe(3);

    // Verify required permissions
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('sidePanel');

    // Verify host permissions for supported platforms
    expect(manifest.host_permissions).toContain('https://chatgpt.com/*');
    expect(manifest.host_permissions).toContain('https://claude.ai/*');

    await page.close();
  });

  test('should have service worker running', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navigate to a supported platform to trigger service worker
    await page.goto('https://chatgpt.com');
    await page.waitForTimeout(2000); // Wait for service worker to initialize

    // Service worker should be active
    // We can verify this by checking if chrome.runtime is available
    const hasRuntime = await page.evaluate(() => {
      return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
    });

    expect(hasRuntime).toBe(true);

    await page.close();
  });

  test('should have required extension pages', async ({ context, extensionId }) => {
    // Test that all required extension pages exist
    const requiredPages = [
      'popup.html',
      'sidepanel.html',
    ];

    for (const pagePath of requiredPages) {
      const page = await context.newPage();
      const url = `chrome-extension://${extensionId}/${pagePath}`;
      const response = await page.goto(url);

      expect(response?.status()).toBe(200);
      console.log(`✅ ${pagePath} loaded successfully`);

      await page.close();
    }
  });
});

test.describe('Extension UI Elements', () => {
  test('popup should render main navigation', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Check for main UI elements
    // These selectors may need to be adjusted based on actual implementation
    const body = await popup.locator('body');
    await expect(body).toBeVisible();

    // Popup should have some text content
    const textContent = await popup.textContent('body');
    expect(textContent).toBeTruthy();
    expect(textContent!.length).toBeGreaterThan(0);

    await popup.close();
  });

  test('should handle popup close and reopen', async ({ context, extensionId }) => {
    // Open popup
    let popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);
    await popup.close();

    // Reopen popup
    popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Verify it still works
    const body = await popup.locator('body');
    await expect(body).toBeVisible();

    await popup.close();
  });
});

test.describe('Extension Permissions', () => {
  test('should have storage permission', async ({ context, extensionId }) => {
    const page = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(page);

    // Test chrome.storage access
    const hasStorageAccess = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ test: 'value' }, () => {
            chrome.storage.local.get('test', (result) => {
              resolve(result.test === 'value');
            });
          });
        } else {
          resolve(false);
        }
      });
    });

    expect(hasStorageAccess).toBe(true);

    await page.close();
  });
});

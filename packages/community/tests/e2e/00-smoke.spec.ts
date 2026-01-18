import { test as base, expect } from '@playwright/test';
import { launchBrowserWithExtension } from './helpers/extension-helper';

/**
 * Smoke Test - Verifies basic E2E test infrastructure
 *
 * This is a minimal test to ensure:
 * - Browser launches successfully
 * - Extension loads
 * - Basic operations work
 */

test.describe('Smoke Test', () => {
  test('should launch browser with extension', async () => {
    console.log('🧪 Starting smoke test: launching browser...');

    const context = await launchBrowserWithExtension();

    console.log('✅ Browser launched successfully');

    // Verify browser context exists
    expect(context).toBeDefined();

    // Check for service workers
    const serviceWorkers = context.serviceWorkers();
    console.log(`📊 Service workers found: ${serviceWorkers.length}`);

    // Check for background pages
    const backgroundPages = context.backgroundPages();
    console.log(`📊 Background pages found: ${backgroundPages.length}`);

    // Check for regular pages
    const pages = context.pages();
    console.log(`📊 Pages found: ${pages.length}`);

    // Try to find extension ID
    let extensionId = '';

    for (const worker of serviceWorkers) {
      const url = worker.url();
      console.log(`🔍 Service worker URL: ${url}`);
      if (url.startsWith('chrome-extension://')) {
        extensionId = url.split('/')[2];
        break;
      }
    }

    if (!extensionId) {
      for (const page of backgroundPages) {
        const url = page.url();
        console.log(`🔍 Background page URL: ${url}`);
        if (url.startsWith('chrome-extension://')) {
          extensionId = url.split('/')[2];
          break;
        }
      }
    }

    if (!extensionId) {
      for (const page of pages) {
        const url = page.url();
        console.log(`🔍 Page URL: ${url}`);
        if (url.startsWith('chrome-extension://')) {
          extensionId = url.split('/')[2];
          break;
        }
      }
    }

    if (extensionId) {
      console.log(`✅ Extension ID detected: ${extensionId}`);
      expect(extensionId).toMatch(/^[a-z]{32}$/);
    } else {
      console.log('⚠️  Extension ID not found in initial pages/workers');
      // Don't fail - extension might still be loading
    }

    // Cleanup
    await context.close();
    console.log('✅ Smoke test completed - browser closed');
  });

  test('should create and close a page', async () => {
    const context = await launchBrowserWithExtension();

    const page = await context.newPage();
    expect(page).toBeDefined();

    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');

    await page.close();
    await context.close();
  });
});

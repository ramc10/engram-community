import { test, expect } from '@playwright/test';

/**
 * Smoke Test - Verifies basic Playwright works
 *
 * NOTE: Extension loading in headless CI is challenging.
 * These tests verify Playwright infrastructure works.
 * Extension tests should be run locally with headed mode.
 */

test.describe('Smoke Test - Playwright Infrastructure', () => {
  test('should launch browser and navigate', async ({ browser }) => {
    console.log('🧪 Starting smoke test...');

    const context = await browser.newContext();
    console.log('✅ Context created');

    const page = await context.newPage();
    console.log('✅ Page created');

    await page.goto('https://example.com');
    console.log('✅ Navigated to example.com');

    expect(page.url()).toContain('example.com');
    console.log('✅ URL verified');

    await page.close();
    await context.close();
    console.log('✅ Smoke test completed');
  });

  test('should handle multiple pages', async ({ browser }) => {
    const context = await browser.newContext();

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('about:blank');
    await page2.goto('about:blank');

    expect(page1.url()).toBe('about:blank');
    expect(page2.url()).toBe('about:blank');

    await context.close();
  });
});

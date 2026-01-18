import { test, expect } from '@playwright/test';

/**
 * Minimal test to verify Playwright works in CI
 */

test.describe('Minimal CI Test', () => {
  test('should run a basic Playwright test', async ({ browser }) => {
    console.log('✅ Test started');

    const context = await browser.newContext();
    console.log('✅ Context created');

    const page = await context.newPage();
    console.log('✅ Page created');

    await page.goto('about:blank');
    console.log('✅ Navigated to about:blank');

    expect(page.url()).toBe('about:blank');
    console.log('✅ URL verified');

    await page.close();
    await context.close();
    console.log('✅ Test completed successfully');
  });
});

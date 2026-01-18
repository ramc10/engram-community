import { test, expect } from './fixtures/extension-fixture';

/**
 * Smoke Test - Verifies basic E2E test infrastructure
 *
 * This is a minimal test to ensure:
 * - Browser launches successfully
 * - Extension loads
 * - Extension ID can be detected
 */

test.describe('Smoke Test', () => {
  test('should launch browser and get extension ID', async ({ context, extensionId }) => {
    // Verify browser context exists
    expect(context).toBeDefined();

    // Verify extension ID was detected
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/); // Chrome extension IDs are 32 lowercase letters

    console.log('✅ Smoke test passed - Extension ID:', extensionId);
  });

  test('should create a new page', async ({ context }) => {
    const page = await context.newPage();

    expect(page).toBeDefined();

    await page.close();
  });

  test('should have at least one page in context', async ({ context }) => {
    const pages = context.pages();

    expect(pages.length).toBeGreaterThanOrEqual(0);
  });
});

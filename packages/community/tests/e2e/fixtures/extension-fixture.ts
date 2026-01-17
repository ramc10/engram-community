import { test as base, BrowserContext } from '@playwright/test';
import {
  launchBrowserWithExtension,
  getExtensionId,
  clearExtensionStorage,
} from '../helpers/extension-helper';

/**
 * Extended test fixture with extension context
 */
type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

/**
 * Custom test fixture that automatically loads the extension
 * and provides extension ID to tests
 */
export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    // Setup: Launch browser with extension
    const context = await launchBrowserWithExtension();

    // Provide context to test
    await use(context);

    // Teardown: Close browser
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID from context
    const extensionId = await getExtensionId(context);

    // Clear storage for clean test state
    const page = context.pages()[0] || (await context.newPage());
    await clearExtensionStorage(page);

    // Provide extension ID to test
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';

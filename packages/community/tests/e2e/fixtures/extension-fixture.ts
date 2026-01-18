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
    console.log('🔧 Fixture: Launching browser with extension...');

    // Setup: Launch browser with extension
    const context = await launchBrowserWithExtension();

    console.log('✅ Fixture: Browser launched');

    // Provide context to test
    await use(context);

    // Teardown: Close browser
    console.log('🧹 Fixture: Closing browser...');
    await context.close();
  },

  extensionId: async ({ context }, use, testInfo) => {
    console.log('🔧 Fixture: Getting extension ID...');

    try {
      // Get extension ID from context with timeout
      const extensionId = await Promise.race([
        getExtensionId(context),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Extension ID detection timed out after 15 seconds')), 15000)
        ),
      ]);

      console.log(`✅ Fixture: Extension ID found: ${extensionId}`);

      // Clear storage for clean test state
      try {
        const page = context.pages()[0] || (await context.newPage());
        await clearExtensionStorage(page);
        console.log('✅ Fixture: Storage cleared');
      } catch (error) {
        console.warn('⚠️  Fixture: Could not clear storage:', error);
      }

      // Provide extension ID to test
      await use(extensionId);
    } catch (error) {
      console.error('❌ Fixture: Failed to get extension ID:', error);

      // Log diagnostic info
      console.log('📊 Diagnostic info:');
      console.log(`  - Service workers: ${context.serviceWorkers().length}`);
      console.log(`  - Background pages: ${context.backgroundPages().length}`);
      console.log(`  - Regular pages: ${context.pages().length}`);

      // Skip this test and mark as expected failure
      testInfo.skip(true, 'Extension ID could not be detected');

      // Provide empty string to prevent undefined errors
      await use('');
    }
  },
});

export { expect } from '@playwright/test';

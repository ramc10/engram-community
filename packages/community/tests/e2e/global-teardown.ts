import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests
 * Cleanup after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running Playwright global teardown...');

  // Add any cleanup logic here if needed
  // For example, removing temporary test data

  console.log('✅ Global teardown complete');
}

export default globalTeardown;

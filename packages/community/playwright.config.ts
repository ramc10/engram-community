import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Engram browser extension E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    process.env.CI ? ['github'] : ['list']
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'https://chatgpt.com',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Timeout for each action */
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers with extension support */
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome/Chromium supports extensions
        viewport: { width: 1280, height: 720 },
        // Extension-specific context options will be set in tests
        // We'll use chromium.launchPersistentContext in tests
      },
    },
  ],

  /* Global setup and teardown */
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  /* Folder for test artifacts */
  outputDir: 'tests/e2e/test-results',

  /* Timeouts */
  timeout: 30000, // 30 seconds per test (reduced from 60s)
  expect: {
    timeout: 5000, // 5 seconds for expect assertions (reduced from 10s)
  },

  /* Global timeout for the entire test run */
  globalTimeout: 300000, // 5 minutes total for all tests
});

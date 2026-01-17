import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

/**
 * Global setup for Playwright tests
 * Builds the extension and verifies it's ready for testing
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');

  // Path to the built extension
  const extensionPath = path.join(__dirname, '../../build/chrome-mv3-dev');

  // Verify extension build exists
  const fs = require('fs');
  if (!fs.existsSync(extensionPath)) {
    throw new Error(
      `Extension build not found at ${extensionPath}. Please run 'npm run build' first.`
    );
  }

  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${extensionPath}`);
  }

  console.log('✅ Extension build verified at:', extensionPath);

  // Launch a browser to verify extension loads
  console.log('🔍 Verifying extension can be loaded...');
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
    ],
  });

  // Get extension ID
  let extensionId = '';
  const targets = browser.pages();
  for (const target of targets) {
    const url = target.url();
    if (url.startsWith('chrome-extension://')) {
      extensionId = url.split('/')[2];
      console.log('✅ Extension loaded with ID:', extensionId);
      break;
    }
  }

  await browser.close();

  if (!extensionId) {
    console.warn('⚠️  Could not detect extension ID during setup');
  }

  console.log('✅ Global setup complete');
}

export default globalSetup;

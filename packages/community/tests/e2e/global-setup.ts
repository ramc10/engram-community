import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Global setup for Playwright tests
 * Verifies extension build is ready for testing
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');

  // Path to the built extension
  const extensionPath = path.join(__dirname, '../../build/chrome-mv3-dev');

  // Verify extension build exists
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

  // Verify manifest is valid JSON
  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    if (!manifest.name || !manifest.version || !manifest.manifest_version) {
      throw new Error('Manifest is missing required fields');
    }

    console.log(`✅ Manifest validated: ${manifest.name} v${manifest.version}`);
  } catch (error) {
    throw new Error(`Invalid manifest.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('✅ Global setup complete');
}

export default globalSetup;

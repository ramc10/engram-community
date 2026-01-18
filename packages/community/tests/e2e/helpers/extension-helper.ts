import { BrowserContext, chromium, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Helper utilities for testing Chrome extensions with Playwright
 */

/**
 * Launch browser with extension loaded
 */
export async function launchBrowserWithExtension(): Promise<BrowserContext> {
  const extensionPath = path.join(__dirname, '../../../build/chrome-mv3-dev');

  // In CI, use headless mode. Locally, use headed mode for easier debugging
  const isCI = !!process.env.CI;

  // Create a temporary directory for user data
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-extension-'));

  const launchArgs = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ];

  // In headless mode, use the new headless mode which supports extensions better
  if (isCI) {
    launchArgs.push('--headless=new');
  }

  const context = await chromium.launchPersistentContext(tempDir, {
    // Don't use headless: true, instead use --headless=new flag for extension support
    headless: false,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Wait for the extension to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));

  return context;
}

/**
 * Get the extension ID from the browser context
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  // Method 1: Check service workers (for MV3 extensions)
  let serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length > 0) {
    const url = serviceWorkers[0].url();
    if (url.startsWith('chrome-extension://')) {
      return url.split('/')[2];
    }
  }

  // Method 2: Check background pages (for MV2 or if service worker not ready)
  let backgroundPages = context.backgroundPages();
  if (backgroundPages.length > 0) {
    const url = backgroundPages[0].url();
    if (url.startsWith('chrome-extension://')) {
      return url.split('/')[2];
    }
  }

  // Method 3: Check all pages
  const pages = context.pages();
  for (const page of pages) {
    const url = page.url();
    if (url.startsWith('chrome-extension://')) {
      return url.split('/')[2];
    }
  }

  // Method 4: Wait and listen for service worker
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Extension ID not found after 10 seconds'));
    }, 10000);

    context.on('serviceworker', (worker) => {
      const url = worker.url();
      if (url.startsWith('chrome-extension://')) {
        clearTimeout(timeout);
        resolve(url.split('/')[2]);
      }
    });

    context.on('backgroundpage', (page) => {
      const url = page.url();
      if (url.startsWith('chrome-extension://')) {
        clearTimeout(timeout);
        resolve(url.split('/')[2]);
      }
    });
  });
}

/**
 * Open extension popup
 */
export async function openExtensionPopup(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const page = await context.newPage();
  await page.goto(popupUrl);
  return page;
}

/**
 * Open extension side panel
 */
export async function openSidePanel(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
  const page = await context.newPage();
  await page.goto(sidepanelUrl);
  return page;
}

/**
 * Wait for extension to be ready
 */
export async function waitForExtensionReady(
  page: Page,
  timeout = 5000
): Promise<void> {
  // Wait for the extension's React app to render
  await page.waitForSelector('body', { timeout });
  // Give React time to hydrate
  await page.waitForTimeout(1000);
}

/**
 * Clear extension storage (for clean test state)
 */
export async function clearExtensionStorage(
  page: Page
): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.clear(() => {
          chrome.storage.sync.clear(() => {
            resolve();
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.clear();
        resolve();
      }
    });
  });
}

/**
 * Get extension storage data
 */
export async function getExtensionStorage(page: Page): Promise<any> {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(null, (data) => {
          resolve(data);
        });
      } else {
        resolve({});
      }
    });
  });
}

/**
 * Set extension storage data
 */
export async function setExtensionStorage(
  page: Page,
  data: Record<string, any>
): Promise<void> {
  await page.evaluate((storageData) => {
    return new Promise<void>((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set(storageData, () => {
          resolve();
        });
      } else {
        Object.entries(storageData).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
        resolve();
      }
    });
  }, data);
}

/**
 * Mock user authentication state
 */
export async function mockAuthenticatedUser(
  page: Page,
  userData = {
    userId: 'test-user-123',
    email: 'test@example.com',
    masterKeyHash: 'mock-master-key-hash',
  }
): Promise<void> {
  await setExtensionStorage(page, {
    'auth-user': userData,
    'auth-session': {
      sessionId: 'test-session',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    },
  });
}

/**
 * Wait for element with retry
 */
export async function waitForElementWithRetry(
  page: Page,
  selector: string,
  maxRetries = 3,
  retryDelay = 1000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await page.waitForTimeout(retryDelay);
    }
  }
}

/**
 * Take screenshot for debugging
 */
export async function takeDebugScreenshot(
  page: Page,
  name: string
): Promise<void> {
  const screenshotPath = path.join(
    __dirname,
    '../test-results',
    `${name}-${Date.now()}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

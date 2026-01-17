import { BrowserContext, chromium, Page } from '@playwright/test';
import path from 'path';

/**
 * Helper utilities for testing Chrome extensions with Playwright
 */

/**
 * Launch browser with extension loaded
 */
export async function launchBrowserWithExtension(): Promise<BrowserContext> {
  const extensionPath = path.join(__dirname, '../../../build/chrome-mv3-dev');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    // Use a temporary profile for each test
    // This ensures clean state between tests
  });

  return context;
}

/**
 * Get the extension ID from the browser context
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  // Extension pages are available as background pages or service workers
  const pages = context.pages();

  for (const page of pages) {
    const url = page.url();
    if (url.startsWith('chrome-extension://')) {
      const extensionId = url.split('/')[2];
      return extensionId;
    }
  }

  // Alternative: try to find extension ID via chrome.runtime
  const page = await context.newPage();
  await page.goto('chrome://extensions/');

  throw new Error('Could not determine extension ID');
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

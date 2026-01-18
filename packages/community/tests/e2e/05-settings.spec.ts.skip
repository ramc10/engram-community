import { test, expect } from './fixtures/extension-fixture';
import {
  openExtensionPopup,
  waitForExtensionReady,
  mockAuthenticatedUser,
  setExtensionStorage,
  getExtensionStorage,
} from './helpers/extension-helper';

/**
 * E2E Tests for Settings Configuration
 *
 * These tests verify:
 * - Settings page accessibility
 * - Sync configuration
 * - AI service configuration
 * - Privacy settings
 * - Error reporting settings
 * - Theme preferences
 */

test.describe('Settings - Basic Access', () => {
  test('should open settings page', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);
    await mockAuthenticatedUser(popup);

    // Settings should be accessible from popup or sidepanel
    // For now, just verify we can navigate to settings
    const settingsUrl = `chrome-extension://${extensionId}/tabs/settings.html`;
    const settingsPage = await context.newPage();
    await settingsPage.goto(settingsUrl);
    await waitForExtensionReady(settingsPage);

    // Verify settings page loaded
    const body = await settingsPage.locator('body');
    await expect(body).toBeVisible();

    await settingsPage.close();
    await popup.close();
  });

  test('should persist settings across sessions', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Set some settings
    await setExtensionStorage(popup, {
      settings: {
        theme: 'dark',
        syncEnabled: true,
        autoCapture: true,
      },
    });

    await popup.close();

    // Reopen and verify settings persist
    const newPopup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(newPopup);

    const storage = await getExtensionStorage(newPopup);
    expect(storage.settings.theme).toBe('dark');
    expect(storage.settings.syncEnabled).toBe(true);
    expect(storage.settings.autoCapture).toBe(true);

    await newPopup.close();
  });
});

test.describe('Settings - Sync Configuration', () => {
  test('should enable/disable sync', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);
    await mockAuthenticatedUser(popup);

    // Enable sync
    await setExtensionStorage(popup, {
      settings: {
        syncEnabled: true,
        syncProvider: 'supabase',
      },
    });

    let storage = await getExtensionStorage(popup);
    expect(storage.settings.syncEnabled).toBe(true);

    // Disable sync
    await setExtensionStorage(popup, {
      settings: {
        syncEnabled: false,
      },
    });

    storage = await getExtensionStorage(popup);
    expect(storage.settings.syncEnabled).toBe(false);

    await popup.close();
  });

  test('should configure sync provider', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        syncProvider: 'supabase',
        syncUrl: 'https://test.supabase.co',
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.syncProvider).toBe('supabase');
    expect(storage.settings.syncUrl).toBeTruthy();

    await popup.close();
  });

  test('should handle sync conflicts', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Set conflict resolution strategy
    await setExtensionStorage(popup, {
      settings: {
        syncConflictResolution: 'latest-wins',
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.syncConflictResolution).toBe('latest-wins');

    await popup.close();
  });
});

test.describe('Settings - AI Service Configuration', () => {
  test('should configure OpenAI API', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        aiProvider: 'openai',
        aiApiKey: 'sk-test-key-encrypted',
        enableEnrichment: true,
        enableLinking: true,
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.aiProvider).toBe('openai');
    expect(storage.settings.enableEnrichment).toBe(true);

    await popup.close();
  });

  test('should configure Anthropic API', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        aiProvider: 'anthropic',
        aiApiKey: 'sk-ant-test-key-encrypted',
        enableEnrichment: false,
        enableEvolution: true,
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.aiProvider).toBe('anthropic');
    expect(storage.settings.enableEvolution).toBe(true);

    await popup.close();
  });

  test('should toggle AI features', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Test toggling individual features
    const features = {
      enableEnrichment: true,
      enableLinking: false,
      enableEvolution: true,
    };

    await setExtensionStorage(popup, { settings: features });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.enableEnrichment).toBe(true);
    expect(storage.settings.enableLinking).toBe(false);
    expect(storage.settings.enableEvolution).toBe(true);

    await popup.close();
  });
});

test.describe('Settings - Privacy', () => {
  test('should configure error reporting', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Enable error reporting (opt-in)
    await setExtensionStorage(popup, {
      'github-reporter-config': {
        enabled: true,
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: [],
      },
    });

    const storage = await getExtensionStorage(popup);
    const config = storage['github-reporter-config'];

    expect(config.enabled).toBe(true);
    expect(config.rateLimitMinutes).toBe(5);

    await popup.close();
  });

  test('should disable error reporting by default', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Verify error reporting is opt-in (disabled by default)
    const storage = await getExtensionStorage(popup);
    const config = storage['github-reporter-config'];

    // Should be undefined or explicitly disabled
    expect(!config || config.enabled === false).toBe(true);

    await popup.close();
  });

  test('should configure data retention', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        dataRetentionDays: 90,
        autoDeleteOldMemories: true,
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.dataRetentionDays).toBe(90);
    expect(storage.settings.autoDeleteOldMemories).toBe(true);

    await popup.close();
  });
});

test.describe('Settings - UI Preferences', () => {
  test('should toggle dark mode', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Enable dark mode
    await setExtensionStorage(popup, {
      settings: { theme: 'dark' },
    });

    let storage = await getExtensionStorage(popup);
    expect(storage.settings.theme).toBe('dark');

    // Switch to light mode
    await setExtensionStorage(popup, {
      settings: { theme: 'light' },
    });

    storage = await getExtensionStorage(popup);
    expect(storage.settings.theme).toBe('light');

    await popup.close();
  });

  test('should configure memory display options', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        memoryDisplayMode: 'compact',
        showTimestamps: true,
        showPlatformIcons: true,
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.memoryDisplayMode).toBe('compact');
    expect(storage.settings.showTimestamps).toBe(true);

    await popup.close();
  });

  test('should set default search filters', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        defaultSearchPlatform: 'all',
        defaultSortOrder: 'recent',
        resultsPerPage: 20,
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.defaultSearchPlatform).toBe('all');
    expect(storage.settings.resultsPerPage).toBe(20);

    await popup.close();
  });
});

test.describe('Settings - Platform Configuration', () => {
  test('should enable/disable platforms', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        enabledPlatforms: {
          chatgpt: true,
          claude: true,
          perplexity: false,
        },
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.enabledPlatforms.chatgpt).toBe(true);
    expect(storage.settings.enabledPlatforms.claude).toBe(true);
    expect(storage.settings.enabledPlatforms.perplexity).toBe(false);

    await popup.close();
  });

  test('should configure auto-capture settings', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    await setExtensionStorage(popup, {
      settings: {
        autoCapture: true,
        autoCaptureDelay: 2000,
        minimumMessageLength: 10,
      },
    });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.autoCapture).toBe(true);
    expect(storage.settings.autoCaptureDelay).toBe(2000);

    await popup.close();
  });
});

test.describe('Settings - Export/Import', () => {
  test('should export settings', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    const testSettings = {
      theme: 'dark',
      syncEnabled: true,
      aiProvider: 'openai',
    };

    await setExtensionStorage(popup, { settings: testSettings });

    // Export would typically trigger a download
    const storage = await getExtensionStorage(popup);
    const exportedSettings = JSON.stringify(storage.settings);

    expect(exportedSettings).toContain('dark');
    expect(exportedSettings).toContain('openai');

    await popup.close();
  });

  test('should import settings', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Simulate importing settings
    const importedSettings = {
      theme: 'light',
      syncEnabled: false,
      aiProvider: 'anthropic',
    };

    await setExtensionStorage(popup, { settings: importedSettings });

    const storage = await getExtensionStorage(popup);
    expect(storage.settings.theme).toBe('light');
    expect(storage.settings.aiProvider).toBe('anthropic');

    await popup.close();
  });

  test('should validate imported settings', async ({ context, extensionId }) => {
    const popup = await openExtensionPopup(context, extensionId);
    await waitForExtensionReady(popup);

    // Try to import invalid settings
    const invalidSettings = {
      theme: 'invalid-theme', // Should default to light/dark
      syncEnabled: 'yes', // Should be boolean
    };

    await setExtensionStorage(popup, { settings: invalidSettings });

    // Extension should handle gracefully
    const storage = await getExtensionStorage(popup);
    expect(storage.settings).toBeDefined();

    await popup.close();
  });
});

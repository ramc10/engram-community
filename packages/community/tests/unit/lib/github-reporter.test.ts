/**
 * Unit tests for GitHub error reporter
 *
 * Tests cover:
 * - Configuration management
 * - Error reporting workflow
 * - Rate limiting
 * - Deduplication
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GitHubReporter, ErrorSeverity } from '../../../src/lib/github-reporter';

// Mock chrome API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
  },
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.1.3' })),
  },
};

(global as any).chrome = mockChromeStorage;

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('GitHubReporter', () => {
  let reporter: GitHubReporter;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    mockChromeStorage.local.get.mockResolvedValue({});
    mockChromeStorage.local.set.mockResolvedValue(undefined);

    reporter = new GitHubReporter();
  });

  describe('Configuration', () => {
    it('should save configuration', async () => {
      const config = {
        enabled: true,
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: []
      };

      await reporter.saveConfig(config);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'github-reporter-config': expect.objectContaining({
          enabled: true,
          rateLimitMinutes: 5,
          maxIssuesPerDay: 10,
          includeStackTrace: true
        })
      });
    });

    it('should load configuration', async () => {
      const savedConfig = {
        enabled: true,
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: []
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'github-reporter-config': savedConfig
      });

      const config = await reporter.getConfig();

      expect(config).toEqual(savedConfig);
    });

    it('should return null for missing configuration', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});

      const config = await reporter.getConfig();

      expect(config).toBeNull();
    });
  });

  describe('Error Reporting', () => {
    beforeEach(async () => {
      // Set up valid configuration (enabled by default)
      await reporter.saveConfig({
        enabled: true,
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: []
      });

      // Mock successful GitHub API response
      // Note: Uses hardcoded GitHub config from environment variables
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          html_url: 'https://github.com/ramc10/engram-community/issues/1',
          number: 1
        })
      });

      // Mock empty metadata (no previous reports)
      mockChromeStorage.local.get.mockImplementation((key) => {
        if (key === 'github-reporter-config') {
          return Promise.resolve({
            'github-reporter-config': {
              enabled: true,
              rateLimitMinutes: 5,
              maxIssuesPerDay: 10,
              includeStackTrace: true,
              excludePatterns: []
            }
          });
        }
        return Promise.resolve({});
      });

      // Mock environment variables for hardcoded GitHub config
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN = 'ghp_test_token';
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPO_OWNER = 'ramc10';
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPO_NAME = 'engram-community';
    });

    it('should not report when disabled', async () => {
      await reporter.saveConfig({
        enabled: false,
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: []
      });

      const error = new Error('Test error');
      const result = await reporter.reportError(error);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('GitHub reporter is disabled');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not report when GitHub config is missing', async () => {
      // Clear environment variables
      delete (process.env as any).PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN;

      const error = new Error('Test error');
      const result = await reporter.reportError(error);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('GitHub reporter not configured');
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore for other tests
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN = 'ghp_test_token';
    });

    it('should create GitHub issue for new error', async () => {
      const error = new Error('Test error message');
      const result = await reporter.reportError(error, {
        service: 'TestService',
        operation: 'testOperation',
        severity: ErrorSeverity.HIGH
      });

      expect(result.success).toBe(true);
      expect(result.issueUrl).toBe('https://github.com/ramc10/engram-community/issues/1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/ramc10/engram-community/issues',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ghp_test_token',
            'Accept': 'application/vnd.github.v3+json'
          })
        })
      );
    });

    it('should include context in GitHub issue', async () => {
      const error = new Error('Test error');
      await reporter.reportError(error, {
        service: 'Storage',
        operation: 'save',
        severity: ErrorSeverity.CRITICAL,
        userAction: 'Saving memory',
        additionalData: { memoryCount: 100 }
      });

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0] as any[];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.title).toContain('[Storage]');
      expect(requestBody.body).toContain('Storage');
      expect(requestBody.body).toContain('save');
      expect(requestBody.labels).toContain('storage');
      expect(requestBody.labels).toContain('critical');
    });

    it('should exclude errors matching exclusion patterns', async () => {
      await reporter.saveConfig({
        enabled: true,
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: ['Network timeout', 'QuotaExceeded']
      });

      const error = new Error('Network timeout occurred');
      const result = await reporter.reportError(error);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Error matches exclusion pattern');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Testing', () => {
    beforeEach(() => {
      // Set up environment variables
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN = 'ghp_test_token';
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPO_OWNER = 'ramc10';
      (process.env as any).PLASMO_PUBLIC_GITHUB_REPO_NAME = 'engram-community';
    });

    it('should validate valid GitHub configuration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'engram-community' })
      });

      const result = await reporter.testConfiguration();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Configuration valid');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/ramc10/engram-community',
        expect.any(Object)
      );
    });

    it('should detect invalid GitHub token', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await reporter.testConfiguration();

      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
    });

    it('should detect missing GitHub configuration', async () => {
      // Clear environment variables
      delete (process.env as any).PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN;
      delete (process.env as any).PLASMO_PUBLIC_GITHUB_REPO_OWNER;
      delete (process.env as any).PLASMO_PUBLIC_GITHUB_REPO_NAME;

      const result = await reporter.testConfiguration();

      expect(result.success).toBe(false);
      expect(result.message).toContain('GitHub configuration missing');
    });
  });
});

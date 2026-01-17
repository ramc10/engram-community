/**
 * GitHub Error Reporter
 * Automatically creates GitHub issues for errors with intelligent deduplication
 */

import { createLogger } from './logger';
import { generateErrorFingerprint, type ErrorFingerprint } from './error-fingerprint';
import { sanitizeError, validateSanitization, type SanitizedErrorData } from './error-sanitizer';

const logger = createLogger('GitHubReporter');

declare const chrome: any;

/**
 * Configuration for GitHub error reporting
 */
export interface GitHubReporterConfig {
  enabled: boolean;
  rateLimitMinutes: number;
  maxIssuesPerDay: number;
  includeStackTrace: boolean;
  excludePatterns: string[];
}

/**
 * Get GitHub configuration for error reporting
 * This is evaluated at runtime to allow for testing and env var changes
 */
function getGitHubConfig() {
  return {
    token: process.env.PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN || '',
    owner: process.env.PLASMO_PUBLIC_GITHUB_REPO_OWNER || 'ramc10',
    repo: process.env.PLASMO_PUBLIC_GITHUB_REPO_NAME || 'engram-community',
  };
}

/**
 * Error severity levels mapped to GitHub labels
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Error context for reporting
 */
export interface ErrorContext {
  service?: string;
  operation?: string;
  severity?: ErrorSeverity;
  userAction?: string;
  additionalData?: Record<string, any>;
}

/**
 * Stored error report metadata
 */
interface ErrorReportMetadata {
  fingerprint: string;
  lastReported: number;
  reportCount: number;
  issueNumber?: number;
  issueUrl?: string;
}

/**
 * Rate limit tracking
 */
interface RateLimitState {
  dailyCount: number;
  lastReset: number; // Timestamp of last daily reset
}

const STORAGE_KEY_CONFIG = 'github-reporter-config';
const STORAGE_KEY_METADATA = 'github-reporter-metadata';
const STORAGE_KEY_RATE_LIMIT = 'github-reporter-rate-limit';
const DEFAULT_RATE_LIMIT_MINUTES = 5;
const DEFAULT_MAX_ISSUES_PER_DAY = 10;

/**
 * GitHub Error Reporter Service
 */
export class GitHubReporter {
  private config: GitHubReporterConfig | null = null;
  private extensionVersion: string = '0.1.3'; // Will be updated from package.json

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the reporter
   */
  private async initialize(): Promise<void> {
    try {
      // Load configuration from storage
      await this.loadConfig();

      // Get extension version from manifest if available
      if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
        const manifest = chrome.runtime.getManifest();
        this.extensionVersion = manifest.version || this.extensionVersion;
      }
    } catch (error) {
      logger.error('Failed to initialize GitHub reporter:', error);
    }
  }

  /**
   * Load configuration from chrome storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_CONFIG);
      if (result[STORAGE_KEY_CONFIG]) {
        this.config = result[STORAGE_KEY_CONFIG];
      }
    } catch (error) {
      logger.error('Failed to load GitHub reporter config:', error);
    }
  }

  /**
   * Save configuration to chrome storage
   */
  async saveConfig(config: Partial<GitHubReporterConfig>): Promise<void> {
    try {
      this.config = {
        enabled: config.enabled ?? false,
        rateLimitMinutes: config.rateLimitMinutes ?? DEFAULT_RATE_LIMIT_MINUTES,
        maxIssuesPerDay: config.maxIssuesPerDay ?? DEFAULT_MAX_ISSUES_PER_DAY,
        includeStackTrace: config.includeStackTrace ?? true,
        excludePatterns: config.excludePatterns || []
      };

      await chrome.storage.local.set({
        [STORAGE_KEY_CONFIG]: this.config
      });

      logger.log('GitHub reporter config saved');
    } catch (error) {
      logger.error('Failed to save GitHub reporter config:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<GitHubReporterConfig | null> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config;
  }

  /**
   * Report an error to GitHub
   */
  async reportError(
    error: Error,
    context?: ErrorContext
  ): Promise<{ success: boolean; issueUrl?: string; reason?: string }> {
    try {
      // Check if reporting is enabled
      if (!this.config?.enabled) {
        return { success: false, reason: 'GitHub reporter is disabled' };
      }

      // Validate hardcoded configuration
      const githubConfig = getGitHubConfig();
      if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
        logger.warn('GitHub reporter not configured with token/repo. Set PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN env var.');
        return { success: false, reason: 'GitHub reporter not configured' };
      }

      // Check if error should be excluded
      if (this.shouldExcludeError(error, context)) {
        return { success: false, reason: 'Error matches exclusion pattern' };
      }

      // Generate error fingerprint
      const fingerprint = generateErrorFingerprint(error, {
        service: context?.service,
        operation: context?.operation
      });

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(fingerprint);
      if (!rateLimitCheck.allowed) {
        return { success: false, reason: rateLimitCheck.reason };
      }

      // Sanitize error data
      const sanitizedData = sanitizeError(error, {
        ...context?.additionalData,
        service: context?.service,
        operation: context?.operation,
        userAction: context?.userAction
      });

      // Validate sanitization
      const validation = validateSanitization(sanitizedData);
      if (!validation.isSafe) {
        logger.warn('Sanitization warnings:', validation.warnings);
      }

      // Check if similar issue already exists
      const existingIssue = await this.findExistingIssue(fingerprint);
      if (existingIssue) {
        await this.updateMetadata(fingerprint.hash, existingIssue);
        return {
          success: true,
          issueUrl: existingIssue.issueUrl,
          reason: 'Similar issue already exists'
        };
      }

      // Create GitHub issue
      const issueUrl = await this.createGitHubIssue(
        sanitizedData,
        fingerprint,
        context
      );

      // Update metadata
      await this.updateMetadata(fingerprint.hash, {
        issueUrl,
        issueNumber: this.extractIssueNumber(issueUrl)
      });

      // Update rate limit
      await this.incrementRateLimit();

      logger.log('Error reported to GitHub:', issueUrl);

      return { success: true, issueUrl };
    } catch (error) {
      logger.error('Failed to report error to GitHub:', error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if error matches exclusion patterns
   */
  private shouldExcludeError(error: Error, context?: ErrorContext): boolean {
    if (!this.config?.excludePatterns || this.config.excludePatterns.length === 0) {
      return false;
    }

    const errorString = `${error.name} ${error.message} ${context?.service || ''}`;

    return this.config.excludePatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(errorString);
      } catch {
        return errorString.includes(pattern);
      }
    });
  }

  /**
   * Check rate limits
   */
  private async checkRateLimits(fingerprint: ErrorFingerprint): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check fingerprint-specific rate limit
    const metadata = await this.getMetadata(fingerprint.hash);
    if (metadata) {
      const timeSinceLastReport = Date.now() - metadata.lastReported;
      const rateLimitMs = (this.config?.rateLimitMinutes || DEFAULT_RATE_LIMIT_MINUTES) * 60 * 1000;

      if (timeSinceLastReport < rateLimitMs) {
        const remainingMinutes = Math.ceil((rateLimitMs - timeSinceLastReport) / 60000);
        return {
          allowed: false,
          reason: `Rate limit: same error reported ${remainingMinutes} minutes ago`
        };
      }
    }

    // Check daily limit
    const rateLimit = await this.getRateLimitState();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Reset daily count if a day has passed
    if (now - rateLimit.lastReset > oneDayMs) {
      await this.resetDailyLimit();
      return { allowed: true };
    }

    const maxIssuesPerDay = this.config?.maxIssuesPerDay || DEFAULT_MAX_ISSUES_PER_DAY;
    if (rateLimit.dailyCount >= maxIssuesPerDay) {
      return {
        allowed: false,
        reason: `Daily limit reached: ${maxIssuesPerDay} issues per day`
      };
    }

    return { allowed: true };
  }

  /**
   * Find existing issue for the same error
   */
  private async findExistingIssue(
    fingerprint: ErrorFingerprint
  ): Promise<{ issueUrl: string; issueNumber: number } | null> {
    const metadata = await this.getMetadata(fingerprint.hash);
    if (metadata?.issueUrl && metadata.issueNumber) {
      // Check if issue is still open
      const isOpen = await this.isIssueOpen(metadata.issueNumber);
      if (isOpen) {
        return {
          issueUrl: metadata.issueUrl,
          issueNumber: metadata.issueNumber
        };
      }
    }
    return null;
  }

  /**
   * Check if a GitHub issue is still open
   */
  private async isIssueOpen(issueNumber: number): Promise<boolean> {
    try {
      const githubConfig = getGitHubConfig();
      const response = await fetch(
        `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/issues/${issueNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        return false;
      }

      const issue = await response.json();
      return issue.state === 'open';
    } catch (error) {
      logger.error('Failed to check issue status:', error);
      return false;
    }
  }

  /**
   * Create a GitHub issue
   */
  private async createGitHubIssue(
    sanitizedData: SanitizedErrorData,
    fingerprint: ErrorFingerprint,
    context?: ErrorContext
  ): Promise<string> {
    const title = this.generateIssueTitle(sanitizedData, context);
    const body = this.generateIssueBody(sanitizedData, fingerprint, context);
    const labels = this.generateLabels(context);

    const githubConfig = getGitHubConfig();
    const response = await fetch(
      `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubConfig.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          body,
          labels
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    const issue = await response.json();
    return issue.html_url;
  }

  /**
   * Generate issue title
   */
  private generateIssueTitle(
    data: SanitizedErrorData,
    context?: ErrorContext
  ): string {
    const service = context?.service ? `[${context.service}]` : '';
    const errorType = data.type || 'Error';
    const message = data.message.slice(0, 80); // Limit length

    return `${service} ${errorType}: ${message}`.trim();
  }

  /**
   * Generate issue body
   */
  private generateIssueBody(
    data: SanitizedErrorData,
    fingerprint: ErrorFingerprint,
    context?: ErrorContext
  ): string {
    const sections: string[] = [];

    // Auto-generated notice
    sections.push('> **Note:** This issue was automatically generated by the Engram error reporter.\n');

    // Error summary
    sections.push('## Error Summary');
    sections.push(`**Type:** ${data.type}`);
    sections.push(`**Message:** ${data.message}`);
    if (context?.service) {
      sections.push(`**Service:** ${context.service}`);
    }
    if (context?.operation) {
      sections.push(`**Operation:** ${context.operation}`);
    }
    if (context?.severity) {
      sections.push(`**Severity:** ${context.severity}`);
    }
    sections.push('');

    // Environment info
    sections.push('## Environment');
    sections.push(`**Extension Version:** ${this.extensionVersion}`);
    sections.push(`**Browser:** ${this.getBrowserInfo()}`);
    sections.push(`**Timestamp:** ${new Date().toISOString()}`);
    sections.push('');

    // Stack trace (if enabled)
    if (this.config?.includeStackTrace && data.stack) {
      sections.push('## Stack Trace');
      sections.push('```');
      sections.push(data.stack);
      sections.push('```');
      sections.push('');
    }

    // Additional context
    if (Object.keys(data.context).length > 0) {
      sections.push('## Additional Context');
      sections.push('```json');
      sections.push(JSON.stringify(data.context, null, 2));
      sections.push('```');
      sections.push('');
    }

    // User action
    if (context?.userAction) {
      sections.push('## User Action');
      sections.push(context.userAction);
      sections.push('');
    }

    // Error fingerprint (for debugging)
    sections.push('---');
    sections.push(`**Error Fingerprint:** \`${fingerprint.hash}\``);

    return sections.join('\n');
  }

  /**
   * Generate GitHub labels
   */
  private generateLabels(context?: ErrorContext): string[] {
    const labels: string[] = ['auto-reported', 'bug'];

    // Add service label
    if (context?.service) {
      labels.push(context.service.toLowerCase());
    }

    // Add severity label
    if (context?.severity) {
      labels.push(context.severity);
    }

    // Add version label
    labels.push(`v${this.extensionVersion}`);

    return labels;
  }

  /**
   * Get browser info
   */
  private getBrowserInfo(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return 'Unknown';
  }

  /**
   * Extract issue number from URL
   */
  private extractIssueNumber(url: string): number | undefined {
    const match = url.match(/\/issues\/(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Get metadata for a fingerprint
   */
  private async getMetadata(fingerprintHash: string): Promise<ErrorReportMetadata | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_METADATA);
      const allMetadata = result[STORAGE_KEY_METADATA] || {};
      return allMetadata[fingerprintHash] || null;
    } catch (error) {
      logger.error('Failed to get metadata:', error);
      return null;
    }
  }

  /**
   * Update metadata for a fingerprint
   */
  private async updateMetadata(
    fingerprintHash: string,
    data: { issueUrl?: string; issueNumber?: number }
  ): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_METADATA);
      const allMetadata = result[STORAGE_KEY_METADATA] || {};

      const existing = allMetadata[fingerprintHash] || {
        fingerprint: fingerprintHash,
        lastReported: 0,
        reportCount: 0
      };

      allMetadata[fingerprintHash] = {
        ...existing,
        lastReported: Date.now(),
        reportCount: existing.reportCount + 1,
        issueNumber: data.issueNumber || existing.issueNumber,
        issueUrl: data.issueUrl || existing.issueUrl
      };

      await chrome.storage.local.set({
        [STORAGE_KEY_METADATA]: allMetadata
      });
    } catch (error) {
      logger.error('Failed to update metadata:', error);
    }
  }

  /**
   * Get rate limit state
   */
  private async getRateLimitState(): Promise<RateLimitState> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_RATE_LIMIT);
      return result[STORAGE_KEY_RATE_LIMIT] || {
        dailyCount: 0,
        lastReset: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get rate limit state:', error);
      return { dailyCount: 0, lastReset: Date.now() };
    }
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateLimit(): Promise<void> {
    try {
      const state = await this.getRateLimitState();
      state.dailyCount += 1;

      await chrome.storage.local.set({
        [STORAGE_KEY_RATE_LIMIT]: state
      });
    } catch (error) {
      logger.error('Failed to increment rate limit:', error);
    }
  }

  /**
   * Reset daily limit
   */
  private async resetDailyLimit(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY_RATE_LIMIT]: {
          dailyCount: 0,
          lastReset: Date.now()
        }
      });
    } catch (error) {
      logger.error('Failed to reset daily limit:', error);
    }
  }

  /**
   * Test the GitHub reporter configuration
   */
  async testConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      const githubConfig = getGitHubConfig();
      if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
        return {
          success: false,
          message: 'GitHub configuration missing. Set PLASMO_PUBLIC_GITHUB_REPORTER_TOKEN environment variable.'
        };
      }

      // Test GitHub API access
      const response = await fetch(
        `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}`,
        {
          headers: {
            'Authorization': `Bearer ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        return {
          success: false,
          message: `GitHub API error: ${response.status}`
        };
      }

      return {
        success: true,
        message: 'Configuration valid'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton instance
let reporterInstance: GitHubReporter | null = null;

/**
 * Get the GitHub reporter instance
 */
export function getGitHubReporter(): GitHubReporter {
  if (!reporterInstance) {
    reporterInstance = new GitHubReporter();
  }
  return reporterInstance;
}

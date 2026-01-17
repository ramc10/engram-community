/**
 * Simple logger utility for Engram extension
 * Suppresses logs in test environment to reduce noise
 */

import type { GitHubReporter, ErrorContext, ErrorSeverity } from './github-reporter';

type LogLevel = 'log' | 'warn' | 'error' | 'debug';

// Lazy-loaded reporter to avoid circular dependencies
let reporterModule: { getGitHubReporter: () => GitHubReporter } | null = null;

async function getReporter(): Promise<GitHubReporter | null> {
  try {
    if (!reporterModule) {
      reporterModule = await import('./github-reporter');
    }
    return reporterModule.getGitHubReporter();
  } catch {
    return null;
  }
}

/**
 * Check if we're in test environment
 */
function isTestEnvironment(): boolean {
  return (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env.NODE_ENV === 'test') || typeof (globalThis as any).jest !== 'undefined';
}

/**
 * Logger class with namespace support
 */
class Logger {
  constructor(private namespace: string) {}

  private shouldLog(): boolean {
    // Suppress all logs in test environment unless explicitly enabled
    if (isTestEnvironment()) {
      return (globalThis as any).process?.env?.ENGRAM_DEBUG === 'true';
    }
    return true;
  }

  private formatMessage(level: LogLevel, ...args: any[]): any[] {
    return [`[${this.namespace}]`, ...args];
  }

  log(...args: any[]): void {
    if (this.shouldLog()) {
      console.log(...this.formatMessage('log', ...args));
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog()) {
      console.warn(...this.formatMessage('warn', ...args));
    }
  }

  error(...args: any[]): void {
    // Always show errors, even in tests
    console.error(...this.formatMessage('error', ...args));
  }

  debug(...args: any[]): void {
    if (this.shouldLog() && (globalThis as any).process?.env?.ENGRAM_DEBUG === 'true') {
      console.debug(...this.formatMessage('debug', ...args));
    }
  }

  /**
   * Report an error to GitHub
   * This will automatically create a GitHub issue if error reporting is enabled
   */
  async reportError(
    error: Error,
    options?: {
      operation?: string;
      severity?: ErrorSeverity;
      userAction?: string;
      additionalData?: Record<string, any>;
      autoReport?: boolean; // Default: true
    }
  ): Promise<void> {
    // Always log the error locally
    this.error('Error occurred:', error);

    // Skip reporting in test environment
    if (isTestEnvironment()) {
      return;
    }

    // Skip if auto-report is explicitly disabled
    if (options?.autoReport === false) {
      return;
    }

    try {
      const reporter = await getReporter();
      if (!reporter) {
        return;
      }

      const context: ErrorContext = {
        service: this.namespace,
        operation: options?.operation,
        severity: options?.severity,
        userAction: options?.userAction,
        additionalData: options?.additionalData
      };

      await reporter.reportError(error, context);
    } catch (reportingError) {
      // Don't let error reporting failures break the application
      console.error('[Logger] Failed to report error to GitHub:', reportingError);
    }
  }
}

/**
 * Create a logger for a specific namespace
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

/**
 * Re-export error severity for convenience
 */
export type { ErrorSeverity } from './github-reporter';

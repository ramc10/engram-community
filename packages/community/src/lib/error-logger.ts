/**
 * Error Logger
 * Centralized error logging and reporting system
 */

import type { ErrorInfo } from 'react';

export interface ErrorLog {
  timestamp: number;
  error: Error;
  errorInfo?: ErrorInfo;
  context?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorLoggerConfig {
  enabled: boolean;
  maxLogs: number;
  reportToConsole: boolean;
  reportToStorage: boolean;
}

const DEFAULT_CONFIG: ErrorLoggerConfig = {
  enabled: true,
  maxLogs: 50,
  reportToConsole: true,
  reportToStorage: true,
};

class ErrorLogger {
  private config: ErrorLoggerConfig;
  private logs: ErrorLog[] = [];

  constructor(config: Partial<ErrorLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log an error
   */
  logError(
    error: Error,
    errorInfo?: ErrorInfo,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      error,
      errorInfo,
      context,
      metadata,
    };

    // Add to in-memory logs
    this.logs.push(errorLog);

    // Limit log size
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    // Report to console
    if (this.config.reportToConsole) {
      this.reportToConsole(errorLog);
    }

    // Report to storage
    if (this.config.reportToStorage) {
      this.reportToStorage(errorLog);
    }
  }

  /**
   * Log error to console
   */
  private reportToConsole(errorLog: ErrorLog): void {
    console.group(`[Error Logger] ${errorLog.context || 'Error'}`);
    console.error('Error:', errorLog.error);
    if (errorLog.errorInfo) {
      console.error('Component Stack:', errorLog.errorInfo.componentStack);
    }
    if (errorLog.metadata) {
      console.log('Metadata:', errorLog.metadata);
    }
    console.log('Timestamp:', new Date(errorLog.timestamp).toISOString());
    console.groupEnd();
  }

  /**
   * Store error logs in chrome.storage.local
   */
  private async reportToStorage(errorLog: ErrorLog): Promise<void> {
    try {
      // Get existing error logs from storage
      const result = await chrome.storage.local.get('errorLogs');
      const existingLogs: ErrorLog[] = result.errorLogs || [];

      // Serialize error log (Error objects don't serialize well)
      const serializedLog = {
        timestamp: errorLog.timestamp,
        error: {
          message: errorLog.error.message,
          stack: errorLog.error.stack,
          name: errorLog.error.name,
        },
        errorInfo: errorLog.errorInfo
          ? {
              componentStack: errorLog.errorInfo.componentStack,
            }
          : undefined,
        context: errorLog.context,
        metadata: errorLog.metadata,
      };

      // Add new log
      existingLogs.push(serializedLog as any);

      // Keep only recent logs
      const recentLogs = existingLogs.slice(-this.config.maxLogs);

      // Save to storage
      await chrome.storage.local.set({ errorLogs: recentLogs });
    } catch (err) {
      console.error('[ErrorLogger] Failed to save error to storage:', err);
    }
  }

  /**
   * Get all error logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Get logs from storage
   */
  async getLogsFromStorage(): Promise<any[]> {
    try {
      const result = await chrome.storage.local.get('errorLogs');
      return result.errorLogs || [];
    } catch (err) {
      console.error('[ErrorLogger] Failed to get logs from storage:', err);
      return [];
    }
  }

  /**
   * Clear all error logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Clear logs from storage
   */
  async clearLogsFromStorage(): Promise<void> {
    try {
      await chrome.storage.local.remove('errorLogs');
    } catch (err) {
      console.error('[ErrorLogger] Failed to clear logs from storage:', err);
    }
  }

  /**
   * Get error statistics
   */
  getStats(): {
    totalErrors: number;
    recentErrors: number;
    errorsByContext: Record<string, number>;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentErrors = this.logs.filter((log) => log.timestamp > oneHourAgo).length;

    const errorsByContext: Record<string, number> = {};
    for (const log of this.logs) {
      const context = log.context || 'unknown';
      errorsByContext[context] = (errorsByContext[context] || 0) + 1;
    }

    return {
      totalErrors: this.logs.length,
      recentErrors,
      errorsByContext,
    };
  }

  /**
   * Export error logs (for debugging/support)
   */
  async exportLogs(): Promise<string> {
    const storageLogs = await this.getLogsFromStorage();
    const allLogs = {
      inMemoryLogs: this.logs,
      storageLogs,
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(allLogs, null, 2);
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Log a React error boundary error
 */
export function logBoundaryError(
  error: Error,
  errorInfo: ErrorInfo,
  context: string
): void {
  errorLogger.logError(error, errorInfo, context);
}

/**
 * Log a general error
 */
export function logError(
  error: Error,
  context?: string,
  metadata?: Record<string, any>
): void {
  errorLogger.logError(error, undefined, context, metadata);
}

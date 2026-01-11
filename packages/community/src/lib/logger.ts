/**
 * Simple logger utility for Engram extension
 * Suppresses logs in test environment to reduce noise
 */

type LogLevel = 'log' | 'warn' | 'error' | 'debug';

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
}

/**
 * Create a logger for a specific namespace
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

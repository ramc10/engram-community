/**
 * Logger that writes to stderr (stdout is reserved for MCP stdio protocol)
 */

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createLogger(prefix: string): Logger {
  return {
    info: (...args: unknown[]) => console.error(`[${prefix}]`, ...args),
    warn: (...args: unknown[]) => console.error(`[${prefix}] WARN:`, ...args),
    error: (...args: unknown[]) => console.error(`[${prefix}] ERROR:`, ...args),
    debug: (...args: unknown[]) => {
      if (process.env.ENGRAM_DEBUG === 'true') {
        console.error(`[${prefix}] DEBUG:`, ...args);
      }
    },
  };
}

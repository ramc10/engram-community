/**
 * Logger Unit Tests
 * Tests for logging utility with namespace support and error reporting integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createLogger } from '../../../src/lib/logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;

  const originalEnv = process.env;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    // Set test environment
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('createLogger()', () => {
    it('should create logger with namespace', () => {
      const logger = createLogger('TestService');
      expect(logger).toBeDefined();
    });
  });

  describe('log()', () => {
    it('should suppress logs in test environment by default', () => {
      const logger = createLogger('TestService');
      logger.log('Test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log when ENGRAM_DEBUG is enabled', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('TestService');
      logger.log('Test message', { data: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TestService]',
        'Test message',
        { data: 'value' }
      );
    });

    it('should format message with namespace', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('MyService');
      logger.log('Operation completed');

      expect(consoleLogSpy).toHaveBeenCalledWith('[MyService]', 'Operation completed');
    });

    it('should log in non-test environment', () => {
      process.env.NODE_ENV = 'production';
      const logger = createLogger('TestService');
      logger.log('Production log');

      expect(consoleLogSpy).toHaveBeenCalledWith('[TestService]', 'Production log');
    });
  });

  describe('warn()', () => {
    it('should suppress warnings in test environment by default', () => {
      const logger = createLogger('TestService');
      logger.warn('Warning message');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when ENGRAM_DEBUG is enabled', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('TestService');
      logger.warn('Warning message', { warning: 'details' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TestService]',
        'Warning message',
        { warning: 'details' }
      );
    });

    it('should warn in non-test environment', () => {
      process.env.NODE_ENV = 'production';
      const logger = createLogger('TestService');
      logger.warn('Production warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestService]', 'Production warning');
    });
  });

  describe('error()', () => {
    it('should always log errors even in test environment', () => {
      const logger = createLogger('TestService');
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestService]', 'Error occurred', error);
    });

    it('should format error with namespace', () => {
      const logger = createLogger('AuthService');
      const error = new Error('Authentication failed');
      logger.error('Login error:', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[AuthService]', 'Login error:', error);
    });

    it('should log errors in all environments', () => {
      process.env.NODE_ENV = 'production';
      const logger = createLogger('TestService');
      logger.error('Production error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestService]', 'Production error');
    });
  });

  describe('debug()', () => {
    it('should suppress debug logs by default', () => {
      const logger = createLogger('TestService');
      logger.debug('Debug message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when ENGRAM_DEBUG is enabled', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('TestService');
      logger.debug('Debug message', { data: 'debug-value' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[TestService]',
        'Debug message',
        { data: 'debug-value' }
      );
    });

    it('should suppress debug in production without ENGRAM_DEBUG', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ENGRAM_DEBUG;
      const logger = createLogger('TestService');
      logger.debug('Should not appear');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log debug in production with ENGRAM_DEBUG', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('TestService');
      logger.debug('Debug in production');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestService]', 'Debug in production');
    });
  });

  describe('reportError()', () => {
    it('should always log error locally', async () => {
      const logger = createLogger('TestService');
      const error = new Error('Test error');

      await logger.reportError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TestService]',
        'Error occurred:',
        error
      );
    });

    it('should skip reporting in test environment', async () => {
      const logger = createLogger('TestService');
      const error = new Error('Test error');

      // Should not throw even if reporter is not available
      await expect(logger.reportError(error)).resolves.toBeUndefined();
    });

    it('should skip reporting when autoReport is false', async () => {
      process.env.NODE_ENV = 'production';
      const logger = createLogger('TestService');
      const error = new Error('Test error');

      await logger.reportError(error, { autoReport: false });

      // Should still log the error
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should accept error reporting options', async () => {
      const logger = createLogger('AuthService');
      const error = new Error('Auth error');

      await logger.reportError(error, {
        operation: 'login',
        severity: 'high',
        userAction: 'User attempted to log in',
        additionalData: { userId: 'user-123' },
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle reporter failures gracefully', async () => {
      process.env.NODE_ENV = 'production';
      const logger = createLogger('TestService');
      const error = new Error('Test error');

      // Mock dynamic import failure
      jest.mock('../../../src/lib/github-reporter', () => {
        throw new Error('Reporter not available');
      });

      // Should not throw
      await expect(logger.reportError(error)).resolves.toBeUndefined();
    });
  });

  describe('Multiple loggers', () => {
    it('should support multiple loggers with different namespaces', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger1 = createLogger('Service1');
      const logger2 = createLogger('Service2');

      logger1.log('Message from service 1');
      logger2.log('Message from service 2');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Service1]', 'Message from service 1');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Service2]', 'Message from service 2');
    });

    it('should maintain independent state for each logger', () => {
      const logger1 = createLogger('StorageService');
      const logger2 = createLogger('CryptoService');

      expect(logger1).not.toBe(logger2);

      // Both should work independently
      logger1.error('Storage error');
      logger2.error('Crypto error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[StorageService]', 'Storage error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[CryptoService]', 'Crypto error');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined and null arguments', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('TestService');

      logger.log(undefined);
      logger.log(null);
      logger.warn(undefined, null);

      expect(consoleLogSpy).toHaveBeenCalledWith('[TestService]', undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith('[TestService]', null);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestService]', undefined, null);
    });

    it('should handle multiple arguments', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('TestService');

      logger.log('arg1', 'arg2', 'arg3', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TestService]',
        'arg1',
        'arg2',
        'arg3',
        { key: 'value' }
      );
    });

    it('should handle empty namespace', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('');

      logger.log('Message');

      expect(consoleLogSpy).toHaveBeenCalledWith('[]', 'Message');
    });

    it('should handle special characters in namespace', () => {
      process.env.ENGRAM_DEBUG = 'true';
      const logger = createLogger('Service::Auth::V2');

      logger.log('Test');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Service::Auth::V2]', 'Test');
    });
  });
});

/**
 * ErrorLogger Unit Tests
 * Tests for centralized error logging and reporting system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { errorLogger, logBoundaryError, logError } from '../../../src/lib/error-logger';
import { createMockChromeStorage } from '../../__utils__/test-helpers';

describe('ErrorLogger', () => {
  let mockStorage: ReturnType<typeof createMockChromeStorage>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleGroupSpy: jest.SpiedFunction<typeof console.group>;
  let consoleGroupEndSpy: jest.SpiedFunction<typeof console.groupEnd>;

  beforeEach(() => {
    // Setup Chrome storage mock
    mockStorage = createMockChromeStorage();
    (global as any).chrome = {
      storage: {
        local: mockStorage,
      },
    };

    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    // Clear any existing logs
    errorLogger.clearLogs();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockStorage.clear();
  });

  describe('logError()', () => {
    it('should log an error', () => {
      const error = new Error('Test error');

      errorLogger.logError(error);

      const logs = errorLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].error).toBe(error);
      expect(logs[0].timestamp).toBeGreaterThan(0);
    });

    it('should log error with context', () => {
      const error = new Error('Test error');

      errorLogger.logError(error, undefined, 'TestComponent');

      const logs = errorLogger.getLogs();
      expect(logs[0].context).toBe('TestComponent');
    });

    it('should log error with metadata', () => {
      const error = new Error('Test error');
      const metadata = { userId: 'user-123', action: 'saveData' };

      errorLogger.logError(error, undefined, 'TestContext', metadata);

      const logs = errorLogger.getLogs();
      expect(logs[0].metadata).toEqual(metadata);
    });

    it('should report to console', () => {
      const error = new Error('Test error');

      errorLogger.logError(error, undefined, 'TestContext');

      expect(consoleGroupSpy).toHaveBeenCalledWith('[Error Logger] TestContext');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', error);
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should report React error with component stack', () => {
      const error = new Error('React error');
      const errorInfo = {
        componentStack: '\n    at Component1\n    at Component2',
      };

      errorLogger.logError(error, errorInfo, 'React');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Component Stack:', errorInfo.componentStack);
    });

    it('should limit logs to max size', () => {
      // Log more than max (default 50)
      for (let i = 0; i < 60; i++) {
        errorLogger.logError(new Error(`Error ${i}`));
      }

      const logs = errorLogger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(50);
    });

    it('should save to chrome.storage.local', async () => {
      const error = new Error('Storage test');

      errorLogger.logError(error, undefined, 'StorageTest');

      // Wait for async storage operation
      await new Promise(resolve => setTimeout(resolve, 10));

      const storedLogs = mockStorage.storage.get('errorLogs');
      expect(storedLogs).toBeDefined();
      expect(Array.isArray(storedLogs)).toBe(true);
      expect(storedLogs.length).toBeGreaterThan(0);
      expect(storedLogs[0].error.message).toBe('Storage test');
    });

    it('should serialize error objects for storage', async () => {
      const error = new Error('Serialization test');
      error.stack = 'Error stack trace';

      errorLogger.logError(error);

      await new Promise(resolve => setTimeout(resolve, 10));

      const storedLogs = mockStorage.storage.get('errorLogs');
      const storedError = storedLogs[0].error;

      expect(storedError.message).toBe('Serialization test');
      expect(storedError.stack).toBe('Error stack trace');
      expect(storedError.name).toBe('Error');
    });
  });

  describe('getLogs()', () => {
    it('should return copy of logs', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorLogger.logError(error1);
      errorLogger.logError(error2);

      const logs = errorLogger.getLogs();

      // Modify returned array
      logs.push({
        timestamp: Date.now(),
        error: new Error('Fake error'),
      });

      // Original logs should be unchanged
      expect(errorLogger.getLogs()).toHaveLength(2);
    });

    it('should return empty array when no logs', () => {
      const logs = errorLogger.getLogs();

      expect(logs).toEqual([]);
    });
  });

  describe('getLogsFromStorage()', () => {
    it('should retrieve logs from storage', async () => {
      const error = new Error('Storage retrieval test');
      errorLogger.logError(error);

      await new Promise(resolve => setTimeout(resolve, 10));

      const storageLogs = await errorLogger.getLogsFromStorage();

      expect(storageLogs).toHaveLength(1);
      expect(storageLogs[0].error.message).toBe('Storage retrieval test');
    });

    it('should return empty array if no logs in storage', async () => {
      const storageLogs = await errorLogger.getLogsFromStorage();

      expect(storageLogs).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.get.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const storageLogs = await errorLogger.getLogsFromStorage();

      expect(storageLogs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorLogger]'),
        expect.any(Error)
      );
    });
  });

  describe('clearLogs()', () => {
    it('should clear in-memory logs', () => {
      errorLogger.logError(new Error('Error 1'));
      errorLogger.logError(new Error('Error 2'));

      expect(errorLogger.getLogs()).toHaveLength(2);

      errorLogger.clearLogs();

      expect(errorLogger.getLogs()).toHaveLength(0);
    });
  });

  describe('clearLogsFromStorage()', () => {
    it('should clear logs from storage', async () => {
      errorLogger.logError(new Error('Test'));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStorage.storage.get('errorLogs')).toBeDefined();

      await errorLogger.clearLogsFromStorage();

      expect(mockStorage.storage.get('errorLogs')).toBeUndefined();
    });

    it('should handle storage removal errors', async () => {
      mockStorage.remove.mockImplementation(() => {
        throw new Error('Removal error');
      });

      await errorLogger.clearLogsFromStorage();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorLogger]'),
        expect.any(Error)
      );
    });
  });

  describe('getStats()', () => {
    it('should return error statistics', () => {
      errorLogger.logError(new Error('Error 1'), undefined, 'ComponentA');
      errorLogger.logError(new Error('Error 2'), undefined, 'ComponentA');
      errorLogger.logError(new Error('Error 3'), undefined, 'ComponentB');

      const stats = errorLogger.getStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByContext).toEqual({
        ComponentA: 2,
        ComponentB: 1,
      });
    });

    it('should count recent errors (last hour)', () => {
      // Mock Date.now to simulate old and new errors
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      // Temporarily spy on Date.now
      const originalNow = Date.now;
      Date.now = jest.fn(() => twoHoursAgo) as any;

      errorLogger.logError(new Error('Old error'));

      Date.now = jest.fn(() => now) as any;

      errorLogger.logError(new Error('Recent error 1'));
      errorLogger.logError(new Error('Recent error 2'));

      const stats = errorLogger.getStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.recentErrors).toBe(2);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should handle unknown context', () => {
      errorLogger.logError(new Error('No context error'));

      const stats = errorLogger.getStats();

      expect(stats.errorsByContext.unknown).toBe(1);
    });
  });

  describe('exportLogs()', () => {
    it('should export logs as JSON string', async () => {
      errorLogger.logError(new Error('Export test'), undefined, 'TestContext');

      await new Promise(resolve => setTimeout(resolve, 10));

      const exported = await errorLogger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed.inMemoryLogs).toHaveLength(1);
      expect(parsed.storageLogs).toBeDefined();
      expect(parsed.stats).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should include statistics in export', async () => {
      errorLogger.logError(new Error('Error 1'), undefined, 'ComponentA');
      errorLogger.logError(new Error('Error 2'), undefined, 'ComponentB');

      const exported = await errorLogger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed.stats.totalErrors).toBe(2);
      expect(parsed.stats.errorsByContext).toBeDefined();
    });
  });

  describe('helper functions', () => {
    describe('logBoundaryError()', () => {
      it('should log React boundary error', () => {
        const error = new Error('Boundary error');
        const errorInfo = {
          componentStack: '\n    at Component',
        };

        logBoundaryError(error, errorInfo, 'ErrorBoundary');

        const logs = errorLogger.getLogs();
        expect(logs[0].error).toBe(error);
        expect(logs[0].errorInfo).toBe(errorInfo);
        expect(logs[0].context).toBe('ErrorBoundary');
      });
    });

    describe('logError()', () => {
      it('should log general error', () => {
        const error = new Error('General error');

        logError(error, 'TestModule', { action: 'test' });

        const logs = errorLogger.getLogs();
        expect(logs[0].error).toBe(error);
        expect(logs[0].context).toBe('TestModule');
        expect(logs[0].metadata).toEqual({ action: 'test' });
      });

      it('should work without context and metadata', () => {
        const error = new Error('Simple error');

        logError(error);

        const logs = errorLogger.getLogs();
        expect(logs[0].error).toBe(error);
        expect(logs[0].context).toBeUndefined();
        expect(logs[0].metadata).toBeUndefined();
      });
    });
  });
});

/**
 * RetryManager Unit Tests
 * Tests for retry logic with exponential backoff and jitter
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RetryManager, DEFAULT_RETRY_CONFIG } from '../../../src/sync/retry-manager';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    jest.useFakeTimers();
    retryManager = new RetryManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('getRetryCount()', () => {
    it('should start at 0', () => {
      expect(retryManager.getRetryCount()).toBe(0);
    });

    it('should increment after recording attempt', () => {
      retryManager.recordAttempt();
      expect(retryManager.getRetryCount()).toBe(1);

      retryManager.recordAttempt();
      expect(retryManager.getRetryCount()).toBe(2);
    });
  });

  describe('getRetryDelay()', () => {
    it('should use delay sequence by default', () => {
      expect(retryManager.getRetryDelay()).toBeGreaterThanOrEqual(900); // ~1000ms with jitter
      expect(retryManager.getRetryDelay()).toBeLessThanOrEqual(1100);

      retryManager.recordAttempt();
      expect(retryManager.getRetryDelay()).toBeGreaterThanOrEqual(1800); // ~2000ms
      expect(retryManager.getRetryDelay()).toBeLessThanOrEqual(2200);
    });

    it('should use last delay when retry count exceeds sequence', () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        delays: [100, 200],
        maxRetries: 10,
      });

      // Exceed delay sequence length
      manager.recordAttempt();
      manager.recordAttempt();
      manager.recordAttempt();

      const delay = manager.getRetryDelay();
      // Should use last delay (200ms) with jitter
      expect(delay).toBeGreaterThanOrEqual(180);
      expect(delay).toBeLessThanOrEqual(220);
    });

    it('should return 0 when max retries exceeded', () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 2,
      });

      manager.recordAttempt();
      manager.recordAttempt();

      expect(manager.getRetryDelay()).toBe(0);
    });

    it('should use exponential backoff when no delay sequence', () => {
      const manager = new RetryManager({
        maxRetries: 10,
        baseDelay: 1000,
        maxDelay: 60000,
        delays: [],
        jitterFactor: 0,
      });

      expect(manager.getRetryDelay()).toBe(1000); // 1000 * 2^0

      manager.recordAttempt();
      expect(manager.getRetryDelay()).toBe(2000); // 1000 * 2^1

      manager.recordAttempt();
      expect(manager.getRetryDelay()).toBe(4000); // 1000 * 2^2

      manager.recordAttempt();
      expect(manager.getRetryDelay()).toBe(8000); // 1000 * 2^3
    });

    it('should respect max delay', () => {
      const manager = new RetryManager({
        maxRetries: 20,
        baseDelay: 1000,
        maxDelay: 10000,
        delays: [],
        jitterFactor: 0,
      });

      // Force many retries to hit max
      for (let i = 0; i < 10; i++) {
        manager.recordAttempt();
      }

      expect(manager.getRetryDelay()).toBeLessThanOrEqual(10000);
    });

    it('should add jitter to delay', () => {
      const delays: number[] = [];

      for (let i = 0; i < 10; i++) {
        const manager = new RetryManager(DEFAULT_RETRY_CONFIG);
        delays.push(manager.getRetryDelay());
      }

      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('shouldRetry()', () => {
    it('should return true before max retries', () => {
      expect(retryManager.shouldRetry()).toBe(true);

      retryManager.recordAttempt();
      expect(retryManager.shouldRetry()).toBe(true);
    });

    it('should return false after max retries', () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 2,
      });

      manager.recordAttempt();
      manager.recordAttempt();

      expect(manager.shouldRetry()).toBe(false);
    });
  });

  describe('recordAttempt()', () => {
    it('should increment retry count', () => {
      retryManager.recordAttempt();
      expect(retryManager.getRetryCount()).toBe(1);
    });

    it('should record error type and message', () => {
      retryManager.recordAttempt('network', 'Connection timeout');

      const history = retryManager.getHistory();
      expect(history[0].errorType).toBe('network');
      expect(history[0].errorMessage).toBe('Connection timeout');
    });

    it('should maintain retry history', () => {
      retryManager.recordAttempt('network', 'Error 1');
      retryManager.recordAttempt('server', 'Error 2');
      retryManager.recordAttempt('timeout', 'Error 3');

      const history = retryManager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].attemptNumber).toBe(1);
      expect(history[1].attemptNumber).toBe(2);
      expect(history[2].attemptNumber).toBe(3);
    });

    it('should limit history to 50 attempts', () => {
      for (let i = 0; i < 60; i++) {
        retryManager.recordAttempt();
      }

      const history = retryManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('reset()', () => {
    it('should reset retry state', () => {
      retryManager.recordAttempt();
      retryManager.recordAttempt();

      retryManager.reset();

      expect(retryManager.getRetryCount()).toBe(0);
    });

    it('should clear timer', () => {
      const callback = jest.fn();
      retryManager.setTimer(callback);

      retryManager.reset();

      jest.advanceTimersByTime(10000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('scheduleRetry()', () => {
    it('should execute operation after delay', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const promise = retryManager.scheduleRetry(operation);

      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] + 100);

      const result = await promise;

      expect(operation).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should reset on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const promise = retryManager.scheduleRetry(operation);
      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] + 100);

      await promise;

      expect(retryManager.getRetryCount()).toBe(0);
    });

    it('should throw when max retries exceeded', async () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 1,
      });

      manager.recordAttempt();

      await expect(
        manager.scheduleRetry(jest.fn())
      ).rejects.toThrow('Max retries (1) exceeded');
    });

    it('should record attempt with error details', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const promise = retryManager.scheduleRetry(operation, 'network', 'Connection failed');
      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] + 100);

      await promise;

      const history = retryManager.getHistory();
      expect(history[0].errorType).toBe('network');
      expect(history[0].errorMessage).toBe('Connection failed');
    });
  });

  describe('setTimer()', () => {
    it('should execute callback after delay', () => {
      const callback = jest.fn();

      retryManager.setTimer(callback);

      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] - 100);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(200);
      expect(callback).toHaveBeenCalled();
    });

    it('should clear previous timer', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      retryManager.setTimer(callback1);
      retryManager.setTimer(callback2);

      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] + 100);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('clearTimer()', () => {
    it('should cancel pending timer', () => {
      const callback = jest.fn();

      retryManager.setTimer(callback);
      retryManager.clearTimer();

      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] + 100);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getTimeUntilRetry()', () => {
    it('should return 0 when no retries recorded', () => {
      expect(retryManager.getTimeUntilRetry()).toBe(0);
    });

    it('should return remaining time after retry', () => {
      retryManager.recordAttempt();

      const remaining = retryManager.getTimeUntilRetry();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.delays[0] + 200);
    });

    it('should decrease over time', () => {
      retryManager.recordAttempt();

      const initial = retryManager.getTimeUntilRetry();

      jest.advanceTimersByTime(500);

      const after = retryManager.getTimeUntilRetry();
      expect(after).toBeLessThan(initial);
    });

    it('should return 0 when retry time has passed', () => {
      retryManager.recordAttempt();

      jest.advanceTimersByTime(DEFAULT_RETRY_CONFIG.delays[0] + 1000);

      expect(retryManager.getTimeUntilRetry()).toBe(0);
    });
  });

  describe('getHistory()', () => {
    it('should return copy of history', () => {
      retryManager.recordAttempt('network');
      retryManager.recordAttempt('timeout');

      const history = retryManager.getHistory();

      // Modify returned history
      history.push({
        attemptNumber: 999,
        timestamp: Date.now(),
        delay: 0,
      });

      // Original history should be unchanged
      expect(retryManager.getHistory()).toHaveLength(2);
    });
  });

  describe('getRecentHistory()', () => {
    it('should return last N attempts', () => {
      for (let i = 0; i < 20; i++) {
        retryManager.recordAttempt();
      }

      const recent = retryManager.getRecentHistory(5);

      expect(recent).toHaveLength(5);
      expect(recent[0].attemptNumber).toBe(16);
      expect(recent[4].attemptNumber).toBe(20);
    });

    it('should default to 10 attempts', () => {
      for (let i = 0; i < 15; i++) {
        retryManager.recordAttempt();
      }

      const recent = retryManager.getRecentHistory();

      expect(recent).toHaveLength(10);
    });
  });

  describe('clearHistory()', () => {
    it('should clear retry history', () => {
      retryManager.recordAttempt();
      retryManager.recordAttempt();

      retryManager.clearHistory();

      expect(retryManager.getHistory()).toHaveLength(0);
    });

    it('should not affect retry count', () => {
      retryManager.recordAttempt();
      retryManager.recordAttempt();

      retryManager.clearHistory();

      expect(retryManager.getRetryCount()).toBe(2);
    });
  });

  describe('getStats()', () => {
    it('should return comprehensive statistics', () => {
      retryManager.recordAttempt('network', 'Error 1');
      retryManager.recordAttempt('network', 'Error 2');
      retryManager.recordAttempt('timeout', 'Error 3');

      const stats = retryManager.getStats();

      expect(stats.retryCount).toBe(3);
      expect(stats.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
      expect(stats.totalAttempts).toBe(3);
      expect(stats.errorTypeDistribution).toEqual({
        network: 2,
        timeout: 1,
      });
    });
  });

  describe('classifyError()', () => {
    it('should classify network errors', () => {
      expect(RetryManager.classifyError(new Error('Network request failed'))).toBe('network');
      expect(RetryManager.classifyError(new Error('You are offline'))).toBe('network');
      expect(RetryManager.classifyError(new Error('Connection refused'))).toBe('network');
    });

    it('should classify authentication errors', () => {
      expect(RetryManager.classifyError(new Error('Authentication failed'))).toBe('authentication');
      expect(RetryManager.classifyError(new Error('Unauthorized access'))).toBe('authentication');
      expect(RetryManager.classifyError(new Error('Forbidden'))).toBe('authentication');
    });

    it('should classify timeout errors', () => {
      expect(RetryManager.classifyError(new Error('Request timeout'))).toBe('timeout');
      expect(RetryManager.classifyError(new Error('Timeout exceeded'))).toBe('timeout');
    });

    it('should classify server errors', () => {
      expect(RetryManager.classifyError(new Error('Server error 500'))).toBe('server');
      expect(RetryManager.classifyError(new Error('Service unavailable 503'))).toBe('server');
    });

    it('should classify unknown errors', () => {
      expect(RetryManager.classifyError(new Error('Something went wrong'))).toBe('unknown');
      expect(RetryManager.classifyError(null)).toBe('unknown');
      expect(RetryManager.classifyError(undefined)).toBe('unknown');
    });

    it('should handle non-Error objects', () => {
      expect(RetryManager.classifyError('network failure')).toBe('network');
      expect(RetryManager.classifyError({ message: 'auth error' })).toBe('authentication');
    });
  });

  describe('export/import()', () => {
    it('should export state', () => {
      retryManager.recordAttempt('network', 'Error 1');
      retryManager.recordAttempt('timeout', 'Error 2');

      const exported = retryManager.export();

      expect(exported.retryCount).toBe(2);
      expect(exported.lastRetryTime).toBeGreaterThan(0);
      expect(exported.history).toHaveLength(2);
    });

    it('should import state', () => {
      const state = {
        retryCount: 5,
        lastRetryTime: Date.now() - 5000,
        history: [
          {
            attemptNumber: 1,
            timestamp: Date.now() - 10000,
            delay: 1000,
            errorType: 'network' as const,
          },
          {
            attemptNumber: 2,
            timestamp: Date.now() - 8000,
            delay: 2000,
            errorType: 'timeout' as const,
          },
        ],
      };

      retryManager.import(state);

      expect(retryManager.getRetryCount()).toBe(5);
      expect(retryManager.getHistory()).toHaveLength(2);
    });

    it('should support state persistence', () => {
      retryManager.recordAttempt('network');
      retryManager.recordAttempt('timeout');

      const exported = retryManager.export();
      const newManager = new RetryManager();
      newManager.import(exported);

      expect(newManager.getRetryCount()).toBe(retryManager.getRetryCount());
      expect(newManager.getHistory()).toEqual(retryManager.getHistory());
    });
  });

  describe('custom config', () => {
    it('should use custom max retries', () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 3,
      });

      manager.recordAttempt();
      manager.recordAttempt();
      expect(manager.shouldRetry()).toBe(true);

      manager.recordAttempt();
      expect(manager.shouldRetry()).toBe(false);
    });

    it('should use custom delay sequence', () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        delays: [100, 200, 300],
        jitterFactor: 0,
      });

      expect(manager.getRetryDelay()).toBe(100);

      manager.recordAttempt();
      expect(manager.getRetryDelay()).toBe(200);

      manager.recordAttempt();
      expect(manager.getRetryDelay()).toBe(300);

      manager.recordAttempt();
      expect(manager.getRetryDelay()).toBe(300); // Last delay repeats
    });

    it('should support zero jitter', () => {
      const manager = new RetryManager({
        ...DEFAULT_RETRY_CONFIG,
        delays: [1000],
        jitterFactor: 0,
      });

      expect(manager.getRetryDelay()).toBe(1000);
      expect(manager.getRetryDelay()).toBe(1000);
    });
  });
});

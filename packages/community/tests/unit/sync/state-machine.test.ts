/**
 * Unit tests for SyncStateMachine
 *
 * Tests cover:
 * - State initialization
 * - State transitions (valid and invalid)
 * - State getters and checkers
 * - Error handling and retry logic
 * - State change callbacks
 * - Transition history management
 * - Statistics and export functionality
 * - Reset functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SyncStateMachine,
  DEFAULT_STATE_MACHINE_CONFIG,
  StateMachineConfig,
  SyncEvent,
} from '../../../src/sync/state-machine';
import { SyncState } from '@engram/core';

describe('SyncStateMachine', () => {
  let stateMachine: SyncStateMachine;

  beforeEach(() => {
    stateMachine = new SyncStateMachine();
  });

  describe('Initialization', () => {
    it('should initialize with DISCONNECTED state', () => {
      expect(stateMachine.getState()).toBe('DISCONNECTED');
    });

    it('should initialize with null previous state', () => {
      expect(stateMachine.getPreviousState()).toBeNull();
    });

    it('should initialize with default config', () => {
      expect(stateMachine.shouldRetry()).toBe(true);
      expect(stateMachine.getErrorCount()).toBe(0);
    });

    it('should accept custom config', () => {
      const customConfig: StateMachineConfig = {
        connectionTimeout: 5000,
        syncTimeout: 15000,
        heartbeatInterval: 15000,
        maxRetries: 3,
        retryDelays: [500, 1000, 2000],
      };
      const customMachine = new SyncStateMachine(customConfig);
      expect(customMachine.getState()).toBe('DISCONNECTED');
    });
  });

  describe('State Getters', () => {
    it('should get current state', () => {
      expect(stateMachine.getState()).toBe('DISCONNECTED');
    });

    it('should get previous state after transition', () => {
      stateMachine.transition('CONNECT');
      expect(stateMachine.getPreviousState()).toBe('DISCONNECTED');
      expect(stateMachine.getState()).toBe('CONNECTING');
    });

    it('should track state changes', () => {
      stateMachine.transition('CONNECT');
      expect(stateMachine.getState()).toBe('CONNECTING');

      stateMachine.transition('CONNECTED');
      expect(stateMachine.getState()).toBe('CONNECTED');
      expect(stateMachine.getPreviousState()).toBe('CONNECTING');
    });
  });

  describe('State Checkers', () => {
    it('should check if in specific state', () => {
      expect(stateMachine.is('DISCONNECTED')).toBe(true);
      expect(stateMachine.is('CONNECTING')).toBe(false);

      stateMachine.transition('CONNECT');
      expect(stateMachine.is('CONNECTING')).toBe(true);
      expect(stateMachine.is('DISCONNECTED')).toBe(false);
    });

    it('should check if connected', () => {
      expect(stateMachine.isConnected()).toBe(false);

      stateMachine.transition('CONNECT');
      expect(stateMachine.isConnected()).toBe(false); // Still CONNECTING

      stateMachine.transition('CONNECTED');
      expect(stateMachine.isConnected()).toBe(true); // CONNECTED
    });

    it('should check if syncing', () => {
      expect(stateMachine.isSyncing()).toBe(false);

      // Navigate to SYNCING state
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');

      expect(stateMachine.isSyncing()).toBe(true);
    });

    it('should check if idle', () => {
      expect(stateMachine.isIdle()).toBe(false);

      // Navigate to IDLE state
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');

      expect(stateMachine.isIdle()).toBe(true);
    });

    it('should check if in error state', () => {
      expect(stateMachine.isError()).toBe(false);

      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Test error'));

      expect(stateMachine.isError()).toBe(true);
    });

    it('should report isConnected() for SYNCING state', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');

      expect(stateMachine.isConnected()).toBe(true);
      expect(stateMachine.isSyncing()).toBe(true);
    });

    it('should report isConnected() for IDLE state', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');

      expect(stateMachine.isConnected()).toBe(true);
      expect(stateMachine.isIdle()).toBe(true);
    });
  });

  describe('Valid State Transitions', () => {
    it('should transition DISCONNECTED -> CONNECTING', () => {
      const success = stateMachine.transition('CONNECT');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('CONNECTING');
      expect(stateMachine.getPreviousState()).toBe('DISCONNECTED');
    });

    it('should transition CONNECTING -> CONNECTED', () => {
      stateMachine.transition('CONNECT');
      const success = stateMachine.transition('CONNECTED');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('CONNECTED');
      expect(stateMachine.getPreviousState()).toBe('CONNECTING');
    });

    it('should transition CONNECTING -> ERROR', () => {
      stateMachine.transition('CONNECT');
      const error = new Error('Connection failed');
      const success = stateMachine.transition('ERROR', error);

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('ERROR');
      expect(stateMachine.getLastError()).toBe(error);
    });

    it('should transition CONNECTED -> SYNCING', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      const success = stateMachine.transition('SYNC_START');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('SYNCING');
    });

    it('should transition SYNCING -> IDLE', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      const success = stateMachine.transition('SYNC_COMPLETE');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('IDLE');
    });

    it('should transition IDLE -> SYNCING on LOCAL_CHANGE', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');
      const success = stateMachine.transition('LOCAL_CHANGE');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('SYNCING');
    });

    it('should transition IDLE -> SYNCING on REMOTE_CHANGE', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');
      const success = stateMachine.transition('REMOTE_CHANGE');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('SYNCING');
    });

    it('should transition ERROR -> CONNECTING on RETRY', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Test error'));
      const success = stateMachine.transition('RETRY');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('CONNECTING');
    });

    it('should transition to DISCONNECTED from any state', () => {
      // From CONNECTING
      stateMachine.transition('CONNECT');
      stateMachine.transition('DISCONNECT');
      expect(stateMachine.getState()).toBe('DISCONNECTED');

      // From CONNECTED
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('DISCONNECT');
      expect(stateMachine.getState()).toBe('DISCONNECTED');

      // From SYNCING
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('DISCONNECT');
      expect(stateMachine.getState()).toBe('DISCONNECTED');

      // From ERROR
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Test'));
      stateMachine.transition('DISCONNECT');
      expect(stateMachine.getState()).toBe('DISCONNECTED');
    });

    it('should transition to ERROR from connected states', () => {
      const error = new Error('Unexpected error');

      // From CONNECTED
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('ERROR', error);
      expect(stateMachine.getState()).toBe('ERROR');

      // Reset and try from SYNCING
      stateMachine.reset();
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('ERROR', error);
      expect(stateMachine.getState()).toBe('ERROR');

      // Reset and try from IDLE
      stateMachine.reset();
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');
      stateMachine.transition('ERROR', error);
      expect(stateMachine.getState()).toBe('ERROR');
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject invalid transition from DISCONNECTED', () => {
      const success = stateMachine.transition('CONNECTED');

      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe('DISCONNECTED'); // Should not change
    });

    it('should reject invalid transition from CONNECTING', () => {
      stateMachine.transition('CONNECT');
      const success = stateMachine.transition('SYNC_START');

      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe('CONNECTING'); // Should not change
    });

    it('should reject invalid transition from CONNECTED', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      const success = stateMachine.transition('SYNC_COMPLETE');

      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe('CONNECTED'); // Should not change
    });

    it('should reject invalid transition from SYNCING', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      const success = stateMachine.transition('CONNECTED');

      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe('SYNCING'); // Should not change
    });

    it('should reject invalid transition from IDLE', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');
      const success = stateMachine.transition('SYNC_START');

      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe('IDLE'); // Should not change
    });

    it('should reject invalid transition from ERROR', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Test'));
      const success = stateMachine.transition('CONNECTED');

      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe('ERROR'); // Should not change
    });
  });

  describe('Error Handling', () => {
    it('should track error count', () => {
      expect(stateMachine.getErrorCount()).toBe(0);

      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Error 1'));
      expect(stateMachine.getErrorCount()).toBe(1);

      stateMachine.transition('RETRY');
      stateMachine.transition('ERROR', new Error('Error 2'));
      expect(stateMachine.getErrorCount()).toBe(2);
    });

    it('should store last error', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', error1);
      expect(stateMachine.getLastError()).toBe(error1);

      stateMachine.transition('RETRY');
      stateMachine.transition('ERROR', error2);
      expect(stateMachine.getLastError()).toBe(error2);
    });

    it('should reset error count on successful connection', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Error'));
      expect(stateMachine.getErrorCount()).toBe(1);

      stateMachine.transition('RETRY');
      stateMachine.transition('CONNECTED');
      expect(stateMachine.getErrorCount()).toBe(0);
      expect(stateMachine.getLastError()).toBeNull();
    });

    it('should calculate retry delay based on error count', () => {
      expect(stateMachine.getRetryDelay()).toBe(1000); // First retry: 1s

      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Error 1'));
      expect(stateMachine.getRetryDelay()).toBe(1000); // 1s

      stateMachine.transition('RETRY');
      stateMachine.transition('ERROR', new Error('Error 2'));
      expect(stateMachine.getRetryDelay()).toBe(2000); // 2s

      stateMachine.transition('RETRY');
      stateMachine.transition('ERROR', new Error('Error 3'));
      expect(stateMachine.getRetryDelay()).toBe(5000); // 5s
    });

    it('should cap retry delay at maximum', () => {
      // Trigger many errors to exceed retry delays array
      for (let i = 0; i < 10; i++) {
        stateMachine.transition('CONNECT');
        stateMachine.transition('ERROR', new Error(`Error ${i}`));
        stateMachine.transition('RETRY');
      }

      // Should be capped at last delay (60s)
      expect(stateMachine.getRetryDelay()).toBe(60000);
    });

    it('should respect max retries', () => {
      expect(stateMachine.shouldRetry()).toBe(true);

      // Trigger max retries (10)
      for (let i = 0; i < 10; i++) {
        stateMachine.transition('CONNECT');
        stateMachine.transition('ERROR', new Error(`Error ${i}`));
        stateMachine.transition('RETRY');
      }

      expect(stateMachine.shouldRetry()).toBe(false);
    });

    it('should use custom max retries', () => {
      const customMachine = new SyncStateMachine({
        ...DEFAULT_STATE_MACHINE_CONFIG,
        maxRetries: 3,
      });

      expect(customMachine.shouldRetry()).toBe(true);

      // Trigger 3 errors
      for (let i = 0; i < 3; i++) {
        customMachine.transition('CONNECT');
        customMachine.transition('ERROR', new Error(`Error ${i}`));
        customMachine.transition('RETRY');
      }

      expect(customMachine.shouldRetry()).toBe(false);
    });
  });

  describe('State Change Callbacks', () => {
    it('should notify listeners on state change', () => {
      const callback = jest.fn<(state: SyncState) => void>();
      stateMachine.onStateChange(callback);

      stateMachine.transition('CONNECT');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('CONNECTING');
    });

    it('should support multiple listeners', () => {
      const callback1 = jest.fn<(state: SyncState) => void>();
      const callback2 = jest.fn<(state: SyncState) => void>();

      stateMachine.onStateChange(callback1);
      stateMachine.onStateChange(callback2);

      stateMachine.transition('CONNECT');

      expect(callback1).toHaveBeenCalledWith('CONNECTING');
      expect(callback2).toHaveBeenCalledWith('CONNECTING');
    });

    it('should unsubscribe listeners', () => {
      const callback = jest.fn<(state: SyncState) => void>();
      const unsubscribe = stateMachine.onStateChange(callback);

      stateMachine.transition('CONNECT');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      stateMachine.transition('CONNECTED');
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = jest.fn<(state: SyncState) => void>(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn<(state: SyncState) => void>();

      stateMachine.onStateChange(errorCallback);
      stateMachine.onStateChange(goodCallback);

      // Should not throw
      expect(() => stateMachine.transition('CONNECT')).not.toThrow();

      // Both callbacks should be called
      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Transition History', () => {
    it('should record transition history', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');

      const history = stateMachine.getHistory();

      expect(history.length).toBe(2);
      expect(history[0]).toMatchObject({
        from: 'DISCONNECTED',
        to: 'CONNECTING',
        event: 'CONNECT',
      });
      expect(history[1]).toMatchObject({
        from: 'CONNECTING',
        to: 'CONNECTED',
        event: 'CONNECTED',
      });
    });

    it('should include timestamps in history', () => {
      const before = Date.now();
      stateMachine.transition('CONNECT');
      const after = Date.now();

      const history = stateMachine.getHistory();

      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should get recent history', () => {
      // Create 15 transitions
      for (let i = 0; i < 15; i++) {
        stateMachine.transition('CONNECT');
        stateMachine.transition('DISCONNECT');
      }

      const recentHistory = stateMachine.getRecentHistory(5);

      expect(recentHistory.length).toBe(5);
      expect(recentHistory[4]).toMatchObject({
        from: 'CONNECTING',
        to: 'DISCONNECTED',
        event: 'DISCONNECT',
      });
    });

    it('should limit history to 100 transitions', () => {
      // Create 150 transitions
      for (let i = 0; i < 150; i++) {
        stateMachine.transition('CONNECT');
        stateMachine.transition('DISCONNECT');
      }

      const history = stateMachine.getHistory();

      expect(history.length).toBe(100);
    });

    it('should clear history', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');

      expect(stateMachine.getHistory().length).toBe(2);

      stateMachine.clearHistory();

      expect(stateMachine.getHistory().length).toBe(0);
    });

    it('should return copy of history', () => {
      stateMachine.transition('CONNECT');
      const history1 = stateMachine.getHistory();
      const history2 = stateMachine.getHistory();

      expect(history1).not.toBe(history2); // Different array instances
      expect(history1).toEqual(history2); // Same content
    });
  });

  describe('Statistics', () => {
    it('should provide state statistics', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('SYNC_START');
      stateMachine.transition('SYNC_COMPLETE');

      const stats = stateMachine.getStats();

      expect(stats.currentState).toBe('IDLE');
      expect(stats.transitionCount).toBe(4);
      expect(stats.errorCount).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should track state distribution', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');
      stateMachine.transition('DISCONNECT');
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');

      const stats = stateMachine.getStats();

      expect(stats.stateDistribution.CONNECTING).toBe(2);
      expect(stats.stateDistribution.CONNECTED).toBe(2);
      expect(stats.stateDistribution.DISCONNECTED).toBe(1);
    });

    it('should include error count in stats', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Test error'));

      const stats = stateMachine.getStats();

      expect(stats.errorCount).toBe(1);
    });
  });

  describe('Export Functionality', () => {
    it('should export state machine state', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('CONNECTED');

      const exported = stateMachine.export();

      expect(exported.state).toBe('CONNECTED');
      expect(exported.previousState).toBe('CONNECTING');
      expect(exported.errorCount).toBe(0);
      expect(exported.lastError).toBeNull();
      expect(exported.history.length).toBe(2);
    });

    it('should export error information', () => {
      const error = new Error('Test error message');
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', error);

      const exported = stateMachine.export();

      expect(exported.errorCount).toBe(1);
      expect(exported.lastError).toBe('Test error message');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initial state', () => {
      stateMachine.transition('CONNECT');
      stateMachine.transition('ERROR', new Error('Test'));

      stateMachine.reset();

      expect(stateMachine.getState()).toBe('DISCONNECTED');
      expect(stateMachine.getPreviousState()).toBeNull();
      expect(stateMachine.getErrorCount()).toBe(0);
      expect(stateMachine.getLastError()).toBeNull();
      expect(stateMachine.getHistory().length).toBe(0);
    });

    it('should allow transitions after reset', () => {
      stateMachine.transition('CONNECT');
      stateMachine.reset();

      const success = stateMachine.transition('CONNECT');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('CONNECTING');
    });
  });

  describe('Edge Cases', () => {
    it('should handle DISCONNECT from DISCONNECTED (idempotent)', () => {
      const success = stateMachine.transition('DISCONNECT');

      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe('DISCONNECTED');
    });

    it('should handle multiple consecutive errors', () => {
      stateMachine.transition('CONNECT');

      for (let i = 0; i < 5; i++) {
        stateMachine.transition('ERROR', new Error(`Error ${i}`));
        stateMachine.transition('RETRY');
      }

      expect(stateMachine.getErrorCount()).toBe(5);
    });

    it('should handle rapid state changes', () => {
      // Simulate rapid connect/disconnect
      for (let i = 0; i < 10; i++) {
        stateMachine.transition('CONNECT');
        stateMachine.transition('DISCONNECT');
      }

      expect(stateMachine.getState()).toBe('DISCONNECTED');
      expect(stateMachine.getHistory().length).toBe(20);
    });

    it('should handle state change with no listeners', () => {
      expect(() => stateMachine.transition('CONNECT')).not.toThrow();
    });
  });
});

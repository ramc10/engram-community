/**
 * Sync State Machine
 * Manages sync states and transitions for the client
 *
 * States:
 * - DISCONNECTED: Not connected to server
 * - CONNECTING: Attempting to connect
 * - CONNECTED: Connected but idle
 * - SYNCING: Actively syncing operations
 * - IDLE: Connected and up-to-date
 * - ERROR: Error occurred, will retry
 *
 * Transitions:
 * DISCONNECTED --[connect]--> CONNECTING
 * CONNECTING --[success]--> CONNECTED
 * CONNECTING --[failure]--> ERROR
 * CONNECTED --[sync_request]--> SYNCING
 * SYNCING --[sync_complete]--> IDLE
 * IDLE --[local_change]--> SYNCING
 * IDLE --[remote_change]--> SYNCING
 * * --[error]--> ERROR
 * ERROR --[retry]--> CONNECTING
 * * --[disconnect]--> DISCONNECTED
 */

import { SyncState } from '@engram/core';

export type SyncEvent =
  | 'CONNECT'
  | 'CONNECTED'
  | 'DISCONNECT'
  | 'DISCONNECTED'
  | 'SYNC_START'
  | 'SYNC_COMPLETE'
  | 'LOCAL_CHANGE'
  | 'REMOTE_CHANGE'
  | 'ERROR'
  | 'RETRY';

export interface StateTransition {
  from: SyncState;
  to: SyncState;
  event: SyncEvent;
  timestamp: number;
}

export interface StateMachineConfig {
  connectionTimeout: number; // 10 seconds
  syncTimeout: number; // 30 seconds
  heartbeatInterval: number; // 30 seconds
  maxRetries: number; // 10
  retryDelays: number[]; // [1s, 2s, 5s, 10s, 30s, 60s]
}

export const DEFAULT_STATE_MACHINE_CONFIG: StateMachineConfig = {
  connectionTimeout: 10000, // 10 seconds
  syncTimeout: 30000, // 30 seconds
  heartbeatInterval: 30000, // 30 seconds
  maxRetries: 10,
  retryDelays: [1000, 2000, 5000, 10000, 30000, 60000], // exponential backoff
};

export class SyncStateMachine {
  private currentState: SyncState = 'DISCONNECTED';
  private previousState: SyncState | null = null;
  private transitionHistory: StateTransition[] = [];
  private stateChangeCallbacks: Set<(state: SyncState) => void> = new Set();
  private errorCount: number = 0;
  private lastError: Error | null = null;

  constructor(
    private config: StateMachineConfig = DEFAULT_STATE_MACHINE_CONFIG
  ) { }

  /**
   * Get current state
   */
  getState(): SyncState {
    return this.currentState;
  }

  /**
   * Get previous state
   */
  getPreviousState(): SyncState | null {
    return this.previousState;
  }

  /**
   * Check if in a specific state
   */
  is(state: SyncState): boolean {
    return this.currentState === state;
  }

  /**
   * Check if connected (CONNECTED, SYNCING, or IDLE)
   */
  isConnected(): boolean {
    return (
      this.currentState === 'CONNECTED' ||
      this.currentState === 'SYNCING' ||
      this.currentState === 'IDLE'
    );
  }

  /**
   * Check if syncing
   */
  isSyncing(): boolean {
    return this.currentState === 'SYNCING';
  }

  /**
   * Check if idle
   */
  isIdle(): boolean {
    return this.currentState === 'IDLE';
  }

  /**
   * Check if in error state
   */
  isError(): boolean {
    return this.currentState === 'ERROR';
  }

  /**
   * Transition to a new state
   */
  transition(event: SyncEvent, error?: Error): boolean {
    const from = this.currentState;
    const to = this.getNextState(event);

    if (to === null) {
      console.warn(
        `[StateMachine] Invalid transition: ${from} --[${event}]--> (no valid state)`
      );
      return false;
    }

    // Track error if provided
    if (error) {
      this.lastError = error;
      if (to === 'ERROR') {
        this.errorCount++;
      }
    }

    // Reset error count on successful connection
    if (to === 'CONNECTED') {
      this.errorCount = 0;
      this.lastError = null;
    }

    // Update state
    this.previousState = from;
    this.currentState = to;

    // Record transition
    const transition: StateTransition = {
      from,
      to,
      event,
      timestamp: Date.now(),
    };
    this.transitionHistory.push(transition);

    // Keep only last 100 transitions
    if (this.transitionHistory.length > 100) {
      this.transitionHistory.shift();
    }

    console.log(`[StateMachine] ${from} --[${event}]--> ${to}`);

    // Notify listeners
    this.notifyStateChange(to);

    return true;
  }

  /**
   * Get next state based on current state and event
   */
  private getNextState(event: SyncEvent): SyncState | null {
    const current = this.currentState;

    switch (current) {
      case 'DISCONNECTED':
        if (event === 'CONNECT') return 'CONNECTING';
        if (event === 'DISCONNECT') return 'DISCONNECTED';
        return null;

      case 'CONNECTING':
        if (event === 'CONNECTED') return 'CONNECTED';
        if (event === 'ERROR') return 'ERROR';
        if (event === 'DISCONNECT') return 'DISCONNECTED';
        return null;

      case 'CONNECTED':
        if (event === 'SYNC_START') return 'SYNCING';
        if (event === 'DISCONNECT') return 'DISCONNECTED';
        if (event === 'ERROR') return 'ERROR';
        return null;

      case 'SYNCING':
        if (event === 'SYNC_COMPLETE') return 'IDLE';
        if (event === 'ERROR') return 'ERROR';
        if (event === 'DISCONNECT') return 'DISCONNECTED';
        return null;

      case 'IDLE':
        if (event === 'LOCAL_CHANGE' || event === 'REMOTE_CHANGE') {
          return 'SYNCING';
        }
        if (event === 'DISCONNECT') return 'DISCONNECTED';
        if (event === 'ERROR') return 'ERROR';
        return null;

      case 'ERROR':
        if (event === 'RETRY') return 'CONNECTING';
        if (event === 'DISCONNECT') return 'DISCONNECTED';
        return null;

      default:
        return null;
    }
  }

  /**
   * Register state change callback
   */
  onStateChange(callback: (state: SyncState) => void): () => void {
    this.stateChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(state: SyncState): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(state);
      } catch (error) {
        console.error('[StateMachine] Error in state change callback:', error);
      }
    }
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Get last error
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get retry delay based on error count
   */
  getRetryDelay(): number {
    const index = Math.min(this.errorCount - 1, this.config.retryDelays.length - 1);
    return this.config.retryDelays[Math.max(0, index)];
  }

  /**
   * Check if should retry
   */
  shouldRetry(): boolean {
    return this.errorCount < this.config.maxRetries;
  }

  /**
   * Get transition history
   */
  getHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Get recent transitions (last N)
   */
  getRecentHistory(count: number = 10): StateTransition[] {
    return this.transitionHistory.slice(-count);
  }

  /**
   * Clear transition history
   */
  clearHistory(): void {
    this.transitionHistory = [];
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.currentState = 'DISCONNECTED';
    this.previousState = null;
    this.errorCount = 0;
    this.lastError = null;
    this.transitionHistory = [];
    console.log('[StateMachine] Reset to DISCONNECTED');
  }

  /**
   * Get state machine statistics
   */
  getStats(): {
    currentState: SyncState;
    errorCount: number;
    transitionCount: number;
    uptime: number;
    stateDistribution: Record<SyncState, number>;
  } {
    const stateDistribution: Record<string, number> = {};

    for (const transition of this.transitionHistory) {
      stateDistribution[transition.to] = (stateDistribution[transition.to] || 0) + 1;
    }

    const uptime = this.transitionHistory.length > 0
      ? Date.now() - this.transitionHistory[0].timestamp
      : 0;

    return {
      currentState: this.currentState,
      errorCount: this.errorCount,
      transitionCount: this.transitionHistory.length,
      uptime,
      stateDistribution: stateDistribution as Record<SyncState, number>,
    };
  }

  /**
   * Export state for persistence/debugging
   */
  export(): {
    state: SyncState;
    previousState: SyncState | null;
    errorCount: number;
    lastError: string | null;
    history: StateTransition[];
  } {
    return {
      state: this.currentState,
      previousState: this.previousState,
      errorCount: this.errorCount,
      lastError: this.lastError?.message || null,
      history: this.transitionHistory,
    };
  }
}

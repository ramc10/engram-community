/**
 * Retry Manager
 * Manages retry logic with exponential backoff
 *
 * Features:
 * - Exponential backoff: [1s, 2s, 5s, 10s, 30s, 60s]
 * - Max retry limit
 * - Different strategies for different error types
 * - Jitter to prevent thundering herd
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Base delay in ms
  maxDelay: number; // Maximum delay in ms
  delays: number[]; // Explicit delay sequence
  jitterFactor: number; // Add randomness (0-1)
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 10,
  baseDelay: 1000, // 1 second
  maxDelay: 60000, // 60 seconds
  delays: [1000, 2000, 5000, 10000, 30000, 60000], // Exponential backoff
  jitterFactor: 0.1, // 10% jitter
};

export type ErrorType =
  | 'network'
  | 'authentication'
  | 'server'
  | 'timeout'
  | 'unknown';

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  delay: number;
  errorType?: ErrorType;
  errorMessage?: string;
}

export class RetryManager {
  private retryCount: number = 0;
  private lastRetryTime: number = 0;
  private retryHistory: RetryAttempt[] = [];
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get retry delay for current attempt
   * Uses explicit delay sequence if available, otherwise exponential backoff
   */
  getRetryDelay(): number {
    if (this.retryCount >= this.config.maxRetries) {
      return 0; // No more retries
    }

    let delay: number;

    // Use explicit delay sequence if available
    if (this.config.delays && this.config.delays.length > 0) {
      const index = Math.min(this.retryCount, this.config.delays.length - 1);
      delay = this.config.delays[index];
    } else {
      // Exponential backoff: baseDelay * 2^attempt
      delay = Math.min(
        this.config.baseDelay * Math.pow(2, this.retryCount),
        this.config.maxDelay
      );
    }

    // Add jitter to prevent thundering herd
    const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5) * 2;
    delay = Math.max(0, delay + jitter);

    return Math.floor(delay);
  }

  /**
   * Check if should retry
   */
  shouldRetry(): boolean {
    return this.retryCount < this.config.maxRetries;
  }

  /**
   * Record retry attempt
   */
  recordAttempt(errorType?: ErrorType, errorMessage?: string): void {
    this.retryCount++;
    this.lastRetryTime = Date.now();

    const delay = this.getRetryDelay();

    const attempt: RetryAttempt = {
      attemptNumber: this.retryCount,
      timestamp: this.lastRetryTime,
      delay,
      errorType,
      errorMessage,
    };

    this.retryHistory.push(attempt);

    // Keep only last 50 attempts
    if (this.retryHistory.length > 50) {
      this.retryHistory.shift();
    }

    console.log(
      `[RetryManager] Attempt ${this.retryCount}/${this.config.maxRetries}, delay: ${delay}ms, error: ${errorType}`
    );
  }

  /**
   * Reset retry state (after successful connection)
   */
  reset(): void {
    this.retryCount = 0;
    this.lastRetryTime = 0;
    this.clearTimer();
    console.log('[RetryManager] Reset');
  }

  /**
   * Schedule retry with callback
   * Returns a promise that resolves after the retry delay
   */
  async scheduleRetry<T>(
    operation: () => Promise<T>,
    errorType?: ErrorType,
    errorMessage?: string
  ): Promise<T> {
    if (!this.shouldRetry()) {
      throw new Error(`Max retries (${this.config.maxRetries}) exceeded`);
    }

    // Record attempt
    this.recordAttempt(errorType, errorMessage);

    // Get delay
    const delay = this.getRetryDelay();

    console.log(`[RetryManager] Scheduling retry in ${delay}ms`);

    // Wait for delay
    await this.delay(delay);

    // Execute operation
    try {
      const result = await operation();
      this.reset(); // Reset on success
      return result;
    } catch (error) {
      // If operation fails, caller can decide to retry again
      throw error;
    }
  }

  /**
   * Set timer for retry
   * Returns a promise that resolves after delay
   */
  setTimer(callback: () => void): void {
    this.clearTimer();

    const delay = this.getRetryDelay();

    if (delay > 0) {
      this.retryTimer = setTimeout(() => {
        callback();
      }, delay);

      console.log(`[RetryManager] Timer set for ${delay}ms`);
    }
  }

  /**
   * Clear retry timer
   */
  clearTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Get time until next retry
   */
  getTimeUntilRetry(): number {
    if (this.lastRetryTime === 0) {
      return 0;
    }

    const delay = this.getRetryDelay();
    const elapsed = Date.now() - this.lastRetryTime;
    const remaining = delay - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Get retry history
   */
  getHistory(): RetryAttempt[] {
    return [...this.retryHistory];
  }

  /**
   * Get recent retry attempts
   */
  getRecentHistory(count: number = 10): RetryAttempt[] {
    return this.retryHistory.slice(-count);
  }

  /**
   * Clear retry history
   */
  clearHistory(): void {
    this.retryHistory = [];
  }

  /**
   * Get retry statistics
   */
  getStats(): {
    retryCount: number;
    maxRetries: number;
    lastRetryTime: number;
    timeUntilRetry: number;
    totalAttempts: number;
    errorTypeDistribution: Record<ErrorType, number>;
  } {
    const errorTypeDistribution: Record<string, number> = {};

    for (const attempt of this.retryHistory) {
      if (attempt.errorType) {
        errorTypeDistribution[attempt.errorType] =
          (errorTypeDistribution[attempt.errorType] || 0) + 1;
      }
    }

    return {
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries,
      lastRetryTime: this.lastRetryTime,
      timeUntilRetry: this.getTimeUntilRetry(),
      totalAttempts: this.retryHistory.length,
      errorTypeDistribution: errorTypeDistribution as Record<ErrorType, number>,
    };
  }

  /**
   * Determine error type from error object
   */
  static classifyError(error: Error | unknown): ErrorType {
    if (!error) {
      return 'unknown';
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (message.includes('network') || message.includes('offline') || message.includes('connection')) {
      return 'network';
    }

    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'authentication';
    }

    if (message.includes('timeout')) {
      return 'timeout';
    }

    if (message.includes('server') || message.includes('500') || message.includes('503')) {
      return 'server';
    }

    return 'unknown';
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Export state for persistence/debugging
   */
  export(): {
    retryCount: number;
    lastRetryTime: number;
    history: RetryAttempt[];
  } {
    return {
      retryCount: this.retryCount,
      lastRetryTime: this.lastRetryTime,
      history: this.retryHistory,
    };
  }

  /**
   * Import state from persistence
   */
  import(state: {
    retryCount: number;
    lastRetryTime: number;
    history: RetryAttempt[];
  }): void {
    this.retryCount = state.retryCount;
    this.lastRetryTime = state.lastRetryTime;
    this.retryHistory = state.history;
  }
}

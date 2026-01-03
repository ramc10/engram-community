/**
 * Shared utility functions
 */

import type { UUID, Timestamp, VectorClock } from './types/memory';

/**
 * Generate a UUID v4
 */
export function generateUUID(): UUID {
  // Browser environment or Node.js with webcrypto
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older Node.js or test environments
  // Simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current timestamp
 */
export function now(): Timestamp {
  return Date.now();
}

/**
 * Create an empty vector clock
 */
export function createVectorClock(): VectorClock {
  return {};
}

/**
 * Increment a device's clock value
 */
export function incrementClock(clock: VectorClock, deviceId: string): VectorClock {
  return {
    ...clock,
    [deviceId]: (clock[deviceId] || 0) + 1,
  };
}

/**
 * Merge two vector clocks (taking max of each device)
 */
export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };

  for (const [deviceId, value] of Object.entries(b)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, value);
  }

  return merged;
}

/**
 * Compare two vector clocks
 * Returns:
 * - 'before' if a happened before b
 * - 'after' if a happened after b
 * - 'concurrent' if they are concurrent
 * - 'equal' if they are equal
 */
export function compareVectorClocks(
  a: VectorClock,
  b: VectorClock
): 'before' | 'after' | 'concurrent' | 'equal' {
  let aGreater = false;
  let bGreater = false;

  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const deviceId of allDevices) {
    const aValue = a[deviceId] || 0;
    const bValue = b[deviceId] || 0;

    if (aValue > bValue) {
      aGreater = true;
    } else if (bValue > aValue) {
      bGreater = true;
    }
  }

  if (aGreater && bGreater) {
    return 'concurrent';
  } else if (aGreater) {
    return 'after';
  } else if (bGreater) {
    return 'before';
  } else {
    return 'equal';
  }
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

/**
 * Convert string to Uint8Array
 */
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
export function uint8ArrayToString(array: Uint8Array): string {
  return new TextDecoder().decode(array);
}

/**
 * Simple hash function for content
 */
export function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if code is running in browser extension context
 */
export function isExtensionContext(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'chrome' in globalThis &&
    typeof (globalThis as any).chrome?.runtime !== 'undefined'
  );
}

/**
 * Get platform name from URL
 */
export function getPlatformFromUrl(url: string): 'chatgpt' | 'claude' | 'perplexity' | null {
  if (/chatgpt\.com/.test(url)) return 'chatgpt';
  if (/claude\.ai/.test(url)) return 'claude';
  if (/perplexity\.ai/.test(url)) return 'perplexity';
  return null;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: Timestamp): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

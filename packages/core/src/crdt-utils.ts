/**
 * CRDT Utilities
 * Shared utilities for working with CRDTs and vector clocks
 */

/**
 * Vector Clock type
 * Maps device ID to sequence number
 */
export type VectorClock = Record<string, number>;

/**
 * Compare two vector clocks
 * Returns:
 * - 'before': clock1 happened before clock2
 * - 'after': clock1 happened after clock2
 * - 'concurrent': clocks are concurrent (conflict)
 * - 'equal': clocks are equal
 */
export function compareVectorClocks(
  clock1: VectorClock,
  clock2: VectorClock
): 'before' | 'after' | 'concurrent' | 'equal' {
  const devices = new Set([
    ...Object.keys(clock1),
    ...Object.keys(clock2),
  ]);

  let clock1Greater = false;
  let clock2Greater = false;

  for (const device of devices) {
    const v1 = clock1[device] || 0;
    const v2 = clock2[device] || 0;

    if (v1 > v2) {
      clock1Greater = true;
    } else if (v2 > v1) {
      clock2Greater = true;
    }
  }

  if (!clock1Greater && !clock2Greater) {
    return 'equal';
  } else if (clock1Greater && !clock2Greater) {
    return 'after';
  } else if (clock2Greater && !clock1Greater) {
    return 'before';
  } else {
    return 'concurrent';
  }
}

/**
 * Merge two vector clocks (take maximum for each device)
 */
export function mergeVectorClocks(
  clock1: VectorClock,
  clock2: VectorClock
): VectorClock {
  const devices = new Set([
    ...Object.keys(clock1),
    ...Object.keys(clock2),
  ]);

  const merged: VectorClock = {};

  for (const device of devices) {
    merged[device] = Math.max(clock1[device] || 0, clock2[device] || 0);
  }

  return merged;
}

/**
 * Increment vector clock for a device
 */
export function incrementVectorClock(
  clock: VectorClock,
  deviceId: string
): VectorClock {
  return {
    ...clock,
    [deviceId]: (clock[deviceId] || 0) + 1,
  };
}

/**
 * Check if clock1 causally precedes clock2
 * (clock1 happened before clock2)
 */
export function happenedBefore(
  clock1: VectorClock,
  clock2: VectorClock
): boolean {
  return compareVectorClocks(clock1, clock2) === 'before';
}

/**
 * Check if two vector clocks are concurrent
 * (neither happened before the other - potential conflict)
 */
export function areConcurrent(
  clock1: VectorClock,
  clock2: VectorClock
): boolean {
  return compareVectorClocks(clock1, clock2) === 'concurrent';
}

/**
 * Get the "distance" between two vector clocks
 * Returns the total number of operations that differ
 */
export function vectorClockDistance(
  clock1: VectorClock,
  clock2: VectorClock
): number {
  const devices = new Set([
    ...Object.keys(clock1),
    ...Object.keys(clock2),
  ]);

  let distance = 0;

  for (const device of devices) {
    const v1 = clock1[device] || 0;
    const v2 = clock2[device] || 0;
    distance += Math.abs(v1 - v2);
  }

  return distance;
}

/**
 * Serialize vector clock to string (for storage/transmission)
 */
export function serializeVectorClock(clock: VectorClock): string {
  return JSON.stringify(clock);
}

/**
 * Deserialize vector clock from string
 */
export function deserializeVectorClock(serialized: string): VectorClock {
  return JSON.parse(serialized) as VectorClock;
}

/**
 * Create empty vector clock
 */
export function createVectorClock(): VectorClock {
  return {};
}

/**
 * Initialize vector clock for a device
 */
export function initializeVectorClock(deviceId: string): VectorClock {
  return { [deviceId]: 0 };
}

/**
 * Check if vector clock is empty
 */
export function isEmptyVectorClock(clock: VectorClock): boolean {
  return Object.keys(clock).length === 0;
}

/**
 * Get all devices in a vector clock
 */
export function getDevices(clock: VectorClock): string[] {
  return Object.keys(clock);
}

/**
 * Get sequence number for a specific device
 */
export function getSequence(clock: VectorClock, deviceId: string): number {
  return clock[deviceId] || 0;
}

/**
 * Last Write Wins (LWW) conflict resolution
 * Compares two timestamps, returns the winner
 */
export function resolveLastWriteWins(
  timestamp1: number,
  timestamp2: number,
  tiebreaker1?: string,
  tiebreaker2?: string
): 'first' | 'second' {
  if (timestamp1 > timestamp2) {
    return 'first';
  } else if (timestamp2 > timestamp1) {
    return 'second';
  } else {
    // Timestamps are equal, use tiebreaker (e.g., deviceId)
    if (tiebreaker1 && tiebreaker2) {
      return tiebreaker1 > tiebreaker2 ? 'first' : 'second';
    }
    return 'first'; // Default to first if no tiebreaker
  }
}

/**
 * Check if a vector clock dominates another
 * clock1 dominates clock2 if all entries in clock1 >= clock2
 */
export function dominates(clock1: VectorClock, clock2: VectorClock): boolean {
  const devices = new Set([
    ...Object.keys(clock1),
    ...Object.keys(clock2),
  ]);

  for (const device of devices) {
    const v1 = clock1[device] || 0;
    const v2 = clock2[device] || 0;

    if (v1 < v2) {
      return false;
    }
  }

  return true;
}

/**
 * Format vector clock for display
 */
export function formatVectorClock(clock: VectorClock): string {
  const entries = Object.entries(clock)
    .map(([device, sequence]) => `${device.slice(0, 8)}:${sequence}`)
    .join(', ');

  return `{${entries}}`;
}

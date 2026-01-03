"use strict";
/**
 * CRDT Utilities
 * Shared utilities for working with CRDTs and vector clocks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareVectorClocks = compareVectorClocks;
exports.mergeVectorClocks = mergeVectorClocks;
exports.incrementVectorClock = incrementVectorClock;
exports.happenedBefore = happenedBefore;
exports.areConcurrent = areConcurrent;
exports.vectorClockDistance = vectorClockDistance;
exports.serializeVectorClock = serializeVectorClock;
exports.deserializeVectorClock = deserializeVectorClock;
exports.createVectorClock = createVectorClock;
exports.initializeVectorClock = initializeVectorClock;
exports.isEmptyVectorClock = isEmptyVectorClock;
exports.getDevices = getDevices;
exports.getSequence = getSequence;
exports.resolveLastWriteWins = resolveLastWriteWins;
exports.dominates = dominates;
exports.formatVectorClock = formatVectorClock;
/**
 * Compare two vector clocks
 * Returns:
 * - 'before': clock1 happened before clock2
 * - 'after': clock1 happened after clock2
 * - 'concurrent': clocks are concurrent (conflict)
 * - 'equal': clocks are equal
 */
function compareVectorClocks(clock1, clock2) {
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
        }
        else if (v2 > v1) {
            clock2Greater = true;
        }
    }
    if (!clock1Greater && !clock2Greater) {
        return 'equal';
    }
    else if (clock1Greater && !clock2Greater) {
        return 'after';
    }
    else if (clock2Greater && !clock1Greater) {
        return 'before';
    }
    else {
        return 'concurrent';
    }
}
/**
 * Merge two vector clocks (take maximum for each device)
 */
function mergeVectorClocks(clock1, clock2) {
    const devices = new Set([
        ...Object.keys(clock1),
        ...Object.keys(clock2),
    ]);
    const merged = {};
    for (const device of devices) {
        merged[device] = Math.max(clock1[device] || 0, clock2[device] || 0);
    }
    return merged;
}
/**
 * Increment vector clock for a device
 */
function incrementVectorClock(clock, deviceId) {
    return {
        ...clock,
        [deviceId]: (clock[deviceId] || 0) + 1,
    };
}
/**
 * Check if clock1 causally precedes clock2
 * (clock1 happened before clock2)
 */
function happenedBefore(clock1, clock2) {
    return compareVectorClocks(clock1, clock2) === 'before';
}
/**
 * Check if two vector clocks are concurrent
 * (neither happened before the other - potential conflict)
 */
function areConcurrent(clock1, clock2) {
    return compareVectorClocks(clock1, clock2) === 'concurrent';
}
/**
 * Get the "distance" between two vector clocks
 * Returns the total number of operations that differ
 */
function vectorClockDistance(clock1, clock2) {
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
function serializeVectorClock(clock) {
    return JSON.stringify(clock);
}
/**
 * Deserialize vector clock from string
 */
function deserializeVectorClock(serialized) {
    return JSON.parse(serialized);
}
/**
 * Create empty vector clock
 */
function createVectorClock() {
    return {};
}
/**
 * Initialize vector clock for a device
 */
function initializeVectorClock(deviceId) {
    return { [deviceId]: 0 };
}
/**
 * Check if vector clock is empty
 */
function isEmptyVectorClock(clock) {
    return Object.keys(clock).length === 0;
}
/**
 * Get all devices in a vector clock
 */
function getDevices(clock) {
    return Object.keys(clock);
}
/**
 * Get sequence number for a specific device
 */
function getSequence(clock, deviceId) {
    return clock[deviceId] || 0;
}
/**
 * Last Write Wins (LWW) conflict resolution
 * Compares two timestamps, returns the winner
 */
function resolveLastWriteWins(timestamp1, timestamp2, tiebreaker1, tiebreaker2) {
    if (timestamp1 > timestamp2) {
        return 'first';
    }
    else if (timestamp2 > timestamp1) {
        return 'second';
    }
    else {
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
function dominates(clock1, clock2) {
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
function formatVectorClock(clock) {
    const entries = Object.entries(clock)
        .map(([device, sequence]) => `${device.slice(0, 8)}:${sequence}`)
        .join(', ');
    return `{${entries}}`;
}
//# sourceMappingURL=crdt-utils.js.map
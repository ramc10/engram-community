"use strict";
/**
 * Shared utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUUID = generateUUID;
exports.now = now;
exports.createVectorClock = createVectorClock;
exports.incrementClock = incrementClock;
exports.mergeVectorClocks = mergeVectorClocks;
exports.compareVectorClocks = compareVectorClocks;
exports.uint8ArrayToBase64 = uint8ArrayToBase64;
exports.base64ToUint8Array = base64ToUint8Array;
exports.stringToUint8Array = stringToUint8Array;
exports.uint8ArrayToString = uint8ArrayToString;
exports.simpleHash = simpleHash;
exports.debounce = debounce;
exports.deepClone = deepClone;
exports.isExtensionContext = isExtensionContext;
exports.getPlatformFromUrl = getPlatformFromUrl;
exports.formatBytes = formatBytes;
exports.formatRelativeTime = formatRelativeTime;
/**
 * Generate a UUID v4
 */
function generateUUID() {
    return crypto.randomUUID();
}
/**
 * Get current timestamp
 */
function now() {
    return Date.now();
}
/**
 * Create an empty vector clock
 */
function createVectorClock() {
    return {};
}
/**
 * Increment a device's clock value
 */
function incrementClock(clock, deviceId) {
    return {
        ...clock,
        [deviceId]: (clock[deviceId] || 0) + 1,
    };
}
/**
 * Merge two vector clocks (taking max of each device)
 */
function mergeVectorClocks(a, b) {
    const merged = { ...a };
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
function compareVectorClocks(a, b) {
    let aGreater = false;
    let bGreater = false;
    const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const deviceId of allDevices) {
        const aValue = a[deviceId] || 0;
        const bValue = b[deviceId] || 0;
        if (aValue > bValue) {
            aGreater = true;
        }
        else if (bValue > aValue) {
            bGreater = true;
        }
    }
    if (aGreater && bGreater) {
        return 'concurrent';
    }
    else if (aGreater) {
        return 'after';
    }
    else if (bGreater) {
        return 'before';
    }
    else {
        return 'equal';
    }
}
/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(array) {
    return btoa(String.fromCharCode(...array));
}
/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64) {
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
function stringToUint8Array(str) {
    return new TextEncoder().encode(str);
}
/**
 * Convert Uint8Array to string
 */
function uint8ArrayToString(array) {
    return new TextDecoder().decode(array);
}
/**
 * Simple hash function for content
 */
function simpleHash(content) {
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
function debounce(func, wait) {
    let timeout = null;
    return function executedFunction(...args) {
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
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
/**
 * Check if code is running in browser extension context
 */
function isExtensionContext() {
    return (typeof globalThis !== 'undefined' &&
        'chrome' in globalThis &&
        typeof globalThis.chrome?.runtime !== 'undefined');
}
/**
 * Get platform name from URL
 */
function getPlatformFromUrl(url) {
    if (/chatgpt\.com/.test(url))
        return 'chatgpt';
    if (/claude\.ai/.test(url))
        return 'claude';
    if (/perplexity\.ai/.test(url))
        return 'perplexity';
    return null;
}
/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60)
        return 'just now';
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800)
        return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
}
//# sourceMappingURL=utils.js.map
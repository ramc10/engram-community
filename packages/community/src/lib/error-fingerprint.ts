/**
 * Error Fingerprinting Service
 * Generates unique fingerprints for errors to enable deduplication
 */

export interface ErrorFingerprint {
  hash: string;
  errorType: string;
  location: string;
  message: string;
}

/**
 * Generates a unique fingerprint for an error
 * Used for deduplication of similar errors
 */
export function generateErrorFingerprint(
  error: Error,
  context?: {
    service?: string;
    operation?: string;
  }
): ErrorFingerprint {
  // Extract error type
  const errorType = error.name || 'Error';

  // Extract location from stack trace (first meaningful line)
  const location = extractLocationFromStack(error.stack);

  // Normalize error message (remove dynamic values)
  const normalizedMessage = normalizeErrorMessage(error.message);

  // Create fingerprint string
  const fingerprintString = [
    errorType,
    location,
    normalizedMessage,
    context?.service || '',
    context?.operation || ''
  ].join('|');

  // Generate hash
  const hash = simpleHash(fingerprintString);

  return {
    hash,
    errorType,
    location,
    message: normalizedMessage
  };
}

/**
 * Extracts meaningful location from stack trace
 */
function extractLocationFromStack(stack?: string): string {
  if (!stack) return 'unknown';

  const lines = stack.split('\n');

  // Skip the first line (error message) and find first meaningful location
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip internal chrome/browser lines
    if (line.includes('chrome-extension://') ||
        line.includes('extensions::') ||
        line.includes('node_modules/')) {
      continue;
    }

    // Extract file and line number
    const match = line.match(/at\s+(?:.*\s+\()?([^)]+):(\d+):(\d+)/);
    if (match) {
      const [, file, lineNum] = match;
      // Get just the filename without full path
      const filename = file.split('/').pop() || file;
      return `${filename}:${lineNum}`;
    }
  }

  return 'unknown';
}

/**
 * Normalizes error message by removing dynamic values
 * This helps group similar errors together
 */
function normalizeErrorMessage(message: string): string {
  return message
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    // Remove timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
    // Remove numbers that might be IDs
    .replace(/\b\d{6,}\b/g, '<ID>')
    // Remove file paths
    .replace(/\/[\w\-./]+/g, '<PATH>')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple hash function for fingerprint generation
 * Based on Java's String.hashCode()
 */
function simpleHash(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Checks if two error fingerprints are similar
 */
export function areFingerprintsSimilar(
  fp1: ErrorFingerprint,
  fp2: ErrorFingerprint
): boolean {
  return fp1.hash === fp2.hash;
}

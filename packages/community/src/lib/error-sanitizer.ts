/**
 * Error Sanitizer
 * Removes sensitive information from errors before reporting to GitHub
 */

export interface SanitizedErrorData {
  message: string;
  stack?: string;
  type: string;
  context: Record<string, any>;
}

/**
 * List of sensitive patterns to remove from error data
 */
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  /\b(api[_-]?key|token|secret|password|passwd|pwd)[=:]\s*['"]?[\w\-./+]+['"]?/gi,
  // Bearer tokens
  /Bearer\s+[\w\-._~+/]+/gi,
  // GitHub tokens
  /gh[ps]_[a-zA-Z0-9]{20,}/gi,
  // Stripe API keys
  /[sp]k_(test|live)_[\w]+/gi,
  // Supabase keys
  /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/gi,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
  // Encryption keys (base64 encoded)
  /[A-Za-z0-9+/]{40,}={0,2}/g,
];

/**
 * Sensitive field names to redact
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'apikey',
  'api_key',
  'secret',
  'privatekey',
  'private_key',
  'masterkey',
  'master_key',
  'encryptionkey',
  'encryption_key',
  'supabasekey',
  'supabase_key',
  'githubtoken',
  'github_token',
  'sessiontoken',
  'session_token',
  'authtoken',
  'auth_token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
]);

/**
 * Sanitizes error data by removing sensitive information
 */
export function sanitizeError(
  error: Error,
  additionalContext?: Record<string, any>
): SanitizedErrorData {
  return {
    message: sanitizeString(error.message),
    stack: error.stack ? sanitizeStackTrace(error.stack) : undefined,
    type: error.name || 'Error',
    context: sanitizeContext(additionalContext || {})
  };
}

/**
 * Sanitizes a string by removing sensitive patterns
 */
export function sanitizeString(str: string): string {
  let sanitized = str;

  // Apply all sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Keep the field name but redact the value
      if (match.includes('=') || match.includes(':')) {
        const parts = match.split(/[=:]/);
        return `${parts[0]}=<REDACTED>`;
      }
      return '<REDACTED>';
    });
  }

  return sanitized;
}

/**
 * Sanitizes stack trace
 */
function sanitizeStackTrace(stack: string): string {
  const lines = stack.split('\n');
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    let sanitized = line;

    // Remove chrome extension IDs from paths (do this BEFORE sanitizeString)
    sanitized = sanitized.replace(
      /chrome-extension:\/\/[a-z0-9]{32}\//gi,
      'chrome-extension://<EXTENSION_ID>/'
    );

    // Remove absolute file paths, keep relative paths (do this BEFORE sanitizeString)
    sanitized = sanitized.replace(
      /\/(Users|home|mnt)\/[^\s:)]+/gi,
      '<USER_PATH>'
    );

    // Apply general sanitization
    sanitized = sanitizeString(sanitized);

    sanitizedLines.push(sanitized);
  }

  return sanitizedLines.join('\n');
}

/**
 * Sanitizes context object by recursively removing sensitive fields
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(context)) {
    // Skip sensitive fields
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = '<REDACTED>';
      continue;
    }

    // Recursively sanitize objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value);
    }
    // Sanitize arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' ? sanitizeContext(item) : sanitizeString(String(item))
      );
    }
    // Sanitize strings
    else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    }
    // Keep other primitives as-is
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validates that sanitized data doesn't contain sensitive information
 * Returns true if data appears safe
 */
export function validateSanitization(data: SanitizedErrorData): {
  isSafe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for potential API keys
  if (/[A-Za-z0-9]{32,}/.test(JSON.stringify(data))) {
    warnings.push('Potential API key or token detected');
  }

  // Check for email addresses
  if (/@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i.test(JSON.stringify(data))) {
    warnings.push('Email address detected');
  }

  // Check for sensitive field names
  const dataStr = JSON.stringify(data).toLowerCase();
  for (const field of SENSITIVE_FIELDS) {
    if (dataStr.includes(field) && !dataStr.includes(`"${field}":"<redacted>"`)) {
      warnings.push(`Sensitive field name detected: ${field}`);
    }
  }

  return {
    isSafe: warnings.length === 0,
    warnings
  };
}

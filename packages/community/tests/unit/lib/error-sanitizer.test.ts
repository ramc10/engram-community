/**
 * Unit tests for error sanitizer
 *
 * Tests cover:
 * - Sanitization of sensitive data (API keys, tokens, passwords)
 * - Stack trace sanitization
 * - Context object sanitization
 * - Validation of sanitized data
 */

import { describe, it, expect } from '@jest/globals';
import { sanitizeError, sanitizeString, validateSanitization } from '../../../src/lib/error-sanitizer';

describe('Error Sanitizer', () => {
  describe('sanitizeString', () => {
    it('should redact API keys', () => {
      const input = 'Error with api_key=sk_test_1234567890';
      const result = sanitizeString(input);

      expect(result).toContain('api_key=<REDACTED>');
      expect(result).not.toContain('sk_test_1234567890');
    });

    it('should redact Bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = sanitizeString(input);

      expect(result).toContain('<REDACTED>');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should redact GitHub tokens', () => {
      const input = 'Using token ghp_1234567890abcdefghijklmnopqrstuv';
      const result = sanitizeString(input);

      expect(result).toContain('<REDACTED>');
      expect(result).not.toContain('ghp_1234567890abcdefghijklmnopqrstuv');
    });

    it('should redact email addresses', () => {
      const input = 'User email: user@example.com';
      const result = sanitizeString(input);

      expect(result).toContain('<REDACTED>');
      expect(result).not.toContain('user@example.com');
    });

    it('should redact passwords', () => {
      const input = 'Login failed with password=mySecretPass123';
      const result = sanitizeString(input);

      expect(result).toContain('password=<REDACTED>');
      expect(result).not.toContain('mySecretPass123');
    });

    it('should handle multiple sensitive patterns', () => {
      const input = 'api_key=abc123 token=xyz789 password=secret';
      const result = sanitizeString(input);

      expect(result).toContain('api_key=<REDACTED>');
      expect(result).toContain('token=<REDACTED>');
      expect(result).toContain('password=<REDACTED>');
      expect(result).not.toContain('abc123');
      expect(result).not.toContain('xyz789');
      expect(result).not.toContain('secret');
    });

    it('should preserve non-sensitive content', () => {
      const input = 'Failed to connect to database on port 5432';
      const result = sanitizeString(input);

      expect(result).toBe(input);
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize error message', () => {
      const error = new Error('API key sk_test_123 is invalid');
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toContain('<REDACTED>');
      expect(sanitized.message).not.toContain('sk_test_123');
      expect(sanitized.type).toBe('Error');
    });

    it('should sanitize stack trace', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at testFunction (/home/user/project/file.js:10:5)
    at main (/home/user/project/main.js:20:3)`;

      const sanitized = sanitizeError(error);

      expect(sanitized.stack).toBeDefined();
      expect(sanitized.stack).toContain('<USER_PATH>');
      expect(sanitized.stack).not.toContain('/home/user');
    });

    it('should sanitize chrome extension IDs in stack', () => {
      const error = new Error('Extension error');
      error.stack = `Error: Extension error
    at chrome-extension://abcdefghijklmnopqrstuvwxyz123456/background.js:5:10`;

      const sanitized = sanitizeError(error);

      expect(sanitized.stack).toContain('<EXTENSION_ID>');
      expect(sanitized.stack).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    });

    it('should sanitize additional context', () => {
      const error = new Error('Test error');
      const context = {
        apiKey: 'secret_key_123',
        userId: 'user_456',
        normalField: 'safe value'
      };

      const sanitized = sanitizeError(error, context);

      expect(sanitized.context.apiKey).toBe('<REDACTED>');
      expect(sanitized.context.userId).toBe('user_456');
      expect(sanitized.context.normalField).toBe('safe value');
    });

    it('should handle nested objects in context', () => {
      const error = new Error('Test error');
      const context = {
        config: {
          token: 'secret_token',
          endpoint: 'https://api.example.com'
        },
        user: {
          password: 'secret_pass',
          name: 'John Doe'
        }
      };

      const sanitized = sanitizeError(error, context);

      expect(sanitized.context.config.token).toBe('<REDACTED>');
      expect(sanitized.context.config.endpoint).toBe('https://api.example.com');
      expect(sanitized.context.user.password).toBe('<REDACTED>');
      expect(sanitized.context.user.name).toBe('John Doe');
    });

    it('should handle arrays in context', () => {
      const error = new Error('Test error');
      const context = {
        items: ['item1', 'api_key=secret', 'item3']
      };

      const sanitized = sanitizeError(error, context);

      expect(sanitized.context.items).toHaveLength(3);
      expect(sanitized.context.items[0]).toBe('item1');
      expect(sanitized.context.items[1]).toContain('<REDACTED>');
      expect(sanitized.context.items[2]).toBe('item3');
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      error.stack = undefined;

      const sanitized = sanitizeError(error);

      expect(sanitized.stack).toBeUndefined();
      expect(sanitized.message).toBe('Test error');
    });

    it('should preserve error type', () => {
      const typeError = new TypeError('Type error');
      const sanitized = sanitizeError(typeError);

      expect(sanitized.type).toBe('TypeError');
    });
  });

  describe('validateSanitization', () => {
    it('should pass for clean data', () => {
      const data = {
        message: 'Simple error message',
        stack: 'Error at file.js:10',
        type: 'Error',
        context: { count: 5, name: 'test' }
      };

      const result = validateSanitization(data);

      expect(result.isSafe).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about potential API keys', () => {
      const data = {
        message: 'Error with key: abcdefghijklmnopqrstuvwxyz1234567890',
        stack: undefined,
        type: 'Error',
        context: {}
      };

      const result = validateSanitization(data);

      expect(result.isSafe).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('API key');
    });

    it('should warn about email addresses', () => {
      const data = {
        message: 'Error for user@example.com',
        stack: undefined,
        type: 'Error',
        context: {}
      };

      const result = validateSanitization(data);

      expect(result.isSafe).toBe(false);
      expect(result.warnings.some(w => w.includes('Email'))).toBe(true);
    });

    it('should not warn about properly redacted fields', () => {
      const data = {
        message: 'Error occurred',
        stack: undefined,
        type: 'Error',
        context: {
          apiKey: '<REDACTED>',
          password: '<REDACTED>'
        }
      };

      const result = validateSanitization(data);

      expect(result.isSafe).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect non-redacted sensitive field names', () => {
      const data = {
        message: 'Error occurred',
        stack: undefined,
        type: 'Error',
        context: {
          token: 'some_value'
        }
      };

      const result = validateSanitization(data);

      expect(result.isSafe).toBe(false);
      expect(result.warnings.some(w => w.includes('token'))).toBe(true);
    });
  });
});

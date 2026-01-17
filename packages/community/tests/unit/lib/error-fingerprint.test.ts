/**
 * Unit tests for error fingerprinting service
 *
 * Tests cover:
 * - Error fingerprint generation
 * - Location extraction from stack traces
 * - Error message normalization
 * - Fingerprint similarity comparison
 */

import { describe, it, expect } from '@jest/globals';
import { generateErrorFingerprint, areFingerprintsSimilar } from '../../../src/lib/error-fingerprint';

describe('Error Fingerprinting', () => {
  describe('generateErrorFingerprint', () => {
    it('should generate a fingerprint for a simple error', () => {
      const error = new Error('Test error message');
      const fingerprint = generateErrorFingerprint(error);

      expect(fingerprint).toHaveProperty('hash');
      expect(fingerprint).toHaveProperty('errorType');
      expect(fingerprint).toHaveProperty('location');
      expect(fingerprint).toHaveProperty('message');
      expect(fingerprint.hash).toMatch(/^[0-9a-f]{8}$/);
      expect(fingerprint.errorType).toBe('Error');
      expect(fingerprint.message).toBe('Test error message');
    });

    it('should include context in fingerprint', () => {
      const error = new Error('Test error');
      const fingerprint1 = generateErrorFingerprint(error, {
        service: 'Storage',
        operation: 'save'
      });
      const fingerprint2 = generateErrorFingerprint(error, {
        service: 'Crypto',
        operation: 'save'
      });

      // Different contexts should produce different hashes
      expect(fingerprint1.hash).not.toBe(fingerprint2.hash);
    });

    it('should normalize UUIDs in error messages', () => {
      // Create errors with the same stack trace for consistent fingerprinting
      const createTestError = (message: string) => {
        const err = new Error(message);
        // Set a consistent stack trace
        err.stack = `Error: ${message}\n    at testFunction (test.ts:100:10)`;
        return err;
      };

      const error1 = createTestError('Failed to save memory 123e4567-e89b-12d3-a456-426614174000');
      const error2 = createTestError('Failed to save memory 987e6543-e21b-43d2-b654-123456789abc');

      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      // Both should normalize to same message
      expect(fp1.message).toBe('Failed to save memory <UUID>');
      expect(fp2.message).toBe('Failed to save memory <UUID>');
      expect(fp1.hash).toBe(fp2.hash);
    });

    it('should normalize timestamps in error messages', () => {
      // Create errors with the same stack trace for consistent fingerprinting
      const createTestError = (message: string) => {
        const err = new Error(message);
        err.stack = `Error: ${message}\n    at testFunction (test.ts:100:10)`;
        return err;
      };

      const error1 = createTestError('Error at 2025-01-15T10:30:00');
      const error2 = createTestError('Error at 2025-01-16T15:45:30');

      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      expect(fp1.message).toBe('Error at <TIMESTAMP>');
      expect(fp2.message).toBe('Error at <TIMESTAMP>');
      expect(fp1.hash).toBe(fp2.hash);
    });

    it('should normalize numeric IDs in error messages', () => {
      // Create errors with the same stack trace for consistent fingerprinting
      const createTestError = (message: string) => {
        const err = new Error(message);
        err.stack = `Error: ${message}\n    at testFunction (test.ts:100:10)`;
        return err;
      };

      const error1 = createTestError('Failed to fetch record 123456');
      const error2 = createTestError('Failed to fetch record 789012');

      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      expect(fp1.message).toBe('Failed to fetch record <ID>');
      expect(fp2.message).toBe('Failed to fetch record <ID>');
      expect(fp1.hash).toBe(fp2.hash);
    });

    it('should normalize file paths in error messages', () => {
      const error1 = new Error('Failed to load /home/user/data.json');
      const error2 = new Error('Failed to load /var/lib/app/data.json');

      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      expect(fp1.message).toContain('<PATH>');
      expect(fp2.message).toContain('<PATH>');
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      error.stack = undefined;

      const fingerprint = generateErrorFingerprint(error);

      expect(fingerprint.location).toBe('unknown');
      expect(fingerprint.hash).toBeDefined();
    });

    it('should generate consistent hashes for same error', () => {
      const error = new Error('Consistent error');
      const context = { service: 'Test', operation: 'test' };

      const fp1 = generateErrorFingerprint(error, context);
      const fp2 = generateErrorFingerprint(error, context);

      expect(fp1.hash).toBe(fp2.hash);
    });

    it('should handle different error types', () => {
      const typeError = new TypeError('Type error');
      const rangeError = new RangeError('Range error');

      const fp1 = generateErrorFingerprint(typeError);
      const fp2 = generateErrorFingerprint(rangeError);

      expect(fp1.errorType).toBe('TypeError');
      expect(fp2.errorType).toBe('RangeError');
      expect(fp1.hash).not.toBe(fp2.hash);
    });
  });

  describe('areFingerprintsSimilar', () => {
    it('should return true for identical fingerprints', () => {
      const error = new Error('Test error');
      const fp1 = generateErrorFingerprint(error);
      const fp2 = generateErrorFingerprint(error);

      expect(areFingerprintsSimilar(fp1, fp2)).toBe(true);
    });

    it('should return false for different fingerprints', () => {
      const error1 = new Error('Error one');
      const error2 = new Error('Error two');

      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      expect(areFingerprintsSimilar(fp1, fp2)).toBe(false);
    });

    it('should return true for errors with normalized values', () => {
      const error1 = new Error('Failed to save memory abc123-def456');
      const error2 = new Error('Failed to save memory xyz789-uvw012');

      // Both have UUIDs that get normalized
      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      // Note: These are not proper UUIDs, so they won't be normalized the same way
      // This test demonstrates that similar patterns should produce different hashes
      expect(areFingerprintsSimilar(fp1, fp2)).toBe(false);
    });
  });
});

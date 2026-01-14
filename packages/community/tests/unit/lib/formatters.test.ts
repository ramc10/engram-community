/**
 * Unit tests for formatting utilities
 *
 * Tests cover:
 * - Date formatting with relative time
 * - Text summarization
 * - Text truncation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { formatDate, summarizeText, truncateText } from '../../../src/lib/formatters';

describe('Formatters', () => {
  describe('formatDate', () => {
    let originalDate: DateConstructor;

    beforeEach(() => {
      // Save original Date
      originalDate = global.Date;
    });

    afterEach(() => {
      // Restore original Date
      global.Date = originalDate;
    });

    it('should format today\'s date', () => {
      const now = new Date('2025-12-22T14:30:00');
      global.Date = class extends originalDate {
        constructor() {
          super();
          return now;
        }
        static now() {
          return now.getTime();
        }
      } as DateConstructor;

      const result = formatDate(now.getTime());

      expect(result).toContain('Today at');
      expect(result).toContain('2:30');
    });

    it('should format yesterday\'s date', () => {
      const now = new Date('2025-12-22T14:30:00');
      const yesterday = new Date('2025-12-21T10:00:00');

      global.Date = class extends originalDate {
        constructor(value?: any) {
          super(value || now);
          if (!value) {
            return now as any;
          }
          return new originalDate(value) as any;
        }
        static now() {
          return now.getTime();
        }
      } as any;

      const result = formatDate(yesterday.getTime());

      expect(result).toContain('Yesterday at');
    });

    it('should format dates within the week', () => {
      const now = new Date('2025-12-22T14:30:00'); // Monday
      const thisWeek = new Date('2025-12-18T10:00:00'); // Thursday of previous week

      global.Date = class extends originalDate {
        constructor(value?: any) {
          super(value || now);
          if (!value) {
            return now as any;
          }
          return new originalDate(value) as any;
        }
        static now() {
          return now.getTime();
        }
      } as any;

      const result = formatDate(thisWeek.getTime());

      // Should include weekday name
      expect(result).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) at/);
    });

    it('should format older dates', () => {
      const now = new Date('2025-12-22T14:30:00');
      const older = new Date('2025-11-15T10:00:00');

      global.Date = class extends originalDate {
        constructor(value?: any) {
          super(value || now);
          if (!value) {
            return now as any;
          }
          return new originalDate(value) as any;
        }
        static now() {
          return now.getTime();
        }
      } as any;

      const result = formatDate(older.getTime());

      expect(result).toContain('Nov 15');
      expect(result).toContain('at');
    });

    it('should include year for dates from different year', () => {
      const now = new Date('2026-01-15T14:30:00');
      const lastYear = new Date('2025-11-15T10:00:00');

      global.Date = class extends originalDate {
        constructor(value?: any) {
          super(value || now);
          if (!value) {
            return now as any;
          }
          return new originalDate(value) as any;
        }
        static now() {
          return now.getTime();
        }
      } as any;

      const result = formatDate(lastYear.getTime());

      expect(result).toContain('2025');
    });
  });

  describe('summarizeText', () => {
    it('should return empty string for empty input', () => {
      expect(summarizeText('')).toBe('');
      expect(summarizeText(null as any)).toBe('');
      expect(summarizeText(undefined as any)).toBe('');
    });

    it('should extract first sentence if short enough', () => {
      const text = 'This is the first sentence. This is the second sentence.';
      const result = summarizeText(text);

      expect(result).toBe('This is the first sentence.');
    });

    it('should handle exclamation marks', () => {
      const text = 'This is exciting! This is the second sentence.';
      const result = summarizeText(text);

      expect(result).toBe('This is exciting!');
    });

    it('should handle question marks', () => {
      const text = 'Is this a question? This is the second sentence.';
      const result = summarizeText(text);

      expect(result).toBe('Is this a question?');
    });

    it('should return full text if shorter than maxLength', () => {
      const text = 'Short text';
      const result = summarizeText(text, 100);

      expect(result).toBe('Short text');
    });

    it('should truncate at word boundary if first sentence is too long', () => {
      const text = 'This is a very long sentence that exceeds the maximum length and should be truncated at the nearest word boundary before the limit.';
      const result = summarizeText(text, 50);

      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result).toContain('...');
      expect(result).not.toContain(' .'); // Should not have space before ellipsis
    });

    it('should handle text without sentence terminators', () => {
      const text = 'This is text without any sentence terminators but it is quite long';
      const result = summarizeText(text, 30);

      expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
      expect(result).toContain('...');
    });

    it('should respect custom maxLength', () => {
      const text = 'This is a test sentence that is longer than 20 characters.';
      const result = summarizeText(text, 20);

      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    it('should handle text without spaces', () => {
      const text = 'a'.repeat(150);
      const result = summarizeText(text, 100);

      expect(result.length).toBe(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should trim whitespace from first sentence', () => {
      const text = '  This is a sentence.  More text here.';
      const result = summarizeText(text);

      expect(result).toBe('This is a sentence.');
    });
  });

  describe('truncateText', () => {
    it('should return text as-is if shorter than maxLength', () => {
      const text = 'Short text';
      const result = truncateText(text, 100);

      expect(result).toBe('Short text');
    });

    it('should return text as-is if equal to maxLength', () => {
      const text = 'Exactly 20 charactr!';
      const result = truncateText(text, 20);

      expect(result).toBe(text);
    });

    it('should truncate and add ellipsis if longer than maxLength', () => {
      const text = 'This is a long text that needs to be truncated';
      const result = truncateText(text, 20);

      expect(result.length).toBe(20);
      expect(result.endsWith('...')).toBe(true);
      expect(result).toBe('This is a long te...');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 100)).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(truncateText(null as any, 100)).toBe(null);
      expect(truncateText(undefined as any, 100)).toBe(undefined);
    });

    it('should respect custom maxLength', () => {
      const text = 'This is a test';
      const result = truncateText(text, 10);

      expect(result.length).toBe(10);
      expect(result).toBe('This is...');
    });

    it('should handle very short maxLength', () => {
      const text = 'Hello World';
      const result = truncateText(text, 5);

      expect(result.length).toBe(5);
      expect(result).toBe('He...');
    });

    it('should use default maxLength of 100', () => {
      const text = 'a'.repeat(150);
      const result = truncateText(text);

      expect(result.length).toBe(100);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle unicode characters', () => {
      const text = '你好世界'.repeat(50); // Chinese characters
      const result = truncateText(text, 20);

      expect(result.length).toBe(20);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle emojis', () => {
      const text = '😀'.repeat(50);
      const result = truncateText(text, 20);

      expect(result.length).toBeLessThanOrEqual(20);
      expect(result.endsWith('...')).toBe(true);
    });
  });
});

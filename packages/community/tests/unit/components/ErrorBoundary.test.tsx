/**
 * ErrorBoundary Component Tests
 * Tests for React error boundary with fallback UI
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ error }: { error?: Error }) => {
  if (error) {
    throw error;
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Suppress console.error in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('normal operation', () => {
    it('should render children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child content')).toBeTruthy();
    });

    it('should not show error UI when no error', () => {
      render(
        <ErrorBoundary>
          <div>Normal content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText('Something went wrong')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should catch and display error', () => {
      const error = new Error('Test error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('should call onError callback', () => {
      const onError = jest.fn();
      const error = new Error('Test error');

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should log error to console', () => {
      const error = new Error('Test error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorBoundary]'),
        error,
        expect.any(Object)
      );
    });
  });

  describe('fallback UI', () => {
    it('should show detailed fallback by default', () => {
      const error = new Error('Detailed error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByText('Try again')).toBeTruthy();
      expect(screen.getByText('Reload page')).toBeTruthy();
    });

    it('should show minimal fallback when specified', () => {
      const error = new Error('Minimal error');

      render(
        <ErrorBoundary fallbackComponent="minimal">
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByText('Try again')).toBeTruthy();
      expect(screen.queryByText('Reload page')).toBeNull();
    });

    it('should use custom fallback when provided', () => {
      const error = new Error('Custom error');
      const customFallback = (err: Error) => <div>Custom: {err.message}</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom: Custom error')).toBeTruthy();
    });

    it('should show error details in expandable section', () => {
      const error = new Error('Error with stack');
      error.stack = 'Error stack trace';

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error details')).toBeTruthy();
    });
  });

  describe('reset functionality', () => {
    it('should provide reset function to custom fallback', () => {
      const error = new Error('Reset test');
      let resetFn: (() => void) | null = null;

      const customFallback = (_err: Error, _info: any, reset: () => void) => {
        resetFn = reset;
        return <div>Error occurred</div>;
      };

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(resetFn).toBeInstanceOf(Function);
    });

    it('should reset error state when resetKeys change', () => {
      const error = new Error('Reset keys test');
      let resetKeys = ['key1'];

      const { rerender } = render(
        <ErrorBoundary resetKeys={resetKeys}>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      // Update resetKeys
      resetKeys = ['key2'];

      rerender(
        <ErrorBoundary resetKeys={resetKeys}>
          <div>Recovered content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText('Something went wrong')).toBeNull();
      expect(screen.getByText('Recovered content')).toBeTruthy();
    });
  });

  describe('multiple errors', () => {
    it('should handle multiple different errors', () => {
      const error1 = new Error('First error');

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError error={error1} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      const error2 = new Error('Second error');

      rerender(
        <ErrorBoundary>
          <ThrowError error={error2} />
        </ErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });
  });

  describe('nested error boundaries', () => {
    it('should catch errors from nested components', () => {
      const error = new Error('Nested error');

      render(
        <ErrorBoundary>
          <div>
            <div>
              <ThrowError error={error} />
            </div>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('should allow multiple error boundaries', () => {
      const error = new Error('Inner error');

      render(
        <ErrorBoundary fallbackComponent="minimal">
          <div>Outer content</div>
          <ErrorBoundary fallbackComponent="minimal">
            <ThrowError error={error} />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      // Inner boundary should catch the error
      expect(screen.getAllByText('Something went wrong')).toHaveLength(1);
      expect(screen.getByText('Outer content')).toBeTruthy();
    });
  });
});

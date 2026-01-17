/**
 * Error Boundary Component
 * Catches React errors and provides fallback UI with recovery options
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  fallbackComponent?: 'minimal' | 'detailed';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary to catch and handle component errors
 * Prevents full app crashes and provides user-friendly error messages
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if resetKeys change
    if (
      hasError &&
      resetKeys &&
      prevProps.resetKeys &&
      resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
    ) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  renderFallback(): ReactNode {
    const { error, errorInfo } = this.state;
    const { fallback, fallbackComponent = 'detailed' } = this.props;

    // Use custom fallback if provided
    if (fallback && error && errorInfo) {
      return fallback(error, errorInfo, this.reset);
    }

    // Minimal fallback (for small components)
    if (fallbackComponent === 'minimal') {
      return (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#991B1B',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Something went wrong</div>
          <button
            onClick={this.reset}
            style={{
              padding: '4px 12px',
              backgroundColor: '#DC2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginTop: '8px',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    // Detailed fallback (default)
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: '#FEF2F2',
          borderRadius: '8px',
          border: '1px solid #FCA5A5',
          maxWidth: '600px',
          margin: '20px auto',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#991B1B',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>⚠️</span>
            Something went wrong
          </div>
          <p style={{ fontSize: '14px', color: '#7F1D1D', margin: 0, lineHeight: '1.5' }}>
            An unexpected error occurred. This has been logged and you can try again.
          </p>
        </div>

        {error && (
          <details style={{ marginBottom: '16px' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '13px',
                color: '#991B1B',
                fontWeight: 600,
                padding: '8px',
                backgroundColor: '#FEE2E2',
                borderRadius: '4px',
                userSelect: 'none',
              }}
            >
              Error details
            </summary>
            <div
              style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#FEE2E2',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#7F1D1D',
                overflow: 'auto',
                maxHeight: '200px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Error:</div>
              <div style={{ marginBottom: '12px' }}>{error.message}</div>

              {error.stack && (
                <>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Stack trace:</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {error.stack}
                  </pre>
                </>
              )}
            </div>
          </details>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={this.reset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#DC2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#991B1B',
              border: '1px solid #FCA5A5',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return this.renderFallback();
    }

    return children;
  }
}

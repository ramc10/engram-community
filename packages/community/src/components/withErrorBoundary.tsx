/**
 * Higher-Order Component (HOC) to wrap components with Error Boundary
 * Provides automatic error handling and logging for any component
 */

import React, { ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { logBoundaryError } from '../lib/error-logger';

export interface WithErrorBoundaryOptions {
  componentName?: string;
  fallbackComponent?: 'minimal' | 'detailed';
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Wraps a component with an ErrorBoundary
 * @param WrappedComponent - The component to wrap
 * @param options - Configuration options
 * @returns Component wrapped with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
): ComponentType<P> {
  const {
    componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component',
    fallbackComponent = 'detailed',
    onError,
  } = options;

  const ComponentWithErrorBoundary: React.FC<P> = (props) => {
    return (
      <ErrorBoundary
        fallbackComponent={fallbackComponent}
        onError={(error, errorInfo) => {
          // Log to error logger
          logBoundaryError(error, errorInfo, componentName);

          // Call custom error handler if provided
          if (onError) {
            onError(error, errorInfo);
          }
        }}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  // Preserve display name for debugging
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${componentName})`;

  return ComponentWithErrorBoundary;
}

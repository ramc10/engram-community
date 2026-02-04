/**
 * Error types and severity levels
 * Separated from github-reporter to enable tree-shaking
 */

/**
 * Error severity levels mapped to GitHub labels
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Error context for reporting
 */
export interface ErrorContext {
  service?: string;
  operation?: string;
  severity?: ErrorSeverity;
  userAction?: string;
  additionalData?: Record<string, any>;
}

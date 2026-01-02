/**
 * Loading State Components
 * Skeleton loaders and spinners for better UX
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

/**
 * Animated loading spinner
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 24,
  color,
}) => {
  const spinnerColor = color || '#6b7280';

  return (
    <div
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `3px solid #e5e7eb`,
        borderTopColor: spinnerColor,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    >
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

/**
 * Skeleton loader for content placeholders
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
}) => {
  const bgColor = '#e5e7eb';
  const shimmerColor = '#f3f4f6';

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: bgColor,
        backgroundImage: `linear-gradient(90deg, ${bgColor} 0%, ${shimmerColor} 50%, ${bgColor} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    >
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
    </div>
  );
};

interface SkeletonTextProps {
  lines?: number;
}

/**
 * Multi-line skeleton text
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? '60%' : '100%'}
          height="16px"
        />
      ))}
    </div>
  );
};

interface SkeletonCardProps {}

/**
 * Skeleton card for memory/conversation items
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = () => {
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: `1px solid #e5e7eb`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Skeleton width="40px" height="40px" borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="16px" />
          <div style={{ marginTop: '6px' }}>
            <Skeleton width="40%" height="14px" />
          </div>
        </div>
      </div>

      {/* Content */}
      <SkeletonText lines={3} />
    </div>
  );
};

interface LoadingOverlayProps {
  message?: string;
}

/**
 * Full-screen loading overlay
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Loading...',
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <LoadingSpinner size={40} />
      <div
        style={{
          marginTop: '16px',
          fontSize: '14px',
          color: '#6b7280',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {message}
      </div>
    </div>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
}

/**
 * Progress bar component
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 4,
  color,
}) => {
  const barColor = color || '#3b82f6';
  const bgColor = '#e5e7eb';

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: bgColor,
        borderRadius: `${height / 2}px`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, progress))}%`,
          backgroundColor: barColor,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
};

/**
 * Toast Notification Component
 * Displays temporary feedback messages to users
 */

import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getColors = () => {
    const colors = {
      success: {
        bg: '#d1fae5',
        border: '#34d399',
        text: '#065f46',
        icon: '✓',
      },
      error: {
        bg: '#fee2e2',
        border: '#f87171',
        text: '#991b1b',
        icon: '✕',
      },
      warning: {
        bg: '#fef3c7',
        border: '#fbbf24',
        text: '#92400e',
        icon: '⚠',
      },
      info: {
        bg: '#dbeafe',
        border: '#60a5fa',
        text: '#1e40af',
        icon: 'ℹ',
      },
    };
    return colors[type];
  };

  const colors = getColors();

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 10000,
        minWidth: '280px',
        maxWidth: '400px',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'slideIn 0.3s ease-out',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>

      {/* Icon */}
      <div
        style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: colors.text,
          flexShrink: 0,
        }}
      >
        {colors.icon}
      </div>

      {/* Message */}
      <div
        style={{
          flex: 1,
          fontSize: '14px',
          color: colors.text,
          lineHeight: '1.4',
        }}
      >
        {message}
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text,
          fontSize: '18px',
          cursor: 'pointer',
          padding: '0',
          lineHeight: '1',
          opacity: 0.7,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
};

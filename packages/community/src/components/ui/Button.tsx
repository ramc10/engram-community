/**
 * Button Component
 * Reusable button with consistent styling
 */

import React, { CSSProperties } from 'react';
import { LoadingSpinner } from './LoadingStates';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  style,
  ...props
}) => {
  interface VariantStyle {
    backgroundColor: string;
    color: string;
    border: string;
    hover: CSSProperties;
  }

  const getVariantStyles = (): VariantStyle => {
    const variants: Record<ButtonVariant, VariantStyle> = {
      primary: {
        backgroundColor: disabled || isLoading ? '#9ca3af' : '#3b82f6',
        color: '#ffffff',
        border: 'none',
        hover: {
          backgroundColor: '#2563eb',
        },
      },
      secondary: {
        backgroundColor: '#ffffff',
        color: '#374151',
        border: `1px solid #e5e7eb`,
        hover: {
          backgroundColor: '#f3f4f6',
        },
      },
      danger: {
        backgroundColor: '#ffffff',
        color: '#dc2626',
        border: `1px solid #fecaca`,
        hover: {
          backgroundColor: '#fef2f2',
          borderColor: '#f87171',
        },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '#6b7280',
        border: 'none',
        hover: {
          backgroundColor: '#f3f4f6',
        },
      },
    };

    return variants[variant];
  };

  const getSizeStyles = (): CSSProperties => {
    const sizes = {
      sm: {
        padding: '6px 12px',
        fontSize: '13px',
        borderRadius: '4px',
      },
      md: {
        padding: '10px 16px',
        fontSize: '14px',
        borderRadius: '6px',
      },
      lg: {
        padding: '12px 20px',
        fontSize: '16px',
        borderRadius: '8px',
      },
    };

    return sizes[size];
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Extract hover styles separately
  const { hover: hoverStyles, ...variantBaseStyles } = variantStyles;

  const baseStyles: CSSProperties = {
    ...variantBaseStyles,
    ...sizeStyles,
    width: fullWidth ? '100%' : 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: disabled && !isLoading ? 0.6 : 1,
    ...style,
  };

  const [isHovered, setIsHovered] = React.useState(false);

  const currentStyles: CSSProperties = {
    ...baseStyles,
    ...(isHovered && !disabled && !isLoading ? hoverStyles : {}),
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      style={currentStyles}
      onMouseEnter={(e) => {
        setIsHovered(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        props.onMouseLeave?.(e);
      }}
    >
      {isLoading ? (
        <LoadingSpinner size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} color="currentColor" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

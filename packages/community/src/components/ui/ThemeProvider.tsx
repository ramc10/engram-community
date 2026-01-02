/**
 * Theme Provider
 * Provides light theme colors only
 */

import React, { createContext, useContext, ReactNode } from 'react';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderFocus: string;
  primary: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  button: {
    primary: string;
    primaryHover: string;
    primaryText: string;
    secondary: string;
    secondaryHover: string;
    secondaryText: string;
    danger: string;
    dangerHover: string;
    dangerText: string;
  };
  status: {
    success: string;
    successBg: string;
    error: string;
    errorBg: string;
    warning: string;
    warningBg: string;
    info: string;
    infoBg: string;
  };
}

interface ThemeContextValue {
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const colors: ThemeColors = {
  background: '#ffffff',
  surface: '#f9fafb',
  surfaceHover: '#f3f4f6',
  border: '#e5e7eb',
  borderFocus: '#3b82f6',
  primary: '#3b82f6',
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
  },
  button: {
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryText: '#ffffff',
    secondary: '#ffffff',
    secondaryHover: '#f3f4f6',
    secondaryText: '#374151',
    danger: '#ffffff',
    dangerHover: '#fef2f2',
    dangerText: '#dc2626',
  },
  status: {
    success: '#059669',
    successBg: '#d1fae5',
    error: '#dc2626',
    errorBg: '#fee2e2',
    warning: '#f59e0b',
    warningBg: '#fef3c7',
    info: '#3b82f6',
    infoBg: '#dbeafe',
  },
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const value: ThemeContextValue = {
    colors,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Login Page Component
 * Allows existing users to sign in with email and password
 */

import React, { useState } from 'react';
import { useToast, useTheme, Button, useKeyboardShortcuts, commonShortcuts } from '../../components/ui';
import type { MessageType } from '../../lib/messages';

interface LoginPageProps {
  onSuccess: (userId: string, email: string) => void;
  onSwitchToSignup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onSwitchToSignup,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { success, error } = useToast();
  const { colors } = useTheme();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    commonShortcuts.submit(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }),
  ]);

  const validateForm = (): boolean => {
    if (!email || !password) {
      error('Email and password are required');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      error('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Send login message to background service
      const response = await chrome.runtime.sendMessage({
        type: 'AUTH_LOGIN' as MessageType,
        email,
        password,
      });

      if (response.success && response.userId) {
        success(`Welcome back, ${email.split('@')[0]}!`);
        setTimeout(() => {
          onSuccess(response.userId, response.email);
        }, 500); // Small delay to show success toast
      } else {
        error(response.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AUTH_LOGIN_GOOGLE' as MessageType,
      });

      if (response.success && response.userId) {
        success('Signed in with Google!');
        setTimeout(() => {
          onSuccess(response.userId, response.email);
        }, 500);
      } else {
        error(response.error || 'Google sign-in failed. Please try again.');
      }
    } catch (err) {
      console.error('Google login error:', err);
      error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '400px',
        minHeight: '500px',
        backgroundColor: colors.background,
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: '8px',
          }}
        >
          Welcome Back
        </h1>
        <p style={{ fontSize: '14px', color: colors.text.secondary }}>
          Sign in to access your saved conversations
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit}>
        {/* Email Input */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: colors.text.primary,
              marginBottom: '6px',
            }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: colors.background,
              color: colors.text.primary,
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.borderFocus;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(59, 130, 246, 0.1)`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Password Input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="password"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: colors.text.primary,
              marginBottom: '6px',
            }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: colors.background,
              color: colors.text.primary,
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.borderFocus;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(59, 130, 246, 0.1)`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          isLoading={isLoading}
          disabled={isLoading}
        >
          Sign In
        </Button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
          <span style={{ fontSize: '12px', color: colors.text.secondary }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: '#ffffff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#c6c6c6';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#dadce0';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fillRule="evenodd">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </g>
          </svg>
          Sign in with Google
        </button>
      </form>

      {/* Privacy Reminder */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: colors.status.infoBg,
          borderRadius: '6px',
          fontSize: '12px',
          color: colors.status.info,
          lineHeight: '1.5',
          border: `1px solid transparent`,
        }}
      >
        <strong>🔒 Secure:</strong> Your password derives your encryption key
        locally. We never store or transmit your plaintext data.
      </div>

      {/* Switch to Signup */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <span style={{ fontSize: '13px', color: colors.text.secondary }}>
          Don&apos;t have an account?{' '}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSwitchToSignup}
          disabled={isLoading}
        >
          Create account
        </Button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: colors.text.tertiary }}>
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to sign in
        </div>
      </div>

      {/* Forgot Password (future) */}
      <div style={{ marginTop: '12px', textAlign: 'center' }}>
        <button
          disabled
          style={{
            background: 'none',
            border: 'none',
            color: colors.text.tertiary,
            fontSize: '12px',
            cursor: 'not-allowed',
            padding: 0,
          }}
        >
          Forgot password? (Coming soon)
        </button>
      </div>
    </div>
  );
};

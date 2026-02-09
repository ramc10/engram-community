/**
 * Authentication View Component
 * Login and signup form for the side panel
 */

import React, { useState } from 'react';
import { useToast, Button, Logo } from './ui';

interface AuthenticationViewProps {
  onSuccess: () => void;
  colors: any;
}

export function AuthenticationView({ onSuccess, colors }: AuthenticationViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      error('Email and password are required');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: isLogin ? 'AUTH_LOGIN' : 'AUTH_SIGNUP',
        email,
        password,
      });

      if (response.success) {
        success(isLogin ? 'Logged in successfully!' : 'Account created!');
        setTimeout(onSuccess, 500);
      } else {
        error(response.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Auth error:', err);
      error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AUTH_LOGIN_GOOGLE',
      });

      if (response.success) {
        success('Signed in with Google!');
        setTimeout(onSuccess, 500);
      } else {
        error(response.error || 'Google sign-in failed');
      }
    } catch (err) {
      console.error('Google auth error:', err);
      error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: colors.background,
    color: colors.text.primary,
  };

  const labelStyle = {
    display: 'block' as const,
    fontSize: '12px',
    fontWeight: 600,
    color: colors.text.primary,
    marginBottom: '6px',
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: colors.background,
    }}>
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            <Logo size={48} />
          </div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: '4px'
          }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ fontSize: '13px', color: colors.text.secondary }}>
            {isLogin ? 'Sign in to access your memories' : 'Start saving your AI conversations'}
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            style={inputStyle}
          />
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              style={inputStyle}
            />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          isLoading={isLoading}
          disabled={isLoading}
        >
          {isLogin ? 'Sign In' : 'Create Account'}
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: '8px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
          <span style={{ fontSize: '11px', color: colors.text.secondary }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            backgroundColor: '#ffffff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#c6c6c6';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#dadce0';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fillRule="evenodd">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </g>
          </svg>
          {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
        </button>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: colors.text.secondary }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </span>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}

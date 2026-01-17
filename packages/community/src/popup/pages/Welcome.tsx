/**
 * Welcome Screen Component
 * First-time user experience offering offline or cloud sync options
 */

import React from 'react';
import { Logo, Button, useTheme } from '../../components/ui';
import { withErrorBoundary } from '../../components';

interface WelcomeProps {
  onContinueOffline: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

const WelcomeComponent: React.FC<WelcomeProps> = ({
  onContinueOffline,
  onSignUp,
  onSignIn,
}) => {
  const { colors } = useTheme();

  return (
    <div
      style={{
        width: '400px',
        minHeight: '500px',
        backgroundColor: colors.background,
        padding: '32px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Logo and Heading */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <Logo size={72} />
        </div>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: '8px',
            margin: 0,
          }}
        >
          Welcome to Engram
        </h1>
        <p style={{ fontSize: '15px', color: colors.text.secondary, margin: 0 }}>
          Your private AI conversation memory
        </p>
      </div>

      {/* Primary Action - Continue Offline */}
      <div style={{ width: '100%', marginBottom: '24px' }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinueOffline}
          style={{ marginBottom: '12px' }}
        >
          Continue Offline
        </Button>
        <div
          style={{
            textAlign: 'center',
            fontSize: '13px',
            color: colors.text.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '16px' }}>✓</span> No account needed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '16px' }}>✓</span> Works immediately
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          margin: '24px 0',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
        <span style={{ fontSize: '13px', color: colors.text.tertiary }}>
          or enable cloud sync
        </span>
        <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
      </div>

      {/* Secondary Actions - Cloud Sync */}
      <div style={{ width: '100%', marginBottom: '24px' }}>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={onSignUp}
          style={{ marginBottom: '12px' }}
        >
          Create Account
        </Button>
        <Button variant="ghost" size="md" fullWidth onClick={onSignIn}>
          Sign In
        </Button>
      </div>

      {/* Cloud Sync Benefits */}
      <div
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: colors.status.infoBg,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text.primary, marginBottom: '8px' }}>
          Cloud Sync Benefits:
        </div>
        <ul
          style={{
            fontSize: '13px',
            color: colors.text.secondary,
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '1.6',
          }}
        >
          <li>Access memories from any device</li>
          <li>Automatic backup to cloud</li>
          <li>End-to-end encrypted sync</li>
        </ul>
      </div>

      {/* Privacy Note */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p
          style={{
            fontSize: '12px',
            color: colors.text.tertiary,
            lineHeight: '1.5',
            margin: 0,
          }}
        >
          Both modes are fully private. Offline mode keeps data on your device only.
          Cloud sync encrypts data before uploading.
        </p>
      </div>
    </div>
  );
};

// Wrap with error boundary for automatic error handling
export const Welcome = withErrorBoundary(WelcomeComponent, {
  componentName: "Welcome",
  fallbackComponent: "detailed",
});

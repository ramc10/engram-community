import React, { useState } from 'react';
import { Button } from './ui';

interface UpgradeBannerProps {
  onUpgrade: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * UpgradeBanner - Prompts free users to upgrade to premium
 *
 * Shows benefits of premium tier and upgrade button
 * Can be dismissed by user
 */
export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({
  onUpgrade,
  className,
  style,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)',
        padding: '16px',
        color: 'white',
        borderRadius: '8px',
        margin: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.2',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: '1' }}>☁️</span>
              <span>Upgrade to Premium</span>
            </div>
            <div
              style={{
                fontSize: '13px',
                opacity: 0.9,
                lineHeight: '1.4',
                paddingLeft: '28px',
              }}
            >
              Sync across devices • Cloud backup
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              opacity: 0.7,
              transition: 'opacity 0.2s',
              flexShrink: 0,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '0.7';
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            paddingLeft: '28px',
          }}
        >
          <button
            onClick={onUpgrade}
            style={{
              backgroundColor: 'white',
              color: '#1a1a1a',
              fontWeight: 600,
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
};

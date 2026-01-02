import React from 'react';

interface PremiumBadgeProps {
  isPremium: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * PremiumBadge - Displays premium status badge
 *
 * Shows a green bordered badge with transparent background for premium users
 * Returns null for free users
 */
export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  isPremium,
  className,
  style,
}) => {
  if (!isPremium) return null;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        background: 'transparent',
        border: '1.5px solid #10B981',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#10B981',
        letterSpacing: '0.5px',
        ...style,
      }}
    >
      <span>PREMIUM</span>
    </div>
  );
};

/**
 * Engram Logo Component
 * Uses the engram-logo.png from assets
 */

import React from 'react';
import iconUrl from 'data-base64:~assets/engram-logo.png';

export interface LogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps> = ({
  size = 24,
  className,
  style
}) => {
  return (
    <img
      src={iconUrl}
      width={size}
      height={size}
      alt="Engram"
      className={className}
      style={{
        borderRadius: '6px',
        ...style
      }}
    />
  );
};

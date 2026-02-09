/**
 * Platform Logo Component
 * Displays platform-specific icons for ChatGPT, Claude, Perplexity, and Gemini
 */

import React from 'react';

interface PlatformLogoProps {
  platform?: string;
}

export function PlatformLogo({ platform }: PlatformLogoProps) {
  if (!platform) return null;

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
  };

  switch (platform.toLowerCase()) {
    case 'chatgpt':
      return (
        <div style={style}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
          </svg>
          <span>ChatGPT</span>
        </div>
      );
    case 'claude':
      return (
        <div style={style}>
          <svg width="12" height="12" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="24" height="24" rx="5" fill="#CC9B7A"/>
            <path d="M19.5 8L17 15.5L22.5 18L17 20.5L19.5 28L15 22L10.5 28L13 20.5L7.5 18L13 15.5L10.5 8L15 14L19.5 8Z" fill="#1A1A1A"/>
          </svg>
          <span>Claude</span>
        </div>
      );
    case 'perplexity':
      return (
        <div style={style}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#20808D"/>
            <path d="M12 7V12M12 12V17M12 12H7M12 12H17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>Perplexity</span>
        </div>
      );
    case 'gemini':
      return (
        <div style={style}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#4285F4"/>
            <path d="M12 6L14.5 10.5L19 12L14.5 13.5L12 18L9.5 13.5L5 12L9.5 10.5L12 6Z" fill="white"/>
          </svg>
          <span>Gemini</span>
        </div>
      );
    default:
      return <span style={{ fontSize: '10px' }}>{platform}</span>;
  }
}

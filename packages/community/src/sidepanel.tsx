/**
 * Engram Side Panel
 * Native Chrome side panel for memory management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, ToastProvider, useToast, useTheme, Logo } from './components/ui';
import { PremiumBadge, UpgradeBanner, ErrorBoundary, AuthenticationView, MemoriesTab, SettingsTab } from './components';
import type { MessageType } from './lib/messages';
import type { Memory } from '@engram/core';
import { logBoundaryError } from './lib/error-logger';

type Tab = 'memories' | 'settings';

function SidePanelContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('memories');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Premium tier state
  const [isPremium, setIsPremium] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const { success, error: showError } = useToast();
  const { colors } = useTheme();

  const checkAuthState = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_AUTH_STATE' as MessageType,
      });

      if (response.success && response.authState) {
        setIsAuthenticated(response.authState.isAuthenticated);
        setUserId(response.authState.userId || '');
        setEmail(response.authState.email || '');
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to check auth state:', err);
    }
  }, []);

  const checkPremiumStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PREMIUM_STATUS' as MessageType,
      });

      if (response.success && response.status) {
        setIsPremium(response.status.isPremium);
        setSyncEnabled(response.status.syncEnabled);
        setHasPendingRequest(response.status.hasPendingRequest || false);
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to check premium status:', err);
    }
  }, []);

  const loadMemories = useCallback(async () => {
    setIsLoadingMemories(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MEMORIES' as MessageType,
        filter: {
          limit: 1000,
        },
      });

      if (response.success && response.memories) {
        setMemories(response.memories);
        setLastRefreshTime(new Date());
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to load memories:', err);
      showError('Failed to load memories');
    } finally {
      setIsLoadingMemories(false);
    }
  }, [showError]);

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  // Load memories when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadMemories();
      checkPremiumStatus();
    }
  }, [isAuthenticated, loadMemories, checkPremiumStatus]);

  // Auto-refresh memories every 10 seconds
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'memories') {
      return;
    }

    const intervalId = setInterval(() => {
      loadMemories();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, activeTab, loadMemories]);

  const handleUpgrade = async () => {
    const confirmed = window.confirm(
      'Request Premium Access\n\n' +
      'Your upgrade request will be submitted for review.\n\n' +
      'The founder will review and grant you access shortly.\n\n' +
      'Click OK to continue.'
    );

    if (!confirmed) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_PREMIUM_UPGRADE' as MessageType,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to submit upgrade request');
      }

      setHasPendingRequest(true);
      success('Upgrade request submitted! You will be notified once approved.');
    } catch (err) {
      console.error('[Engram Side Panel] Failed to submit upgrade request:', err);
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : 'Failed to submit upgrade request';
      showError(errorMessage);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) return;

    setIsLoggingOut(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'AUTH_LOGOUT' as MessageType,
      });

      success('Logged out successfully');
      setTimeout(() => {
        setIsAuthenticated(false);
        setUserId('');
        setEmail('');
        setMemories([]);
      }, 300);
    } catch (err) {
      console.error('[Engram Side Panel] Logout error:', err);
      showError('Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: colors.background,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!isAuthenticated ? (
        <AuthenticationView onSuccess={checkAuthState} colors={colors} />
      ) : (
        <>
          {/* Header with Tabs */}
          <div
            style={{
              borderBottom: `1px solid ${colors.border}`,
              backgroundColor: colors.background,
            }}
          >
            <div style={{ padding: '16px 16px 0 16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Logo size={32} />
                  <PremiumBadge isPremium={isPremium} />
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '4px', padding: '0 16px' }}>
              {(['memories', 'settings'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === tab ? colors.primary : colors.text.secondary,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab ? colors.primary : 'transparent'}`,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Upgrade Banner for Free Users */}
          {!isPremium && !hasPendingRequest && <UpgradeBanner onUpgrade={handleUpgrade} />}

          {/* Pending Request Message */}
          {!isPremium && hasPendingRequest && (
            <div style={{
              background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)',
              padding: '16px',
              color: 'white',
              borderRadius: '8px',
              margin: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
              position: 'relative',
            }}>
              <button
                onClick={checkPremiumStatus}
                title="Check approval status"
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'rotate(0deg)';
                }}
              >
                Refresh
              </button>
              <div style={{ fontSize: '14px', marginBottom: '4px', fontWeight: 600 }}>
                Upgrade Request Pending
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Your premium upgrade request has been submitted. You&apos;ll be notified once approved.
              </div>
            </div>
          )}

          {/* Content Area */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'memories' ? (
              <ErrorBoundary
                fallbackComponent="minimal"
                onError={(error, errorInfo) => {
                  logBoundaryError(error, errorInfo, 'MemoriesTab');
                }}
              >
                <MemoriesTab
                  memories={memories}
                  isLoadingMemories={isLoadingMemories}
                  lastRefreshTime={lastRefreshTime}
                  onReloadMemories={loadMemories}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary
                fallbackComponent="minimal"
                onError={(error, errorInfo) => {
                  logBoundaryError(error, errorInfo, 'SettingsTab');
                }}
              >
                <SettingsTab
                  email={email}
                  userId={userId}
                  isPremium={isPremium}
                  syncEnabled={syncEnabled}
                  hasPendingRequest={hasPendingRequest}
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                  onCheckPremiumStatus={checkPremiumStatus}
                  onUpgrade={handleUpgrade}
                />
              </ErrorBoundary>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SidePanel() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logBoundaryError(error, errorInfo, 'SidePanel');
      }}
    >
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary
            fallbackComponent="detailed"
            onError={(error, errorInfo) => {
              logBoundaryError(error, errorInfo, 'SidePanelContent');
            }}
          >
            <SidePanelContent />
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default SidePanel;

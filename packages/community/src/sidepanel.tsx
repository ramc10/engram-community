/**
 * Engram Side Panel
 * Native Chrome side panel for memory management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, ToastProvider, useToast, useTheme, Logo } from './components/ui';
import { ErrorBoundary, AuthenticationView, MemoriesTab, SettingsTab } from './components';
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
    }
  }, [isAuthenticated, loadMemories]);

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
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
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

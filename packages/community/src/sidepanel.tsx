/**
 * Engram Side Panel
 * Native Chrome side panel for memory management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, ToastProvider, useToast, useTheme, Button, Logo } from './components/ui';
import { PremiumBadge, UpgradeBanner, ErrorBoundary } from './components';
import type { MessageType } from './lib/messages';
import type { Memory, EnrichmentConfig } from '@engram/core';
import { getEmbeddingService, type MemoryWithEmbedding } from './lib/embedding-service';
import { formatDate, summarizeText } from './lib/formatters';
import { encryptApiKey, decryptApiKey, isEncrypted } from './lib/api-key-crypto';
import { logBoundaryError } from './lib/error-logger';

interface AuthenticationViewProps {
  onSuccess: () => void;
  colors: any;
}

function AuthenticationView({ onSuccess, colors }: AuthenticationViewProps) {
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
        type: (isLogin ? 'AUTH_LOGIN' : 'AUTH_SIGNUP') as MessageType,
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
        type: 'AUTH_LOGIN_GOOGLE' as MessageType,
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
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '6px'
          }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: colors.background,
              color: colors.text.primary,
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '6px'
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: colors.background,
              color: colors.text.primary,
            }}
          />
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: colors.text.primary,
              marginBottom: '6px'
            }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: colors.background,
                color: colors.text.primary,
              }}
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

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: '8px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
          <span style={{ fontSize: '11px', color: colors.text.secondary }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }}></div>
        </div>

        {/* Google Auth Button */}
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

/**
 * Platform logo component
 */
function PlatformLogo({ platform }: { platform?: string }) {
  if (!platform) return null;

  const style = {
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
    default:
      return <span style={{ fontSize: '10px' }}>{platform}</span>;
  }
}

type Tab = 'memories' | 'settings';

function SidePanelContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesWithEmbeddings, setMemoriesWithEmbeddings] = useState<MemoryWithEmbedding[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [isPreparingEmbeddings, setIsPreparingEmbeddings] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('memories');
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [semanticSearchResults, setSemanticSearchResults] = useState<Memory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<number | null>(null);
  const [showTimelineForMemory, setShowTimelineForMemory] = useState<string | null>(null);

  // Premium tier state
  const [isPremium, setIsPremium] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isTogglingSync, setIsTogglingSync] = useState(false);

  // Enrichment config state
  const [enrichmentConfig, setEnrichmentConfig] = useState<EnrichmentConfig>({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    batchSize: 5,
    enableLinkDetection: false,
  });
  const [isUpdatingEnrichment, setIsUpdatingEnrichment] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const { success, error: showError } = useToast();
  const { colors } = useTheme();
  const embeddingService = getEmbeddingService();

  // Helper function to get color for confidence scores
  const getConfidenceColor = (score: number): string => {
    if (score >= 0.9) return colors.status.success;  // Dark green for 90-100%
    if (score >= 0.8) return colors.status.info;     // Blue for 80-89%
    if (score >= 0.7) return colors.status.warning;  // Orange for 70-79%
    return colors.text.tertiary;                      // Gray for <70%
  };

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

  const loadEnrichmentConfig = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get('enrichmentConfig');
      if (result.enrichmentConfig) {
        const config = result.enrichmentConfig;

        // Decrypt API key if present and encrypted
        if (config.apiKey && isEncrypted(config.apiKey)) {
          try {
            config.apiKey = await decryptApiKey(config.apiKey);
          } catch (err) {
            console.error('[Engram Side Panel] Failed to decrypt API key:', err);
            config.apiKey = '';
          }
        }

        setEnrichmentConfig(config);
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to load enrichment config:', err);
    }
  }, []);

  // Pre-compute embeddings for all memories
  const precomputeEmbeddings = useCallback(async (memoriesToEmbed: Memory[]) => {
    if (memoriesToEmbed.length === 0) return;

    setIsPreparingEmbeddings(true);
    setEmbeddingProgress({ current: 0, total: memoriesToEmbed.length });
    console.log('[Engram Sidepanel] Pre-computing embeddings for', memoriesToEmbed.length, 'memories...');

    try {
      // Initialize embedding service
      await embeddingService.initialize();

      // Generate embeddings for all memories with progress tracking
      const embedded = await embeddingService.embedMemories(
        memoriesToEmbed,
        (current, total) => {
          setEmbeddingProgress({ current, total });
        }
      );
      setMemoriesWithEmbeddings(embedded);

      console.log('[Engram Sidepanel] Embeddings ready!');
    } catch (error) {
      console.error('[Engram Sidepanel] Failed to pre-compute embeddings:', error);
    } finally {
      setIsPreparingEmbeddings(false);
      setEmbeddingProgress(null);
    }
  }, [embeddingService]);

  const loadMemories = useCallback(async () => {
    setIsLoadingMemories(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MEMORIES' as MessageType,
        filter: {
          limit: 1000, // Load up to 1000 memories - all your conversations available
        },
      });

      if (response.success && response.memories) {
        setMemories(response.memories);
        setLastRefreshTime(new Date());

        // Pre-compute embeddings in background for better search performance
        precomputeEmbeddings(response.memories);
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to load memories:', err);
      showError('Failed to load memories');
    } finally {
      setIsLoadingMemories(false);
    }
  }, [showError, precomputeEmbeddings]);

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  // Load memories when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadMemories();
      checkPremiumStatus();
      loadEnrichmentConfig();
    }
  }, [isAuthenticated, loadMemories, checkPremiumStatus, loadEnrichmentConfig]);

  // Auto-refresh memories every 10 seconds
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'memories') {
      return;
    }

    const intervalId = setInterval(() => {
      loadMemories();
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [isAuthenticated, activeTab, loadMemories]);

  const updateEnrichmentConfig = async (updates: Partial<EnrichmentConfig>) => {
    setIsUpdatingEnrichment(true);
    try {
      const newConfig = { ...enrichmentConfig, ...updates };

      // Encrypt API key before storage if present
      const configToStore = { ...newConfig };
      if (configToStore.apiKey && configToStore.apiKey.trim().length > 0) {
        try {
          configToStore.apiKey = await encryptApiKey(configToStore.apiKey);
        } catch (err) {
          console.error('[Engram Side Panel] Failed to encrypt API key:', err);
          showError('Failed to encrypt API key');
          setIsUpdatingEnrichment(false);
          return;
        }
      }

      await chrome.storage.local.set({ enrichmentConfig: configToStore });
      setEnrichmentConfig(newConfig); // Keep decrypted version in state

      // Notify background service to reinitialize enrichment
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'REINITIALIZE_ENRICHMENT' as MessageType,
        });

        if (response.success) {
          console.log('[Engram Side Panel] Enrichment services reinitialized');
        } else {
          console.warn('[Engram Side Panel] Failed to reinitialize enrichment:', response.error);
        }
      } catch (err) {
        console.warn('[Engram Side Panel] Failed to send reinitialize message:', err);
        // Don't block the update if reinitialize fails
      }

      success('Enrichment settings updated');
    } catch (err) {
      console.error('[Engram Side Panel] Failed to update enrichment config:', err);
      showError('Failed to update settings');
    } finally {
      setIsUpdatingEnrichment(false);
    }
  };

  const handleToggleEnrichment = () => {
    // For local models, we don't need an API key, just the endpoint
    if (!enrichmentConfig.enabled) {
      if (enrichmentConfig.provider === 'local') {
        if (!enrichmentConfig.localEndpoint) {
          showError('Please set a local endpoint first');
          return;
        }
      } else {
        if (!enrichmentConfig.apiKey) {
          showError('Please set an API key first');
          return;
        }
      }
    }
    updateEnrichmentConfig({ enabled: !enrichmentConfig.enabled });
  };

  const estimateMonthlyCost = () => {
    // Local models are free (no API costs)
    if (enrichmentConfig.provider === 'local') {
      return '0.00';
    }
    // Estimate based on 100 memories/month @ $0.00005 per memory
    const avgMemoriesPerMonth = 100;
    const costPerMemory = 0.00005;
    return (avgMemoriesPerMonth * costPerMemory).toFixed(4);
  };

  const handleUpgrade = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      '💬 Request Premium Access\n\n' +
      'Your upgrade request will be submitted for review.\n\n' +
      'The founder will review and grant you access shortly.\n\n' +
      'Click OK to continue.'
    );

    if (!confirmed) {
      return;
    }

    try {
      // Send message to background script to handle upgrade request
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_PREMIUM_UPGRADE' as MessageType,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to submit upgrade request');
      }

      // Immediately update UI to show pending state
      setHasPendingRequest(true);

      // Show success message
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

  const handleToggleSync = async () => {
    if (!isPremium) {
      showError('Premium subscription required for cloud sync');
      return;
    }

    setIsTogglingSync(true);

    try {
      const messageType = syncEnabled ? 'STOP_CLOUD_SYNC' : 'START_CLOUD_SYNC';

      const response = await chrome.runtime.sendMessage({
        type: messageType as MessageType,
      });

      if (response.success) {
        setSyncEnabled(!syncEnabled);
        success(syncEnabled ? 'Cloud sync disabled' : 'Cloud sync enabled');
      } else {
        showError(response.error || 'Failed to toggle sync');
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to toggle sync:', err);
      showError('Failed to toggle sync');
    } finally {
      setIsTogglingSync(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

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

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    success('User ID copied to clipboard');
  };

  // Handle reverting memory evolution to a specific version
  const handleRevertEvolution = async (memoryId: string, versionIndex: number) => {
    if (!confirm('Revert to this version? This will update the memory\'s keywords, tags, and context.')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REVERT_EVOLUTION' as MessageType,
        memoryId,
        versionIndex,
      });

      if (response.success) {
        success('Memory reverted successfully');
        // Reload memories to show updated state
        loadMemories();
      } else {
        showError(response.error || 'Failed to revert memory');
      }
    } catch (err) {
      console.error('[Engram Side Panel] Failed to revert evolution:', err);
      showError('Failed to revert memory');
    }
  };

  // Perform semantic search
  const performSemanticSearch = async (query: string) => {
    if (!query || query.length < 3) {
      setSemanticSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      // Use pre-computed embeddings if available
      if (memoriesWithEmbeddings.length > 0) {
        console.log('[Engram Sidepanel] Using pre-computed embeddings for search');

        // Find similar memories using cached embeddings
        const results = await embeddingService.findSimilar(query, memoriesWithEmbeddings, {
          threshold: 0.2, // Lower threshold for search (more results)
          maxResults: 50, // More results for search
        });

        // Extract just the memories
        const searchResults = results.map(r => r.memory);
        setSemanticSearchResults(searchResults);
      } else {
        console.log('[Engram Sidepanel] Embeddings not ready, using text search');
        // Fallback to text search if embeddings aren't ready yet
        const textResults = memories.filter((memory) => {
          const q = query.toLowerCase();
          return (
            memory.content.text?.toLowerCase().includes(q) ||
            memory.conversationId?.toLowerCase().includes(q)
          );
        });
        setSemanticSearchResults(textResults);
      }
    } catch (error) {
      console.error('[Engram Sidepanel] Semantic search failed:', error);
      // Fallback to text search
      const textResults = memories.filter((memory) => {
        const q = query.toLowerCase();
        return (
          memory.content.text?.toLowerCase().includes(q) ||
          memory.conversationId?.toLowerCase().includes(q)
        );
      });
      setSemanticSearchResults(textResults);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input with debouncing
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);

    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Debounce semantic search
    if (value && value.length >= 3) {
      const timer = window.setTimeout(() => {
        performSemanticSearch(value);
      }, 500);
      setSearchDebounceTimer(timer);
    } else {
      setSemanticSearchResults([]);
      setIsSearching(false);
    }
  };

  // Filter memories based on search
  const filteredMemories = searchQuery && searchQuery.length >= 3
    ? semanticSearchResults
    : memories.filter((memory) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          memory.content.text?.toLowerCase().includes(query) ||
          memory.conversationId?.toLowerCase().includes(query)
        );
      });


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
                🔄
              </button>
              <div style={{ fontSize: '14px', marginBottom: '4px', fontWeight: 600 }}>
                ⏳ Upgrade Request Pending
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Your premium upgrade request has been submitted. You&apos;ll be notified once approved.
              </div>
            </div>
          )}

          {/* Content Area */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'memories' ? (
              <>
                {/* Search Bar */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
                  <input
                    type="text"
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.text.primary,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Memories Count and Auto-refresh Status */}
                <div style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: colors.text.secondary,
                  borderBottom: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    {filteredMemories.length} {filteredMemories.length === 1 ? 'memory' : 'memories'}
                    {searchQuery && ` matching "${searchQuery}"`}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: colors.text.tertiary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {isPreparingEmbeddings && embeddingProgress ? (
                      <>⚡ Preparing search... ({embeddingProgress.current}/{embeddingProgress.total})</>
                    ) : isPreparingEmbeddings ? (
                      <>⚡ Preparing search...</>
                    ) : isSearching ? (
                      <>🔍 Searching...</>
                    ) : isLoadingMemories ? (
                      <>🔄 Refreshing...</>
                    ) : lastRefreshTime ? (
                      <>✓ Auto-refresh active</>
                    ) : null}
                  </div>
                </div>

                {/* Memories List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  {isLoadingMemories ? (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: colors.text.secondary,
                      fontSize: '13px',
                    }}>
                      Loading memories...
                    </div>
                  ) : filteredMemories.length === 0 ? (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: colors.text.secondary,
                      fontSize: '13px',
                    }}>
                      {searchQuery ? 'No memories found' : 'No memories saved yet. Start chatting!'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredMemories.map((memory) => {
                        const isExpanded = expandedMemoryId === memory.id;
                        return (
                        <div
                          key={memory.id}
                          id={`memory-${memory.id}`}
                          style={{
                            padding: '12px',
                            backgroundColor: colors.surface,
                            borderRadius: '8px',
                            border: `1px solid ${colors.border}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => setExpandedMemoryId(isExpanded ? null : memory.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = colors.primary;
                            e.currentTarget.style.backgroundColor = colors.surfaceHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = colors.border;
                            e.currentTarget.style.backgroundColor = colors.surface;
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}>
                              {/* Platform Badge */}
                              {memory.platform && (
                                <div style={{
                                  color: colors.text.secondary,
                                }}>
                                  <PlatformLogo platform={memory.platform} />
                                </div>
                              )}
                              {/* Evolution Badge */}
                              {(() => {
                                const memoryWithEvolution = memory as any;
                                return memoryWithEvolution.evolution && memoryWithEvolution.evolution.updateCount > 0 && (
                                  <div style={{
                                    fontSize: '9px',
                                    color: '#9333ea',
                                    backgroundColor: '#f3e8ff',
                                    padding: '2px 6px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    border: '1px solid #e9d5ff',
                                  }}>
                                    Evolved {memoryWithEvolution.evolution.updateCount}x
                                  </div>
                                );
                              })()}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: colors.text.tertiary,
                            }}>
                              {formatDate(memory.timestamp)}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: colors.text.primary,
                            lineHeight: '1.5',
                            marginBottom: '6px',
                            ...(isExpanded ? {} : {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              maxHeight: '60px',
                            }),
                          }}>
                            {isExpanded ? (memory.content.text || '') : summarizeText(memory.content.text || '')}
                          </div>

                          {/* Related Memories Section */}
                          {(() => {
                            const memoryWithLinks = memory as any;
                            return memoryWithLinks.links && memoryWithLinks.links.length > 0 && (
                              <div style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: `1px solid ${colors.border}`,
                              }}>
                                <div style={{
                                  fontSize: '11px',
                                  color: colors.text.secondary,
                                  marginBottom: '8px',
                                  fontWeight: 600,
                                }}>
                                  Related Memories ({memoryWithLinks.links.length})
                                </div>

                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '6px',
                                }}>
                                  {memoryWithLinks.links.slice(0, 5).map((link: any) => {
                                    const linkedMemory = memories.find(m => m.id === link.memoryId);
                                    if (!linkedMemory) return null;

                                    return (
                                      <div
                                        key={link.memoryId}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Scroll to and expand linked memory
                                          setExpandedMemoryId(link.memoryId);
                                          // Scroll into view
                                          setTimeout(() => {
                                            const element = document.getElementById(`memory-${link.memoryId}`);
                                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          }, 100);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '4px 8px',
                                          fontSize: '10px',
                                          backgroundColor: colors.surface,
                                          border: `1px solid ${colors.border}`,
                                          borderRadius: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = colors.status.infoBg;
                                          e.currentTarget.style.borderColor = colors.status.info;
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = colors.surface;
                                          e.currentTarget.style.borderColor = colors.border;
                                        }}
                                      >
                                        {/* Link icon */}
                                        <span style={{ opacity: 0.6 }}>🔗</span>

                                        {/* Truncated text preview */}
                                        <span style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '150px',
                                        }}>
                                          {(linkedMemory.content.text || '').slice(0, 40)}...
                                        </span>

                                        {/* Confidence score */}
                                        <span style={{
                                          fontSize: '9px',
                                          padding: '1px 4px',
                                          borderRadius: '4px',
                                          backgroundColor: getConfidenceColor(link.score),
                                          color: 'white',
                                        }}>
                                          {Math.round(link.score * 100)}%
                                        </span>
                                      </div>
                                    );
                                  })}

                                  {/* Show "X more" if more than 5 links */}
                                  {memoryWithLinks.links.length > 5 && (
                                    <div style={{
                                      padding: '4px 8px',
                                      fontSize: '10px',
                                      color: colors.text.tertiary,
                                    }}>
                                      +{memoryWithLinks.links.length - 5} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Evolution History Timeline */}
                          {(() => {
                            const memoryWithEvolution = memory as any;
                            return memoryWithEvolution.evolution && memoryWithEvolution.evolution.history && memoryWithEvolution.evolution.history.length > 0 && (
                              <div style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: `1px solid ${colors.border}`,
                              }}>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '8px',
                                }}>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#9333ea',
                                    fontWeight: 600,
                                  }}>
                                    Evolution History ({memoryWithEvolution.evolution.updateCount} update{memoryWithEvolution.evolution.updateCount !== 1 ? 's' : ''})
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowTimelineForMemory(
                                        showTimelineForMemory === memory.id ? null : memory.id
                                      );
                                    }}
                                    style={{
                                      fontSize: '10px',
                                      color: '#9333ea',
                                      backgroundColor: 'transparent',
                                      border: `1px solid #e9d5ff`,
                                      borderRadius: '4px',
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {showTimelineForMemory === memory.id ? 'Hide Timeline' : 'Show Timeline'}
                                  </button>
                                </div>

                                {showTimelineForMemory === memory.id && (
                                  <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                  }}>
                                    {memoryWithEvolution.evolution.history.map((version: any, index: number) => (
                                      <div
                                        key={index}
                                        style={{
                                          padding: '8px',
                                          backgroundColor: colors.background,
                                          border: `1px solid #e9d5ff`,
                                          borderRadius: '6px',
                                        }}
                                      >
                                        <div style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          marginBottom: '6px',
                                        }}>
                                          <div style={{
                                            fontSize: '9px',
                                            color: colors.text.tertiary,
                                          }}>
                                            Version {index + 1} • {formatDate(version.timestamp)}
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRevertEvolution(memory.id, index);
                                            }}
                                            style={{
                                              fontSize: '9px',
                                              color: '#9333ea',
                                              backgroundColor: '#f3e8ff',
                                              border: `1px solid #e9d5ff`,
                                              borderRadius: '4px',
                                              padding: '2px 6px',
                                              cursor: 'pointer',
                                              fontWeight: 600,
                                            }}
                                          >
                                            Revert
                                          </button>
                                        </div>
                                        <div style={{
                                          fontSize: '11px',
                                          color: colors.text.primary,
                                          marginBottom: '4px',
                                        }}>
                                          {version.context}
                                        </div>
                                        {version.keywords && version.keywords.length > 0 && (
                                          <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            marginBottom: '4px',
                                          }}>
                                            {version.keywords.slice(0, 5).map((keyword: string, ki: number) => (
                                              <span
                                                key={ki}
                                                style={{
                                                  fontSize: '9px',
                                                  color: '#9333ea',
                                                  backgroundColor: '#f3e8ff',
                                                  padding: '2px 6px',
                                                  borderRadius: '8px',
                                                  border: '1px solid #e9d5ff',
                                                }}
                                              >
                                                {keyword}
                                              </span>
                                            ))}
                                            {version.keywords.length > 5 && (
                                              <span style={{
                                                fontSize: '9px',
                                                color: colors.text.tertiary,
                                              }}>
                                                +{version.keywords.length - 5} more
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {version.tags && version.tags.length > 0 && (
                                          <div style={{
                                            fontSize: '9px',
                                            color: colors.text.secondary,
                                          }}>
                                            Tags: {version.tags.join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {/* Current Version Indicator */}
                                    <div style={{
                                      padding: '8px',
                                      backgroundColor: '#f3e8ff',
                                      border: `2px solid #9333ea`,
                                      borderRadius: '6px',
                                      fontSize: '10px',
                                      color: '#9333ea',
                                      fontWeight: 600,
                                      textAlign: 'center',
                                    }}>
                                      Current Version
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Settings Tab */
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px'
              }}>
                {/* Account Section */}
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: colors.surface,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <h2 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.text.primary,
                    marginBottom: '12px',
                  }}>
                    Account
                  </h2>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: colors.text.secondary,
                      marginBottom: '4px',
                    }}>
                      Email
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.text.primary,
                      fontWeight: 500,
                      wordBreak: 'break-all',
                    }}>
                      {email}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '11px',
                      color: colors.text.secondary,
                      marginBottom: '4px',
                    }}>
                      User ID
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: colors.text.secondary,
                      fontFamily: 'monospace',
                      backgroundColor: colors.background,
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${colors.border}`,
                      wordBreak: 'break-all',
                      marginBottom: '8px',
                    }}>
                      {userId}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={copyUserId}
                    >
                      Copy User ID
                    </Button>
                  </div>
                </div>

                {/* Cloud Sync Settings */}
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: colors.surface,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <h2 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.text.primary,
                    marginBottom: '12px',
                  }}>
                    Cloud Sync
                  </h2>

                  {isPremium ? (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}>
                        <div style={{ fontSize: '13px', color: colors.text.primary }}>
                          Enable cloud sync
                        </div>
                        <button
                          onClick={handleToggleSync}
                          disabled={isTogglingSync}
                          style={{
                            position: 'relative',
                            width: '44px',
                            height: '24px',
                            backgroundColor: syncEnabled ? colors.status.success : colors.border,
                            borderRadius: '12px',
                            border: 'none',
                            cursor: isTogglingSync ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            opacity: isTogglingSync ? 0.6 : 1,
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: '3px',
                            left: syncEnabled ? '23px' : '3px',
                            width: '18px',
                            height: '18px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: 'left 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }} />
                        </button>
                      </div>

                      <div style={{ fontSize: '11px', color: colors.text.secondary, lineHeight: '1.5' }}>
                        {syncEnabled
                          ? 'Memories are synced across your devices with end-to-end encryption'
                          : 'Enable to sync memories across devices'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}>
                        <div style={{ fontSize: '13px', color: colors.text.secondary }}>
                          Cloud sync (Premium only)
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: colors.text.tertiary,
                          fontWeight: 600,
                          backgroundColor: colors.background,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${colors.border}`,
                        }}>
                          Disabled
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: colors.text.secondary, lineHeight: '1.5' }}>
                        Upgrade to Premium to sync memories across devices
                      </div>
                    </>
                  )}
                </div>

                {/* Memory Enrichment Settings */}
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: colors.surface,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <h2 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.text.primary,
                    marginBottom: '4px',
                  }}>
                    Memory Enrichment
                  </h2>
                  <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '12px' }}>
                    Use AI to automatically generate keywords, tags, and context
                  </div>

                  {/* Enable/Disable Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}>
                    <div style={{ fontSize: '13px', color: colors.text.primary }}>
                      Enable enrichment
                    </div>
                    <button
                      onClick={handleToggleEnrichment}
                      disabled={isUpdatingEnrichment}
                      style={{
                        position: 'relative',
                        width: '44px',
                        height: '24px',
                        backgroundColor: enrichmentConfig.enabled ? colors.status.success : colors.border,
                        borderRadius: '12px',
                        border: 'none',
                        cursor: isUpdatingEnrichment ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        opacity: isUpdatingEnrichment ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: enrichmentConfig.enabled ? '23px' : '3px',
                        width: '18px',
                        height: '18px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: 'left 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>

                  {/* Link Detection Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    opacity: enrichmentConfig.enabled ? 1 : 0.5,
                  }}>
                    <div style={{ fontSize: '13px', color: colors.text.primary }}>
                      Enable link detection
                    </div>
                    <button
                      onClick={() => updateEnrichmentConfig({ enableLinkDetection: !enrichmentConfig.enableLinkDetection })}
                      disabled={isUpdatingEnrichment || !enrichmentConfig.enabled}
                      style={{
                        position: 'relative',
                        width: '44px',
                        height: '24px',
                        backgroundColor: enrichmentConfig.enableLinkDetection ? colors.status.success : colors.border,
                        borderRadius: '12px',
                        border: 'none',
                        cursor: (isUpdatingEnrichment || !enrichmentConfig.enabled) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        opacity: (isUpdatingEnrichment || !enrichmentConfig.enabled) ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: enrichmentConfig.enableLinkDetection ? '23px' : '3px',
                        width: '18px',
                        height: '18px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: 'left 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                  <div style={{ fontSize: '10px', color: colors.text.tertiary, marginBottom: '12px' }}>
                    Find semantic connections between memories (~$0.001 per link)
                  </div>

                  {/* Memory Evolution Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    opacity: (enrichmentConfig.enabled && enrichmentConfig.enableLinkDetection) ? 1 : 0.5,
                  }}>
                    <div style={{ fontSize: '13px', color: colors.text.primary }}>
                      Enable memory evolution
                    </div>
                    <button
                      onClick={() => updateEnrichmentConfig({ enableEvolution: !enrichmentConfig.enableEvolution })}
                      disabled={isUpdatingEnrichment || !enrichmentConfig.enabled || !enrichmentConfig.enableLinkDetection}
                      style={{
                        position: 'relative',
                        width: '44px',
                        height: '24px',
                        backgroundColor: enrichmentConfig.enableEvolution ? colors.status.success : colors.border,
                        borderRadius: '12px',
                        border: 'none',
                        cursor: (isUpdatingEnrichment || !enrichmentConfig.enabled || !enrichmentConfig.enableLinkDetection) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        opacity: (isUpdatingEnrichment || !enrichmentConfig.enabled || !enrichmentConfig.enableLinkDetection) ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: enrichmentConfig.enableEvolution ? '23px' : '3px',
                        width: '18px',
                        height: '18px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: 'left 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                  <div style={{ fontSize: '10px', color: colors.text.tertiary, marginBottom: '12px' }}>
                    Historical memories update based on new information (~$0.0005 per evolution)
                  </div>

                  {/* Provider Selection */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
                      LLM Provider
                    </div>
                    <select
                      value={enrichmentConfig.provider}
                      onChange={(e) => updateEnrichmentConfig({ provider: e.target.value as 'openai' | 'anthropic' | 'local' | 'premium' })}
                      disabled={isUpdatingEnrichment}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '12px',
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        color: colors.text.primary,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="openai">OpenAI (GPT-4o-mini)</option>
                      <option value="anthropic">Anthropic (Claude 3 Haiku)</option>
                      <option value="premium">Premium API (Engram Cloud)</option>
                      <option value="local">Local Model (Ollama/LM Studio)</option>
                    </select>
                  </div>

                  {/* Model Selection */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
                      Model
                    </div>
                    <select
                      value={enrichmentConfig.model}
                      onChange={(e) => updateEnrichmentConfig({ model: e.target.value })}
                      disabled={isUpdatingEnrichment}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '12px',
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        color: colors.text.primary,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {enrichmentConfig.provider === 'openai' ? (
                        <>
                          <option value="gpt-4o-mini">GPT-4o-mini (recommended)</option>
                          <option value="gpt-4o">GPT-4o</option>
                        </>
                      ) : enrichmentConfig.provider === 'anthropic' ? (
                        <>
                          <option value="claude-3-haiku-20240307">Claude 3 Haiku (recommended)</option>
                          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        </>
                      ) : (
                        <>
                          <option value="llama-3.2-3b-instruct">Llama 3.2 3B Instruct (recommended)</option>
                          <option value="llama3.2">Llama 3.2</option>
                          <option value="mistral">Mistral</option>
                          <option value="qwen2.5">Qwen 2.5</option>
                          <option value="phi3">Phi-3</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Local Endpoint Input (only for local provider) */}
                  {enrichmentConfig.provider === 'local' && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
                        Local Endpoint URL
                      </div>
                      <input
                        type="text"
                        value={enrichmentConfig.localEndpoint || ''}
                        onChange={(e) => updateEnrichmentConfig({ localEndpoint: e.target.value })}
                        placeholder="http://localhost:11434/v1"
                        disabled={isUpdatingEnrichment}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          backgroundColor: colors.background,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          color: colors.text.primary,
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: '10px', color: colors.text.tertiary, marginTop: '4px' }}>
                        OpenAI-compatible endpoint. For Ollama: http://localhost:11434/v1
                      </div>
                    </div>
                  )}

                  {/* API Key Input (only for cloud providers) */}
                  {enrichmentConfig.provider !== 'local' && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
                        {enrichmentConfig.provider === 'premium' ? 'License Key' : 'API Key'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={enrichmentConfig.apiKey || ''}
                          onChange={(e) => updateEnrichmentConfig({ apiKey: e.target.value })}
                          placeholder={
                            enrichmentConfig.provider === 'premium' ? 'engram-lic-...' :
                            enrichmentConfig.provider === 'openai' ? 'sk-...' :
                            'sk-ant-...'
                          }
                          disabled={isUpdatingEnrichment}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            color: colors.text.primary,
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: colors.text.primary,
                          }}
                        >
                          {showApiKey ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                      <div style={{ fontSize: '10px', color: colors.text.tertiary, marginTop: '4px' }}>
                        Encrypted before storage. Get from{' '}
                        {enrichmentConfig.provider === 'openai' ? (
                          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: colors.status.info }}>
                            OpenAI
                          </a>
                        ) : (
                          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: colors.status.info }}>
                            Anthropic
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Batch Size */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
                      Batch Size: {enrichmentConfig.batchSize}
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={enrichmentConfig.batchSize}
                      onChange={(e) => updateEnrichmentConfig({ batchSize: parseInt(e.target.value) })}
                      disabled={isUpdatingEnrichment}
                      style={{
                        width: '100%',
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ fontSize: '10px', color: colors.text.tertiary, marginTop: '2px' }}>
                      Memories to enrich in parallel
                    </div>
                  </div>

                  {/* Cost Estimate */}
                  <div style={{
                    padding: '10px',
                    backgroundColor: colors.background,
                    borderRadius: '6px',
                    border: `1px solid ${colors.border}`,
                  }}>
                    <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '2px' }}>
                      Estimated Cost
                    </div>
                    <div style={{ fontSize: '14px', color: colors.text.primary, fontWeight: 600 }}>
                      ~${estimateMonthlyCost()}/month
                    </div>
                    <div style={{ fontSize: '10px', color: colors.text.tertiary, marginTop: '2px' }}>
                      Based on 100 memories/month
                    </div>
                  </div>
                </div>

                {/* Privacy Info */}
                <div style={{
                  marginBottom: '20px',
                  padding: '12px',
                  backgroundColor: colors.status.infoBg,
                  borderRadius: '8px',
                  border: `1px solid ${colors.status.info}33`,
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.status.info,
                    marginBottom: '6px',
                  }}>
                    🔒 End-to-End Encrypted
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.status.info,
                    lineHeight: '1.5',
                  }}>
                    Your conversations are encrypted on your device before syncing. Your password never leaves your browser.
                  </div>
                </div>

                {/* Logout Button */}
                <Button
                  variant="danger"
                  size="md"
                  fullWidth
                  onClick={handleLogout}
                  isLoading={isLoggingOut}
                  disabled={isLoggingOut}
                >
                  Logout
                </Button>
              </div>
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

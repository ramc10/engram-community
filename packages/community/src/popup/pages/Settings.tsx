/**
 * Settings Page Component
 * Displays account information and settings
 */

declare const chrome: any;

import React, { useState, useEffect } from 'react';
import { useToast, useTheme, Button } from '../../components/ui';
import type { MessageType } from '../../lib/messages';
import type { Memory, EnrichmentConfig } from '@engram/core';
import { formatDate } from '../../lib/formatters';
import { encryptApiKey, decryptApiKey, isEncrypted } from '../../lib/api-key-crypto';

interface SettingsPageProps {
  userId: string;
  email: string;
  isPremium: boolean;
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  userId,
  email,
  isPremium,
  onLogout,
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isTogglingSync, setIsTogglingSync] = useState(false);

  // Enrichment config state
  const [enrichmentConfig, setEnrichmentConfig] = useState<EnrichmentConfig>({
    enabled: false,
    provider: 'local',
    model: 'llama-3.2-3b-instruct',
    localEndpoint: 'http://localhost:1234',
    batchSize: 5,
    enableLinkDetection: false, // Phase 2: Link Generation
  });
  const [isUpdatingEnrichment, setIsUpdatingEnrichment] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Error reporter state
  const [errorReportingEnabled, setErrorReportingEnabled] = useState(false);
  const [isUpdatingErrorReporter, setIsUpdatingErrorReporter] = useState(false);

  const { success, error: showError, info } = useToast();
  const { colors } = useTheme();

  // Load memories on mount
  useEffect(() => {
    loadMemories();
    loadSyncStatus();
    loadEnrichmentConfig();
    loadErrorReporterConfig();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PREMIUM_STATUS' as MessageType,
      });

      if (response.success && response.status) {
        setSyncEnabled(response.status.syncEnabled);
      }
    } catch (err) {
      console.error('Failed to load sync status:', err);
    }
  };

  const loadMemories = async () => {
    setIsLoadingMemories(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MEMORIES' as MessageType,
        filter: {
          limit: 100, // Load last 100 memories
        },
      });

      if (response.success && response.memories) {
        setMemories(response.memories);
      }
    } catch (err) {
      console.error('Failed to load memories:', err);
      showError('Failed to load memories');
    } finally {
      setIsLoadingMemories(false);
    }
  };

  const loadEnrichmentConfig = async () => {
    try {
      const result = await chrome.storage.local.get('enrichmentConfig');
      if (result.enrichmentConfig) {
        const config = result.enrichmentConfig;

        // Decrypt API key if present and encrypted
        if (config.apiKey && isEncrypted(config.apiKey)) {
          try {
            config.apiKey = await decryptApiKey(config.apiKey);
          } catch (err) {
            console.error('Failed to decrypt API key:', err);
            // If decryption fails, clear the API key to prevent issues
            config.apiKey = '';
          }
        }

        setEnrichmentConfig(config);
      }
    } catch (err) {
      console.error('Failed to load enrichment config:', err);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    setIsLoggingOut(true);

    try {
      // Send logout message to background service
      await chrome.runtime.sendMessage({
        type: 'AUTH_LOGOUT' as MessageType,
      });

      success('Logged out successfully');
      setTimeout(() => {
        onLogout();
      }, 300);
    } catch (err) {
      console.error('Logout error:', err);
      showError('Logout failed, but clearing local state');
      setTimeout(() => {
        onLogout();
      }, 500);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    success('User ID copied to clipboard');
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
      console.error('Failed to toggle sync:', err);
      showError('Failed to toggle sync');
    } finally {
      setIsTogglingSync(false);
    }
  };

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
          console.error('Failed to encrypt API key:', err);
          showError('Failed to encrypt API key');
          setIsUpdatingEnrichment(false);
          return;
        }
      }

      await chrome.storage.local.set({ enrichmentConfig: configToStore });
      setEnrichmentConfig(newConfig); // Keep decrypted version in state
      success('Enrichment settings updated');
    } catch (err) {
      console.error('Failed to update enrichment config:', err);
      showError('Failed to update settings');
    } finally {
      setIsUpdatingEnrichment(false);
    }
  };

  const handleToggleEnrichment = () => {
    if (!enrichmentConfig.enabled) {
      // Check if credentials are configured
      let hasCredentials = false;
      let message = '';

      if (enrichmentConfig.provider === 'local') {
        hasCredentials = !!enrichmentConfig.localEndpoint;
        message = 'Please set a local endpoint first';
      } else if ((enrichmentConfig.provider as string) === 'premium') {
        hasCredentials = !!enrichmentConfig.apiKey;
        message = 'Please set a license key first';
      } else {
        hasCredentials = !!enrichmentConfig.apiKey;
        message = 'Please set an API key first';
      }

      if (!hasCredentials) {
        showError(message);
        return;
      }
    }
    updateEnrichmentConfig({ enabled: !enrichmentConfig.enabled });
  };

  const loadErrorReporterConfig = async () => {
    try {
      const result = await chrome.storage.local.get('github-reporter-config');
      if (result['github-reporter-config']) {
        setErrorReportingEnabled(result['github-reporter-config'].enabled || false);
      }
    } catch (err) {
      console.error('Failed to load error reporter config:', err);
    }
  };

  const toggleErrorReporting = async (enabled: boolean) => {
    setIsUpdatingErrorReporter(true);
    try {
      // Get existing config
      const result = await chrome.storage.local.get('github-reporter-config');
      const existingConfig = result['github-reporter-config'] || {
        rateLimitMinutes: 5,
        maxIssuesPerDay: 10,
        includeStackTrace: true,
        excludePatterns: []
      };

      // Update only the enabled flag
      const newConfig = { ...existingConfig, enabled };
      await chrome.storage.local.set({ 'github-reporter-config': newConfig });
      setErrorReportingEnabled(enabled);

      if (enabled) {
        success('Error reporting enabled');
      } else {
        success('Error reporting disabled');
      }
    } catch (err) {
      console.error('Failed to update error reporter config:', err);
      showError('Failed to update settings');
    } finally {
      setIsUpdatingErrorReporter(false);
    }
  };

  const estimateMonthlyCost = () => {
    // Estimate based on 100 memories/month @ $0.00005 per memory
    const avgMemoriesPerMonth = 100;
    const costPerMemory = 0.00005;
    return (avgMemoriesPerMonth * costPerMemory).toFixed(4);
  };

  const filteredMemories = memories.filter((memory) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      memory.content.text.toLowerCase().includes(query) ||
      memory.conversationId?.toLowerCase().includes(query)
    );
  });


  return (
    <div
      style={{
        width: '700px',
        height: '600px',
        backgroundColor: colors.background,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Left Sidebar - Memories */}
      <div
        style={{
          width: '350px',
          height: '100%',
          backgroundColor: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: colors.text.primary,
              marginBottom: '4px',
            }}
          >
            Saved Memories
          </h2>
          <div
            style={{
              fontSize: '12px',
              color: colors.text.secondary,
            }}
          >
            {memories.length} total
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px' }}>
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.text.primary,
              outline: 'none',
            }}
          />
        </div>

        {/* Memories List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 12px 12px 12px',
          }}
        >
          {isLoadingMemories ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: colors.text.secondary,
                fontSize: '13px',
              }}
            >
              Loading memories...
            </div>
          ) : filteredMemories.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: colors.text.secondary,
                fontSize: '13px',
              }}
            >
              {searchQuery ? 'No memories found' : 'No memories saved yet. Start chatting!'}
            </div>
          ) : (
            filteredMemories.map((memory) => (
              <div
                key={memory.id}
                style={{
                  marginBottom: '8px',
                  padding: '10px',
                  backgroundColor: colors.background,
                  borderRadius: '6px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.text.tertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: colors.text.secondary,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {memory.content.role === 'user' ? '👤 You' : '🤖 AI'}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: colors.text.tertiary,
                    }}
                  >
                    {formatDate(memory.timestamp)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: colors.text.primary,
                    lineHeight: '1.4',
                    maxHeight: '50px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {memory.content.text}
                </div>
                {memory.platform && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '9px',
                      color: colors.text.tertiary,
                    }}
                  >
                    {memory.platform === 'chatgpt' ? '💬 ChatGPT' : memory.platform === 'claude' ? '🎭 Claude' : memory.platform}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Refresh Button */}
        <div style={{ padding: '12px', borderTop: `1px solid ${colors.border}` }}>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={loadMemories}
            disabled={isLoadingMemories}
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Right Content - Settings */}
      <div
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: colors.text.primary,
              marginBottom: '8px',
            }}
          >
            Settings
          </h1>
          <p style={{ fontSize: '14px', color: colors.text.secondary }}>
            Manage your account and preferences
          </p>
        </div>

        {/* Account Section */}
        <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '12px',
          }}
        >
          Account
        </h2>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '4px' }}>
            Email
          </div>
          <div style={{ fontSize: '14px', color: colors.text.primary, fontWeight: 500 }}>
            {email}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '4px' }}>
            User ID
          </div>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: '11px',
                color: colors.text.secondary,
                fontFamily: 'monospace',
                backgroundColor: colors.background,
                padding: '6px 8px',
                borderRadius: '4px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userId}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyUserId}
            >
              Copy
            </Button>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '12px',
          }}
        >
          Security
        </h2>

        <Button
          variant="secondary"
          size="md"
          fullWidth
          disabled
        >
          Change Password (Coming soon)
        </Button>
      </div>

      {/* Sync Settings */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '12px',
          }}
        >
          Cloud Sync
        </h2>

        {isPremium ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontSize: '14px', color: colors.text.primary }}>
                Enable cloud sync
              </div>
              <button
                onClick={handleToggleSync}
                disabled={isTogglingSync}
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '26px',
                  backgroundColor: syncEnabled ? colors.status.success : colors.border,
                  borderRadius: '13px',
                  border: 'none',
                  cursor: isTogglingSync ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  opacity: isTogglingSync ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: syncEnabled ? '25px' : '3px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: colors.text.secondary }}>
              {syncEnabled
                ? 'Memories are synced across your devices with end-to-end encryption'
                : 'Enable to sync memories across devices (Premium feature)'}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontSize: '14px', color: colors.text.secondary }}>
                Cloud sync (Premium only)
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: colors.text.tertiary,
                  fontWeight: 600,
                  backgroundColor: colors.background,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                Disabled
              </div>
            </div>

            <div style={{ fontSize: '12px', color: colors.text.secondary }}>
              Upgrade to Premium to sync memories across devices
            </div>
          </>
        )}
      </div>

      {/* Memory Enrichment Settings */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '4px',
          }}
        >
          Memory Enrichment
        </h2>
        <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '16px' }}>
          Use AI to automatically generate keywords, tags, and context for your memories
        </div>

        {/* Enable/Disable Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '14px', color: colors.text.primary }}>
            Enable enrichment
          </div>
          <button
            onClick={handleToggleEnrichment}
            disabled={isUpdatingEnrichment}
            style={{
              position: 'relative',
              width: '48px',
              height: '26px',
              backgroundColor: enrichmentConfig.enabled ? colors.status.success : colors.border,
              borderRadius: '13px',
              border: 'none',
              cursor: isUpdatingEnrichment ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: isUpdatingEnrichment ? 0.6 : 1,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: enrichmentConfig.enabled ? '25px' : '3px',
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>

        {/* Link Detection Toggle (Phase 2) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            opacity: enrichmentConfig.enabled ? 1 : 0.5,
          }}
        >
          <div style={{ fontSize: '14px', color: colors.text.primary }}>
            Enable link detection
          </div>
          <button
            onClick={() => updateEnrichmentConfig({ enableLinkDetection: !enrichmentConfig.enableLinkDetection })}
            disabled={isUpdatingEnrichment || !enrichmentConfig.enabled}
            style={{
              position: 'relative',
              width: '48px',
              height: '26px',
              backgroundColor: enrichmentConfig.enableLinkDetection ? colors.status.success : colors.border,
              borderRadius: '13px',
              border: 'none',
              cursor: (isUpdatingEnrichment || !enrichmentConfig.enabled) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: (isUpdatingEnrichment || !enrichmentConfig.enabled) ? 0.6 : 1,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: enrichmentConfig.enableLinkDetection ? '25px' : '3px',
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
        <div style={{ fontSize: '11px', color: colors.text.tertiary, marginBottom: '16px', marginLeft: '2px' }}>
          Automatically find semantic connections between memories (~$0.001 per link)
        </div>

        {/* Provider Selection */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '6px' }}>
            LLM Provider
          </div>
          <select
            value={enrichmentConfig.provider}
            onChange={(e) => updateEnrichmentConfig({ provider: e.target.value as any })}
            disabled={isUpdatingEnrichment}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.text.primary,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="local">Local (LM Studio / Ollama) - Free!</option>
            <option value="premium">Premium API ($10/month) - Managed LLM</option>
            <option value="openai">OpenAI (GPT-4o-mini)</option>
            <option value="anthropic">Anthropic (Claude 3 Haiku)</option>
          </select>
        </div>

        {/* Model Selection (not shown for premium) */}
        {(enrichmentConfig.provider as string) !== 'premium' && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '6px' }}>
              Model
            </div>
            <select
              value={enrichmentConfig.model}
              onChange={(e) => updateEnrichmentConfig({ model: e.target.value })}
              disabled={isUpdatingEnrichment}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text.primary,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {enrichmentConfig.provider === 'local' ? (
                <>
                  <option value="llama-3.2-3b-instruct">Llama 3.2 3B Instruct (recommended)</option>
                  <option value="llama-3.2-1b-instruct">Llama 3.2 1B Instruct (faster)</option>
                  <option value="phi-3-mini">Phi-3 Mini</option>
                  <option value="qwen2.5-3b-instruct">Qwen 2.5 3B Instruct</option>
                  <option value="custom">Custom Model</option>
                </>
              ) : enrichmentConfig.provider === 'openai' ? (
                <>
                  <option value="gpt-4o-mini">GPT-4o-mini (recommended)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              ) : (
                <>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku (recommended)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                </>
              )}
            </select>
          </div>
        )}

        {/* Local Endpoint, API Key, or License Key Input */}
        {enrichmentConfig.provider === 'local' ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '6px' }}>
              Local Endpoint
            </div>
            <input
              type="text"
              value={enrichmentConfig.localEndpoint || ''}
              onChange={(e) => updateEnrichmentConfig({ localEndpoint: e.target.value })}
              placeholder="http://localhost:1234"
              disabled={isUpdatingEnrichment}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                fontFamily: 'monospace',
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text.primary,
                outline: 'none',
              }}
            />
            <div style={{ fontSize: '11px', color: colors.text.tertiary, marginTop: '4px' }}>
              LM Studio default: http://localhost:1234 | Ollama default: http://localhost:11434
            </div>
          </div>
        ) : (enrichmentConfig.provider as string) === 'premium' ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '6px' }}>
              License Key
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={enrichmentConfig.apiKey || ''}
                onChange={(e) => updateEnrichmentConfig({ apiKey: e.target.value })}
                placeholder="ENGRAM-XXXX-XXXX-XXXX-XXXX"
                disabled={isUpdatingEnrichment}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text.primary,
                  outline: 'none',
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? '👁️' : '👁️‍🗨️'}
              </Button>
            </div>
            <div style={{ fontSize: '11px', color: colors.text.tertiary, marginTop: '4px' }}>
              Your premium license key. No API keys needed - managed LLM included!
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '6px' }}>
              API Key
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={enrichmentConfig.apiKey || ''}
                onChange={(e) => updateEnrichmentConfig({ apiKey: e.target.value })}
                placeholder={enrichmentConfig.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                disabled={isUpdatingEnrichment}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text.primary,
                  outline: 'none',
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? '👁️' : '👁️‍🗨️'}
              </Button>
            </div>
            <div style={{ fontSize: '11px', color: colors.text.tertiary, marginTop: '4px' }}>
              Encrypted before storage. Get your key from{' '}
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
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '6px' }}>
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
          <div style={{ fontSize: '11px', color: colors.text.tertiary, marginTop: '4px' }}>
            Number of memories to enrich in parallel
          </div>
        </div>

        {/* Cost Estimate */}
        <div
          style={{
            padding: '12px',
            backgroundColor: colors.background,
            borderRadius: '6px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '4px' }}>
            Estimated Cost
          </div>
          <div style={{ fontSize: '16px', color: colors.text.primary, fontWeight: 600 }}>
            ~${estimateMonthlyCost()}/month
          </div>
          <div style={{ fontSize: '11px', color: colors.text.tertiary, marginTop: '4px' }}>
            Based on 100 memories per month with {enrichmentConfig.model}
          </div>
        </div>
      </div>

      {/* Error Reporting Section */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: '12px',
          }}
        >
          Help Improve Engram
        </h2>

        <div style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '16px', lineHeight: '1.6' }}>
          Automatic error reporting helps us identify and fix bugs faster. When enabled, Engram will send error reports to our team when something goes wrong.
        </div>

        {/* What's Collected */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: colors.background,
          borderRadius: '6px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: colors.text.primary, marginBottom: '8px' }}>
            What's collected:
          </div>
          <ul style={{ fontSize: '11px', color: colors.text.secondary, margin: '0', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Error messages (sanitized)</li>
            <li>Extension version</li>
            <li>Browser type</li>
            <li>When the error occurred</li>
          </ul>
        </div>

        {/* What's NOT Collected */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: colors.background,
          borderRadius: '6px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: colors.text.primary, marginBottom: '8px' }}>
            What's NOT collected:
          </div>
          <ul style={{ fontSize: '11px', color: colors.text.secondary, margin: '0', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Your conversations</li>
            <li>Personal information</li>
            <li>API keys or passwords</li>
            <li>Browsing history</li>
          </ul>
        </div>

        {/* Enable/Disable Toggle */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '12px',
          backgroundColor: errorReportingEnabled ? colors.status.successBg : colors.background,
          borderRadius: '6px',
          border: `1px solid ${errorReportingEnabled ? colors.status.success + '33' : colors.border}`,
          transition: 'all 0.2s'
        }}>
          <input
            type="checkbox"
            checked={errorReportingEnabled}
            onChange={(e) => toggleErrorReporting(e.target.checked)}
            disabled={isUpdatingErrorReporter}
            style={{ marginRight: '12px', cursor: 'pointer' }}
          />
          <span style={{
            fontSize: '14px',
            fontWeight: 500,
            color: colors.text.primary
          }}>
            {errorReportingEnabled ? 'Error reporting is enabled' : 'Enable error reporting'}
          </span>
        </label>

        <div style={{ fontSize: '11px', color: colors.text.tertiary, marginTop: '12px' }}>
          You can change this setting at any time. Reports are rate-limited and sanitized to protect your privacy.
        </div>
      </div>

      {/* Privacy Information */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: colors.status.infoBg,
          borderRadius: '8px',
          border: `1px solid ${colors.status.info + '33'}`,
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: colors.status.info,
            marginBottom: '8px',
          }}
        >
          🔒 Privacy & Encryption
        </h3>
        <div style={{ fontSize: '12px', color: colors.status.info, lineHeight: '1.6' }}>
          All your conversations are encrypted on your device before sync. Your
          password derives an encryption key that never leaves your browser. We
          never see your data in plaintext.
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

        {/* Version Info */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: colors.text.tertiary }}>
            Engram v{chrome.runtime.getManifest().version}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Settings Tab Component
 * Account, cloud sync, enrichment settings, and privacy info
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTheme, useToast, Button } from './ui';
import { encryptApiKey, decryptApiKey, isEncrypted } from '../lib/api-key-crypto';
import type { EnrichmentConfig } from '@engram/core';
import type { MessageType } from '../lib/messages';

interface SettingsTabProps {
  email: string;
  userId: string;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export function SettingsTab({
  email,
  userId,
  onLogout,
  isLoggingOut,
}: SettingsTabProps) {
  const { colors } = useTheme();
  const { success, error: showError } = useToast();

  const [showApiKey, setShowApiKey] = useState(false);
  const [isUpdatingEnrichment, setIsUpdatingEnrichment] = useState(false);
  const [enrichmentConfig, setEnrichmentConfig] = useState<EnrichmentConfig>({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    batchSize: 5,
    enableLinkDetection: false,
  });

  // Load enrichment config on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await chrome.storage.local.get('enrichmentConfig');
        if (result.enrichmentConfig) {
          const config = result.enrichmentConfig;
          if (config.apiKey && isEncrypted(config.apiKey)) {
            try {
              config.apiKey = await decryptApiKey(config.apiKey);
            } catch (err) {
              console.error('[Engram Settings] Failed to decrypt API key:', err);
              config.apiKey = '';
            }
          }
          setEnrichmentConfig(config);
        }
      } catch (err) {
        console.error('[Engram Settings] Failed to load enrichment config:', err);
      }
    })();
  }, []);

  const updateEnrichmentConfig = async (updates: Partial<EnrichmentConfig>) => {
    setIsUpdatingEnrichment(true);
    try {
      const newConfig = { ...enrichmentConfig, ...updates };
      const configToStore = { ...newConfig };

      if (configToStore.apiKey && configToStore.apiKey.trim().length > 0) {
        try {
          configToStore.apiKey = await encryptApiKey(configToStore.apiKey);
        } catch (err) {
          console.error('[Engram Settings] Failed to encrypt API key:', err);
          showError('Failed to encrypt API key');
          setIsUpdatingEnrichment(false);
          return;
        }
      }

      await chrome.storage.local.set({ enrichmentConfig: configToStore });
      setEnrichmentConfig(newConfig);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'REINITIALIZE_ENRICHMENT' as MessageType,
        });
        if (!response.success) {
          console.warn('[Engram Settings] Failed to reinitialize enrichment:', response.error);
        }
      } catch (err) {
        console.warn('[Engram Settings] Failed to send reinitialize message:', err);
      }

      success('Enrichment settings updated');
    } catch (err) {
      console.error('[Engram Settings] Failed to update enrichment config:', err);
      showError('Failed to update settings');
    } finally {
      setIsUpdatingEnrichment(false);
    }
  };

  const handleToggleEnrichment = () => {
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

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    success('User ID copied to clipboard');
  };

  const estimateMonthlyCost = () => {
    if (enrichmentConfig.provider === 'local') return '0.00';
    const avgMemoriesPerMonth = 100;
    const costPerMemory = 0.00005;
    return (avgMemoriesPerMonth * costPerMemory).toFixed(4);
  };

  const toggleStyle = (enabled: boolean, disabled: boolean): React.CSSProperties => ({
    position: 'relative',
    width: '44px',
    height: '24px',
    backgroundColor: enabled ? colors.status.success : colors.border,
    borderRadius: '12px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s',
    opacity: disabled ? 0.6 : 1,
  });

  const toggleKnobStyle = (enabled: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: '3px',
    left: enabled ? '23px' : '3px',
    width: '18px',
    height: '18px',
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'left 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
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
          <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
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
          <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
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
          <Button variant="ghost" size="sm" fullWidth onClick={copyUserId}>
            Copy User ID
          </Button>
        </div>
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
            style={toggleStyle(enrichmentConfig.enabled, isUpdatingEnrichment)}
          >
            <div style={toggleKnobStyle(enrichmentConfig.enabled)} />
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
            style={toggleStyle(!!enrichmentConfig.enableLinkDetection, isUpdatingEnrichment || !enrichmentConfig.enabled)}
          >
            <div style={toggleKnobStyle(!!enrichmentConfig.enableLinkDetection)} />
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
            style={toggleStyle(
              !!enrichmentConfig.enableEvolution,
              isUpdatingEnrichment || !enrichmentConfig.enabled || !enrichmentConfig.enableLinkDetection
            )}
          >
            <div style={toggleKnobStyle(!!enrichmentConfig.enableEvolution)} />
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
            onChange={(e) => updateEnrichmentConfig({ provider: e.target.value as 'openai' | 'anthropic' | 'local' })}
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

        {/* Local Endpoint Input */}
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

        {/* API Key Input */}
        {enrichmentConfig.provider !== 'local' && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>
              API Key
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={enrichmentConfig.apiKey || ''}
                onChange={(e) => updateEnrichmentConfig({ apiKey: e.target.value })}
                placeholder={
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
                {showApiKey ? 'Hide' : 'Show'}
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
            style={{ width: '100%', cursor: 'pointer' }}
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
          End-to-End Encrypted
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
        onClick={onLogout}
        isLoading={isLoggingOut}
        disabled={isLoggingOut}
      >
        Logout
      </Button>
    </div>
  );
}

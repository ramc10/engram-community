/**
 * Memories Tab Component
 * Search and list view for memories in the side panel
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTheme, useToast } from './ui';
import { MemoryCard } from './MemoryCard';
import { getEmbeddingService, type MemoryWithEmbedding } from '../lib/embedding-service';
import type { Memory } from '@engram/core';
import type { MessageType } from '../lib/messages';

interface MemoriesTabProps {
  memories: Memory[];
  isLoadingMemories: boolean;
  lastRefreshTime: Date | null;
  onReloadMemories: () => void;
}

export function MemoriesTab({
  memories,
  isLoadingMemories,
  lastRefreshTime,
  onReloadMemories,
}: MemoriesTabProps) {
  const { colors } = useTheme();
  const { success, error: showError } = useToast();
  const embeddingService = getEmbeddingService();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);
  const [semanticSearchResults, setSemanticSearchResults] = useState<Memory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<number | null>(null);
  const [memoriesWithEmbeddings, setMemoriesWithEmbeddings] = useState<MemoryWithEmbedding[]>([]);
  const [isPreparingEmbeddings, setIsPreparingEmbeddings] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState<{ current: number; total: number } | null>(null);

  // Pre-compute embeddings for all memories
  const precomputeEmbeddings = useCallback(async (memoriesToEmbed: Memory[]) => {
    if (memoriesToEmbed.length === 0) return;

    setIsPreparingEmbeddings(true);
    setEmbeddingProgress({ current: 0, total: memoriesToEmbed.length });

    try {
      await embeddingService.initialize();
      const embedded = await embeddingService.embedMemories(
        memoriesToEmbed,
        (current, total) => {
          setEmbeddingProgress({ current, total });
        }
      );
      setMemoriesWithEmbeddings(embedded);
    } catch (error) {
      console.error('[Engram MemoriesTab] Failed to pre-compute embeddings:', error);
    } finally {
      setIsPreparingEmbeddings(false);
      setEmbeddingProgress(null);
    }
  }, [embeddingService]);

  // Pre-compute embeddings when memories change
  useEffect(() => {
    if (memories.length > 0) {
      precomputeEmbeddings(memories);
    }
  }, [memories, precomputeEmbeddings]);

  // Perform semantic search
  const performSemanticSearch = async (query: string) => {
    if (!query || query.length < 3) {
      setSemanticSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      if (memoriesWithEmbeddings.length > 0) {
        const results = await embeddingService.findSimilar(query, memoriesWithEmbeddings, {
          threshold: 0.2,
          maxResults: 50,
        });
        setSemanticSearchResults(results.map(r => r.memory));
      } else {
        // Fallback to text search
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
      console.error('[Engram MemoriesTab] Semantic search failed:', error);
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

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

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

  const handleNavigateToMemory = (memoryId: string) => {
    setExpandedMemoryId(memoryId);
    setTimeout(() => {
      const element = document.getElementById(`memory-${memoryId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

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
        onReloadMemories();
      } else {
        showError(response.error || 'Failed to revert memory');
      }
    } catch (err) {
      console.error('[Engram MemoriesTab] Failed to revert evolution:', err);
      showError('Failed to revert memory');
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

      {/* Status Bar */}
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
            <>Preparing search... ({embeddingProgress.current}/{embeddingProgress.total})</>
          ) : isPreparingEmbeddings ? (
            <>Preparing search...</>
          ) : isSearching ? (
            <>Searching...</>
          ) : isLoadingMemories ? (
            <>Refreshing...</>
          ) : lastRefreshTime ? (
            <>Auto-refresh active</>
          ) : null}
        </div>
      </div>

      {/* Memories List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {isLoadingMemories && memories.length === 0 ? (
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
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                isExpanded={expandedMemoryId === memory.id}
                onToggleExpand={() => setExpandedMemoryId(
                  expandedMemoryId === memory.id ? null : memory.id
                )}
                allMemories={memories}
                onNavigateToMemory={handleNavigateToMemory}
                onRevertEvolution={handleRevertEvolution}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

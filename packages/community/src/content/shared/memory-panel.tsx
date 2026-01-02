/**
 * Memory Panel Component
 * Container for displaying relevant memories with search and filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MemoryCard } from './memory-card';
import { ScoredMemory, contextMatcher } from './context-matcher';
import { Memory } from 'engram-shared/types/memory';
import { Logo } from '../../components/ui';

interface MemoryPanelProps {
  conversationId?: string;
  currentContext?: string;
  onMemoryClick?: (memory: Memory) => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  conversationId,
  currentContext = '',
  onMemoryClick,
}) => {
  const [memories, setMemories] = useState<ScoredMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch relevant memories based on context
  const fetchRelevantMemories = useCallback(async () => {
    if (!currentContext.trim()) {
      setMemories([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const relevant = await contextMatcher.findRelevant(currentContext, {
        maxResults: 5,
        minScore: 0.1,
        conversationId,
        excludeCurrentConversation: true,
      });

      setMemories(relevant);
    } catch (err) {
      console.error('[Memory Panel] Error fetching memories:', err);
      setError('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [currentContext, conversationId]);

  // Search memories by query
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Re-fetch context-based memories
      await fetchRelevantMemories();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const keywords = query.split(' ').filter(k => k.length > 2);
      const results = await contextMatcher.searchByKeywords(keywords, {
        maxResults: 10,
        minScore: 0.05,
        conversationId,
        excludeCurrentConversation: true,
      });

      setMemories(results);
    } catch (err) {
      console.error('[Memory Panel] Error searching memories:', err);
      setError('Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, fetchRelevantMemories]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        fetchRelevantMemories();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, fetchRelevantMemories]);

  // Fetch memories when context changes
  useEffect(() => {
    if (!searchQuery) {
      fetchRelevantMemories();
    }
  }, [currentContext, fetchRelevantMemories, searchQuery]);

  const handleMemoryExpand = (memory: Memory) => {
    if (onMemoryClick) {
      onMemoryClick(memory);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        maxWidth: '350px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Logo size={18} />
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Engram Memories
          </div>
          {memories.length > 0 && (
            <div
              style={{
                fontSize: '11px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
            >
              {memories.length}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
            color: '#6b7280',
          }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Search Bar */}
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Error State */}
          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#dc2626',
                marginBottom: '12px',
              }}
            >
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                color: '#6b7280',
                fontSize: '13px',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  border: '2px solid #e5e7eb',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <style>
                {`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}
              </style>
              <div style={{ marginTop: '8px' }}>Loading memories...</div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && memories.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                color: '#9ca3af',
                fontSize: '13px',
              }}
            >
              {searchQuery ? (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                  <div>No memories found</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    Try different keywords
                  </div>
                </>
              ) : currentContext ? (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💭</div>
                  <div>No relevant memories yet</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    Keep chatting to build context
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
                  <div>Start a conversation</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    Memories will appear here
                  </div>
                </>
              )}
            </div>
          )}

          {/* Memory Cards */}
          {!isLoading && memories.length > 0 && (
            <div
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {memories.map((scored) => (
                <MemoryCard
                  key={scored.memory.id}
                  memory={scored.memory}
                  relevanceScore={scored.score}
                  matchedKeywords={scored.matchedKeywords}
                  onExpand={handleMemoryExpand}
                />
              ))}
            </div>
          )}

          {/* Footer Info */}
          {memories.length > 0 && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid #e5e7eb',
                fontSize: '10px',
                color: '#9ca3af',
                textAlign: 'center',
              }}
            >
              Showing {memories.length} relevant{' '}
              {memories.length === 1 ? 'memory' : 'memories'}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Memory Card Component
 * Displays a single memory with expand/collapse functionality
 */

import React, { useState } from 'react';
import { Memory } from '@engram/core';
import { formatDate, truncateText } from '../../lib/formatters';

interface MemoryCardProps {
  memory: Memory;
  relevanceScore?: number;
  matchedKeywords?: string[];
  onExpand?: (memory: Memory) => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  relevanceScore,
  matchedKeywords = [],
  onExpand,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && onExpand) {
      onExpand(memory);
    }
  };


  const highlightKeywords = (text: string): React.ReactNode => {
    if (matchedKeywords.length === 0) return text;

    const regex = new RegExp(`(${matchedKeywords.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = matchedKeywords.some(
        kw => kw.toLowerCase() === part.toLowerCase()
      );
      return isMatch ? (
        <mark key={i} style={{ backgroundColor: '#fef3c7', padding: '0 2px' }}>
          {part}
        </mark>
      ) : (
        part
      );
    });
  };

  const codeBlocks = memory.content.metadata?.codeBlocks || [];
  const hasCode = codeBlocks.length > 0;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}
      onClick={toggleExpand}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.borderColor = '#3b82f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.borderColor = '#e5e7eb';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <div
          style={{
            backgroundColor: memory.content.role === 'user' ? '#dbeafe' : '#dcfce7',
            color: memory.content.role === 'user' ? '#1e40af' : '#166534',
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
            marginRight: '8px',
            textTransform: 'uppercase',
          }}
        >
          {memory.content.role}
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginRight: 'auto' }}>
          {formatDate(memory.timestamp)}
        </div>
        {relevanceScore !== undefined && (
          <div
            style={{
              fontSize: '10px',
              color: '#059669',
              fontWeight: 600,
              backgroundColor: '#d1fae5',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {Math.round(relevanceScore * 100)}% match
          </div>
        )}
      </div>

      {/* Content Preview/Full */}
      <div
        style={{
          fontSize: '13px',
          lineHeight: '1.5',
          color: '#374151',
          marginBottom: hasCode ? '8px' : '0',
        }}
      >
        {isExpanded
          ? highlightKeywords(memory.content.text)
          : highlightKeywords(truncateText(memory.content.text))}
      </div>

      {/* Code Blocks (if expanded) */}
      {isExpanded && hasCode && (
        <div style={{ marginTop: '8px' }}>
          {codeBlocks.map((block, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#1f2937',
                borderRadius: '4px',
                padding: '8px',
                marginBottom: idx < codeBlocks.length - 1 ? '8px' : '0',
                overflow: 'auto',
              }}
            >
              {block.language && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#9ca3af',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  {block.language}
                </div>
              )}
              <pre
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#e5e7eb',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {block.code}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {memory.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginTop: '8px',
          }}
        >
          {memory.tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '10px',
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Expand/Collapse Indicator */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#3b82f6',
          fontWeight: 500,
          textAlign: 'center',
        }}
      >
        {isExpanded ? '▲ Click to collapse' : '▼ Click to expand'}
      </div>
    </div>
  );
};

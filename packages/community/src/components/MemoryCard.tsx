/**
 * Memory Card Component
 * Displays a single memory with expansion, related memories, and evolution timeline
 */

import React, { useState } from 'react';
import { useTheme } from './ui';
import { PlatformLogo } from './PlatformLogo';
import { formatDate, summarizeText } from '../lib/formatters';
import type { Memory } from '@engram/core';

interface MemoryCardProps {
  memory: Memory;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allMemories: Memory[];
  onNavigateToMemory: (memoryId: string) => void;
  onRevertEvolution: (memoryId: string, versionIndex: number) => void;
}

export function MemoryCard({
  memory,
  isExpanded,
  onToggleExpand,
  allMemories,
  onNavigateToMemory,
  onRevertEvolution,
}: MemoryCardProps) {
  const { colors } = useTheme();
  const [showTimeline, setShowTimeline] = useState(false);

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.9) return colors.status.success;
    if (score >= 0.8) return colors.status.info;
    if (score >= 0.7) return colors.status.warning;
    return colors.text.tertiary;
  };

  const memoryWithEvolution = memory as any;
  const memoryWithLinks = memory as any;

  return (
    <div
      id={`memory-${memory.id}`}
      style={{
        padding: '12px',
        backgroundColor: colors.surface,
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={onToggleExpand}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary;
        e.currentTarget.style.backgroundColor = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.backgroundColor = colors.surface;
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {memory.platform && (
            <div style={{ color: colors.text.secondary }}>
              <PlatformLogo platform={memory.platform} />
            </div>
          )}
          {memoryWithEvolution.evolution && memoryWithEvolution.evolution.updateCount > 0 && (
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
          )}
        </div>
        <div style={{ fontSize: '10px', color: colors.text.tertiary }}>
          {formatDate(memory.timestamp)}
        </div>
      </div>

      {/* Content */}
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

      {/* Related Memories */}
      {memoryWithLinks.links && memoryWithLinks.links.length > 0 && (
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {memoryWithLinks.links.slice(0, 5).map((link: any) => {
              const linkedMemory = allMemories.find(m => m.id === link.memoryId);
              if (!linkedMemory) return null;

              return (
                <div
                  key={link.memoryId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToMemory(link.memoryId);
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
                  <span style={{ opacity: 0.6 }}>🔗</span>
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '150px',
                  }}>
                    {(linkedMemory.content.text || '').slice(0, 40)}...
                  </span>
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
      )}

      {/* Evolution History */}
      {memoryWithEvolution.evolution && memoryWithEvolution.evolution.history && memoryWithEvolution.evolution.history.length > 0 && (
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
            <div style={{ fontSize: '11px', color: '#9333ea', fontWeight: 600 }}>
              Evolution History ({memoryWithEvolution.evolution.updateCount} update{memoryWithEvolution.evolution.updateCount !== 1 ? 's' : ''})
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTimeline(!showTimeline);
              }}
              style={{
                fontSize: '10px',
                color: '#9333ea',
                backgroundColor: 'transparent',
                border: '1px solid #e9d5ff',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
            </button>
          </div>

          {showTimeline && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {memoryWithEvolution.evolution.history.map((version: any, index: number) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    backgroundColor: colors.background,
                    border: '1px solid #e9d5ff',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <div style={{ fontSize: '9px', color: colors.text.tertiary }}>
                      Version {index + 1} &bull; {formatDate(version.timestamp)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevertEvolution(memory.id, index);
                      }}
                      style={{
                        fontSize: '9px',
                        color: '#9333ea',
                        backgroundColor: '#f3e8ff',
                        border: '1px solid #e9d5ff',
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
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
                        <span style={{ fontSize: '9px', color: colors.text.tertiary }}>
                          +{version.keywords.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                  {version.tags && version.tags.length > 0 && (
                    <div style={{ fontSize: '9px', color: colors.text.secondary }}>
                      Tags: {version.tags.join(', ')}
                    </div>
                  )}
                </div>
              ))}
              <div style={{
                padding: '8px',
                backgroundColor: '#f3e8ff',
                border: '2px solid #9333ea',
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
      )}
    </div>
  );
}

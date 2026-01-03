/**
 * Context Matcher
 * Finds relevant memories based on current conversation context
 * Uses TF-IDF and keyword matching for relevance scoring
 */

import { Memory } from '@engram/core';
import { sendGetMemories, sendSearchMemories } from '../../lib/messages';

/**
 * Keyword with weight
 */
interface WeightedKeyword {
  term: string;
  weight: number;
}

/**
 * Memory with relevance score
 */
export interface ScoredMemory {
  memory: Memory;
  score: number;
  matchedKeywords: string[];
}

/**
 * Context matching options
 */
export interface MatchOptions {
  maxResults?: number;
  minScore?: number;
  conversationId?: string;
  excludeCurrentConversation?: boolean;
}

/**
 * Context Matcher Class
 */
export class ContextMatcher {
  private stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
    'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
    'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
    'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
    'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
    'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had',
    'were', 'said', 'did', 'having', 'may', 'should', 'am', 'being', 'does'
  ]);

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): WeightedKeyword[] {
    // Normalize text
    const normalized = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Split into words
    const words = normalized.split(' ');

    // Count word frequency
    const wordCount = new Map<string, number>();
    for (const word of words) {
      if (word.length < 3 || this.stopWords.has(word)) {
        continue;
      }
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }

    // Calculate TF (term frequency)
    const maxFreq = Math.max(...Array.from(wordCount.values()));
    const keywords: WeightedKeyword[] = [];

    for (const [term, count] of wordCount.entries()) {
      const tf = count / maxFreq;
      // Give higher weight to longer words (likely more specific)
      const lengthBonus = Math.min(term.length / 10, 1.5);
      const weight = tf * lengthBonus;

      keywords.push({ term, weight });
    }

    // Sort by weight and return top keywords
    return keywords
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20); // Top 20 keywords
  }

  /**
   * Calculate relevance score between keywords and memory
   */
  private calculateScore(
    keywords: WeightedKeyword[],
    memory: Memory
  ): { score: number; matched: string[] } {
    const memoryText = memory.content.text.toLowerCase();
    let score = 0;
    const matched: string[] = [];

    for (const { term, weight } of keywords) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = memoryText.match(regex);

      if (matches) {
        const matchCount = matches.length;
        // Score = keyword weight * match frequency
        score += weight * matchCount;
        matched.push(term);
      }
    }

    // Boost score for code blocks if current context has code
    if (memory.content.metadata?.codeBlocks) {
      const hasCodeInKeywords = keywords.some(k => 
        ['code', 'function', 'class', 'import', 'def', 'const', 'let', 'var'].includes(k.term)
      );
      if (hasCodeInKeywords) {
        score *= 1.5;
      }
    }

    return { score, matched };
  }

  /**
   * Find relevant memories for given context
   */
  async findRelevant(
    contextText: string,
    options: MatchOptions = {}
  ): Promise<ScoredMemory[]> {
    const {
      maxResults = 5,
      minScore = 0.1,
      conversationId,
      excludeCurrentConversation = true,
    } = options;

    try {
      // Extract keywords from context
      const keywords = this.extractKeywords(contextText);
      
      if (keywords.length === 0) {
        return [];
      }

      // Get all memories (we'll implement smarter filtering later)
      const response = await sendGetMemories({
        limit: 100, // Get recent 100 memories
      });

      if (!response.success || !response.memories) {
        console.error('[Context Matcher] Failed to get memories:', response.error);
        return [];
      }

      // Filter out current conversation if needed
      let memories = response.memories;
      if (excludeCurrentConversation && conversationId) {
        memories = memories.filter(m => m.conversationId !== conversationId);
      }

      // Score each memory
      const scored: ScoredMemory[] = [];
      for (const memory of memories) {
        const { score, matched } = this.calculateScore(keywords, memory);

        if (score >= minScore) {
          scored.push({
            memory,
            score,
            matchedKeywords: matched,
          });
        }
      }

      // Sort by score (descending) and return top N
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    } catch (error) {
      console.error('[Context Matcher] Error finding relevant memories:', error);
      return [];
    }
  }

  /**
   * Find memories similar to a specific memory
   */
  async findSimilar(
    memory: Memory,
    options: MatchOptions = {}
  ): Promise<ScoredMemory[]> {
    return this.findRelevant(memory.content.text, {
      ...options,
      conversationId: memory.conversationId,
      excludeCurrentConversation: true,
    });
  }

  /**
   * Search for memories using keywords
   */
  async searchByKeywords(
    keywords: string[],
    options: MatchOptions = {}
  ): Promise<ScoredMemory[]> {
    const contextText = keywords.join(' ');
    return this.findRelevant(contextText, options);
  }

  /**
   * Get recent memories from a conversation
   */
  async getConversationContext(
    conversationId: string,
    limit: number = 10
  ): Promise<Memory[]> {
    try {
      const response = await sendGetMemories({
        conversationId,
        limit,
      });

      if (response.success && response.memories) {
        return response.memories.sort((a, b) => b.timestamp - a.timestamp);
      }

      return [];
    } catch (error) {
      console.error('[Context Matcher] Error getting conversation context:', error);
      return [];
    }
  }
}

/**
 * Export singleton instance
 */
export const contextMatcher = new ContextMatcher();

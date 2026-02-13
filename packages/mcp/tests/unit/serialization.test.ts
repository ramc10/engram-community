/**
 * Unit tests for serialization helpers
 */

import { memoryToRow, rowToMemory, conversationToRow, rowToConversation } from '../../src/storage/serialization';
import { createTestMemory, createTestMemoryWithMemA, createTestConversation, TEST_DEVICE_ID } from '../__fixtures__/memories';

describe('Serialization', () => {
  describe('memoryToRow / rowToMemory', () => {
    it('should round-trip a basic memory', () => {
      const memory = createTestMemory({ id: 'roundtrip-001' });
      const row = memoryToRow(memory, TEST_DEVICE_ID);
      const restored = rowToMemory({ ...row, created_at: Date.now() });

      expect(restored.id).toBe(memory.id);
      expect(restored.content.role).toBe(memory.content.role);
      expect(restored.content.text).toBe(memory.content.text);
      expect(restored.platform).toBe(memory.platform);
      expect(restored.conversationId).toBe(memory.conversationId);
      expect(restored.tags).toEqual(memory.tags);
      expect(restored.vectorClock).toEqual(memory.vectorClock);
    });

    it('should round-trip a MemoryWithMemA', () => {
      const memory = createTestMemoryWithMemA({ id: 'roundtrip-mema' });
      const row = memoryToRow(memory, TEST_DEVICE_ID);
      const restored = rowToMemory({ ...row, created_at: Date.now() });

      expect(restored.keywords).toEqual(memory.keywords);
      expect(restored.context).toBe(memory.context);
      expect(restored.memAVersion).toBe(memory.memAVersion);
    });

    it('should handle null content fields', () => {
      const memory = createTestMemory({
        id: 'null-content',
        content: { role: 'assistant', text: null },
      });
      const row = memoryToRow(memory, TEST_DEVICE_ID);
      const restored = rowToMemory({ ...row, created_at: Date.now() });

      expect(restored.content.text).toBeNull();
    });

    it('should handle content metadata', () => {
      const memory = createTestMemory({
        id: 'with-metadata',
        content: {
          role: 'assistant',
          text: 'Here is the code:',
          metadata: {
            codeBlocks: [{ language: 'javascript', code: 'console.log("hello")' }],
          },
        },
      });
      const row = memoryToRow(memory, TEST_DEVICE_ID);
      const restored = rowToMemory({ ...row, created_at: Date.now() });

      expect(restored.content.metadata?.codeBlocks?.[0].language).toBe('javascript');
    });

    it('should handle embeddings round-trip', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const memory = createTestMemoryWithMemA({
        id: 'embedding-test',
        embedding,
        embeddingVersion: 1,
      });

      const row = memoryToRow(memory, TEST_DEVICE_ID);
      expect(row.embedding).toBeInstanceOf(Buffer);

      const restored = rowToMemory({ ...row, created_at: Date.now() });
      expect(restored.embedding).toBeInstanceOf(Float32Array);
      expect(restored.embedding!.length).toBe(4);
      expect(Math.abs(restored.embedding![0] - 0.1)).toBeLessThan(0.001);
    });
  });

  describe('conversationToRow / rowToConversation', () => {
    it('should round-trip a conversation', () => {
      const conversation = createTestConversation({ id: 'conv-roundtrip' });
      const row = conversationToRow(conversation);
      const restored = rowToConversation(row);

      expect(restored.id).toBe(conversation.id);
      expect(restored.platform).toBe(conversation.platform);
      expect(restored.title).toBe(conversation.title);
      expect(restored.messageCount).toBe(conversation.messageCount);
      expect(restored.tags).toEqual(conversation.tags);
    });

    it('should handle missing title', () => {
      const conversation = createTestConversation({ id: 'no-title', title: undefined });
      const row = conversationToRow(conversation);
      const restored = rowToConversation(row);

      expect(restored.title).toBeUndefined();
    });
  });
});

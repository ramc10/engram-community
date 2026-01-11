/**
 * Message Handler Unit Tests
 * Tests for message routing, validation, and handler functions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { handleMessage } from '../../../src/background/message-handler';
import { MessageType, createErrorResponse, validateMessage } from '../../../src/lib/messages';
import { BackgroundService } from '../../../src/background/index';
import { createMemory, createEnrichedMemory } from '../../__fixtures__/memories';
import { createUser, createMasterKey } from '../../__fixtures__/users';
import { createMockChromeStorage } from '../../__utils__/test-helpers';

// Declare chrome for TypeScript
declare const chrome: any;

// Mock dependencies
jest.mock('../../../src/lib/premium-service', () => ({
  premiumService: {
    getPremiumStatus: jest.fn(),
    isPremium: jest.fn(),
    upgradeToPremium: jest.fn(),
    requestPremiumUpgrade: jest.fn(),
    enableSync: jest.fn(),
    disableSync: jest.fn(),
  },
}));

jest.mock('../../../src/lib/cloud-sync', () => ({
  CloudSyncService: jest.fn<any>().mockImplementation(() => ({
    start: jest.fn<any>().mockResolvedValue(undefined),
    stop: jest.fn<any>().mockResolvedValue(undefined),
  })),
}));

describe('Message Handler', () => {
  let mockService: any;
  let mockStorage: any;
  let mockCrypto: any;
  let mockAuthClient: any;
  let mockSender: any;

  beforeEach(() => {
    // Setup mocks
    const chromeStorage = createMockChromeStorage();

    mockStorage = {
      saveMemory: jest.fn<any>().mockResolvedValue(undefined),
      getMemories: jest.fn<any>().mockResolvedValue([]),
      getMemory: jest.fn<any>().mockResolvedValue(null),
      getMetadata: jest.fn<any>().mockResolvedValue(null),
      reinitializeEnrichment: jest.fn<any>().mockResolvedValue(undefined),
    };

    mockCrypto = {
      encrypt: jest.fn<any>().mockResolvedValue({
        version: 1,
        algorithm: 'AES-GCM',
        ciphertext: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        salt: new Uint8Array([7, 8, 9]),
      }),
      decrypt: jest.fn<any>().mockImplementation(async () => {
        const json = JSON.stringify({
          role: 'user',
          text: 'Decrypted content',
          metadata: {},
        });
        return new TextEncoder().encode(json);
      }),
      deriveKey: jest.fn<any>().mockResolvedValue(createMasterKey()),
      generateEncryptionKey: jest.fn<any>().mockReturnValue(new Uint8Array(32)),
      generateSalt: jest.fn<any>().mockReturnValue(new Uint8Array(16)),
    };

    mockAuthClient = {
      register: jest.fn<any>().mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
        token: 'jwt-token',
      }),
      login: jest.fn<any>().mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
        token: 'jwt-token',
      }),
      loginWithGoogle: jest.fn<any>().mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
        token: 'jwt-token',
      }),
      logout: jest.fn<any>().mockResolvedValue(undefined),
      getAuthState: jest.fn<any>().mockResolvedValue({
        isAuthenticated: true,
        userId: 'user-123',
        email: 'test@example.com',
      }),
      registerDevice: jest.fn<any>().mockResolvedValue(undefined),
      updateUserMetadata: jest.fn<any>().mockResolvedValue(undefined),
      getSupabaseClient: jest.fn<any>().mockReturnValue({}),
    };

    mockService = {
      getDeviceId: jest.fn<any>().mockReturnValue('device-123'),
      getStorage: jest.fn<any>().mockReturnValue(mockStorage),
      getCrypto: jest.fn<any>().mockReturnValue(mockCrypto),
      getAuthClient: jest.fn<any>().mockReturnValue(mockAuthClient),
      hasMasterKey: jest.fn<any>().mockReturnValue(true),
      getMasterKey: jest.fn<any>().mockReturnValue(createMasterKey()),
      setMasterKey: jest.fn(),
      clearMasterKey: jest.fn(),
      persistMasterKey: jest.fn<any>().mockResolvedValue(undefined),
      clearPersistedMasterKey: jest.fn<any>().mockResolvedValue(undefined),
      initializeCloudSyncIfNeeded: jest.fn<any>().mockResolvedValue(undefined),
      initializePremiumClientIfNeeded: jest.fn<any>().mockResolvedValue(undefined),
      getCloudSync: jest.fn<any>().mockReturnValue(null),
    } as unknown as BackgroundService;

    mockSender = {
      tab: {
        url: 'https://chat.openai.com/c/123',
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Message Validation', () => {
    describe('validateMessage()', () => {
      it('should validate valid message', () => {
        const message = { type: MessageType.INIT_REQUEST };
        const result = validateMessage(message);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject null message', () => {
        const result = validateMessage(null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Message must be an object');
      });

      it('should reject message without type', () => {
        const result = validateMessage({});

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Message must have a type string');
      });

      it('should reject message with non-string type', () => {
        const result = validateMessage({ type: 123 });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Message must have a type string');
      });

      it('should reject message with invalid type', () => {
        const result = validateMessage({ type: 'INVALID_TYPE' });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid message type');
      });
    });

    describe('handleMessage() validation', () => {
      it('should return error for invalid message', async () => {
        const invalidMessage = { invalid: true } as any;

        const response = await handleMessage(invalidMessage, mockSender, mockService);

        expect(response.type).toBe(MessageType.ERROR);
        expect(response.error).toBe('Message must have a type string');
      });

      it('should return error for unknown message type', async () => {
        const message = { type: 'UNKNOWN_TYPE' } as any;

        const response = await handleMessage(message as any, mockSender, mockService);

        expect(response.type).toBe(MessageType.ERROR);
        expect(response.error).toContain('Invalid message');
      });
    });
  });

  describe('INIT_REQUEST', () => {
    it('should handle init request successfully', async () => {
      const message = { type: MessageType.INIT_REQUEST };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.INIT_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.deviceId).toBe('device-123');
      expect(mockService.getDeviceId).toHaveBeenCalled();
    });

    it('should handle init request error', async () => {
      mockService.getDeviceId.mockImplementationOnce(() => {
        throw new Error('Device ID error');
      });

      const message = { type: MessageType.INIT_REQUEST };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.INIT_RESPONSE);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Device ID error');
    });
  });

  describe('SAVE_MESSAGE', () => {
    it('should save message successfully', async () => {
      const extractedMessage = {
        role: 'user' as const,
        content: 'Test message',
        conversationId: 'conv-123',
        timestamp: Date.now(),
        metadata: {},
      };

      const message = {
        type: MessageType.SAVE_MESSAGE,
        message: extractedMessage,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.SAVE_MESSAGE_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.memoryId).toBeDefined();
      expect(mockCrypto.encrypt).toHaveBeenCalled();
      expect(mockStorage.saveMemory).toHaveBeenCalled();
    });

    it('should detect platform from sender URL', async () => {
      mockSender.tab!.url = 'https://claude.ai/chat/123';

      const message = {
        type: MessageType.SAVE_MESSAGE,
        message: {
          role: 'user' as const,
          content: 'Test',
          conversationId: 'conv-123',
          timestamp: Date.now(),
        },
      };

      await handleMessage(message as any, mockSender, mockService);

      const savedMemory = mockStorage.saveMemory.mock.calls[0][0];
      expect(savedMemory.platform).toBe('claude');
    });

    it('should require master key for saving', async () => {
      mockService.hasMasterKey.mockReturnValue(false);

      const message = {
        type: MessageType.SAVE_MESSAGE,
        message: {
          role: 'user' as const,
          content: 'Test',
          conversationId: 'conv-123',
          timestamp: Date.now(),
        },
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Authentication required');
    });

    it('should handle missing message data', async () => {
      const message = {
        type: MessageType.SAVE_MESSAGE,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Missing message data');
    });

    it('should handle encryption error', async () => {
      mockCrypto.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      const message = {
        type: MessageType.SAVE_MESSAGE,
        message: {
          role: 'user' as const,
          content: 'Test',
          conversationId: 'conv-123',
          timestamp: Date.now(),
        },
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Encryption failed');
    });
  });

  describe('GET_MEMORIES', () => {
    it('should get memories successfully', async () => {
      const memories = [
        {
          ...createMemory(),
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
          },
        },
      ];
      mockStorage.getMemories.mockResolvedValue(memories);

      const message = { type: MessageType.GET_MEMORIES };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.GET_MEMORIES_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.memories).toBeDefined();
      expect(Array.isArray(response.memories)).toBe(true);
      expect(mockStorage.getMemories).toHaveBeenCalledWith({});
    });

    it('should apply filter when provided', async () => {
      mockStorage.getMemories.mockResolvedValue([]);

      const message = {
        type: MessageType.GET_MEMORIES,
        filter: { conversationId: 'conv-123' },
      };

      await handleMessage(message as any, mockSender, mockService);

      expect(mockStorage.getMemories).toHaveBeenCalledWith({ conversationId: 'conv-123' });
    });

    it('should decrypt memories before returning', async () => {
      const encryptedMemory = {
        ...createMemory(),
        content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
        encryptedContent: {
          version: 1,
          algorithm: 'AES-GCM',
          ciphertext: new Uint8Array([1, 2, 3]),
          iv: new Uint8Array([4, 5, 6]),
          salt: new Uint8Array([7, 8, 9]),
        },
      };
      mockStorage.getMemories.mockResolvedValue([encryptedMemory]);

      const message = { type: MessageType.GET_MEMORIES };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(mockCrypto.decrypt).toHaveBeenCalled();
      expect(response.memories[0].content.text).toBe('Decrypted content');
    });

    it('should return encrypted memories when no master key', async () => {
      mockService.hasMasterKey.mockReturnValue(false);

      const encryptedMemory = {
        ...createMemory(),
        content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
        encryptedContent: {
          version: 1,
          algorithm: 'AES-GCM',
          ciphertext: new Uint8Array([1, 2, 3]),
          iv: new Uint8Array([4, 5, 6]),
          salt: new Uint8Array([7, 8, 9]),
        },
      };
      mockStorage.getMemories.mockResolvedValue([encryptedMemory]);

      const message = { type: MessageType.GET_MEMORIES };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(mockCrypto.decrypt).not.toHaveBeenCalled();
      expect(response.memories[0].content.text).toBe('[ENCRYPTED]');
    });

    it('should handle decryption errors gracefully', async () => {
      mockCrypto.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const encryptedMemory = {
        ...createMemory(),
        content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
        encryptedContent: {
          version: 1,
          algorithm: 'AES-GCM',
          ciphertext: new Uint8Array([1, 2, 3]),
          iv: new Uint8Array([4, 5, 6]),
          salt: new Uint8Array([7, 8, 9]),
        },
      };
      mockStorage.getMemories.mockResolvedValue([encryptedMemory]);

      const message = { type: MessageType.GET_MEMORIES };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      // Should return memory as-is when decryption fails
      expect(response.memories[0].content.text).toBe('[ENCRYPTED]');
    });
  });

  describe('SEARCH_MEMORIES', () => {
    beforeEach(() => {
      // Update decrypt mock to preserve the original text during search tests
      mockCrypto.decrypt.mockImplementation(async (encryptedContent: any) => {
        // Return the text that was "encrypted"
        const text = encryptedContent.originalText || 'Decrypted content';
        const json = JSON.stringify({
          role: 'user',
          text: text,
          metadata: {},
        });
        return new TextEncoder().encode(json);
      });
    });

    it('should search memories successfully', async () => {
      const memories = [
        {
          ...createMemory(),
          content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
            originalText: 'Hello world', // Helper for mock
          } as any,
        },
        {
          ...createMemory(),
          content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
            originalText: 'Goodbye world', // Helper for mock
          } as any,
        },
      ];
      mockStorage.getMemories.mockResolvedValue(memories);

      const message = {
        type: MessageType.SEARCH_MEMORIES,
        query: 'world',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.SEARCH_MEMORIES_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.memories).toHaveLength(2);
    });

    it('should filter by search query', async () => {
      const memories = [
        {
          ...createMemory(),
          content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
            originalText: 'Hello world',
          } as any,
        },
        {
          ...createMemory(),
          content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
            originalText: 'Unrelated content',
          } as any,
        },
      ];
      mockStorage.getMemories.mockResolvedValue(memories);

      const message = {
        type: MessageType.SEARCH_MEMORIES,
        query: 'world',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].content.text).toContain('world');
    });

    it('should apply limit when provided', async () => {
      const memories = Array.from({ length: 10 }, () => ({
        ...createMemory(),
        content: { role: 'user' as const, text: '[ENCRYPTED]', metadata: {} },
        encryptedContent: {
          version: 1,
          algorithm: 'AES-GCM',
          ciphertext: new Uint8Array([1, 2, 3]),
          iv: new Uint8Array([4, 5, 6]),
          salt: new Uint8Array([7, 8, 9]),
          originalText: 'Match content',
        } as any,
      }));
      mockStorage.getMemories.mockResolvedValue(memories);

      const message = {
        type: MessageType.SEARCH_MEMORIES,
        query: 'Match',
        limit: 5,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(response.memories).toHaveLength(5);
    });

    it('should require search query', async () => {
      const message = {
        type: MessageType.SEARCH_MEMORIES,
        query: '',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Search query is required');
    });

    it('should search in tags', async () => {
      const memories = [
        {
          ...createMemory(),
          content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
          tags: ['javascript', 'testing'],
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
            originalText: 'Some text',
          } as any,
        },
      ];
      mockStorage.getMemories.mockResolvedValue(memories);

      const message = {
        type: MessageType.SEARCH_MEMORIES,
        query: 'javascript',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(response.memories).toHaveLength(1);
    });

    it('should be case-insensitive', async () => {
      const memories = [
        {
          ...createMemory(),
          content: { role: 'user', text: '[ENCRYPTED]', metadata: {} },
          encryptedContent: {
            version: 1,
            algorithm: 'AES-GCM',
            ciphertext: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array([4, 5, 6]),
            salt: new Uint8Array([7, 8, 9]),
            originalText: 'JavaScript Tutorial',
          } as any,
        },
      ];
      mockStorage.getMemories.mockResolvedValue(memories);

      const message = {
        type: MessageType.SEARCH_MEMORIES,
        query: 'javascript',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(response.memories).toHaveLength(1);
    });
  });

  describe('GET_SYNC_STATUS', () => {
    it('should get sync status successfully', async () => {
      mockStorage.getMetadata.mockResolvedValue(Date.now() - 60000);

      const message = { type: MessageType.GET_SYNC_STATUS };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.GET_SYNC_STATUS_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
      expect(response.status.deviceId).toBe('device-123');
      expect(response.status.pendingOperations).toBe(0);
    });

    it('should include last sync time if available', async () => {
      const lastSyncTime = Date.now() - 60000;
      mockStorage.getMetadata.mockResolvedValue(lastSyncTime);

      const message = { type: MessageType.GET_SYNC_STATUS };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.status.lastSyncTime).toBe(lastSyncTime);
    });
  });

  describe('AUTH_REGISTER', () => {
    it('should register user successfully', async () => {
      const message = {
        type: MessageType.AUTH_REGISTER,
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.AUTH_REGISTER_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.userId).toBe('user-123');
      expect(response.email).toBe('test@example.com');
      expect(mockAuthClient.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
      // Verify salt generation and usage
      expect(mockCrypto.generateSalt).toHaveBeenCalled();
      expect(mockAuthClient.updateUserMetadata).toHaveBeenCalledWith({
        engram_salt: expect.any(String)
      });
      expect(mockCrypto.deriveKey).toHaveBeenCalledWith(
        'SecurePass123!',
        expect.any(Uint8Array)
      );
      expect(mockService.setMasterKey).toHaveBeenCalled();
      expect(mockService.persistMasterKey).toHaveBeenCalled();
    });

    it('should require email and password', async () => {
      const message = {
        type: MessageType.AUTH_REGISTER,
        email: 'test@example.com',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Email and password are required');
    });

    it('should handle registration error', async () => {
      mockAuthClient.register.mockRejectedValueOnce(new Error('Email already exists'));

      const message = {
        type: MessageType.AUTH_REGISTER,
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Email already exists');
    });
  });

  describe('AUTH_LOGIN', () => {
    it('should login user successfully', async () => {
      const message = {
        type: MessageType.AUTH_LOGIN,
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.AUTH_LOGIN_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.userId).toBe('user-123');
      expect(response.email).toBe('test@example.com');
      expect(mockAuthClient.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
      expect(mockCrypto.deriveKey).toHaveBeenCalled();
      expect(mockService.setMasterKey).toHaveBeenCalled();
    });

    it('should use existing salt from metadata on login', async () => {
      const existingSalt = new Uint8Array(16).fill(1); // 16 bytes of 0x01
      const base64Salt = Buffer.from(existingSalt).toString('base64');

      mockAuthClient.login.mockResolvedValueOnce({
        token: 'fake-jwt',
        expiresIn: '3600',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { engram_salt: base64Salt }
        }
      });

      const message = {
        type: MessageType.AUTH_LOGIN,
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      await handleMessage(message as any, mockSender, mockService);

      // Verify it used the existing salt, not generated a new one
      expect(mockCrypto.generateSalt).not.toHaveBeenCalled();
      expect(mockCrypto.deriveKey).toHaveBeenCalledWith(
        'SecurePass123!',
        expect.any(Uint8Array)
      );

      const saltArg = mockCrypto.deriveKey.mock.calls[0][1];
      expect(Buffer.from(saltArg)).toEqual(Buffer.from(existingSalt));
    });

    it('should require email and password', async () => {
      const message = {
        type: MessageType.AUTH_LOGIN,
        password: 'SecurePass123!',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Email and password are required');
    });

    it('should handle login error', async () => {
      mockAuthClient.login.mockRejectedValueOnce(new Error('Invalid credentials'));

      const message = {
        type: MessageType.AUTH_LOGIN,
        email: 'test@example.com',
        password: 'WrongPass',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid credentials');
    });
  });

  describe('AUTH_LOGIN_GOOGLE', () => {
    it('should login with Google successfully', async () => {
      const message = { type: MessageType.AUTH_LOGIN_GOOGLE };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.AUTH_LOGIN_GOOGLE_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.userId).toBe('user-123');
      expect(response.email).toBe('test@example.com');
      expect(mockAuthClient.loginWithGoogle).toHaveBeenCalled();
      expect(mockCrypto.generateEncryptionKey).toHaveBeenCalled();
      expect(mockService.setMasterKey).toHaveBeenCalled();
    });

    it('should generate master key for Google OAuth user', async () => {
      const message = { type: MessageType.AUTH_LOGIN_GOOGLE };

      await handleMessage(message as any, mockSender, mockService);

      expect(mockCrypto.generateEncryptionKey).toHaveBeenCalled();
      expect(mockCrypto.generateSalt).toHaveBeenCalled();
    });

    it('should handle Google login error', async () => {
      mockAuthClient.loginWithGoogle.mockRejectedValueOnce(new Error('OAuth cancelled'));

      const message = { type: MessageType.AUTH_LOGIN_GOOGLE };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('OAuth cancelled');
    });
  });

  describe('AUTH_LOGOUT', () => {
    it('should logout user successfully', async () => {
      const message = { type: MessageType.AUTH_LOGOUT };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.AUTH_LOGOUT_RESPONSE);
      expect(response.success).toBe(true);
      expect(mockAuthClient.logout).toHaveBeenCalled();
      expect(mockService.clearMasterKey).toHaveBeenCalled();
      expect(mockService.clearPersistedMasterKey).toHaveBeenCalled();
    });

    it('should stop cloud sync on logout', async () => {
      const mockCloudSync = {
        stop: jest.fn<any>().mockResolvedValue(undefined),
      };
      mockService.getCloudSync.mockReturnValue(mockCloudSync);

      const message = { type: MessageType.AUTH_LOGOUT };

      await handleMessage(message as any, mockSender, mockService);

      expect(mockCloudSync.stop).toHaveBeenCalled();
    });

    it('should clear client state even if server logout fails', async () => {
      mockAuthClient.logout.mockRejectedValueOnce(new Error('Network error'));

      const message = { type: MessageType.AUTH_LOGOUT };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(mockService.clearMasterKey).toHaveBeenCalled();
      expect(mockService.clearPersistedMasterKey).toHaveBeenCalled();
    });
  });

  describe('GET_AUTH_STATE', () => {
    it('should get auth state successfully', async () => {
      const message = { type: MessageType.GET_AUTH_STATE };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.GET_AUTH_STATE_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.authState).toBeDefined();
      expect(response.authState.isAuthenticated).toBe(true);
      expect(response.authState.userId).toBe('user-123');
      expect(response.authState.email).toBe('test@example.com');
    });

    it('should require both auth and master key for authenticated state', async () => {
      mockService.hasMasterKey.mockReturnValue(false);

      const message = { type: MessageType.GET_AUTH_STATE };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
      expect(response.authState.isAuthenticated).toBe(false);
    });
  });

  describe('GET_PREMIUM_STATUS', () => {
    const { premiumService } = require('../../../src/lib/premium-service');

    it('should get premium status successfully', async () => {
      premiumService.getPremiumStatus.mockResolvedValue({
        tier: 'premium',
        isPremium: true,
        syncEnabled: true,
        premiumSince: '2024-01-01',
        hasPendingRequest: false,
      });

      const message = { type: MessageType.GET_PREMIUM_STATUS };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.GET_PREMIUM_STATUS_RESPONSE);
      expect(response.success).toBe(true);
      expect(response.status.isPremium).toBe(true);
      expect(premiumService.getPremiumStatus).toHaveBeenCalledWith('user-123', expect.any(Object));
    });

    it('should require authentication', async () => {
      mockAuthClient.getAuthState.mockResolvedValue({
        isAuthenticated: false,
        userId: null,
        email: null,
      });

      const message = { type: MessageType.GET_PREMIUM_STATUS };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Not authenticated');
    });
  });

  describe('UPGRADE_TO_PREMIUM', () => {
    const { premiumService } = require('../../../src/lib/premium-service');

    it('should upgrade to premium successfully', async () => {
      premiumService.upgradeToPremium.mockResolvedValue(undefined);

      const message = { type: MessageType.UPGRADE_TO_PREMIUM };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.UPGRADE_TO_PREMIUM_RESPONSE);
      expect(response.success).toBe(true);
      expect(premiumService.upgradeToPremium).toHaveBeenCalledWith('user-123');
    });

    it('should require authentication', async () => {
      mockAuthClient.getAuthState.mockResolvedValue({
        isAuthenticated: false,
        userId: null,
        email: null,
      });

      const message = { type: MessageType.UPGRADE_TO_PREMIUM };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Not authenticated');
    });
  });

  describe('REQUEST_PREMIUM_UPGRADE', () => {
    const { premiumService } = require('../../../src/lib/premium-service');

    it('should request premium upgrade successfully', async () => {
      premiumService.requestPremiumUpgrade.mockResolvedValue(undefined);

      const message = { type: MessageType.REQUEST_PREMIUM_UPGRADE };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.REQUEST_PREMIUM_UPGRADE_RESPONSE);
      expect(response.success).toBe(true);
      expect(premiumService.requestPremiumUpgrade).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        expect.any(Object)
      );
    });

    it('should require authentication with email', async () => {
      mockAuthClient.getAuthState.mockResolvedValue({
        isAuthenticated: true,
        userId: 'user-123',
        email: null,
      });

      const message = { type: MessageType.REQUEST_PREMIUM_UPGRADE };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Not authenticated');
    });
  });

  describe('START_CLOUD_SYNC', () => {
    const { premiumService } = require('../../../src/lib/premium-service');

    it('should start cloud sync successfully', async () => {
      premiumService.isPremium.mockResolvedValue(true);
      premiumService.enableSync.mockResolvedValue(undefined);

      const message = { type: MessageType.START_CLOUD_SYNC };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.START_CLOUD_SYNC_RESPONSE);
      expect(response.success).toBe(true);
      expect(premiumService.isPremium).toHaveBeenCalled();
      expect(premiumService.enableSync).toHaveBeenCalled();
      expect(mockService.initializeCloudSyncIfNeeded).toHaveBeenCalled();
    });

    it('should require premium subscription', async () => {
      premiumService.isPremium.mockResolvedValue(false);

      const message = { type: MessageType.START_CLOUD_SYNC };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Premium subscription required for cloud sync');
    });

    it('should require authentication', async () => {
      mockAuthClient.getAuthState.mockResolvedValue({
        isAuthenticated: false,
        userId: null,
        email: null,
      });

      const message = { type: MessageType.START_CLOUD_SYNC };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Not authenticated');
    });
  });

  describe('STOP_CLOUD_SYNC', () => {
    const { premiumService } = require('../../../src/lib/premium-service');

    it('should stop cloud sync successfully', async () => {
      const mockCloudSync = {
        stop: jest.fn<any>().mockResolvedValue(undefined),
      };
      mockService.getCloudSync.mockReturnValue(mockCloudSync);
      premiumService.disableSync.mockResolvedValue(undefined);

      const message = { type: MessageType.STOP_CLOUD_SYNC };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.STOP_CLOUD_SYNC_RESPONSE);
      expect(response.success).toBe(true);
      expect(premiumService.disableSync).toHaveBeenCalled();
      expect(mockCloudSync.stop).toHaveBeenCalled();
    });

    it('should handle when cloud sync is not running', async () => {
      mockService.getCloudSync.mockReturnValue(null);

      const message = { type: MessageType.STOP_CLOUD_SYNC };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(true);
    });
  });

  describe('REINITIALIZE_ENRICHMENT', () => {
    it('should reinitialize enrichment successfully', async () => {
      const message = { type: MessageType.REINITIALIZE_ENRICHMENT };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.REINITIALIZE_ENRICHMENT_RESPONSE);
      expect(response.success).toBe(true);
      expect(mockStorage.reinitializeEnrichment).toHaveBeenCalled();
      expect(mockService.initializePremiumClientIfNeeded).toHaveBeenCalled();
    });

    it('should handle enrichment initialization error', async () => {
      mockStorage.reinitializeEnrichment.mockRejectedValueOnce(new Error('Init failed'));

      const message = { type: MessageType.REINITIALIZE_ENRICHMENT };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Init failed');
    });
  });

  describe('REVERT_EVOLUTION', () => {
    it('should revert evolution successfully', async () => {
      const memory = {
        ...createEnrichedMemory(),
        evolution: {
          version: 2,
          history: [
            {
              keywords: ['old', 'keywords'],
              tags: ['old-tag'],
              context: 'Old context',
              timestamp: Date.now() - 10000,
            },
            {
              keywords: ['new', 'keywords'],
              tags: ['new-tag'],
              context: 'New context',
              timestamp: Date.now(),
            },
          ],
        },
      };
      mockStorage.getMemory.mockResolvedValue(memory);

      const message = {
        type: MessageType.REVERT_EVOLUTION,
        memoryId: memory.id,
        versionIndex: 0,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.REVERT_EVOLUTION_RESPONSE);
      expect(response.success).toBe(true);
      expect(mockStorage.saveMemory).toHaveBeenCalled();
    });

    it('should require memoryId', async () => {
      const message = {
        type: MessageType.REVERT_EVOLUTION,
        versionIndex: 0,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Missing memoryId');
    });

    it('should require versionIndex', async () => {
      const message = {
        type: MessageType.REVERT_EVOLUTION,
        memoryId: 'mem-123',
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Missing versionIndex');
    });

    it('should handle memory not found', async () => {
      mockStorage.getMemory.mockResolvedValue(null);

      const message = {
        type: MessageType.REVERT_EVOLUTION,
        memoryId: 'nonexistent',
        versionIndex: 0,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Memory not found');
    });

    it('should handle memory with no evolution history', async () => {
      const memory = createMemory();
      mockStorage.getMemory.mockResolvedValue(memory);

      const message = {
        type: MessageType.REVERT_EVOLUTION,
        memoryId: memory.id,
        versionIndex: 0,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Memory has no evolution history');
    });

    it('should validate versionIndex range', async () => {
      const memory = {
        ...createMemory(),
        evolution: {
          version: 1,
          history: [{ keywords: [], tags: [], context: '', timestamp: Date.now() }],
        },
      };
      mockStorage.getMemory.mockResolvedValue(memory);

      const message = {
        type: MessageType.REVERT_EVOLUTION,
        memoryId: memory.id,
        versionIndex: 5,
      };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid versionIndex');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors in message handler', async () => {
      mockService.getDeviceId.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const message = { type: MessageType.INIT_REQUEST };

      const response = await handleMessage(message as any, mockSender, mockService);

      expect(response.type).toBe(MessageType.INIT_RESPONSE);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Unexpected error');
    });

    it('should create proper error response', () => {
      const errorResponse = createErrorResponse('Test error', MessageType.SAVE_MESSAGE);

      expect(errorResponse.type).toBe(MessageType.ERROR);
      expect(errorResponse.error).toBe('Test error');
      expect(errorResponse.originalType).toBe(MessageType.SAVE_MESSAGE);
    });

    it('should handle Error objects in createErrorResponse', () => {
      const errorResponse = createErrorResponse(new Error('Error object'), MessageType.GET_MEMORIES);

      expect(errorResponse.type).toBe(MessageType.ERROR);
      expect(errorResponse.error).toBe('Error object');
      expect(errorResponse.originalType).toBe(MessageType.GET_MEMORIES);
    });
  });
});

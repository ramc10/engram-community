/**
 * Premium API Client Unit Tests
 * Tests for authentication, enrichment, link detection, and evolution
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PremiumAPIClient } from '../../../src/lib/premium-api-client';
import { createMemory } from '../../__fixtures__/memories';
import { createEnrichmentResponse, createAuthResponse, createRateLimitError } from '../../__fixtures__/premium-api';
import { createMockChromeStorage, createMockFetch } from '../../__utils__/test-helpers';

describe('PremiumAPIClient', () => {
  let client: PremiumAPIClient;
  let mockStorage: ReturnType<typeof createMockChromeStorage>;
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    // Setup mocks
    mockStorage = createMockChromeStorage();
    ((global as any).chrome.storage.local as any) = mockStorage;

    mockFetch = createMockFetch();
    global.fetch = mockFetch.fetch;

    // Create client instance
    client = new PremiumAPIClient('http://localhost:3000');
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });

  describe('Authentication', () => {
    describe('authenticate()', () => {
      it('should authenticate with valid license key', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);

        await client.authenticate('ENGRAM-TEST-KEY');

        expect(mockFetch.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/login',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ licenseKey: 'ENGRAM-TEST-KEY' }),
          })
        );

        expect(client.isAuthenticated()).toBe(true);
        expect(client.getUser()).toEqual(authResponse.user);
        expect(client.getLicense()).toEqual(authResponse.license);
      });

      it('should store token in chrome.storage.local', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);

        await client.authenticate('ENGRAM-TEST-KEY');

        expect(mockStorage.storage.get('premium_jwt_token')).toBe(authResponse.token);
        expect(mockStorage.storage.get('premium_user_info')).toEqual(authResponse.user);
        expect(mockStorage.storage.get('premium_license_info')).toEqual(authResponse.license);
      });

      it('should throw error on invalid license key', async () => {
        mockFetch.mockResponse(
          { message: 'Invalid license key' },
          { ok: false, status: 401 }
        );

        await expect(client.authenticate('INVALID-KEY')).rejects.toThrow('Invalid license key');
        expect(client.isAuthenticated()).toBe(false);
      });

      it('should throw error on network failure', async () => {
        mockFetch.mockNetworkError();

        await expect(client.authenticate('ENGRAM-TEST-KEY')).rejects.toThrow('Network request failed');
        expect(client.isAuthenticated()).toBe(false);
      });

      it('should throw error on server error', async () => {
        mockFetch.mockResponse(
          { error: 'Server error' },
          { ok: false, status: 500 }
        );

        await expect(client.authenticate('ENGRAM-TEST-KEY')).rejects.toThrow();
      });
    });

    describe('initialize()', () => {
      it('should restore authentication from storage', async () => {
        const authResponse = createAuthResponse();
        mockStorage.storage.set('premium_jwt_token', authResponse.token);
        mockStorage.storage.set('premium_user_info', authResponse.user);
        mockStorage.storage.set('premium_license_info', authResponse.license);

        // Mock verifyToken to return true
        mockFetch.mockResponse({}, { ok: true });

        const result = await client.initialize();

        expect(result).toBe(true);
        expect(client.isAuthenticated()).toBe(true);
        expect(client.getUser()).toEqual(authResponse.user);
        expect(client.getLicense()).toEqual(authResponse.license);
      });

      it('should return false when no token in storage', async () => {
        const result = await client.initialize();

        expect(result).toBe(false);
        expect(client.isAuthenticated()).toBe(false);
      });

      it('should clear auth if token verification fails', async () => {
        const authResponse = createAuthResponse();
        mockStorage.storage.set('premium_jwt_token', authResponse.token);
        mockStorage.storage.set('premium_user_info', authResponse.user);
        mockStorage.storage.set('premium_license_info', authResponse.license);

        // Mock verifyToken to return false
        mockFetch.mockResponse({}, { ok: false, status: 401 });

        const result = await client.initialize();

        expect(result).toBe(false);
        expect(client.isAuthenticated()).toBe(false);
        expect(mockStorage.storage.has('premium_jwt_token')).toBe(false);
      });

      it('should handle storage errors gracefully', async () => {
        // Mock storage.get to throw
        mockStorage.get.mockRejectedValueOnce(new Error('Storage error'));

        const result = await client.initialize();

        expect(result).toBe(false);
        expect(client.isAuthenticated()).toBe(false);
      });
    });

    describe('verifyToken()', () => {
      it('should return true for valid token', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        // Mock verify endpoint
        mockFetch.mockResponse({}, { ok: true });
        const result = await client.verifyToken();

        expect(result).toBe(true);
        expect(mockFetch.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/verify',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${authResponse.token}`,
            }),
          })
        );
      });

      it('should return false for invalid token', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        // Mock verify endpoint to fail
        mockFetch.mockResponse({}, { ok: false, status: 401 });
        const result = await client.verifyToken();

        expect(result).toBe(false);
      });

      it('should return false when not authenticated', async () => {
        const result = await client.verifyToken();
        expect(result).toBe(false);
      });

      it('should handle network errors', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        mockFetch.mockNetworkError();
        const result = await client.verifyToken();

        expect(result).toBe(false);
      });
    });

    describe('clearAuth()', () => {
      it('should clear authentication data', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        expect(client.isAuthenticated()).toBe(true);

        await client.clearAuth();

        expect(client.isAuthenticated()).toBe(false);
        expect(client.getUser()).toBeNull();
        expect(client.getLicense()).toBeNull();
        expect(mockStorage.storage.has('premium_jwt_token')).toBe(false);
        expect(mockStorage.storage.has('premium_user_info')).toBe(false);
        expect(mockStorage.storage.has('premium_license_info')).toBe(false);
      });

      it('should be idempotent', async () => {
        await client.clearAuth();
        await client.clearAuth(); // Should not throw

        expect(client.isAuthenticated()).toBe(false);
      });
    });

    describe('isAuthenticated()', () => {
      it('should return true when authenticated', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        expect(client.isAuthenticated()).toBe(true);
      });

      it('should return false when not authenticated', () => {
        expect(client.isAuthenticated()).toBe(false);
      });

      it('should return false after clearAuth', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        await client.clearAuth();

        expect(client.isAuthenticated()).toBe(false);
      });
    });

    describe('getUser()', () => {
      it('should return user info when authenticated', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        const user = client.getUser();

        expect(user).toEqual(authResponse.user);
        expect(user?.id).toBe('user-123');
        expect(user?.email).toBe('test@example.com');
      });

      it('should return null when not authenticated', () => {
        expect(client.getUser()).toBeNull();
      });
    });

    describe('getLicense()', () => {
      it('should return license info when authenticated', async () => {
        const authResponse = createAuthResponse();
        mockFetch.mockResponse(authResponse);
        await client.authenticate('ENGRAM-TEST-KEY');

        const license = client.getLicense();

        expect(license).toEqual(authResponse.license);
        expect(license?.tier).toBe('PRO');
        expect(license?.rateLimit).toBe(500);
      });

      it('should return null when not authenticated', () => {
        expect(client.getLicense()).toBeNull();
      });
    });
  });

  describe('Enrichment', () => {
    beforeEach(async () => {
      // Authenticate first
      const authResponse = createAuthResponse();
      mockFetch.mockResponse(authResponse);
      await client.authenticate('ENGRAM-TEST-KEY');
    });

    describe('enrich()', () => {
      it('should enrich content successfully', async () => {
        const enrichmentResponse = createEnrichmentResponse();
        mockFetch.mockResponse({ enrichment: enrichmentResponse });

        const result = await client.enrich('Test content to enrich');

        expect(mockFetch.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/enrich',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: expect.stringContaining('Bearer '),
            }),
            body: JSON.stringify({ content: 'Test content to enrich' }),
          })
        );

        expect(result).toEqual(enrichmentResponse);
        expect(result.keywords).toHaveLength(5);
        expect(result.tags).toHaveLength(4);
        expect(result.context).toBeDefined();
      });

      it('should throw error when not authenticated', async () => {
        await client.clearAuth();

        await expect(client.enrich('Test content')).rejects.toThrow('Not authenticated');
      });

      it('should handle rate limit errors', async () => {
        mockFetch.mockResponse(
          'Rate limit exceeded',
          { ok: false, status: 429 }
        );

        await expect(client.enrich('Test content')).rejects.toThrow();
      });

      it('should handle server errors', async () => {
        mockFetch.mockResponse(
          'Server error',
          { ok: false, status: 500 }
        );

        await expect(client.enrich('Test content')).rejects.toThrow();
      });

      it('should handle missing enrichment data in response', async () => {
        mockFetch.mockResponse({ noEnrichment: true });

        await expect(client.enrich('Test content')).rejects.toThrow('No enrichment data in response');
      });

      it('should handle network errors', async () => {
        mockFetch.mockNetworkError();

        await expect(client.enrich('Test content')).rejects.toThrow('Network request failed');
      });
    });
  });

  describe('Link Detection', () => {
    beforeEach(async () => {
      // Authenticate first
      const authResponse = createAuthResponse();
      mockFetch.mockResponse(authResponse);
      await client.authenticate('ENGRAM-TEST-KEY');
    });

    describe('detectLinks()', () => {
      it('should detect links between memories', async () => {
        const newMemory = createMemory();
        const existingMemories = [createMemory(), createMemory()];

        const linksResponse = {
          links: [
            {
              targetId: existingMemories[0].id,
              relationship: 'follows_from',
              confidence: 0.92,
              reason: 'Related topic discussion',
            },
          ],
        };

        mockFetch.mockResponse(linksResponse);

        const result = await client.detectLinks(newMemory, existingMemories);

        expect(mockFetch.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/links/detect',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: expect.stringContaining('Bearer '),
            }),
          })
        );

        expect(result).toEqual(linksResponse.links);
        expect(result).toHaveLength(1);
        expect(result[0].confidence).toBe(0.92);
      });

      it('should throw error when not authenticated', async () => {
        await client.clearAuth();

        const newMemory = createMemory();
        const existingMemories = [createMemory()];

        await expect(client.detectLinks(newMemory, existingMemories)).rejects.toThrow('Not authenticated');
      });

      it('should handle empty existing memories', async () => {
        const newMemory = createMemory();
        mockFetch.mockResponse({ links: [] });

        const result = await client.detectLinks(newMemory, []);

        expect(result).toEqual([]);
      });

      it('should handle server errors', async () => {
        mockFetch.mockResponse(
          { message: 'Link detection failed' },
          { ok: false, status: 500 }
        );

        const newMemory = createMemory();
        const existingMemories = [createMemory()];

        await expect(client.detectLinks(newMemory, existingMemories)).rejects.toThrow();
      });
    });
  });

  describe('Evolution', () => {
    beforeEach(async () => {
      // Authenticate first
      const authResponse = createAuthResponse();
      mockFetch.mockResponse(authResponse);
      await client.authenticate('ENGRAM-TEST-KEY');
    });

    describe('checkEvolution()', () => {
      it('should check if memory should evolve', async () => {
        const memory = createMemory();
        const newInformation = 'New related information';

        const evolutionResponse = {
          evolution: {
            shouldEvolve: true,
            reason: 'New information expands understanding',
            updatedContent: 'Enhanced context',
            changeType: 'expansion',
          },
        };

        mockFetch.mockResponse(evolutionResponse);

        const result = await client.checkEvolution(memory, newInformation);

        expect(mockFetch.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/evolve/check',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: expect.stringContaining('Bearer '),
            }),
          })
        );

        expect(result).toEqual(evolutionResponse.evolution);
        expect(result.shouldEvolve).toBe(true);
        expect(result.changeType).toBe('expansion');
      });

      it('should handle no evolution needed', async () => {
        const memory = createMemory();
        mockFetch.mockResponse({
          evolution: {
            shouldEvolve: false,
            reason: 'No significant new information',
            updatedContent: null,
            changeType: 'none',
          },
        });

        const result = await client.checkEvolution(memory, 'Minor detail');

        expect(result.shouldEvolve).toBe(false);
      });

      it('should throw error when not authenticated', async () => {
        await client.clearAuth();

        const memory = createMemory();

        await expect(client.checkEvolution(memory, 'New info')).rejects.toThrow('Not authenticated');
      });

      it('should handle server errors', async () => {
        mockFetch.mockResponse(
          { message: 'Evolution check failed' },
          { ok: false, status: 500 }
        );

        const memory = createMemory();

        await expect(client.checkEvolution(memory, 'New info')).rejects.toThrow();
      });
    });
  });

  describe('Health Check', () => {
    describe('healthCheck()', () => {
      it('should return true when API is healthy', async () => {
        mockFetch.mockResponse({}, { ok: true });

        const result = await client.healthCheck();

        expect(result).toBe(true);
        expect(mockFetch.fetch).toHaveBeenCalledWith('http://localhost:3000/health');
      });

      it('should return false when API is down', async () => {
        mockFetch.mockResponse({}, { ok: false, status: 503 });

        const result = await client.healthCheck();

        expect(result).toBe(false);
      });

      it('should return false on network error', async () => {
        mockFetch.mockNetworkError();

        const result = await client.healthCheck();

        expect(result).toBe(false);
      });
    });
  });

  describe('Configuration', () => {
    it('should use default base URL', () => {
      const defaultClient = new PremiumAPIClient();
      expect(defaultClient).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const customClient = new PremiumAPIClient('https://custom-api.example.com');
      expect(customClient).toBeDefined();
    });
  });
});

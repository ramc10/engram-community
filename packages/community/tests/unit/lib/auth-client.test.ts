/**
 * AuthClient Unit Tests
 * Tests for Supabase authentication including email/password and Google OAuth
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthClient } from '../../../src/lib/auth-client';
import { createMockChromeStorage } from '../../__utils__/test-helpers';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    signInWithIdToken: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('AuthClient', () => {
  let authClient: AuthClient;
  let mockStorage: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    // Setup Chrome storage mock
    mockStorage = createMockChromeStorage();
    (global as any).chrome = {
      storage: {
        local: mockStorage,
      },
      identity: {
        getRedirectURL: jest.fn(() => 'https://test.chromiumapp.org/'),
        launchWebAuthFlow: jest.fn(),
      },
      runtime: {
        lastError: null,
      },
    };

    // Reset all mocks
    jest.clearAllMocks();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    authClient = new AuthClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });

  describe('register()', () => {
    it('should register a new user successfully', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 3600,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          email_confirmed_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          user_metadata: { name: 'Test User' },
        },
      };

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: mockSession.user,
          session: mockSession,
        },
        error: null,
      });

      const result = await authClient.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        token: 'test-token',
        expiresIn: '3600',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: true,
          createdAt: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
          user_metadata: { name: 'Test User' },
        },
      });
    });

    it('should throw error when registration fails', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already exists' },
      });

      await expect(
        authClient.register({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('User already exists');
    });

    it('should throw error when no user returned', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      await expect(
        authClient.register({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Registration failed - no user or session returned');
    });
  });

  describe('login()', () => {
    it('should login successfully with valid credentials', async () => {
      const mockSession = {
        access_token: 'test-token',
        expires_in: 3600,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          email_confirmed_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          user_metadata: {},
        },
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockSession.user,
          session: mockSession,
        },
        error: null,
      });

      const result = await authClient.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBe('test-token');
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw error with invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        authClient.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid login credentials');
    });
  });

  describe('loginWithGoogle()', () => {
    it('should handle Google OAuth flow successfully', async () => {
      const mockSession = {
        access_token: 'google-token',
        expires_in: 3600,
        user: {
          id: 'user-google-123',
          email: 'google@example.com',
          email_confirmed_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          user_metadata: { provider: 'google' },
        },
      };

      // Mock OAuth URL generation
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?client_id=test' },
        error: null,
      });

      // Mock successful OAuth callback
      const redirectUrl = 'https://test.chromiumapp.org/#id_token=test-id-token';
      (global as any).chrome.identity.launchWebAuthFlow.mockImplementation((config, callback) => {
        callback(redirectUrl);
      });

      // Mock Supabase ID token sign-in
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockSession.user,
          session: mockSession,
        },
        error: null,
      });

      const result = await authClient.loginWithGoogle();

      expect((global as any).chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
      expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          token: 'test-id-token',
        })
      );

      expect(result.token).toBe('google-token');
      expect(result.user.email).toBe('google@example.com');
    });

    it('should handle OAuth cancellation', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?client_id=test' },
        error: null,
      });

      (global as any).chrome.identity.launchWebAuthFlow.mockImplementation((config, callback) => {
        callback(undefined);
      });

      await expect(authClient.loginWithGoogle()).rejects.toThrow('OAuth flow cancelled');
    });

    it('should handle missing ID token in response', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?client_id=test' },
        error: null,
      });

      const redirectUrl = 'https://test.chromiumapp.org/#error=access_denied';
      (global as any).chrome.identity.launchWebAuthFlow.mockImplementation((config, callback) => {
        callback(redirectUrl);
      });

      await expect(authClient.loginWithGoogle()).rejects.toThrow('No ID token');
    });
  });

  describe('logout()', () => {
    it('should logout successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      await authClient.logout();

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('should throw error if logout fails', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' },
      });

      await expect(authClient.logout()).rejects.toThrow('Logout failed');
    });
  });

  describe('getCurrentUser()', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const user = await authClient.getCurrentUser();

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        createdAt: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
      });
    });

    it('should return null when no user is logged in', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const user = await authClient.getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('changePassword()', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: {} },
        error: null,
      });

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authClient.changePassword('oldpassword', 'newpassword');

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'oldpassword',
      });

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword',
      });
    });

    it('should throw error if not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(
        authClient.changePassword('oldpassword', 'newpassword')
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw error if current password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        authClient.changePassword('wrongpassword', 'newpassword')
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('getToken()', () => {
    it('should return current access token', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-123' },
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const token = await authClient.getToken();

      expect(token).toBe('test-token');
    });

    it('should return null when no session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const token = await authClient.getToken();

      expect(token).toBeNull();
    });
  });

  describe('isAuthenticated()', () => {
    it('should return true when user has valid token', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token', user: {} } },
        error: null,
      });

      const isAuth = await authClient.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false when no token exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const isAuth = await authClient.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });

  describe('getAuthState()', () => {
    it('should return authenticated state', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const state = await authClient.getAuthState();

      expect(state).toEqual({
        isAuthenticated: true,
        token: 'test-token',
        userId: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should return unauthenticated state', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const state = await authClient.getAuthState();

      expect(state).toEqual({
        isAuthenticated: false,
        token: null,
        userId: null,
        email: null,
      });
    });
  });

  describe('registerDevice()', () => {
    it('should register device successfully', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token', user: {} } },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }) as any;

      await authClient.registerDevice('device-123', 'My Device', 'public-key-123', {
        os: 'Chrome OS',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/device/register'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify({
            deviceId: 'device-123',
            deviceName: 'My Device',
            publicKey: 'public-key-123',
            metadata: { os: 'Chrome OS' },
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(
        authClient.registerDevice('device-123', 'My Device', 'public-key-123')
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw error on failed registration', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token', user: {} } },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Device registration failed' }),
      }) as any;

      await expect(
        authClient.registerDevice('device-123', 'My Device', 'public-key-123')
      ).rejects.toThrow('Device registration failed');
    });
  });
});

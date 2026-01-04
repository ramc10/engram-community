/**
 * Authentication Client (Supabase)
 * Handles user registration, login, and session management via Supabase Auth
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, SYNC_CONFIG } from '@engram/core';

const API_BASE_URL = SYNC_CONFIG.API_BASE_URL;

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: number;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  userId: string | null;
  email: string | null;
}

export class AuthClient {
  private supabase: SupabaseClient;
  private session: Session | null = null;

  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
      auth: {
        storage: {
          getItem: async (key: string) => {
            const result = await chrome.storage.local.get([key]);
            return result[key] || null;
          },
          setItem: async (key: string, value: string) => {
            await chrome.storage.local.set({ [key]: value });
          },
          removeItem: async (key: string) => {
            await chrome.storage.local.remove([key]);
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    // Initialize session from storage
    this.initializeSession();
  }

  private async initializeSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.session = data.session;
  }

  /**
   * Register a new user account
   */
  async register(credentials: AuthCredentials): Promise<AuthToken> {
    const { data, error } = await this.supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Registration failed - no user or session returned');
    }

    this.session = data.session;

    return {
      token: data.session.access_token,
      expiresIn: String(data.session.expires_in || 3600),
      user: {
        id: data.user.id,
        email: data.user.email!,
        emailVerified: !!data.user.email_confirmed_at,
        createdAt: new Date(data.user.created_at).getTime() / 1000,
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(credentials: AuthCredentials): Promise<AuthToken> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Login failed - no user or session returned');
    }

    this.session = data.session;

    return {
      token: data.session.access_token,
      expiresIn: String(data.session.expires_in || 3600),
      user: {
        id: data.user.id,
        email: data.user.email!,
        emailVerified: !!data.user.email_confirmed_at,
        createdAt: new Date(data.user.created_at).getTime() / 1000,
      },
    };
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(): Promise<AuthToken> {
    console.log('[Auth] Starting Google OAuth with redirect:', chrome.identity.getRedirectURL());

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: chrome.identity.getRedirectURL(),
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error('[Auth] Supabase OAuth error:', error);
      throw new Error(`Google OAuth failed: ${error.message}. Make sure Google provider is enabled in Supabase Dashboard (Authentication > Providers > Google).`);
    }

    if (!data.url) {
      console.error('[Auth] No OAuth URL returned from Supabase. Data:', data);
      throw new Error('No OAuth URL returned. Please enable Google provider in Supabase Dashboard.');
    }

    console.log('[Auth] Got OAuth URL, launching auth flow');
    console.log('[Auth] OAuth URL:', data.url);

    // Launch OAuth flow in a new window
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: data.url,
          interactive: true,
        },
        async (redirectUrl) => {
          console.log('[Auth] Redirect URL received:', redirectUrl);
          console.log('[Auth] Chrome runtime error:', chrome.runtime.lastError);
          if (chrome.runtime.lastError || !redirectUrl) {
            reject(new Error(chrome.runtime.lastError?.message || 'OAuth flow cancelled'));
            return;
          }

          // Extract tokens from redirect URL
          const url = new URL(redirectUrl);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const expiresIn = hashParams.get('expires_in');

          console.log('[Auth] Extracted tokens from URL');
          console.log('[Auth] Access token present:', !!accessToken);
          console.log('[Auth] Refresh token present:', !!refreshToken);

          if (!accessToken) {
            reject(new Error('No access token in OAuth response'));
            return;
          }

          try {
            // Set the session with the OAuth tokens
            console.log('[Auth] Setting session with tokens...');
            const { data: sessionData, error: sessionError } = await this.supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            console.log('[Auth] setSession result:', { sessionData, sessionError });

            if (sessionError) {
              console.error('[Auth] Session error:', sessionError);
              reject(new Error(`Failed to establish session: ${sessionError.message}`));
              return;
            }

            if (!sessionData.user || !sessionData.session) {
              console.error('[Auth] No user or session in response');
              reject(new Error('Failed to establish session - no user or session returned'));
              return;
            }

            this.session = sessionData.session;
            console.log('[Auth] Session established successfully');

            resolve({
              token: sessionData.session.access_token,
              expiresIn: String(sessionData.session.expires_in || expiresIn || 3600),
              user: {
                id: sessionData.user.id,
                email: sessionData.user.email!,
                emailVerified: !!sessionData.user.email_confirmed_at,
                createdAt: new Date(sessionData.user.created_at).getTime() / 1000,
              },
            });
          } catch (error) {
            console.error('[Auth] Exception during setSession:', error);
            const err = error as any;
            console.error('[Auth] Error details:', {
              name: err?.name,
              message: err?.message,
              stack: err?.stack,
            });
            reject(new Error(`OAuth session error: ${err?.message || 'Unknown error'}`));
          }
        }
      );
    });
  }

  /**
   * Logout (clear stored credentials)
   */
  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      console.error('Supabase logout error:', error);
      throw new Error(error.message);
    }

    this.session = null;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<AuthToken['user'] | null> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email!,
      emailVerified: !!data.user.email_confirmed_at,
      createdAt: new Date(data.user.created_at).getTime() / 1000,
    };
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // Supabase requires re-authentication before password change
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Re-authenticate with current password
    const { error: signInError } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    const { error: updateError } = await this.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  /**
   * Get stored JWT token
   */
  async getToken(): Promise<string | null> {
    if (this.session) {
      return this.session.access_token;
    }

    const { data } = await this.supabase.auth.getSession();
    this.session = data.session;

    return data.session?.access_token || null;
  }

  /**
   * Get stored user ID
   */
  async getUserId(): Promise<string | null> {
    if (this.session) {
      return this.session.user.id;
    }

    const { data } = await this.supabase.auth.getSession();
    this.session = data.session;

    return data.session?.user.id || null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    const { data } = await this.supabase.auth.getSession();

    if (!data.session) {
      return {
        isAuthenticated: false,
        token: null,
        userId: null,
        email: null,
      };
    }

    this.session = data.session;

    return {
      isAuthenticated: true,
      token: data.session.access_token,
      userId: data.session.user.id,
      email: data.session.user.email || null,
    };
  }

  /**
   * Register device with authenticated user
   */
  async registerDevice(deviceId: string, deviceName: string, publicKey: string, metadata?: any): Promise<void> {
    const token = await this.getToken();

    if (!token) {
      throw new Error('Not authenticated. Please login first.');
    }

    const response = await fetch(`${API_BASE_URL}/device/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId,
        deviceName,
        publicKey,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Device registration failed');
    }
  }

  /**
   * Get Supabase client (for advanced usage)
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

// Export singleton instance
export const authClient = new AuthClient();

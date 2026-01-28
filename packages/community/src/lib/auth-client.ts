/**
 * Authentication Client (Supabase)
 * Handles user registration, login, and session management via Supabase Auth
 */

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
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
    user_metadata?: any;
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
        user_metadata: data.user.user_metadata,
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
        user_metadata: data.user.user_metadata,
      },
    };
  }

  // Store pending OAuth data for tab-based flow
  private pendingOAuthNonce: string | null = null;
  private pendingOAuthResolve: ((value: AuthToken) => void) | null = null;
  private pendingOAuthReject: ((reason: Error) => void) | null = null;

  /**
   * Login with Google OAuth (tab-based flow)
   *
   * Opens Google sign-in in a new browser tab for better UX.
   *
   * Flow:
   * 1. Get Google Client ID from config or extract from Supabase
   * 2. Open Google OAuth in a new tab via chrome.tabs.create()
   * 3. Google redirects to extension's oauth-callback page
   * 4. Callback page extracts ID token and sends to background
   * 5. Background authenticates with Supabase using signInWithIdToken
   */
  async loginWithGoogle(): Promise<AuthToken> {
    // Use extension's OAuth callback page as redirect URI
    const extensionId = chrome.runtime.id;
    const callbackUrl = `chrome-extension://${extensionId}/tabs/oauth-callback.html`;
    console.log('[Auth] Starting Google OAuth with tab redirect:', callbackUrl);

    // Get Google Client ID
    const googleClientId = await this.getGoogleClientId();
    console.log('[Auth] Google Client ID resolved');

    // Generate nonce for security (required for ID token validation)
    const rawNonce = this.generateNonce();
    const hashedNonce = await this.sha256(rawNonce);

    // Store nonce for later verification
    this.pendingOAuthNonce = rawNonce;

    // Build direct Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', googleClientId);
    googleAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    googleAuthUrl.searchParams.set('response_type', 'id_token');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('nonce', hashedNonce);
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    console.log('[Auth] Opening Google OAuth in new tab');

    return new Promise((resolve, reject) => {
      // Store resolve/reject for use when callback is received
      this.pendingOAuthResolve = resolve;
      this.pendingOAuthReject = reject;

      // Open OAuth in a new tab
      chrome.tabs.create({
        url: googleAuthUrl.toString(),
        active: true,
      }, (tab) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
          console.error('[Auth] Failed to open OAuth tab:', errorMessage);
          this.clearPendingOAuth();
          reject(new Error(`Failed to open sign-in tab: ${errorMessage}`));
          return;
        }
        console.log('[Auth] OAuth tab opened:', tab?.id);
      });

      // Set a timeout for the OAuth flow (5 minutes)
      setTimeout(() => {
        if (this.pendingOAuthReject) {
          this.pendingOAuthReject(new Error('Sign-in timed out. Please try again.'));
          this.clearPendingOAuth();
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Handle OAuth callback from the callback page
   * Called by background service when OAUTH_CALLBACK message is received
   */
  async handleOAuthCallback(idToken: string): Promise<AuthToken> {
    console.log('[Auth] Handling OAuth callback, token present:', !!idToken);

    if (!this.pendingOAuthNonce) {
      throw new Error('No pending OAuth flow. Please start sign-in again.');
    }

    const rawNonce = this.pendingOAuthNonce;

    try {
      // Authenticate with Supabase using the Google ID token
      console.log('[Auth] Authenticating with Supabase using Google ID token...');
      const { data: sessionData, error: sessionError } =
        await this.supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: rawNonce,
        });

      if (sessionError) {
        console.error('[Auth] Supabase signInWithIdToken error:', sessionError);
        throw new Error(`Failed to authenticate with Supabase: ${sessionError.message}`);
      }

      if (!sessionData.user || !sessionData.session) {
        console.error('[Auth] No user or session in response');
        throw new Error('Failed to establish session - no user or session returned');
      }

      this.session = sessionData.session;
      console.log('[Auth] Google OAuth session established successfully');

      const authToken: AuthToken = {
        token: sessionData.session.access_token,
        expiresIn: String(sessionData.session.expires_in || 3600),
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email!,
          emailVerified: !!sessionData.user.email_confirmed_at,
          createdAt: new Date(sessionData.user.created_at).getTime() / 1000,
          user_metadata: sessionData.user.user_metadata,
        },
      };

      // Resolve the pending promise if exists
      if (this.pendingOAuthResolve) {
        this.pendingOAuthResolve(authToken);
      }

      this.clearPendingOAuth();
      return authToken;
    } catch (error) {
      console.error('[Auth] Exception during OAuth callback:', error);
      const err = error as Error;

      if (this.pendingOAuthReject) {
        this.pendingOAuthReject(err);
      }

      this.clearPendingOAuth();
      throw err;
    }
  }

  /**
   * Clear pending OAuth state
   */
  private clearPendingOAuth(): void {
    this.pendingOAuthNonce = null;
    this.pendingOAuthResolve = null;
    this.pendingOAuthReject = null;
  }

  /**
   * Get Google Client ID from config or extract from Supabase OAuth flow
   */
  private async getGoogleClientId(): Promise<string> {
    // 1. Try from config (PLASMO_PUBLIC_GOOGLE_CLIENT_ID env var)
    if (SUPABASE_CONFIG.GOOGLE_CLIENT_ID) {
      console.log('[Auth] Using Google Client ID from config');
      return SUPABASE_CONFIG.GOOGLE_CLIENT_ID;
    }

    // 2. Try to extract from Supabase OAuth flow by following the redirect
    console.log('[Auth] No Google Client ID in config, attempting to extract from Supabase...');
    try {
      const { data } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
        },
      });

      if (data?.url) {
        // Fetch the Supabase authorize URL - it returns a 302 redirect to Google
        // The response.url after following redirects should be Google's OAuth page
        const response = await fetch(data.url, {
          redirect: 'follow',
          credentials: 'omit',
        });

        const finalUrl = new URL(response.url);
        const clientId = finalUrl.searchParams.get('client_id');

        if (clientId) {
          console.log('[Auth] Extracted Google Client ID from Supabase OAuth flow');
          return clientId;
        }
      }
    } catch (error) {
      console.warn('[Auth] Failed to extract Google Client ID from Supabase:', error);
    }

    throw new Error(
      'Google Client ID not available.\n\n' +
      'Please set PLASMO_PUBLIC_GOOGLE_CLIENT_ID in your .env file.\n' +
      'Get it from Google Cloud Console > APIs & Services > Credentials.\n\n' +
      'See SUPABASE_SETUP.md for detailed setup instructions.'
    );
  }

  /**
   * Generate a cryptographically secure random nonce
   */
  private generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash a string using SHA-256
   */
  private async sha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
   * Update user metadata
   */
  async updateUserMetadata(metadata: any): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({
      data: metadata,
    });

    if (error) {
      throw new Error(error.message);
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

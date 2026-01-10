/**
 * Premium API Client
 * Handles communication with the Engram Premium API server
 */

import { Memory } from '@engram/core';

// API endpoint (can be overridden via env var)
const PREMIUM_API_URL =
  process.env.PLASMO_PUBLIC_PREMIUM_API_URL || 'http://localhost:3000';

// Storage keys
const STORAGE_KEYS = {
  PREMIUM_TOKEN: 'premium_jwt_token',
  PREMIUM_USER: 'premium_user_info',
  PREMIUM_LICENSE: 'premium_license_info',
};

/**
 * Premium user info
 */
export interface PremiumUser {
  id: string;
  email: string;
}

/**
 * Premium license info
 */
export interface PremiumLicense {
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  rateLimit: number;
  expiresAt?: string;
}

/**
 * Enrichment result from premium API
 */
export interface PremiumEnrichment {
  keywords: string[];
  tags: string[];
  context: string;
}

/**
 * Link detection result from premium API
 */
export interface PremiumLink {
  targetId: string;
  relationship: string;
  confidence: number;
  reason: string;
}

/**
 * Evolution check result from premium API
 */
export interface PremiumEvolution {
  shouldEvolve: boolean;
  reason: string;
  updatedContent: string | null;
  changeType: string;
}

/**
 * Premium API Client
 */
export class PremiumAPIClient {
  private baseURL: string;
  private token: string | null = null;
  private user: PremiumUser | null = null;
  private license: PremiumLicense | null = null;

  constructor(baseURL: string = PREMIUM_API_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Initialize client - restore token and user info from storage
   */
  async initialize(): Promise<boolean> {
    console.log('[PremiumAPI] initialize() called');
    try {
      console.log('[PremiumAPI] Fetching storage keys:', [
        STORAGE_KEYS.PREMIUM_TOKEN,
        STORAGE_KEYS.PREMIUM_USER,
        STORAGE_KEYS.PREMIUM_LICENSE,
      ]);

      const storage = await chrome.storage.local.get([
        STORAGE_KEYS.PREMIUM_TOKEN,
        STORAGE_KEYS.PREMIUM_USER,
        STORAGE_KEYS.PREMIUM_LICENSE,
      ]);

      console.log('[PremiumAPI] Storage fetched:', {
        hasToken: !!storage[STORAGE_KEYS.PREMIUM_TOKEN],
        hasUser: !!storage[STORAGE_KEYS.PREMIUM_USER],
        hasLicense: !!storage[STORAGE_KEYS.PREMIUM_LICENSE],
      });

      this.token = storage[STORAGE_KEYS.PREMIUM_TOKEN] || null;
      this.user = storage[STORAGE_KEYS.PREMIUM_USER] || null;
      this.license = storage[STORAGE_KEYS.PREMIUM_LICENSE] || null;

      // Verify token if present
      if (this.token) {
        console.log('[PremiumAPI] Token found in storage, verifying...');
        const isValid = await this.verifyToken();
        if (!isValid) {
          console.log('[PremiumAPI] Token invalid, clearing auth');
          await this.clearAuth();
          return false;
        }
        console.log('[PremiumAPI] Token valid, authentication restored');
        return true;
      }

      console.log('[PremiumAPI] No token in storage, returning false');
      return false;
    } catch (error) {
      console.error('[PremiumAPI] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Authenticate with license key
   */
  async authenticate(licenseKey: string): Promise<void> {
    console.log('[PremiumAPI] authenticate() called');
    try {
      console.log('[PremiumAPI] Calling auth endpoint:', `${this.baseURL}/auth/login`);
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey }),
      });

      console.log('[PremiumAPI] Auth response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[PremiumAPI] Auth failed:', error);
        throw new Error(error.message || 'Authentication failed');
      }

      const data = await response.json();
      console.log('[PremiumAPI] Auth response data:', {
        hasToken: !!data.token,
        hasUser: !!data.user,
        hasLicense: !!data.license,
        user: data.user,
        license: data.license,
      });

      this.token = data.token;
      this.user = data.user;
      this.license = data.license;

      console.log('[PremiumAPI] Set instance properties:', {
        token: this.token ? `${this.token.substring(0, 20)}...` : null,
        user: this.user,
        license: this.license,
      });

      // Store in chrome.storage
      const storageData = {
        [STORAGE_KEYS.PREMIUM_TOKEN]: this.token,
        [STORAGE_KEYS.PREMIUM_USER]: this.user,
        [STORAGE_KEYS.PREMIUM_LICENSE]: this.license,
      };
      console.log('[PremiumAPI] Saving to chrome.storage.local:', Object.keys(storageData));

      await chrome.storage.local.set(storageData);
      console.log('[PremiumAPI] Saved to chrome.storage.local successfully');

      // Verify it was saved
      const verification = await chrome.storage.local.get([
        STORAGE_KEYS.PREMIUM_TOKEN,
        STORAGE_KEYS.PREMIUM_USER,
        STORAGE_KEYS.PREMIUM_LICENSE,
      ]);
      console.log('[PremiumAPI] Verification - stored values:', {
        hasToken: !!verification[STORAGE_KEYS.PREMIUM_TOKEN],
        hasUser: !!verification[STORAGE_KEYS.PREMIUM_USER],
        hasLicense: !!verification[STORAGE_KEYS.PREMIUM_LICENSE],
      });

      console.log('[PremiumAPI] Authenticated successfully');
    } catch (error) {
      console.error('[PremiumAPI] Authentication error:', error);
      console.error('[PremiumAPI] Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  /**
   * Verify current token
   */
  async verifyToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[PremiumAPI] Token verification error:', error);
      return false;
    }
  }

  /**
   * Clear authentication data
   */
  async clearAuth(): Promise<void> {
    this.token = null;
    this.user = null;
    this.license = null;

    await chrome.storage.local.remove([
      STORAGE_KEYS.PREMIUM_TOKEN,
      STORAGE_KEYS.PREMIUM_USER,
      STORAGE_KEYS.PREMIUM_LICENSE,
    ]);

    console.log('[PremiumAPI] Authentication cleared');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    const result = this.token !== null;
    console.log('[PremiumAPI] isAuthenticated() called:', {
      hasToken: result,
      tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : null,
    });
    return result;
  }

  /**
   * Get user info
   */
  getUser(): PremiumUser | null {
    return this.user;
  }

  /**
   * Get license info
   */
  getLicense(): PremiumLicense | null {
    return this.license;
  }

  /**
   * Enrich memory content using premium API
   */
  async enrich(content: string): Promise<PremiumEnrichment> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('[PremiumAPI] Sending enrichment request to:', `${this.baseURL}/enrich`);
      const response = await fetch(`${this.baseURL}/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ content }),
      });

      console.log('[PremiumAPI] Response status:', response.status, response.statusText);
      console.log('[PremiumAPI] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PremiumAPI] Error response:', errorText);
        throw new Error(errorText || 'Enrichment failed');
      }

      const responseText = await response.text();
      console.log('[PremiumAPI] Response body:', responseText);

      const data = JSON.parse(responseText);
      console.log('[PremiumAPI] Parsed data:', data);

      if (!data.enrichment) {
        throw new Error('No enrichment data in response');
      }

      return data.enrichment;
    } catch (error) {
      console.error('[PremiumAPI] Enrichment error:', error);
      throw error;
    }
  }

  /**
   * Detect links between memories using premium API
   */
  async detectLinks(
    newMemory: Memory,
    existingMemories: Memory[]
  ): Promise<PremiumLink[]> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseURL}/links/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          newMemory: {
            id: newMemory.id,
            content: newMemory.content,
            context: (newMemory as any).context,
          },
          existingMemories: existingMemories.map((m) => ({
            id: m.id,
            content: m.content,
            context: (m as any).context,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Link detection failed');
      }

      const data = await response.json();
      return data.links;
    } catch (error) {
      console.error('[PremiumAPI] Link detection error:', error);
      throw error;
    }
  }

  /**
   * Check if memory should evolve using premium API
   */
  async checkEvolution(
    memory: Memory,
    newInformation: string
  ): Promise<PremiumEvolution> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseURL}/evolve/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          memory: {
            id: memory.id,
            content: memory.content,
            timestamp: memory.timestamp,
            context: (memory as any).context,
          },
          newInformation,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Evolution check failed');
      }

      const data = await response.json();
      return data.evolution;
    } catch (error) {
      console.error('[PremiumAPI] Evolution check error:', error);
      throw error;
    }
  }

  /**
   * Health check - verify API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      console.error('[PremiumAPI] Health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let premiumClient: PremiumAPIClient | null = null;

/**
 * Get premium API client instance
 */
export function getPremiumClient(): PremiumAPIClient {
  if (!premiumClient) {
    premiumClient = new PremiumAPIClient();
  }
  return premiumClient;
}

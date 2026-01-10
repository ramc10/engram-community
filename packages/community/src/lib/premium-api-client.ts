/**
 * Premium API Client
 * Handles communication with the Engram Premium API server
 */

import { Memory } from '@engram/core';
import { createLogger } from './logger';

// Declare chrome for TypeScript
declare const chrome: any;

const logger = createLogger('PremiumAPI');

// API endpoint (can be overridden via env var)
const PREMIUM_API_URL =
  (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env.PLASMO_PUBLIC_PREMIUM_API_URL) || 'http://localhost:3000';

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
    logger.log('initialize() called');
    try {
      logger.log('Fetching storage keys:', [
        STORAGE_KEYS.PREMIUM_TOKEN,
        STORAGE_KEYS.PREMIUM_USER,
        STORAGE_KEYS.PREMIUM_LICENSE,
      ]);

      const storage = await chrome.storage.local.get([
        STORAGE_KEYS.PREMIUM_TOKEN,
        STORAGE_KEYS.PREMIUM_USER,
        STORAGE_KEYS.PREMIUM_LICENSE,
      ]);

      logger.log('Storage fetched:', {
        hasToken: !!storage[STORAGE_KEYS.PREMIUM_TOKEN],
        hasUser: !!storage[STORAGE_KEYS.PREMIUM_USER],
        hasLicense: !!storage[STORAGE_KEYS.PREMIUM_LICENSE],
      });

      this.token = storage[STORAGE_KEYS.PREMIUM_TOKEN] || null;
      this.user = storage[STORAGE_KEYS.PREMIUM_USER] || null;
      this.license = storage[STORAGE_KEYS.PREMIUM_LICENSE] || null;

      // Verify token if present
      if (this.token) {
        logger.log('Token found in storage, verifying...');
        const isValid = await this.verifyToken();
        if (!isValid) {
          logger.log('Token invalid, clearing auth');
          await this.clearAuth();
          return false;
        }
        logger.log('Token valid, authentication restored');
        return true;
      }

      logger.log('No token in storage, returning false');
      return false;
    } catch (error) {
      logger.error('Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Authenticate with license key
   */
  async authenticate(licenseKey: string): Promise<void> {
    logger.log('authenticate() called');
    try {
      logger.log('Calling auth endpoint:', `${this.baseURL}/auth/login`);
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey }),
      });

      logger.log('Auth response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        logger.error('Auth failed:', error);
        throw new Error(error.message || 'Authentication failed');
      }

      const data = await response.json();
      logger.log('Auth response data:', {
        hasToken: !!data.token,
        hasUser: !!data.user,
        hasLicense: !!data.license,
        user: data.user,
        license: data.license,
      });

      this.token = data.token;
      this.user = data.user;
      this.license = data.license;

      logger.log('Set instance properties:', {
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
      logger.log('Saving to chrome.storage.local:', Object.keys(storageData));

      await chrome.storage.local.set(storageData);
      logger.log('Saved to chrome.storage.local successfully');

      // Verify it was saved
      const verification = await chrome.storage.local.get([
        STORAGE_KEYS.PREMIUM_TOKEN,
        STORAGE_KEYS.PREMIUM_USER,
        STORAGE_KEYS.PREMIUM_LICENSE,
      ]);
      logger.log('Verification - stored values:', {
        hasToken: !!verification[STORAGE_KEYS.PREMIUM_TOKEN],
        hasUser: !!verification[STORAGE_KEYS.PREMIUM_USER],
        hasLicense: !!verification[STORAGE_KEYS.PREMIUM_LICENSE],
      });

      logger.log('Authenticated successfully');
    } catch (error) {
      logger.error('Authentication error:', error);
      logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
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
      logger.error('Token verification error:', error);
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

    logger.log('Authentication cleared');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    const result = this.token !== null;
    logger.log('isAuthenticated() called:', {
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
      logger.log('Sending enrichment request to:', `${this.baseURL}/enrich`);
      const response = await fetch(`${this.baseURL}/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ content }),
      });

      logger.log('Response status:', response.status, response.statusText);
      logger.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error response:', errorText);
        throw new Error(errorText || 'Enrichment failed');
      }

      const responseText = await response.text();
      logger.log('Response body:', responseText);

      const data = JSON.parse(responseText);
      logger.log('Parsed data:', data);

      if (!data.enrichment) {
        throw new Error('No enrichment data in response');
      }

      return data.enrichment;
    } catch (error) {
      logger.error('Enrichment error:', error);
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
      logger.error('Link detection error:', error);
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
      logger.error('Evolution check error:', error);
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
      logger.error('Health check failed:', error);
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

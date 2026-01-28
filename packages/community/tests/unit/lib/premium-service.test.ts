/**
 * PremiumService Unit Tests
 * Tests for premium tier management, upgrade requests, and sync enablement
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PremiumService } from '../../../src/lib/premium-service';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Mock environment variables
const originalEnv = process.env;

describe('PremiumService', () => {
  let premiumService: PremiumService;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PLASMO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      PLASMO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };

    jest.clearAllMocks();
    premiumService = new PremiumService();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if Supabase credentials are missing', () => {
      delete process.env.PLASMO_PUBLIC_SUPABASE_URL;

      expect(() => new PremiumService()).toThrow('Supabase credentials not found in environment');
    });
  });

  describe('isPremium()', () => {
    it('should return true for premium users', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tier: 'premium' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.isPremium('user-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockFrom.select).toHaveBeenCalledWith('tier');
      expect(mockFrom.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(result).toBe(true);
    });

    it('should return false for free users', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tier: 'free' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.isPremium('user-123');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.isPremium('user-123');

      expect(result).toBe(false);
    });

    it('should use authenticated client if provided', async () => {
      const mockAuthenticatedClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { tier: 'premium' },
            error: null,
          }),
        }),
      };

      const result = await premiumService.isPremium('user-123', mockAuthenticatedClient as any);

      expect(mockAuthenticatedClient.from).toHaveBeenCalledWith('profiles');
      expect(result).toBe(true);
    });
  });

  describe('upgradeToPremium()', () => {
    it('should upgrade user to premium successfully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await premiumService.upgradeToPremium('user-123');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('upgrade_to_premium', {
        user_uuid: 'user-123',
      });
    });

    it('should throw error on upgrade failure', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Upgrade failed' },
      });

      await expect(premiumService.upgradeToPremium('user-123')).rejects.toThrow(
        'Failed to upgrade to premium: Upgrade failed'
      );
    });

    it('should throw error on unexpected error', async () => {
      mockSupabaseClient.rpc.mockRejectedValue(new Error('Network error'));

      await expect(premiumService.upgradeToPremium('user-123')).rejects.toThrow('Network error');
    });
  });

  describe('downgradeToFree()', () => {
    it('should downgrade user to free successfully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await premiumService.downgradeToFree('user-123');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('downgrade_to_free', {
        user_uuid: 'user-123',
      });
    });

    it('should throw error on downgrade failure', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Downgrade failed' },
      });

      await expect(premiumService.downgradeToFree('user-123')).rejects.toThrow(
        'Failed to downgrade to free: Downgrade failed'
      );
    });
  });

  describe('getSyncEnabled()', () => {
    it('should return true when sync is enabled', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { sync_enabled: true },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.getSyncEnabled('user-123');

      expect(result).toBe(true);
    });

    it('should return false when sync is disabled', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { sync_enabled: false },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.getSyncEnabled('user-123');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.getSyncEnabled('user-123');

      expect(result).toBe(false);
    });
  });

  describe('enableSync()', () => {
    it('should enable sync for premium user', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tier: 'premium' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      mockFrom.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      await premiumService.enableSync('user-123');

      expect(mockFrom.update).toHaveBeenCalledWith({ sync_enabled: true });
    });

    it('should throw error for non-premium user', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tier: 'free' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      await expect(premiumService.enableSync('user-123')).rejects.toThrow(
        'Premium tier required for cloud sync'
      );
    });

    it('should throw error on database error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tier: 'premium' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      mockFrom.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        }),
      });

      await expect(premiumService.enableSync('user-123')).rejects.toThrow(
        'Failed to enable sync: Update failed'
      );
    });
  });

  describe('disableSync()', () => {
    it('should disable sync successfully', async () => {
      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      await premiumService.disableSync('user-123');

      expect(mockFrom.update).toHaveBeenCalledWith({ sync_enabled: false });
    });

    it('should throw error on failure', async () => {
      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      await expect(premiumService.disableSync('user-123')).rejects.toThrow(
        'Failed to disable sync: Update failed'
      );
    });
  });

  describe('getPremiumStatus()', () => {
    it('should return complete premium status', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: {
            tier: 'premium',
            sync_enabled: true,
            premium_since: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      // Mock for profiles query
      mockSupabaseClient.from.mockReturnValueOnce(mockFrom);

      // Mock for pending request query
      mockFrom.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockFrom.maybeSingle,
      });

      const result = await premiumService.getPremiumStatus('user-123');

      expect(result).toEqual({
        tier: 'premium',
        isPremium: true,
        syncEnabled: true,
        premiumSince: '2024-01-01T00:00:00Z',
        hasPendingRequest: false,
      });
    });

    it('should return default values on error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.getPremiumStatus('user-123');

      expect(result).toEqual({
        tier: 'free',
        isPremium: false,
        syncEnabled: false,
        premiumSince: null,
        hasPendingRequest: false,
      });
    });
  });

  describe('hasPendingUpgradeRequest()', () => {
    it('should return true when pending request exists', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'request-123' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.hasPendingUpgradeRequest('user-123');

      expect(result).toBe(true);
    });

    it('should return false when no pending request exists', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.hasPendingUpgradeRequest('user-123');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const result = await premiumService.hasPendingUpgradeRequest('user-123');

      expect(result).toBe(false);
    });
  });

  describe('requestPremiumUpgrade()', () => {
    it('should submit upgrade request successfully', async () => {
      const mockFrom = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      await premiumService.requestPremiumUpgrade('user-123', 'test@example.com');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('premium_upgrade_requests');
      expect(mockFrom.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should throw error on submission failure', async () => {
      const mockFrom = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      await expect(
        premiumService.requestPremiumUpgrade('user-123', 'test@example.com')
      ).rejects.toThrow('Failed to submit upgrade request: Insert failed');
    });

    it('should use authenticated client if provided', async () => {
      const mockAuthenticatedClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      };

      await premiumService.requestPremiumUpgrade(
        'user-123',
        'test@example.com',
        mockAuthenticatedClient as any
      );

      expect(mockAuthenticatedClient.from).toHaveBeenCalledWith('premium_upgrade_requests');
    });
  });
});

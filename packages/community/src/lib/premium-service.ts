import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * PremiumService - Manages premium tier checks and upgrades
 *
 * Responsibilities:
 * - Check if user has premium tier
 * - Upgrade user to premium
 * - Check if sync is enabled
 * - Manage premium status
 */
export class PremiumService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check if user has premium tier
   * @param userId - User's UUID
   * @param authenticatedClient - Authenticated Supabase client (optional, for RLS)
   * @returns true if user is premium, false otherwise
   */
  async isPremium(userId: string, authenticatedClient?: SupabaseClient): Promise<boolean> {
    try {
      const client = authenticatedClient || this.supabase;

      const { data, error } = await client
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Premium] Error checking premium status:', error);
        return false;
      }

      return data?.tier === 'premium';
    } catch (err) {
      console.error('[Premium] Unexpected error checking premium status:', err);
      return false;
    }
  }

  /**
   * Upgrade user to premium tier
   * @param userId - User's UUID
   */
  async upgradeToPremium(userId: string): Promise<void> {
    try {
      console.log('[Premium] Upgrading user to premium:', userId);

      const { error } = await this.supabase.rpc('upgrade_to_premium', {
        user_uuid: userId,
      });

      if (error) {
        console.error('[Premium] Error upgrading to premium:', error);
        throw new Error(`Failed to upgrade to premium: ${error.message}`);
      }

      console.log('[Premium] Successfully upgraded user to premium');
    } catch (err) {
      console.error('[Premium] Unexpected error upgrading to premium:', err);
      throw err;
    }
  }

  /**
   * Downgrade user to free tier
   * @param userId - User's UUID
   */
  async downgradeToFree(userId: string): Promise<void> {
    try {
      console.log('[Premium] Downgrading user to free:', userId);

      const { error } = await this.supabase.rpc('downgrade_to_free', {
        user_uuid: userId,
      });

      if (error) {
        console.error('[Premium] Error downgrading to free:', error);
        throw new Error(`Failed to downgrade to free: ${error.message}`);
      }

      console.log('[Premium] Successfully downgraded user to free');
    } catch (err) {
      console.error('[Premium] Unexpected error downgrading to free:', err);
      throw err;
    }
  }

  /**
   * Check if cloud sync is enabled for user
   * @param userId - User's UUID
   * @returns true if sync is enabled, false otherwise
   */
  async getSyncEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('sync_enabled')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Premium] Error checking sync status:', error);
        return false;
      }

      return data?.sync_enabled ?? false;
    } catch (err) {
      console.error('[Premium] Unexpected error checking sync status:', err);
      return false;
    }
  }

  /**
   * Enable cloud sync for user (requires premium tier)
   * @param userId - User's UUID
   * @param authenticatedClient - Authenticated Supabase client (optional, for RLS)
   */
  async enableSync(userId: string, authenticatedClient?: SupabaseClient): Promise<void> {
    try {
      const client = authenticatedClient || this.supabase;

      // First verify user is premium
      const isPremium = await this.isPremium(userId, client);
      if (!isPremium) {
        throw new Error('Premium tier required for cloud sync');
      }

      const { error } = await client
        .from('profiles')
        .update({ sync_enabled: true })
        .eq('id', userId);

      if (error) {
        console.error('[Premium] Error enabling sync:', error);
        throw new Error(`Failed to enable sync: ${error.message}`);
      }

      console.log('[Premium] Successfully enabled sync for user');
    } catch (err) {
      console.error('[Premium] Unexpected error enabling sync:', err);
      throw err;
    }
  }

  /**
   * Disable cloud sync for user
   * @param userId - User's UUID
   * @param authenticatedClient - Authenticated Supabase client (optional, for RLS)
   */
  async disableSync(userId: string, authenticatedClient?: SupabaseClient): Promise<void> {
    try {
      const client = authenticatedClient || this.supabase;

      const { error } = await client
        .from('profiles')
        .update({ sync_enabled: false })
        .eq('id', userId);

      if (error) {
        console.error('[Premium] Error disabling sync:', error);
        throw new Error(`Failed to disable sync: ${error.message}`);
      }

      console.log('[Premium] Successfully disabled sync for user');
    } catch (err) {
      console.error('[Premium] Unexpected error disabling sync:', err);
      throw err;
    }
  }

  /**
   * Get complete premium status for user
   * @param userId - User's UUID
   * @param authenticatedClient - Authenticated Supabase client (optional, for RLS)
   * @returns Object with tier, premium status, sync enabled, premium since date, and pending request status
   */
  async getPremiumStatus(userId: string, authenticatedClient?: SupabaseClient): Promise<{
    tier: 'free' | 'premium';
    isPremium: boolean;
    syncEnabled: boolean;
    premiumSince: string | null;
    hasPendingRequest: boolean;
  }> {
    try {
      const client = authenticatedClient || this.supabase;

      const { data, error } = await client
        .from('profiles')
        .select('tier, sync_enabled, premium_since')
        .eq('id', userId)
        .single();

      // Check if user has pending upgrade request (even if no profile exists)
      const hasPendingRequest = await this.hasPendingUpgradeRequest(userId, client);

      if (error) {
        console.error('[Premium] Error getting premium status:', error);
        // Return default values but preserve hasPendingRequest status
        return {
          tier: 'free',
          isPremium: false,
          syncEnabled: false,
          premiumSince: null,
          hasPendingRequest,
        };
      }

      return {
        tier: data.tier as 'free' | 'premium',
        isPremium: data.tier === 'premium',
        syncEnabled: data.sync_enabled ?? false,
        premiumSince: data.premium_since,
        hasPendingRequest,
      };
    } catch (err) {
      console.error('[Premium] Unexpected error getting premium status:', err);
      // Try to check pending request even on unexpected error
      const hasPendingRequest = await this.hasPendingUpgradeRequest(userId, authenticatedClient);
      return {
        tier: 'free',
        isPremium: false,
        syncEnabled: false,
        premiumSince: null,
        hasPendingRequest,
      };
    }
  }

  /**
   * Check if user has a pending upgrade request
   * @param userId - User's UUID
   * @param authenticatedClient - Authenticated Supabase client (required for RLS)
   * @returns true if user has a pending request, false otherwise
   */
  async hasPendingUpgradeRequest(userId: string, authenticatedClient?: SupabaseClient): Promise<boolean> {
    try {
      const client = authenticatedClient || this.supabase;

      const { data, error } = await client
        .from('premium_upgrade_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) {
        console.error('[Premium] Error checking pending upgrade request:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('[Premium] Unexpected error checking pending upgrade request:', err);
      return false;
    }
  }

  /**
   * Submit a premium upgrade request
   * @param userId - User's UUID
   * @param email - User's email
   * @param authenticatedClient - Authenticated Supabase client (required for RLS)
   */
  async requestPremiumUpgrade(userId: string, email: string, authenticatedClient?: SupabaseClient): Promise<void> {
    try {
      console.log('[Premium] Submitting upgrade request for user:', userId, email);

      // Use authenticated client if provided (required for RLS policies)
      const client = authenticatedClient || this.supabase;

      const { error } = await client
        .from('premium_upgrade_requests')
        .insert({
          user_id: userId,
          email: email,
        });

      if (error) {
        console.error('[Premium] Error submitting upgrade request:', error);
        throw new Error(`Failed to submit upgrade request: ${error.message}`);
      }

      console.log('[Premium] Successfully submitted upgrade request');
    } catch (err) {
      console.error('[Premium] Unexpected error submitting upgrade request:', err);
      throw err;
    }
  }
}

// Singleton instance
export const premiumService = new PremiumService();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
          email_verified: boolean;
          two_factor_enabled: boolean;
          two_factor_secret?: string;
          last_login?: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          created_at?: string;
          updated_at?: string;
          email_verified?: boolean;
          two_factor_enabled?: boolean;
          two_factor_secret?: string;
          last_login?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          created_at?: string;
          updated_at?: string;
          email_verified?: boolean;
          two_factor_enabled?: boolean;
          two_factor_secret?: string;
          last_login?: string;
          is_active?: boolean;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          timezone: string;
          notification_preferences: any;
          risk_tolerance: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          timezone?: string;
          notification_preferences?: any;
          risk_tolerance?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          timezone?: string;
          notification_preferences?: any;
          risk_tolerance?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string;
          chain: string;
          encrypted_private_key: string;
          wallet_type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address: string;
          chain: string;
          encrypted_private_key: string;
          wallet_type?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          address?: string;
          chain?: string;
          encrypted_private_key?: string;
          wallet_type?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
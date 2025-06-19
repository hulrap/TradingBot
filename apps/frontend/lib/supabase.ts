import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client for browser usage
export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
};

// Admin client for server-side operations
export const createAdminClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Database types (simplified for now)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
      };
      bot_configurations: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          bot_type: string;
          is_paper_trading: boolean;
          is_active: boolean;
          max_daily_trades: number;
          max_position_size?: string;
          stop_loss_percentage?: number;
          take_profit_percentage?: number;
          configuration: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          bot_type: string;
          is_paper_trading?: boolean;
          is_active?: boolean;
          max_daily_trades?: number;
          max_position_size?: string;
          stop_loss_percentage?: number;
          take_profit_percentage?: number;
          configuration?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          bot_id: string;
          trade_type: string;
          status: string;
          token_in: string;
          token_out: string;
          amount_in: string;
          amount_out: string;
          gas_used?: string;
          tx_hash?: string;
          profit_loss?: string;
          created_at: string;
        };
      };
    };
  };
}
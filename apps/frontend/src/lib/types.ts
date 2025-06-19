// Re-export types from the main types package and add frontend-specific types
export * from '@trading-bot/types';

// Frontend-specific types
export interface Trade {
  id: string;
  status: string;
  profit_loss_usd?: string | null;
  gas_fee_usd?: string | null;
  amount_in?: string | null;
  executed_at: string;
  chain?: string;
  token_in_symbol?: string;
  token_out_symbol?: string;
  trade_type?: string;
  bot_configurations: {
    user_id: string;
    type: string;
    name?: string;
  };
}

export interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  winRate: number;
  totalProfitLoss: number;
  totalGasFees: number;
  netProfit: number;
  totalReturn: number;
  avgProfitPerTrade: number;
  avgTradeSize: number;
}

export interface RiskMetrics {
  volatility: number;
  var95: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  avgReturn: number;
  totalReturn: number;
  bestTrade: number;
  worstTrade: number;
  winRate: number;
} 
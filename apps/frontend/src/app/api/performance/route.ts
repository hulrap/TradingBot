import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

const PerformanceQuerySchema = z.object({
  botId: z.string().uuid().optional(),
  botType: z.enum(['arbitrage', 'copy-trader', 'mev-sandwich']).optional(),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana']).optional(),
  period: z.enum(['1h', '24h', '7d', '30d', '90d', 'all']).optional().default('7d'),
  granularity: z.enum(['hour', 'day', 'week']).optional().default('day'),
  includeRiskMetrics: z.string().transform(val => val === 'true').optional().default('true'),
  includeComparison: z.string().transform(val => val === 'true').optional().default('false'),
  benchmarkType: z.enum(['hold', 'market', 'peer']).optional().default('hold')
});

// Supabase returns bot_configurations as an array due to the join
interface SupabaseTrade {
  status: any;
  profit_loss_usd?: any;
  gas_fee_usd?: any;
  amount_in?: any;
  executed_at: any;
  chain?: any;
  token_in_symbol?: any;
  token_out_symbol?: any;
  trade_type?: any;
  bot_configurations: {
    user_id: any;
    type: any;
    name?: any;
  }[];
}

// Normalized Trade type for internal use
interface Trade {
  status: string;
  profit_loss_usd: string | null | undefined;
  gas_fee_usd: string | null | undefined;
  amount_in: string | null | undefined;
  executed_at: string;
  chain: string | undefined;
  token_in_symbol: string | undefined;
  token_out_symbol: string | undefined;
  trade_type: string | undefined;
  bot_configurations: {
    user_id: string;
    type: string;
    name?: string | undefined;
  } | undefined;
}

interface TimeGroup {
  [key: string]: Trade[];
}

// Helper function to normalize Supabase trade data
function normalizeSupabaseTrade(supabaseTrade: SupabaseTrade): Trade {
  const firstBotConfig = supabaseTrade.bot_configurations?.[0];
  
  return {
    status: String(supabaseTrade.status || ''),
    profit_loss_usd: supabaseTrade.profit_loss_usd ? String(supabaseTrade.profit_loss_usd) : null,
    gas_fee_usd: supabaseTrade.gas_fee_usd ? String(supabaseTrade.gas_fee_usd) : null,
    amount_in: supabaseTrade.amount_in ? String(supabaseTrade.amount_in) : null,
    executed_at: String(supabaseTrade.executed_at || ''),
    chain: supabaseTrade.chain ? String(supabaseTrade.chain) : undefined,
    token_in_symbol: supabaseTrade.token_in_symbol ? String(supabaseTrade.token_in_symbol) : undefined,
    token_out_symbol: supabaseTrade.token_out_symbol ? String(supabaseTrade.token_out_symbol) : undefined,
    trade_type: supabaseTrade.trade_type ? String(supabaseTrade.trade_type) : undefined,
    bot_configurations: firstBotConfig ? {
      user_id: String(firstBotConfig.user_id || ''),
      type: String(firstBotConfig.type || ''),
      ...(firstBotConfig.name && { name: String(firstBotConfig.name) })
    } : undefined
  };
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.payload?.sub;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      );
    }
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Validate query parameters
    const validationResult = PerformanceQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const {
      botId,
      botType,
      chain,
      period,
      granularity,
      includeRiskMetrics,
      includeComparison,
      benchmarkType
    } = validationResult.data;

    // Calculate date range based on period
    const dateRange = calculateDateRange(period);

    // Get current performance metrics
    const currentMetrics = await getCurrentPerformanceMetrics(userId, {
      botId,
      botType,
      chain,
      dateRange
    });

    // Get time series data
    const timeSeriesData = await getTimeSeriesData(userId, {
      botId,
      botType,
      chain,
      dateRange,
      granularity
    });

    // Calculate risk metrics if requested
    let riskMetrics = null;
    if (includeRiskMetrics) {
      riskMetrics = await calculateRiskMetrics(userId, {
        botId,
        botType,
        chain,
        dateRange
      });
    }

    // Get comparison data if requested
    let comparisonData = null;
    if (includeComparison) {
      comparisonData = await getComparisonData(userId, {
        botId,
        botType,
        chain,
        dateRange,
        benchmarkType
      });
    }

    // Get portfolio breakdown
    const portfolioBreakdown = await getPortfolioBreakdown(userId, {
      botId,
      botType,
      chain,
      dateRange
    });

    return NextResponse.json({
      success: true,
      data: {
        period: {
          range: period,
          from: dateRange.from,
          to: dateRange.to,
          granularity
        },
        performance: currentMetrics,
        timeSeries: timeSeriesData,
        riskMetrics,
        comparison: comparisonData,
        portfolio: portfolioBreakdown,
        filters: {
          botId,
          botType,
          chain
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (period) {
    case '1h':
      from = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      from = new Date(2023, 0, 1); // Start from beginning of 2023
      break;
  }

  return {
    from: from.toISOString(),
    to
  };
}

async function getCurrentPerformanceMetrics(userId: string, filters: any) {
  try {
    const supabase = getSupabaseClient();
    
    // Build base query for trades
    let tradesQuery = supabase
      .from('trade_history')
      .select(`
        status,
        profit_loss_usd,
        gas_fee_usd,
        amount_in,
        executed_at,
        chain,
        token_in_symbol,
        token_out_symbol,
        trade_type,
        bot_configurations!inner(user_id, type)
      `)
      .eq('bot_configurations.user_id', userId)
      .gte('executed_at', filters.dateRange.from)
      .lte('executed_at', filters.dateRange.to);

    // Apply filters
    if (filters.botId) tradesQuery = tradesQuery.eq('bot_id', filters.botId);
    if (filters.botType) tradesQuery = tradesQuery.eq('bot_configurations.type', filters.botType);
    if (filters.chain) tradesQuery = tradesQuery.eq('chain', filters.chain);

    const { data: trades, error } = await tradesQuery;

    if (error) {
      console.error('Trades query error:', error);
      return null;
    }

    // Normalize Supabase response to Trade objects
    const normalizedTrades: Trade[] = (trades as SupabaseTrade[] || []).map(normalizeSupabaseTrade);
    const completedTrades = normalizedTrades.filter(t => t.status === 'completed');
    const failedTrades = normalizedTrades.filter(t => t.status === 'failed');

    // Calculate core metrics
    const totalTrades = normalizedTrades.length;
    const successfulTrades = completedTrades.length;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    const totalProfitLoss = completedTrades.reduce((sum, trade) => 
      sum + parseFloat(trade.profit_loss_usd || '0'), 0);

    const totalGasFees = normalizedTrades.reduce((sum, trade) => 
      sum + parseFloat(trade.gas_fee_usd || '0'), 0);

    const netProfit = totalProfitLoss - totalGasFees;

    const profitableTrades = completedTrades.filter(t => 
      parseFloat(t.profit_loss_usd || '0') > 0);

    const winRate = completedTrades.length > 0 ? 
      (profitableTrades.length / completedTrades.length) * 100 : 0;

    const avgProfitPerTrade = completedTrades.length > 0 ? 
      totalProfitLoss / completedTrades.length : 0;

    const avgTradeSize = completedTrades.length > 0 ?
      completedTrades.reduce((sum, trade) => sum + parseFloat(trade.amount_in || '0'), 0) / completedTrades.length : 0;

    // Calculate daily returns for additional metrics
    const dailyReturns = calculateDailyReturns(completedTrades);
    const totalReturn = ((netProfit / Math.max(avgTradeSize * totalTrades, 1)) * 100);

    return {
      summary: {
        totalTrades,
        successfulTrades,
        failedTrades: failedTrades.length,
        successRate: Math.round(successRate * 100) / 100,
        winRate: Math.round(winRate * 100) / 100,
        totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
        totalGasFees: Math.round(totalGasFees * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        avgProfitPerTrade: Math.round(avgProfitPerTrade * 100) / 100,
        avgTradeSize: Math.round(avgTradeSize * 100) / 100
      },
      returns: {
        daily: dailyReturns,
        cumulative: calculateCumulativeReturns(dailyReturns)
      }
    };

  } catch (error) {
    console.error('Performance metrics calculation error:', error);
    return null;
  }
}

async function getTimeSeriesData(userId: string, filters: any) {
  try {
    const supabase = getSupabaseClient();
    
    // Get trades grouped by time period
    let query = supabase
      .from('trade_history')
      .select(`
        executed_at,
        profit_loss_usd,
        gas_fee_usd,
        status,
        bot_configurations!inner(user_id, type)
      `)
      .eq('bot_configurations.user_id', userId)
      .gte('executed_at', filters.dateRange.from)
      .lte('executed_at', filters.dateRange.to)
      .order('executed_at', { ascending: true });

    // Apply filters
    if (filters.botId) query = query.eq('bot_id', filters.botId);
    if (filters.botType) query = query.eq('bot_configurations.type', filters.botType);
    if (filters.chain) query = query.eq('chain', filters.chain);

    const { data: trades, error } = await query;

    if (error || !trades) {
      console.error('Time series query error:', error);
      return [];
    }

    // Normalize Supabase response to Trade objects
    const normalizedTrades: Trade[] = (trades as SupabaseTrade[]).map(normalizeSupabaseTrade);

    // Group trades by time period
    const timeGroups: TimeGroup = groupTradesByTime(normalizedTrades, filters.granularity);
    
    // Calculate metrics for each time period
    const timeSeriesData = Object.entries(timeGroups).map(([timestamp, periodTrades]: [string, Trade[]]) => {
      const completedTrades = periodTrades.filter((t: Trade) => t.status === 'completed');
      
      const totalProfit = completedTrades.reduce((sum: number, trade: Trade) => 
        sum + parseFloat(trade.profit_loss_usd || '0'), 0);
      
      const totalGasFees = periodTrades.reduce((sum: number, trade: Trade) => 
        sum + parseFloat(trade.gas_fee_usd || '0'), 0);

      const netProfit = totalProfit - totalGasFees;
      const successRate = periodTrades.length > 0 ? 
        (completedTrades.length / periodTrades.length) * 100 : 0;

      return {
        timestamp,
        totalTrades: periodTrades.length,
        completedTrades: completedTrades.length,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalGasFees: Math.round(totalGasFees * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        successRate: Math.round(successRate * 100) / 100
      };
    });

    return timeSeriesData;

  } catch (error) {
    console.error('Time series data error:', error);
    return [];
  }
}

async function calculateRiskMetrics(userId: string, filters: any) {
  try {
    const supabase = getSupabaseClient();
    
    // Get all completed trades for risk analysis
    let query = supabase
      .from('trade_history')
      .select(`
        profit_loss_usd,
        executed_at,
        amount_in,
        bot_configurations!inner(user_id, type)
      `)
      .eq('bot_configurations.user_id', userId)
      .eq('status', 'completed')
      .gte('executed_at', filters.dateRange.from)
      .lte('executed_at', filters.dateRange.to);

    // Apply filters
    if (filters.botId) query = query.eq('bot_id', filters.botId);
    if (filters.botType) query = query.eq('bot_configurations.type', filters.botType);
    if (filters.chain) query = query.eq('chain', filters.chain);

    const { data: trades, error } = await query;

    if (error || !trades || trades.length === 0) {
      return null;
    }

    // Normalize trades to Trade[] type
    const normalizedTrades: Trade[] = (trades as SupabaseTrade[]).map(normalizeSupabaseTrade);
    const returns = normalizedTrades.map(trade => parseFloat(trade.profit_loss_usd || '0'));
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Calculate risk metrics
    const totalReturn = returns.reduce((sum: number, r: number) => sum + r, 0);
    const avgReturn = totalReturn / returns.length;
    const variance = returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Value at Risk (VaR) at 95% confidence level
    const var95Index = Math.floor(returns.length * 0.05);
    const var95 = sortedReturns[var95Index] || 0;

    // Maximum Drawdown
    const maxDrawdown = calculateMaxDrawdown(returns);

    // Sharpe Ratio (assuming risk-free rate of 2% annually)
    const riskFreeRate = 0.02 / 365; // Daily risk-free rate
    const excessReturn = avgReturn - riskFreeRate;
    const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;

    // Sortino Ratio (downside deviation)
    const negativeReturns = returns.filter(r => r < avgReturn);
    const downsideVariance = negativeReturns.length > 0 ?
      negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / negativeReturns.length : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideDeviation > 0 ? excessReturn / downsideDeviation : 0;

    // Calmar Ratio
    const calmarRatio = Math.abs(maxDrawdown) > 0 ? 
      (totalReturn / Math.abs(maxDrawdown)) : 0;

    return {
      volatility: Math.round(volatility * 10000) / 10000,
      var95: Math.round(var95 * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
      sortinoRatio: Math.round(sortinoRatio * 1000) / 1000,
      calmarRatio: Math.round(calmarRatio * 1000) / 1000,
      avgReturn: Math.round(avgReturn * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      bestTrade: Math.max(...returns),
      worstTrade: Math.min(...returns),
      winRate: (returns.filter(r => r > 0).length / returns.length) * 100
    };

  } catch (error) {
    console.error('Risk metrics calculation error:', error);
    return null;
  }
}

async function getComparisonData(userId: string, filters: any) {
  try {
    const supabase = getSupabaseClient();
    
    // Get user's historical performance for comparison
    let userQuery = supabase
      .from('trade_history')
      .select(`
        profit_loss_usd,
        executed_at,
        bot_configurations!inner(user_id, type)
      `)
      .eq('bot_configurations.user_id', userId)
      .eq('status', 'completed')
      .gte('executed_at', filters.dateRange.from)
      .lte('executed_at', filters.dateRange.to);

    const { data: userTrades } = await userQuery;
    
    if (!userTrades || userTrades.length === 0) {
      return null;
    }

    const userReturns = userTrades.map(trade => parseFloat(trade.profit_loss_usd || '0'));
    const userTotalReturn = userReturns.reduce((sum, r) => sum + r, 0);
    const userAvgReturn = userTotalReturn / userReturns.length;

    // This would implement comparison against different benchmarks
    // For now, we'll return a structure with user performance vs benchmark
    
    return {
      benchmark: {
        type: filters.benchmarkType,
        return: 5.2, // Example benchmark return
        volatility: 15.5,
        sharpeRatio: 0.34
      },
      user: {
        return: userTotalReturn,
        avgReturn: userAvgReturn,
        trades: userTrades.length
      },
      relative: {
        excessReturn: userTotalReturn - 5.2, // User performance vs benchmark
        informationRatio: 0.18,
        beta: 0.85,
        alpha: 1.2
      }
    };

  } catch (error) {
    console.error('Comparison data error:', error);
    return null;
  }
}

async function getPortfolioBreakdown(userId: string, filters: any) {
  try {
    const supabase = getSupabaseClient();
    
    // Get portfolio breakdown by different dimensions
    let query = supabase
      .from('trade_history')
      .select(`
        chain,
        token_in_symbol,
        token_out_symbol,
        profit_loss_usd,
        gas_fee_usd,
        amount_in,
        trade_type,
        status,
        executed_at,
        bot_configurations!inner(user_id, type, name)
      `)
      .eq('bot_configurations.user_id', userId)
      .eq('status', 'completed')
      .gte('executed_at', filters.dateRange.from)
      .lte('executed_at', filters.dateRange.to);

    // Apply filters
    if (filters.botId) query = query.eq('bot_id', filters.botId);
    if (filters.botType) query = query.eq('bot_configurations.type', filters.botType);
    if (filters.chain) query = query.eq('chain', filters.chain);

    const { data: trades, error } = await query;

    if (error || !trades) {
      return null;
    }

    // Normalize Supabase response to Trade objects
    const normalizedTrades: Trade[] = (trades as SupabaseTrade[]).map(normalizeSupabaseTrade);

    // Group by different dimensions
    const byChain = groupBy(normalizedTrades, 'chain');
    const byBot = groupBy(normalizedTrades, (trade: Trade) => trade.bot_configurations?.name || 'Unknown');
    const byTradeType = groupBy(normalizedTrades, 'trade_type');
    const byToken = groupBy(normalizedTrades, 'token_in_symbol');

    const processGroup = (group: Trade[]) => ({
      trades: group.length,
      totalProfit: group.reduce((sum, t) => sum + parseFloat(t.profit_loss_usd || '0'), 0),
      avgTradeSize: group.reduce((sum, t) => sum + parseFloat(t.amount_in || '0'), 0) / group.length
    });

    return {
      byChain: Object.fromEntries(
        Object.entries(byChain).map(([key, trades]) => [key, processGroup(trades)])
      ),
      byBot: Object.fromEntries(
        Object.entries(byBot).map(([key, trades]) => [key, processGroup(trades)])
      ),
      byTradeType: Object.fromEntries(
        Object.entries(byTradeType).map(([key, trades]) => [key, processGroup(trades)])
      ),
      byToken: Object.fromEntries(
        Object.entries(byToken).slice(0, 10).map(([key, trades]) => [key, processGroup(trades)])
      )
    };

  } catch (error) {
    console.error('Portfolio breakdown error:', error);
    return null;
  }
}

// Helper functions
function calculateDailyReturns(trades: Trade[]) {
  const tradesByDay = groupBy(trades, (trade: Trade) => {
    const date = new Date(trade.executed_at).toISOString().split('T')[0];
    return date || 'unknown';
  });

  return Object.entries(tradesByDay).map(([date, dayTrades]) => ({
    date,
    return: dayTrades.reduce((sum, trade) => 
      sum + parseFloat(trade.profit_loss_usd || '0'), 0)
  }));
}

function calculateCumulativeReturns(dailyReturns: { date: string; return: number }[]) {
  let cumulative = 0;
  return dailyReturns.map(day => {
    cumulative += day.return;
    return {
      date: day.date,
      cumulativeReturn: cumulative
    };
  });
}

function groupTradesByTime(trades: Trade[], granularity: string): TimeGroup {
  return trades.reduce((groups, trade) => {
    const date = new Date(trade.executed_at);
    let key: string;

    switch (granularity) {
      case 'hour':
        key = date.toISOString().slice(0, 13) + ':00:00.000Z';
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        key = weekKey || 'unknown';
        break;
      case 'day':
      default:
        const dayKey = date.toISOString().split('T')[0];
        key = dayKey || 'unknown';
        break;
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key]!.push(trade);
    return groups;
  }, {} as TimeGroup);
}

function calculateMaxDrawdown(returns: number[]): number {
  let maxDrawdown = 0;
  let peak = 0;
  let cumulative = 0;

  for (const ret of returns) {
    cumulative += ret;
    peak = Math.max(peak, cumulative);
    const drawdown = (peak - cumulative) / Math.max(peak, 1);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return -maxDrawdown; // Return as negative percentage
}

function groupBy<T>(array: T[], keySelector: string | ((item: T) => string)): Record<string, T[]> {
  return array.reduce((groups, item) => {
    let key: string;
    if (typeof keySelector === 'string') {
      const value = (item as any)[keySelector];
      key = value ? String(value) : 'unknown';
    } else {
      const result = keySelector(item);
      key = result ?? 'unknown';
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key]!.push(item);
    return groups;
  }, {} as Record<string, T[]>);
}
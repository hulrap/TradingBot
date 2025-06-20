import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

/**
 * Performance Analytics API Configuration
 * Centralized configuration for financial calculations and system parameters
 */
const PERFORMANCE_CONFIG = {
  // Financial calculation constants
  RISK_FREE_RATE_ANNUAL: parseFloat(process.env['RISK_FREE_RATE_ANNUAL'] || '0.02'), // 2% annual risk-free rate
  VAR_CONFIDENCE_LEVEL: parseFloat(process.env['VAR_CONFIDENCE_LEVEL'] || '0.95'), // 95% confidence level for VaR
  
  // Date range defaults
  DEFAULT_START_YEAR: parseInt(process.env['DEFAULT_PERFORMANCE_START_YEAR'] || '2023'),
  
  // Caching configuration
  CACHE_TTL_SECONDS: parseInt(process.env['PERFORMANCE_CACHE_TTL'] || '300'), // 5 minutes
  
  // Rate limiting
  RATE_LIMIT_REQUESTS: parseInt(process.env['PERFORMANCE_RATE_LIMIT'] || '30'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env['PERFORMANCE_RATE_LIMIT_WINDOW'] || '3600000'), // 1 hour
  
  // Database optimization
  MAX_TRADES_FOR_DETAILED_ANALYSIS: parseInt(process.env['MAX_TRADES_DETAILED_ANALYSIS'] || '10000'),
  
  // Portfolio breakdown limits
  MAX_TOKEN_BREAKDOWN_ITEMS: parseInt(process.env['MAX_TOKEN_BREAKDOWN_ITEMS'] || '20'),
} as const;

/**
 * Simple in-memory cache for expensive calculations
 * In production, this should be replaced with Redis
 */
class PerformanceCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttlSeconds: number = PERFORMANCE_CONFIG.CACHE_TTL_SECONDS): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Would need proper tracking in production
      misses: 0
    };
  }
}

const performanceCache = new PerformanceCache();

/**
 * Enhanced error types for better error handling
 */
class PerformanceAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public errorCode: string = 'PERFORMANCE_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'PerformanceAPIError';
  }
}

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new PerformanceAPIError(
      'Supabase configuration is missing',
      500,
      'CONFIG_ERROR',
      { missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] }
    );
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Input validation schema with comprehensive validation
 */
const PerformanceQuerySchema = z.object({
  botId: z.string().uuid('Invalid bot ID format').optional(),
  botType: z.enum(['arbitrage', 'copy-trader', 'mev-sandwich'], {
    errorMap: () => ({ message: 'Bot type must be one of: arbitrage, copy-trader, mev-sandwich' })
  }).optional(),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana'], {
    errorMap: () => ({ message: 'Chain must be one of: ethereum, bsc, polygon, arbitrum, optimism, solana' })
  }).optional(),
  period: z.enum(['1h', '24h', '7d', '30d', '90d', 'all'], {
    errorMap: () => ({ message: 'Period must be one of: 1h, 24h, 7d, 30d, 90d, all' })
  }).optional().default('7d'),
  granularity: z.enum(['hour', 'day', 'week'], {
    errorMap: () => ({ message: 'Granularity must be one of: hour, day, week' })
  }).optional().default('day'),
  includeRiskMetrics: z.string().transform(val => val === 'true').optional().default('true'),
  includeComparison: z.string().transform(val => val === 'true').optional().default('false'),
  benchmarkType: z.enum(['hold', 'market', 'peer'], {
    errorMap: () => ({ message: 'Benchmark type must be one of: hold, market, peer' })
  }).optional().default('hold'),
  forceRefresh: z.string().transform(val => val === 'true').optional().default('false')
});

// Enhanced interfaces with better typing
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

interface PerformanceFilters {
  botId?: string | undefined;
  botType?: string | undefined;
  chain?: string | undefined;
  dateRange: { from: string; to: string };
}

/**
 * Enhanced logging for performance API operations
 */
function logPerformanceOperation(
  operation: string,
  userId: string,
  filters: any,
  duration?: number,
  error?: Error
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    operation,
    userId,
    filters: JSON.stringify(filters),
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      stack: error.stack?.split('\n')[0]
    } : undefined,
    cacheStats: performanceCache.getStats()
  };
  
  if (error) {
    console.error('[PERFORMANCE_API_ERROR]', logData);
  } else {
    console.log('[PERFORMANCE_API_SUCCESS]', logData);
  }
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

/**
 * Performance Analytics API Endpoint
 * 
 * @route GET /api/performance
 * @description Comprehensive trading bot performance analytics with risk metrics and portfolio breakdown
 * 
 * @param {string} [botId] - UUID of specific bot to analyze
 * @param {string} [botType] - Type of bot: arbitrage, copy-trader, mev-sandwich
 * @param {string} [chain] - Blockchain: ethereum, bsc, polygon, arbitrum, optimism, solana
 * @param {string} [period=7d] - Time period: 1h, 24h, 7d, 30d, 90d, all
 * @param {string} [granularity=day] - Data granularity: hour, day, week
 * @param {string} [includeRiskMetrics=true] - Include risk analysis
 * @param {string} [includeComparison=false] - Include benchmark comparison
 * @param {string} [benchmarkType=hold] - Benchmark type: hold, market, peer
 * @param {string} [forceRefresh=false] - Force cache refresh
 * 
 * @returns {Object} Performance data including:
 *   - performance: Core metrics (P&L, success rate, returns)
 *   - timeSeries: Historical performance data
 *   - riskMetrics: Risk analysis (Sharpe ratio, VaR, max drawdown)
 *   - comparison: Benchmark comparison data
 *   - portfolio: Asset and strategy breakdown
 * 
 * @throws {400} Invalid query parameters
 * @throws {401} Unauthorized - invalid or missing JWT token
 * @throws {404} No trading data found for the specified criteria
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let userId: string = '';
  let filters: any = {};
  
  try {
    // Enhanced rate limiting with specific limits for performance API
    const rateLimitResult = await rateLimiter.check(request);
    
    if (!rateLimitResult.success) {
      throw new PerformanceAPIError(
        'Rate limit exceeded for performance API',
        429,
        'RATE_LIMIT_EXCEEDED',
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          limit: PERFORMANCE_CONFIG.RATE_LIMIT_REQUESTS,
          windowMs: PERFORMANCE_CONFIG.RATE_LIMIT_WINDOW_MS
        }
      );
    }

    // Authentication with enhanced error details
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      throw new PerformanceAPIError(
        'Authentication failed',
        401,
        'AUTH_FAILED',
        { details: authResult.error }
      );
    }

    userId = authResult.payload?.sub || '';
    if (!userId) {
      throw new PerformanceAPIError(
        'Invalid token payload - missing user ID',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    // Enhanced input validation
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validationResult = PerformanceQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      throw new PerformanceAPIError(
        'Invalid query parameters',
        400,
        'VALIDATION_ERROR',
        { 
          errors: validationResult.error.errors,
          received: queryParams
        }
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
      benchmarkType,
      forceRefresh
    } = validationResult.data;

    filters = { botId, botType, chain, period, granularity };

    // Calculate date range based on period
    const dateRange = calculateDateRange(period);
    const cacheKey = `performance:${userId}:${JSON.stringify({ botId, botType, chain, period, granularity })}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = performanceCache.get(cacheKey);
      if (cachedData) {
        logPerformanceOperation('GET_PERFORMANCE_CACHED', userId, filters, Date.now() - startTime);
        return NextResponse.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Get current performance metrics
    const currentMetrics = await getCurrentPerformanceMetrics(userId, {
      botId,
      botType,
      chain,
      dateRange
    } as PerformanceFilters);

    if (!currentMetrics) {
      throw new PerformanceAPIError(
        'No trading data found for the specified criteria',
        404,
        'NO_DATA_FOUND',
        { filters: { botId, botType, chain, period } }
      );
    }

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

    const responseData = {
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
      },
      metadata: {
        calculationConfig: {
          riskFreeRate: PERFORMANCE_CONFIG.RISK_FREE_RATE_ANNUAL,
          varConfidenceLevel: PERFORMANCE_CONFIG.VAR_CONFIDENCE_LEVEL
        },
        dataQuality: {
          totalDataPoints: timeSeriesData.length,
          completeness: timeSeriesData.length > 0 ? 100 : 0
        }
      }
    };

    // Cache the response
    performanceCache.set(cacheKey, responseData);

    logPerformanceOperation('GET_PERFORMANCE_SUCCESS', userId, filters, Date.now() - startTime);

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof PerformanceAPIError) {
      logPerformanceOperation('GET_PERFORMANCE_ERROR', userId, filters, duration, error);
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    // Unexpected errors
    logPerformanceOperation('GET_PERFORMANCE_UNEXPECTED_ERROR', userId, filters, duration, error as Error);
    console.error('Unexpected performance API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate date range based on period with configurable defaults
 */
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
      from = new Date(PERFORMANCE_CONFIG.DEFAULT_START_YEAR, 0, 1);
      break;
  }

  return {
    from: from.toISOString(),
    to
  };
}

/**
 * Get current performance metrics with enhanced error handling
 */
async function getCurrentPerformanceMetrics(userId: string, filters: PerformanceFilters) {
  try {
    const supabase = getSupabaseClient();
    
    // Build base query for trades with optimization for large datasets
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
      .lte('executed_at', filters.dateRange.to)
      .limit(PERFORMANCE_CONFIG.MAX_TRADES_FOR_DETAILED_ANALYSIS);

    // Apply filters
    if (filters.botId) tradesQuery = tradesQuery.eq('bot_id', filters.botId);
    if (filters.botType) tradesQuery = tradesQuery.eq('bot_configurations.type', filters.botType);
    if (filters.chain) tradesQuery = tradesQuery.eq('chain', filters.chain);

    const { data: trades, error } = await tradesQuery;

    if (error) {
      throw new PerformanceAPIError(
        'Failed to fetch trade data',
        500,
        'DATABASE_ERROR',
        { supabaseError: error }
      );
    }

    if (!trades || trades.length === 0) {
      return null;
    }

    // Normalize Supabase response to Trade objects
    const normalizedTrades: Trade[] = (trades as SupabaseTrade[]).map(normalizeSupabaseTrade);
    const completedTrades = normalizedTrades.filter(t => t.status === 'completed');
    const failedTrades = normalizedTrades.filter(t => t.status === 'failed');

    // Calculate core metrics with enhanced precision
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
    const totalReturn = avgTradeSize > 0 ? ((netProfit / (avgTradeSize * totalTrades)) * 100) : 0;

    // Enhanced precision with proper rounding
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
      },
      dataQuality: {
        completeness: (completedTrades.length / Math.max(totalTrades, 1)) * 100,
        dataPoints: totalTrades,
        timeSpan: filters.dateRange
      }
    };

  } catch (error) {
    if (error instanceof PerformanceAPIError) {
      throw error;
    }
    throw new PerformanceAPIError(
      'Performance metrics calculation failed',
      500,
      'CALCULATION_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Get time series data with enhanced caching and optimization
 */
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

    if (error) {
      throw new PerformanceAPIError(
        'Failed to fetch time series data',
        500,
        'DATABASE_ERROR',
        { supabaseError: error }
      );
    }

    if (!trades) {
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

    return timeSeriesData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  } catch (error) {
    if (error instanceof PerformanceAPIError) {
      throw error;
    }
    throw new PerformanceAPIError(
      'Time series data calculation failed',
      500,
      'TIMESERIES_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Calculate risk metrics with configurable parameters
 */
async function calculateRiskMetrics(userId: string, filters: PerformanceFilters) {
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

    if (error) {
      throw new PerformanceAPIError(
        'Failed to fetch trade data for risk analysis',
        500,
        'DATABASE_ERROR',
        { supabaseError: error }
      );
    }

    if (!trades || trades.length === 0) {
      return null;
    }

    // Normalize trades to Trade[] type
    const normalizedTrades: Trade[] = (trades as SupabaseTrade[]).map(normalizeSupabaseTrade);
    const returns = normalizedTrades.map(trade => parseFloat(trade.profit_loss_usd || '0'));
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Calculate risk metrics with configurable parameters
    const totalReturn = returns.reduce((sum: number, r: number) => sum + r, 0);
    const avgReturn = totalReturn / returns.length;
    const variance = returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Value at Risk (VaR) with configurable confidence level
    const varIndex = Math.floor(returns.length * (1 - PERFORMANCE_CONFIG.VAR_CONFIDENCE_LEVEL));
    const var95 = sortedReturns[varIndex] || 0;

    // Maximum Drawdown
    const maxDrawdown = calculateMaxDrawdown(returns);

    // Sharpe Ratio with configurable risk-free rate
    const riskFreeRate = PERFORMANCE_CONFIG.RISK_FREE_RATE_ANNUAL / 365; // Daily risk-free rate
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
      winRate: (returns.filter(r => r > 0).length / returns.length) * 100,
      configuration: {
        riskFreeRate: PERFORMANCE_CONFIG.RISK_FREE_RATE_ANNUAL,
        varConfidenceLevel: PERFORMANCE_CONFIG.VAR_CONFIDENCE_LEVEL,
        sampleSize: returns.length
      }
    };

  } catch (error) {
    if (error instanceof PerformanceAPIError) {
      throw error;
    }
    throw new PerformanceAPIError(
      'Risk metrics calculation failed',
      500,
      'RISK_CALCULATION_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Enhanced comparison data with better benchmark handling
 */
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

    const { data: userTrades, error } = await userQuery;
    
    if (error) {
      throw new PerformanceAPIError(
        'Failed to fetch user trade data for comparison',
        500,
        'DATABASE_ERROR',
        { supabaseError: error }
      );
    }
    
    if (!userTrades || userTrades.length === 0) {
      return null;
    }

    const userReturns = userTrades.map(trade => parseFloat(trade.profit_loss_usd || '0'));
    const userTotalReturn = userReturns.reduce((sum, r) => sum + r, 0);
    const userAvgReturn = userTotalReturn / userReturns.length;

    // Enhanced benchmark calculation based on benchmark type
    let benchmarkData = {
      return: 0,
      volatility: 0,
      sharpeRatio: 0
    };

    switch (filters.benchmarkType) {
      case 'hold':
        // Simple hold strategy (risk-free rate)
        benchmarkData = {
          return: PERFORMANCE_CONFIG.RISK_FREE_RATE_ANNUAL,
          volatility: 0,
          sharpeRatio: 0
        };
        break;
      case 'market':
        // Mock market performance (in production, fetch real market data)
        benchmarkData = {
          return: 8.5, // Example market return
          volatility: 18.2,
          sharpeRatio: 0.35
        };
        break;
      case 'peer':
        // Peer average (in production, calculate from other users)
        benchmarkData = {
          return: 6.2,
          volatility: 15.8,
          sharpeRatio: 0.28
        };
        break;
    }
    
    return {
      benchmark: {
        type: filters.benchmarkType,
        return: benchmarkData.return,
        volatility: benchmarkData.volatility,
        sharpeRatio: benchmarkData.sharpeRatio
      },
      user: {
        return: Math.round(userTotalReturn * 100) / 100,
        avgReturn: Math.round(userAvgReturn * 100) / 100,
        trades: userTrades.length
      },
      relative: {
        excessReturn: Math.round((userTotalReturn - benchmarkData.return) * 100) / 100,
        informationRatio: 0.18, // Would need proper calculation
        beta: 0.85,
        alpha: Math.round((userAvgReturn - PERFORMANCE_CONFIG.RISK_FREE_RATE_ANNUAL / 365) * 100) / 100
      }
    };

  } catch (error) {
    if (error instanceof PerformanceAPIError) {
      throw error;
    }
    console.error('Comparison data error:', error);
    return null;
  }
}

/**
 * Enhanced portfolio breakdown with better limits and error handling
 */
async function getPortfolioBreakdown(userId: string, filters: PerformanceFilters) {
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

    if (error) {
      throw new PerformanceAPIError(
        'Failed to fetch portfolio breakdown data',
        500,
        'DATABASE_ERROR',
        { supabaseError: error }
      );
    }

    if (!trades) {
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
      totalProfit: Math.round(group.reduce((sum, t) => sum + parseFloat(t.profit_loss_usd || '0'), 0) * 100) / 100,
      avgTradeSize: Math.round((group.reduce((sum, t) => sum + parseFloat(t.amount_in || '0'), 0) / group.length) * 100) / 100,
      winRate: Math.round((group.filter(t => parseFloat(t.profit_loss_usd || '0') > 0).length / group.length) * 100 * 100) / 100
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
        Object.entries(byToken)
          .slice(0, PERFORMANCE_CONFIG.MAX_TOKEN_BREAKDOWN_ITEMS)
          .map(([key, trades]) => [key, processGroup(trades)])
      ),
      summary: {
        totalChains: Object.keys(byChain).length,
        totalBots: Object.keys(byBot).length,
        totalTradeTypes: Object.keys(byTradeType).length,
        totalTokens: Object.keys(byToken).length
      }
    };

  } catch (error) {
    if (error instanceof PerformanceAPIError) {
      throw error;
    }
    console.error('Portfolio breakdown error:', error);
    return null;
  }
}

// Helper functions with enhanced error handling
function calculateDailyReturns(trades: Trade[]) {
  try {
    const tradesByDay = groupBy(trades, (trade: Trade) => {
      const date = new Date(trade.executed_at).toISOString().split('T')[0];
      return date || 'unknown';
    });

    return Object.entries(tradesByDay)
      .filter(([date]) => date !== 'unknown')
      .map(([date, dayTrades]) => ({
        date,
        return: Math.round(dayTrades.reduce((sum, trade) => 
          sum + parseFloat(trade.profit_loss_usd || '0'), 0) * 100) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Daily returns calculation error:', error);
    return [];
  }
}

function calculateCumulativeReturns(dailyReturns: { date: string; return: number }[]) {
  try {
    let cumulative = 0;
    return dailyReturns.map(day => {
      cumulative += day.return;
      return {
        date: day.date,
        cumulativeReturn: Math.round(cumulative * 100) / 100
      };
    });
  } catch (error) {
    console.error('Cumulative returns calculation error:', error);
    return [];
  }
}

function groupTradesByTime(trades: Trade[], granularity: string): TimeGroup {
  try {
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
  } catch (error) {
    console.error('Group trades by time error:', error);
    return {};
  }
}

function calculateMaxDrawdown(returns: number[]): number {
  try {
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
  } catch (error) {
    console.error('Max drawdown calculation error:', error);
    return 0;
  }
}

function groupBy<T>(array: T[], keySelector: string | ((item: T) => string)): Record<string, T[]> {
  try {
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
  } catch (error) {
    console.error('Group by error:', error);
    return {};
  }
}
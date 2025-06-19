import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TradeQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val)).optional().default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val), 100)).optional().default('20'),
  botId: z.string().uuid().optional(),
  botType: z.enum(['arbitrage', 'copy-trader', 'mev-sandwich']).optional(),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana']).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  tokenSymbol: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minProfit: z.string().transform(val => parseFloat(val)).optional(),
  maxProfit: z.string().transform(val => parseFloat(val)).optional(),
  sortBy: z.enum(['executed_at', 'profit_loss', 'amount_in', 'gas_fee']).optional().default('executed_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  includeAnalytics: z.string().transform(val => val === 'true').optional().default('false')
});

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.checkLimit(request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter 
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

    const userId = authResult.payload.sub;
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Validate query parameters
    const validationResult = TradeQuerySchema.safeParse(queryParams);
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
      page,
      limit,
      botId,
      botType,
      chain,
      status,
      tokenSymbol,
      dateFrom,
      dateTo,
      minProfit,
      maxProfit,
      sortBy,
      sortOrder,
      includeAnalytics
    } = validationResult.data;

    // Build base query
    let query = supabase
      .from('trade_history')
      .select(`
        id,
        bot_id,
        trade_type,
        chain,
        dex_name,
        token_in_address,
        token_in_symbol,
        token_in_decimals,
        token_out_address,
        token_out_symbol,
        token_out_decimals,
        amount_in,
        amount_out,
        expected_amount_out,
        slippage,
        profit_loss,
        profit_loss_usd,
        gas_fee,
        gas_fee_usd,
        total_fee,
        price_impact,
        status,
        transaction_hash,
        block_number,
        executed_at,
        failed_reason,
        bot_configurations!inner(
          id,
          name,
          type,
          user_id
        )
      `)
      .eq('bot_configurations.user_id', userId)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * limit, page * limit - 1);

    // Apply filters
    if (botId) {
      query = query.eq('bot_id', botId);
    }

    if (botType) {
      query = query.eq('bot_configurations.type', botType);
    }

    if (chain) {
      query = query.eq('chain', chain);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (tokenSymbol) {
      query = query.or(`token_in_symbol.ilike.%${tokenSymbol}%,token_out_symbol.ilike.%${tokenSymbol}%`);
    }

    if (dateFrom) {
      query = query.gte('executed_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('executed_at', dateTo);
    }

    if (minProfit !== undefined) {
      query = query.gte('profit_loss_usd', minProfit);
    }

    if (maxProfit !== undefined) {
      query = query.lte('profit_loss_usd', maxProfit);
    }

    const { data: trades, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trades', details: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('trade_history')
      .select('*', { count: 'exact', head: true })
      .eq('bot_configurations.user_id', userId);

    // Apply same filters for count
    if (botId) countQuery = countQuery.eq('bot_id', botId);
    if (botType) countQuery = countQuery.eq('bot_configurations.type', botType);
    if (chain) countQuery = countQuery.eq('chain', chain);
    if (status) countQuery = countQuery.eq('status', status);
    if (tokenSymbol) countQuery = countQuery.or(`token_in_symbol.ilike.%${tokenSymbol}%,token_out_symbol.ilike.%${tokenSymbol}%`);
    if (dateFrom) countQuery = countQuery.gte('executed_at', dateFrom);
    if (dateTo) countQuery = countQuery.lte('executed_at', dateTo);
    if (minProfit !== undefined) countQuery = countQuery.gte('profit_loss_usd', minProfit);
    if (maxProfit !== undefined) countQuery = countQuery.lte('profit_loss_usd', maxProfit);

    const { count: totalCount } = await countQuery;

    // Calculate analytics if requested
    let analytics = null;
    if (includeAnalytics) {
      analytics = await calculateTradeAnalytics(userId, {
        botId,
        botType,
        chain,
        dateFrom,
        dateTo
      });
    }

    // Process trades for response
    const processedTrades = (trades || []).map(trade => ({
      id: trade.id,
      botId: trade.bot_id,
      botName: trade.bot_configurations.name,
      botType: trade.bot_configurations.type,
      tradeType: trade.trade_type,
      chain: trade.chain,
      dex: trade.dex_name,
      tokenIn: {
        address: trade.token_in_address,
        symbol: trade.token_in_symbol,
        decimals: trade.token_in_decimals,
        amount: trade.amount_in
      },
      tokenOut: {
        address: trade.token_out_address,
        symbol: trade.token_out_symbol,
        decimals: trade.token_out_decimals,
        amount: trade.amount_out,
        expectedAmount: trade.expected_amount_out
      },
      pricing: {
        slippage: trade.slippage,
        priceImpact: trade.price_impact,
        executionPrice: trade.amount_out && trade.amount_in ? 
          (parseFloat(trade.amount_out) / parseFloat(trade.amount_in)).toString() : null
      },
      profitLoss: {
        amount: trade.profit_loss,
        usd: trade.profit_loss_usd,
        percentage: trade.amount_in ? 
          ((parseFloat(trade.profit_loss || '0') / parseFloat(trade.amount_in)) * 100).toFixed(4) : null
      },
      fees: {
        gas: trade.gas_fee,
        gasUsd: trade.gas_fee_usd,
        total: trade.total_fee
      },
      execution: {
        status: trade.status,
        transactionHash: trade.transaction_hash,
        blockNumber: trade.block_number,
        executedAt: trade.executed_at,
        failureReason: trade.failed_reason
      }
    }));

    return NextResponse.json({
      success: true,
      data: {
        trades: processedTrades,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasNext: page * limit < (totalCount || 0),
          hasPrev: page > 1
        },
        analytics,
        filters: {
          botId,
          botType,
          chain,
          status,
          tokenSymbol,
          dateFrom,
          dateTo,
          minProfit,
          maxProfit
        }
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function calculateTradeAnalytics(userId: string, filters: {
  botId?: string;
  botType?: string;
  chain?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  try {
    // Build analytics query with same filters
    let analyticsQuery = supabase
      .from('trade_history')
      .select(`
        status,
        profit_loss_usd,
        gas_fee_usd,
        trade_type,
        chain,
        executed_at,
        bot_configurations!inner(user_id, type)
      `)
      .eq('bot_configurations.user_id', userId);

    // Apply same filters
    if (filters.botId) analyticsQuery = analyticsQuery.eq('bot_id', filters.botId);
    if (filters.botType) analyticsQuery = analyticsQuery.eq('bot_configurations.type', filters.botType);
    if (filters.chain) analyticsQuery = analyticsQuery.eq('chain', filters.chain);
    if (filters.dateFrom) analyticsQuery = analyticsQuery.gte('executed_at', filters.dateFrom);
    if (filters.dateTo) analyticsQuery = analyticsQuery.lte('executed_at', filters.dateTo);

    const { data: analyticsData, error } = await analyticsQuery;

    if (error || !analyticsData) {
      console.error('Analytics query error:', error);
      return null;
    }

    // Calculate comprehensive analytics
    const totalTrades = analyticsData.length;
    const completedTrades = analyticsData.filter(t => t.status === 'completed');
    const failedTrades = analyticsData.filter(t => t.status === 'failed');

    const totalProfitLoss = completedTrades.reduce((sum, trade) => 
      sum + parseFloat(trade.profit_loss_usd || '0'), 0
    );

    const totalGasFees = analyticsData.reduce((sum, trade) => 
      sum + parseFloat(trade.gas_fee_usd || '0'), 0
    );

    const netProfit = totalProfitLoss - totalGasFees;

    const profitableTrades = completedTrades.filter(t => 
      parseFloat(t.profit_loss_usd || '0') > 0
    );

    const winRate = completedTrades.length > 0 ? 
      (profitableTrades.length / completedTrades.length) * 100 : 0;

    const avgProfitPerTrade = completedTrades.length > 0 ? 
      totalProfitLoss / completedTrades.length : 0;

    const avgGasFeePerTrade = totalTrades > 0 ? 
      totalGasFees / totalTrades : 0;

    // Calculate profit/loss distribution
    const profits = completedTrades.map(t => parseFloat(t.profit_loss_usd || '0'));
    const maxProfit = profits.length > 0 ? Math.max(...profits) : 0;
    const maxLoss = profits.length > 0 ? Math.min(...profits) : 0;

    // Calculate trade frequency by day
    const tradesByDay = analyticsData.reduce((acc, trade) => {
      const date = new Date(trade.executed_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate statistics by chain
    const chainStats = analyticsData.reduce((acc, trade) => {
      const chain = trade.chain;
      if (!acc[chain]) {
        acc[chain] = {
          totalTrades: 0,
          totalProfit: 0,
          totalGasFees: 0,
          completedTrades: 0
        };
      }
      
      acc[chain].totalTrades++;
      if (trade.status === 'completed') {
        acc[chain].completedTrades++;
        acc[chain].totalProfit += parseFloat(trade.profit_loss_usd || '0');
      }
      acc[chain].totalGasFees += parseFloat(trade.gas_fee_usd || '0');
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate statistics by trade type
    const tradeTypeStats = analyticsData.reduce((acc, trade) => {
      const type = trade.trade_type;
      if (!acc[type]) {
        acc[type] = {
          totalTrades: 0,
          totalProfit: 0,
          completedTrades: 0
        };
      }
      
      acc[type].totalTrades++;
      if (trade.status === 'completed') {
        acc[type].completedTrades++;
        acc[type].totalProfit += parseFloat(trade.profit_loss_usd || '0');
      }
      
      return acc;
    }, {} as Record<string, any>);

    return {
      summary: {
        totalTrades,
        completedTrades: completedTrades.length,
        failedTrades: failedTrades.length,
        successRate: totalTrades > 0 ? (completedTrades.length / totalTrades) * 100 : 0,
        winRate: Math.round(winRate * 100) / 100,
        totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
        totalGasFees: Math.round(totalGasFees * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        avgProfitPerTrade: Math.round(avgProfitPerTrade * 100) / 100,
        avgGasFeePerTrade: Math.round(avgGasFeePerTrade * 100) / 100,
        maxProfit: Math.round(maxProfit * 100) / 100,
        maxLoss: Math.round(maxLoss * 100) / 100
      },
      distributions: {
        tradesByDay,
        chainStats,
        tradeTypeStats
      },
      period: {
        from: filters.dateFrom || analyticsData[analyticsData.length - 1]?.executed_at,
        to: filters.dateTo || analyticsData[0]?.executed_at,
        durationDays: filters.dateFrom && filters.dateTo ? 
          Math.ceil((new Date(filters.dateTo).getTime() - new Date(filters.dateFrom).getTime()) / (1000 * 60 * 60 * 24)) : null
      }
    };

  } catch (error) {
    console.error('Analytics calculation error:', error);
    return null;
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyJWT } from '@/lib/auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { generateSecureRandom } from '@trading-bot/crypto';

// Enhanced performance tracking
interface PerformanceTimer {
  start: number;
  operation: string;
}

function createTimer(operation: string): PerformanceTimer {
  return { start: Date.now(), operation };
}

function endTimer(timer: PerformanceTimer): number {
  const duration = Date.now() - timer.start;
  console.log(`[Trades API] ${timer.operation}: ${duration}ms`);
  return duration;
}

// Enhanced trade interfaces
interface TradeMetrics {
  totalTrades: number;
  completedTrades: number;
  failedTrades: number;
  pendingTrades: number;
  executingTrades: number;
  cancelledTrades: number;
  successRate: number;
  avgExecutionTime: number;
  totalProfitLoss: number;
  totalGasFees: number;
  netProfit: number;
  avgSlippage: number;
  avgProfitPerTrade: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  totalVolume: number;
  uniqueTokenPairs: number;
  chainsUsed: string[];
  tradingPairs: Array<{
    pair: string;
    count: number;
    volume: number;
    profitLoss: number;
  }>;
}

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Enhanced validation schemas with more options
const TradeQuerySchema = z.object({
  botId: z.string().uuid().optional(),
  status: z.enum(['pending', 'executing', 'completed', 'failed', 'cancelled']).optional(),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'solana', 'avalanche', 'fantom', 'optimism']).optional(),
  tradeType: z.enum(['arbitrage', 'copy', 'sandwich']).optional(),
  tokenSymbol: z.string().optional(),
  minProfitLoss: z.string().transform(val => parseFloat(val)).optional(),
  maxProfitLoss: z.string().transform(val => parseFloat(val)).optional(),
  minAmount: z.string().transform(val => parseFloat(val)).optional(),
  maxAmount: z.string().transform(val => parseFloat(val)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default('50'),
  offset: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).optional().default('0'),
  sortBy: z.enum(['created_at', 'executed_at', 'profit_loss_usd', 'amount_in', 'gas_fee_usd']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeMetrics: z.string().transform(val => val === 'true').optional().default('false'),
  groupBy: z.enum(['day', 'week', 'month', 'bot', 'chain', 'token_pair']).optional()
});

const TradeCreateSchema = z.object({
  botId: z.string().uuid('Invalid bot ID'),
  tradeType: z.enum(['arbitrage', 'copy', 'sandwich'], { invalid_type_error: 'Invalid trade type' }),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'solana', 'avalanche', 'fantom', 'optimism'], { invalid_type_error: 'Invalid chain' }),
  tokenInSymbol: z.string().min(1, 'Token in symbol is required').max(10, 'Token symbol too long'),
  tokenOutSymbol: z.string().min(1, 'Token out symbol is required').max(10, 'Token symbol too long'),
  tokenInAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token in address').optional(),
  tokenOutAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token out address').optional(),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format').min(1, 'Amount in is required'),
  expectedAmountOut: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid expected amount format').optional(),
  maxSlippage: z.number().min(0.01).max(50, 'Max slippage must be between 0.01% and 50%').optional(),
  gasLimit: z.string().regex(/^\d+$/, 'Invalid gas limit format').optional(),
  gasPrice: z.string().regex(/^\d+$/, 'Invalid gas price format').optional(),
  deadline: z.string().datetime().optional(),
  dex: z.string().min(1, 'DEX is required').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  tags: z.array(z.string()).max(10, 'Too many tags').optional(),
  notes: z.string().max(500, 'Notes too long').optional()
});

const TradeUpdateSchema = z.object({
  tradeId: z.string().uuid('Invalid trade ID'),
  status: z.enum(['pending', 'executing', 'completed', 'failed', 'cancelled']),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash').optional(),
  amountOut: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount out format').optional(),
  gasUsed: z.string().regex(/^\d+$/, 'Invalid gas used format').optional(),
  gasPrice: z.string().regex(/^\d+$/, 'Invalid gas price format').optional(),
  actualSlippage: z.number().min(0).max(100, 'Invalid slippage percentage').optional(),
  executionTimeMs: z.number().min(0).max(300000, 'Execution time too long').optional(),
  profitLossUsd: z.string().regex(/^-?\d+(\.\d+)?$/, 'Invalid profit/loss format').optional(),
  gasFeeUsd: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid gas fee format').optional(),
  errorMessage: z.string().max(1000, 'Error message too long').optional(),
  errorCode: z.string().max(50, 'Error code too long').optional(),
  executedAt: z.string().datetime().optional(),
  dex: z.string().optional(),
  blockNumber: z.number().int().positive().optional(),
  notes: z.string().max(500, 'Notes too long').optional()
});

// Enhanced utility functions
async function calculateTradeMetrics(trades: any[]): Promise<TradeMetrics> {
  const totalTrades = trades.length;
  const completedTrades = trades.filter(t => t.status === 'completed');
  const failedTrades = trades.filter(t => t.status === 'failed');
  const pendingTrades = trades.filter(t => t.status === 'pending');
  const executingTrades = trades.filter(t => t.status === 'executing');
  const cancelledTrades = trades.filter(t => t.status === 'cancelled');

  const successRate = totalTrades > 0 ? (completedTrades.length / totalTrades) * 100 : 0;
  
  const totalProfitLoss = completedTrades.reduce((sum, trade) => 
    sum + parseFloat(trade.profit_loss_usd || '0'), 0);
  
  const totalGasFees = trades.reduce((sum, trade) => 
    sum + parseFloat(trade.gas_fee_usd || '0'), 0);
  
  const netProfit = totalProfitLoss - totalGasFees;
  const avgProfitPerTrade = completedTrades.length > 0 ? totalProfitLoss / completedTrades.length : 0;
  
  const profitableTrades = completedTrades.filter(t => parseFloat(t.profit_loss_usd || '0') > 0);
  const winRate = completedTrades.length > 0 ? (profitableTrades.length / completedTrades.length) * 100 : 0;
  
  const executionTimes = completedTrades
    .filter(t => t.execution_time_ms)
    .map(t => parseFloat(t.execution_time_ms || '0'));
  const avgExecutionTime = executionTimes.length > 0 ? 
    executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length : 0;
  
  const slippages = completedTrades
    .filter(t => t.actual_slippage)
    .map(t => parseFloat(t.actual_slippage || '0'));
  const avgSlippage = slippages.length > 0 ?
    slippages.reduce((sum, slip) => sum + slip, 0) / slippages.length : 0;
  
  const profits = completedTrades.map(t => parseFloat(t.profit_loss_usd || '0'));
  const bestTrade = profits.length > 0 ? Math.max(...profits) : 0;
  const worstTrade = profits.length > 0 ? Math.min(...profits) : 0;
  
  const totalVolume = trades.reduce((sum, trade) => 
    sum + parseFloat(trade.amount_in || '0'), 0);
  
  const uniqueTokenPairs = new Set(
    trades.map(t => `${t.token_in_symbol}/${t.token_out_symbol}`)
  ).size;
  
  const chainsUsed = [...new Set(trades.map(t => t.chain).filter(Boolean))];
  
  const pairCounts = trades.reduce((acc: Record<string, any>, trade) => {
    const pair = `${trade.token_in_symbol}/${trade.token_out_symbol}`;
    if (!acc[pair]) {
      acc[pair] = { count: 0, volume: 0, profitLoss: 0 };
    }
    acc[pair].count++;
    acc[pair].volume += parseFloat(trade.amount_in || '0');
    acc[pair].profitLoss += parseFloat(trade.profit_loss_usd || '0');
    return acc;
  }, {});
  
  const tradingPairs = Object.entries(pairCounts).map(([pair, data]: [string, any]) => ({
    pair,
    count: data.count,
    volume: Math.round(data.volume * 100) / 100,
    profitLoss: Math.round(data.profitLoss * 100) / 100
  }));

  return {
    totalTrades,
    completedTrades: completedTrades.length,
    failedTrades: failedTrades.length,
    pendingTrades: pendingTrades.length,
    executingTrades: executingTrades.length,
    cancelledTrades: cancelledTrades.length,
    successRate: Math.round(successRate * 100) / 100,
    avgExecutionTime: Math.round(avgExecutionTime),
    totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
    totalGasFees: Math.round(totalGasFees * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    avgSlippage: Math.round(avgSlippage * 100) / 100,
    avgProfitPerTrade: Math.round(avgProfitPerTrade * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    bestTrade: Math.round(bestTrade * 100) / 100,
    worstTrade: Math.round(worstTrade * 100) / 100,
    totalVolume: Math.round(totalVolume * 100) / 100,
    uniqueTokenPairs,
    chainsUsed,
    tradingPairs
  };
}

function groupTradeData(trades: any[], groupBy: string) {
  const groups: Record<string, any[]> = {};
  
  trades.forEach(trade => {
    let key: string;
    
    switch (groupBy) {
      case 'day':
        key = new Date(trade.created_at).toISOString().split('T')[0] || 'unknown';
        break;
      case 'week':
        const date = new Date(trade.created_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0] || 'unknown';
        break;
      case 'month':
        key = new Date(trade.created_at).toISOString().slice(0, 7) || 'unknown';
        break;
      case 'bot':
        key = (Array.isArray(trade.bot_configurations) && trade.bot_configurations[0]?.name) || 'Unknown Bot';
        break;
      case 'chain':
        key = trade.chain || 'unknown';
        break;
      case 'token_pair':
        key = `${trade.token_in_symbol}/${trade.token_out_symbol}`;
        break;
      default:
        key = 'all';
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(trade);
  });
  
  // Calculate summary for each group
  return Object.entries(groups).map(([key, groupTrades]) => ({
    key,
    count: groupTrades.length,
    totalProfit: groupTrades.reduce((sum, t) => sum + parseFloat(t.profit_loss_usd || '0'), 0),
    totalVolume: groupTrades.reduce((sum, t) => sum + parseFloat(t.amount_in || '0'), 0),
    successRate: groupTrades.length > 0 ? 
      (groupTrades.filter(t => t.status === 'completed').length / groupTrades.length) * 100 : 0,
    trades: groupTrades
  }));
}

export async function GET(request: NextRequest) {
  const totalTimer = createTimer('GET Trades Request');
  const requestId = crypto.randomUUID();
  
  try {
    // Rate limiting
    const rateLimitTimer = createTimer('Rate Limiting');
    const rateLimitResult = await rateLimiter.check(request);
    endTimer(rateLimitTimer);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 429 }
      );
    }

    // Authentication
    const authTimer = createTimer('Authentication');
    const authResult = await verifyJWT(request);
    endTimer(authTimer);
    
    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          details: authResult.error,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    const userId = authResult.payload?.sub;
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Invalid token payload',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validationTimer = createTimer('Query Validation');
    const validationResult = TradeQuerySchema.safeParse(queryParams);
    endTimer(validationTimer);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: validationResult.error.errors,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const { 
      botId, 
      status, 
      chain,
      tradeType,
      tokenSymbol,
      minProfitLoss,
      maxProfitLoss,
      minAmount,
      maxAmount,
      limit, 
      offset, 
      sortBy,
      sortOrder,
      startDate, 
      endDate,
      includeMetrics,
      groupBy
    } = validationResult.data;

    // Build optimized query for trades with bot configuration join
    const queryTimer = createTimer('Database Query');
    const supabase = getSupabaseClient();
    let query = supabase
      .from('trade_history')
      .select(`
        id,
        bot_id,
        trade_type,
        status,
        chain,
        token_in_symbol,
        token_out_symbol,
        token_in_address,
        token_out_address,
        amount_in,
        amount_out,
        expected_amount_out,
        max_slippage,
        actual_slippage,
        execution_time_ms,
        tx_hash,
        gas_limit,
        gas_used,
        gas_price,
        profit_loss_usd,
        gas_fee_usd,
        error_message,
        error_code,
        priority,
        tags,
        notes,
        dex,
        block_number,
        created_at,
        executed_at,
        updated_at,
        bot_configurations!inner(user_id, name, type, is_active)
      `)
      .eq('bot_configurations.user_id', userId)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    // Apply enhanced filters
    if (botId) query = query.eq('bot_id', botId);
    if (status) query = query.eq('status', status);
    if (chain) query = query.eq('chain', chain);
    if (tradeType) query = query.eq('trade_type', tradeType);
    if (tokenSymbol) {
      query = query.or(`token_in_symbol.ilike.%${tokenSymbol}%,token_out_symbol.ilike.%${tokenSymbol}%`);
    }
    if (minProfitLoss !== undefined) query = query.gte('profit_loss_usd', minProfitLoss);
    if (maxProfitLoss !== undefined) query = query.lte('profit_loss_usd', maxProfitLoss);
    if (minAmount !== undefined) query = query.gte('amount_in', minAmount);
    if (maxAmount !== undefined) query = query.lte('amount_in', maxAmount);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: trades, error, count } = await query;
    endTimer(queryTimer);

    if (error) {
      console.error(`[${requestId}] Error fetching trades:`, error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch trades',
          details: error.message,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Calculate enhanced metrics if requested
    let metrics: TradeMetrics | null = null;
    if (includeMetrics) {
      const metricsTimer = createTimer('Metrics Calculation');
      metrics = await calculateTradeMetrics(trades || []);
      endTimer(metricsTimer);
    }

    // Group data if requested
    let groupedData = null;
    if (groupBy && trades) {
      const groupTimer = createTimer('Data Grouping');
      groupedData = groupTradeData(trades, groupBy);
      endTimer(groupTimer);
    }

    const totalDuration = endTimer(totalTimer);

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        trades: trades || [],
        pagination: {
          limit,
          offset,
          total: count || trades?.length || 0,
          hasMore: (trades?.length || 0) === limit,
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil((count || trades?.length || 0) / limit)
        },
        metrics,
        groupedData,
        filters: {
          botId,
          status,
          chain,
          tradeType,
          tokenSymbol,
          sortBy,
          sortOrder,
          dateRange: startDate && endDate ? { start: startDate, end: endDate } : null
        },
        metadata: {
          requestDuration: totalDuration,
          dataPoints: trades?.length || 0,
          cacheable: true,
          cacheExpiry: 60, // 1 minute for trades data
          sortedBy: `${sortBy} ${sortOrder}`
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    endTimer(totalTimer);
    console.error(`[${requestId}] Error in GET trades:`, error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const totalTimer = createTimer('POST Trade Creation');
  const requestId = crypto.randomUUID();
  
  try {
    // Rate limiting (stricter for trade creation)
    const rateLimitTimer = createTimer('Rate Limiting');
    const rateLimitResult = await rateLimiter.check(request, 20, 60 * 1000); // 20 per minute
    endTimer(rateLimitTimer);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          requestId,
          timestamp: new Date().toISOString()
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = TradeCreateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid trade data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const tradeData = validationResult.data;

    // Verify bot belongs to user and is active
    const supabase = getSupabaseClient();
    const { data: bot, error: botError } = await supabase
      .from('bot_configurations')
      .select('id, user_id, name, type, is_active, is_paper_trading')
      .eq('id', tradeData.botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { error: 'Bot configuration not found or access denied' },
        { status: 404 }
      );
    }

    if (!bot.is_active) {
      return NextResponse.json(
        { error: 'Bot is not active' },
        { status: 400 }
      );
    }

    // Generate secure trade ID
    const tradeId = `trade_${Date.now()}_${generateSecureRandom(8)}`;

    // Create trade record
    const { data: newTrade, error: createError } = await supabase
      .from('trade_history')
      .insert({
        id: tradeId,
        bot_id: tradeData.botId,
        trade_type: tradeData.tradeType,
        status: 'pending',
        chain: tradeData.chain,
        token_in_symbol: tradeData.tokenInSymbol,
        token_out_symbol: tradeData.tokenOutSymbol,
        token_in_address: tradeData.tokenInAddress,
        token_out_address: tradeData.tokenOutAddress,
        amount_in: tradeData.amountIn,
        expected_amount_out: tradeData.expectedAmountOut,
        max_slippage: tradeData.maxSlippage,
        gas_limit: tradeData.gasLimit,
        gas_price: tradeData.gasPrice,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating trade:', createError);
      return NextResponse.json(
        { error: 'Failed to create trade record' },
        { status: 500 }
      );
    }

    console.log(`Trade created by user ${userId}: ${tradeData.tradeType} - ${tradeData.tokenInSymbol}/${tradeData.tokenOutSymbol}`);

    return NextResponse.json({
      success: true,
      data: newTrade
    });

  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json(
      { error: 'Failed to create trade' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, 50, 60 * 1000); // 50 per minute
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = TradeUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid update data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { tradeId, status, ...updateData } = validationResult.data;

    // Prepare update object
    const tradeUpdate: any = {
      status,
      updated_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (updateData.txHash) tradeUpdate.tx_hash = updateData.txHash;
    if (updateData.amountOut) tradeUpdate.amount_out = updateData.amountOut;
    if (updateData.gasUsed) tradeUpdate.gas_used = updateData.gasUsed;
    if (updateData.gasPrice) tradeUpdate.gas_price = updateData.gasPrice;
    if (updateData.profitLossUsd) tradeUpdate.profit_loss_usd = updateData.profitLossUsd;
    if (updateData.gasFeeUsd) tradeUpdate.gas_fee_usd = updateData.gasFeeUsd;
    if (updateData.errorMessage) tradeUpdate.error_message = updateData.errorMessage;
    if (updateData.executedAt) tradeUpdate.executed_at = updateData.executedAt;

    // If status is completed or failed, set executed_at if not provided
    if ((status === 'completed' || status === 'failed') && !updateData.executedAt) {
      tradeUpdate.executed_at = new Date().toISOString();
    }

    // Update trade (ensure it belongs to the user via bot configuration)
    const supabase = getSupabaseClient();
    const { data: updatedTrade, error: updateError } = await supabase
      .from('trade_history')
      .update(tradeUpdate)
      .eq('id', tradeId)
      .eq('bot_configurations.user_id', userId)
      .select(`
        *,
        bot_configurations!inner(user_id)
      `)
      .single();

    if (updateError) {
      console.error('Error updating trade:', updateError);
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Trade not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update trade' },
        { status: 500 }
      );
    }

    console.log(`Trade updated by user ${userId}: ${tradeId} - ${status}`);

    return NextResponse.json({
      success: true,
      data: updatedTrade
    });

  } catch (error) {
    console.error('Error updating trade:', error);
    return NextResponse.json(
      { error: 'Failed to update trade' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('tradeId');

    if (!tradeId) {
      return NextResponse.json(
        { error: 'Trade ID is required' },
        { status: 400 }
      );
    }

    // Only allow deletion of failed or cancelled trades for data cleanup
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from('trade_history')
      .delete()
      .eq('id', tradeId)
      .eq('bot_configurations.user_id', userId)
      .in('status', ['failed', 'cancelled']);

    if (deleteError) {
      console.error('Error deleting trade:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete trade or trade cannot be deleted' },
        { status: 500 }
      );
    }

    console.log(`Trade deleted by user ${userId}: ${tradeId}`);

    return NextResponse.json({
      success: true,
      message: 'Trade deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting trade:', error);
    return NextResponse.json(
      { error: 'Failed to delete trade' },
      { status: 500 }
    );
  }
} 
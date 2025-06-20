import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyJWT } from '@/lib/auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { generateSecureRandom } from '@trading-bot/crypto';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Validation schemas
const TradeQuerySchema = z.object({
  botId: z.string().uuid().optional(),
  status: z.enum(['pending', 'executing', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default('50'),
  offset: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).optional().default('0'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const TradeCreateSchema = z.object({
  botId: z.string().uuid('Invalid bot ID'),
  tradeType: z.enum(['arbitrage', 'copy', 'sandwich'], { invalid_type_error: 'Invalid trade type' }),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'solana'], { invalid_type_error: 'Invalid chain' }),
  tokenInSymbol: z.string().min(1, 'Token in symbol is required'),
  tokenOutSymbol: z.string().min(1, 'Token out symbol is required'),
  tokenInAddress: z.string().optional(),
  tokenOutAddress: z.string().optional(),
  amountIn: z.string().min(1, 'Amount in is required'),
  expectedAmountOut: z.string().optional(),
  maxSlippage: z.number().min(0.1).max(10, 'Max slippage must be between 0.1% and 10%').optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  deadline: z.string().datetime().optional()
});

const TradeUpdateSchema = z.object({
  tradeId: z.string().uuid('Invalid trade ID'),
  status: z.enum(['pending', 'executing', 'completed', 'failed', 'cancelled']),
  txHash: z.string().optional(),
  amountOut: z.string().optional(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  profitLossUsd: z.string().optional(),
  gasFeeUsd: z.string().optional(),
  errorMessage: z.string().optional(),
  executedAt: z.string().datetime().optional()
});

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

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
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

    const { botId, status, limit, offset, startDate, endDate } = validationResult.data;

    // Build query for trades with bot configuration join to ensure user ownership
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
        tx_hash,
        gas_limit,
        gas_used,
        gas_price,
        profit_loss_usd,
        gas_fee_usd,
        error_message,
        created_at,
        executed_at,
        bot_configurations!inner(user_id, name, type)
      `)
      .eq('bot_configurations.user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (botId) {
      query = query.eq('bot_id', botId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: trades, error, count } = await query;

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trades' },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const totalTrades = trades?.length || 0;
    const completedTrades = trades?.filter(t => t.status === 'completed') || [];
    const failedTrades = trades?.filter(t => t.status === 'failed') || [];
    
    const totalProfitLoss = completedTrades.reduce((sum, trade) => 
      sum + parseFloat(trade.profit_loss_usd || '0'), 0);
    
    const totalGasFees = trades?.reduce((sum, trade) => 
      sum + parseFloat(trade.gas_fee_usd || '0'), 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        trades: trades || [],
        pagination: {
          limit,
          offset,
          total: count || totalTrades,
          hasMore: totalTrades === limit
        },
        summary: {
          totalTrades,
          completedTrades: completedTrades.length,
          failedTrades: failedTrades.length,
          successRate: totalTrades > 0 ? (completedTrades.length / totalTrades * 100) : 0,
          totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
          totalGasFees: Math.round(totalGasFees * 100) / 100,
          netProfit: Math.round((totalProfitLoss - totalGasFees) * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Error in GET trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for trade creation)
    const rateLimitResult = await rateLimiter.check(request, 20, 60 * 1000); // 20 per minute
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
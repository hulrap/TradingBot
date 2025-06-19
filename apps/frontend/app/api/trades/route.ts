import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase';
import { z } from 'zod';

const TradesQuerySchema = z.object({
  botId: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  tradeType: z.enum(['arbitrage', 'copy', 'mev-sandwich']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0)
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = TradesQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const { botId, status, tradeType, startDate, endDate, limit, offset } = validationResult.data;

    // Build query
    let query = supabase
      .from('trades')
      .select(`
        id,
        bot_id,
        trade_type,
        status,
        token_in,
        token_out,
        amount_in,
        amount_out,
        gas_used,
        tx_hash,
        profit_loss,
        created_at,
        bot_configurations!inner(name, bot_type)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (botId) {
      query = query.eq('bot_id', botId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (tradeType) {
      query = query.eq('trade_type', tradeType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: trades, error } = await query;

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('trades')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);

    if (botId) countQuery = countQuery.eq('bot_id', botId);
    if (status) countQuery = countQuery.eq('status', status);
    if (tradeType) countQuery = countQuery.eq('trade_type', tradeType);
    if (startDate) countQuery = countQuery.gte('created_at', startDate);
    if (endDate) countQuery = countQuery.lte('created_at', endDate);

    const { count, error: countError } = await countQuery;

    // Calculate analytics
    const analytics = {
      totalTrades: count || 0,
      successfulTrades: trades?.filter(t => t.status === 'completed').length || 0,
      failedTrades: trades?.filter(t => t.status === 'failed').length || 0,
      totalProfit: trades?.reduce((sum, trade) => {
        const profit = parseFloat(trade.profit_loss || '0');
        return sum + profit;
      }, 0) || 0,
      totalGasCost: trades?.reduce((sum, trade) => {
        const gas = parseFloat(trade.gas_used || '0');
        return sum + gas;
      }, 0) || 0,
      successRate: 0,
      averageProfitPerTrade: 0,
      netProfit: 0
    };

    analytics.successRate = analytics.totalTrades > 0 
      ? (analytics.successfulTrades / analytics.totalTrades) * 100 
      : 0;

    analytics.averageProfitPerTrade = analytics.totalTrades > 0 
      ? analytics.totalProfit / analytics.totalTrades 
      : 0;

    analytics.netProfit = analytics.totalProfit - analytics.totalGasCost;

    const response = {
      trades: trades || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      analytics
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in GET /api/trades:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
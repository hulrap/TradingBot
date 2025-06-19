import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botId = params.id;

    // Get bot configuration
    const { data: bot, error: botError } = await supabase
      .from('bot_configurations')
      .select('*')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Get recent performance metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Get recent trades
    const { data: recentTrades, error: tradesError } = await supabase
      .from('trades')
      .select(`
        id,
        trade_type,
        status,
        token_in,
        token_out,
        amount_in,
        amount_out,
        profit_loss,
        created_at
      `)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get trade statistics
    const { data: tradeStats, error: statsError } = await supabase
      .from('trades')
      .select('status, profit_loss')
      .eq('bot_id', botId);

    // Calculate performance statistics
    const totalTrades = tradeStats?.length || 0;
    const successfulTrades = tradeStats?.filter(t => t.status === 'completed').length || 0;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
    
    const totalProfit = tradeStats?.reduce((sum, trade) => {
      const profit = parseFloat(trade.profit_loss || '0');
      return sum + profit;
    }, 0) || 0;

    const averageProfitPerTrade = totalTrades > 0 ? totalProfit / totalTrades : 0;

    // Get current status (this would typically come from your bot service)
    const currentStatus = {
      isRunning: bot.is_active,
      uptime: bot.is_active ? Date.now() - new Date(bot.updated_at).getTime() : 0,
      lastActivity: bot.updated_at,
      connectionStatus: 'connected', // This would be real-time data from bot service
      errorCount: 0, // This would be real-time data from bot service
      memoryUsage: '45MB', // This would be real-time data from bot service
      cpuUsage: '12%' // This would be real-time data from bot service
    };

    const response = {
      bot: {
        id: bot.id,
        name: bot.name,
        type: bot.bot_type,
        isPaperTrading: bot.is_paper_trading,
        isActive: bot.is_active,
        configuration: bot.configuration
      },
      status: currentStatus,
      performance: {
        totalTrades,
        successfulTrades,
        successRate: parseFloat(successRate.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(6)),
        averageProfitPerTrade: parseFloat(averageProfitPerTrade.toFixed(6)),
        metrics: metrics?.[0] || null
      },
      recentTrades: recentTrades || []
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in GET /api/bots/[id]/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
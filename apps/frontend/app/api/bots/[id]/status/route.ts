import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BotStatusParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: BotStatusParams) {
  try {
    // Rate limiting (more lenient for status checks)
    const rateLimitResult = await rateLimiter.checkLimit(request, 'status');
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
    const botId = params.id;

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Get bot configuration and current status
    const { data: bot, error: fetchError } = await supabase
      .from('bot_configurations')
      .select(`
        id,
        name,
        type,
        chain,
        status,
        configuration,
        wallet_id,
        is_active,
        is_paper_trading,
        created_at,
        updated_at,
        wallets!inner(
          id,
          name,
          address,
          chain
        )
      `)
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !bot) {
      return NextResponse.json(
        { error: 'Bot not found or not owned by user' },
        { status: 404 }
      );
    }

    // Get current performance metrics
    const { data: performanceMetrics } = await supabase
      .from('bot_performance_metrics')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(1);

    const metrics = performanceMetrics?.[0] || {
      total_trades: 0,
      successful_trades: 0,
      failed_trades: 0,
      total_profit: '0',
      total_fees: '0',
      win_rate: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      average_trade_size: '0',
      average_profit_per_trade: '0'
    };

    // Get recent activity logs
    const { data: recentLogs } = await supabase
      .from('bot_activity_logs')
      .select('activity_type, details, created_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent trades (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTrades } = await supabase
      .from('trade_history')
      .select(`
        id,
        trade_type,
        token_in_symbol,
        token_out_symbol,
        amount_in,
        amount_out,
        profit_loss,
        gas_fee,
        status,
        executed_at
      `)
      .eq('bot_id', botId)
      .gte('executed_at', twentyFourHoursAgo)
      .order('executed_at', { ascending: false })
      .limit(50);

    // Calculate real-time statistics
    const now = new Date();
    const sessionStart = new Date(bot.configuration?.lastStartedAt || bot.updated_at);
    const sessionDuration = bot.is_active ? now.getTime() - sessionStart.getTime() : 0;

    // Get bot health status from service (if available)
    let botHealthStatus = null;
    try {
      botHealthStatus = await getBotHealthStatus(botId, bot.type);
    } catch (error) {
      console.warn('Failed to get bot health status:', error);
      botHealthStatus = {
        healthy: bot.is_active,
        lastHeartbeat: null,
        errors: bot.is_active ? ['Health service unavailable'] : [],
        warnings: []
      };
    }

    // Calculate performance trends (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [currentPeriodTrades, previousPeriodTrades] = await Promise.all([
      supabase
        .from('trade_history')
        .select('profit_loss, status')
        .eq('bot_id', botId)
        .gte('executed_at', sevenDaysAgo),
      supabase
        .from('trade_history')
        .select('profit_loss, status')
        .eq('bot_id', botId)
        .gte('executed_at', fourteenDaysAgo)
        .lt('executed_at', sevenDaysAgo)
    ]);

    const currentPeriodStats = calculatePeriodStats(currentPeriodTrades.data || []);
    const previousPeriodStats = calculatePeriodStats(previousPeriodTrades.data || []);

    const trends = {
      profitTrend: calculateTrend(currentPeriodStats.totalProfit, previousPeriodStats.totalProfit),
      tradeTrend: calculateTrend(currentPeriodStats.totalTrades, previousPeriodStats.totalTrades),
      winRateTrend: calculateTrend(currentPeriodStats.winRate, previousPeriodStats.winRate)
    };

    // Prepare response
    const statusResponse = {
      bot: {
        id: bot.id,
        name: bot.name,
        type: bot.type,
        chain: bot.chain,
        status: bot.status,
        isActive: bot.is_active,
        isPaperTrading: bot.is_paper_trading,
        wallet: {
          id: bot.wallets.id,
          name: bot.wallets.name,
          address: bot.wallets.address,
          chain: bot.wallets.chain
        },
        configuration: bot.configuration,
        createdAt: bot.created_at,
        updatedAt: bot.updated_at
      },
      performance: {
        current: metrics,
        session: {
          startTime: sessionStart.toISOString(),
          duration: sessionDuration,
          isActive: bot.is_active
        },
        trends,
        recentTrades: recentTrades || []
      },
      health: botHealthStatus,
      activity: {
        recentLogs: recentLogs || [],
        lastActivity: recentLogs?.[0]?.created_at || bot.updated_at
      },
      statistics: {
        last24h: {
          trades: recentTrades?.length || 0,
          profit: recentTrades?.reduce((sum, trade) => sum + parseFloat(trade.profit_loss || '0'), 0) || 0,
          successRate: recentTrades?.length ? 
            (recentTrades.filter(t => t.status === 'completed').length / recentTrades.length) * 100 : 0
        },
        currentPeriod: currentPeriodStats,
        previousPeriod: previousPeriodStats
      }
    };

    return NextResponse.json({
      success: true,
      data: statusResponse,
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

function calculatePeriodStats(trades: any[]) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      totalProfit: 0,
      winRate: 0
    };
  }

  const successfulTrades = trades.filter(t => t.status === 'completed').length;
  const totalProfit = trades.reduce((sum, trade) => sum + parseFloat(trade.profit_loss || '0'), 0);
  const winRate = (successfulTrades / trades.length) * 100;

  return {
    totalTrades: trades.length,
    successfulTrades,
    totalProfit,
    winRate
  };
}

function calculateTrend(current: number, previous: number): { 
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  value: number;
} {
  if (previous === 0) {
    return {
      direction: current > 0 ? 'up' : current < 0 ? 'down' : 'stable',
      percentage: 0,
      value: current
    };
  }

  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';

  return {
    direction,
    percentage: Math.abs(percentage),
    value: current - previous
  };
}

async function getBotHealthStatus(botId: string, botType: string): Promise<{
  healthy: boolean;
  lastHeartbeat: string | null;
  errors: string[];
  warnings: string[];
  metrics?: any;
}> {
  // This would connect to your bot service to get real-time health status
  // Implementation depends on your bot architecture
  
  // For now, we'll simulate health status
  const isHealthy = Math.random() > 0.1; // 90% healthy
  const hasWarnings = Math.random() > 0.7; // 30% chance of warnings
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!isHealthy) {
    errors.push('Connection to DEX API unstable');
    if (Math.random() > 0.5) {
      errors.push('High memory usage detected');
    }
  }
  
  if (hasWarnings) {
    warnings.push('Gas prices are elevated');
    if (Math.random() > 0.6) {
      warnings.push('Low liquidity detected on target pairs');
    }
  }

  return {
    healthy: isHealthy,
    lastHeartbeat: new Date().toISOString(),
    errors,
    warnings,
    metrics: {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      networkLatency: Math.random() * 200 + 10,
      activeConnections: Math.floor(Math.random() * 10) + 1
    }
  };

  // Real implementation might look like:
  /*
  try {
    const response = await fetch(`${process.env.BOT_SERVICE_URL}/bots/${botId}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.BOT_SERVICE_TOKEN}`
      },
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get bot health: ${error.message}`);
  }
  */
}
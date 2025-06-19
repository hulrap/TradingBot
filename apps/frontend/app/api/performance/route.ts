import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase';
import { z } from 'zod';

const PerformanceQuerySchema = z.object({
  botId: z.string().optional(),
  timeframe: z.enum(['1h', '24h', '7d', '30d', '90d', 'all']).default('24h'),
  granularity: z.enum(['minute', 'hour', 'day']).default('hour')
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
    const validationResult = PerformanceQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const { botId, timeframe, granularity } = validationResult.data;

    // Calculate time range
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date('2020-01-01'); // All time
    }

    // Build base query for performance metrics
    let metricsQuery = supabase
      .from('performance_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (botId) {
      metricsQuery = metricsQuery.eq('bot_id', botId);
    }

    const { data: metrics, error: metricsError } = await metricsQuery;

    // Get trade data for the same period
    let tradesQuery = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (botId) {
      tradesQuery = tradesQuery.eq('bot_id', botId);
    }

    const { data: trades, error: tradesError } = await tradesQuery;

    if (metricsError || tradesError) {
      console.error('Error fetching performance data:', metricsError || tradesError);
      return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
    }

    // Calculate aggregated metrics
    const totalTrades = trades?.length || 0;
    const successfulTrades = trades?.filter(t => t.status === 'completed').length || 0;
    const failedTrades = trades?.filter(t => t.status === 'failed').length || 0;
    
    const totalProfit = trades?.reduce((sum, trade) => {
      const profit = parseFloat(trade.profit_loss || '0');
      return sum + profit;
    }, 0) || 0;

    const totalGasCost = trades?.reduce((sum, trade) => {
      const gas = parseFloat(trade.gas_used || '0');
      return sum + gas;
    }, 0) || 0;

    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
    const averageProfitPerTrade = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const netProfit = totalProfit - totalGasCost;

    // Group trades by time intervals for chart data
    const timeSeriesData = groupTradesByTime(trades || [], granularity);

    // Calculate portfolio performance over time
    const portfolioTimeSeries = calculatePortfolioTimeSeries(trades || []);

    // Get bot-specific performance if botId is provided
    let botPerformance = null;
    if (botId) {
      const { data: botConfig } = await supabase
        .from('bot_configurations')
        .select('name, bot_type, created_at')
        .eq('id', botId)
        .eq('user_id', user.id)
        .single();

      if (botConfig) {
        botPerformance = {
          botId,
          name: botConfig.name,
          type: botConfig.bot_type,
          createdAt: botConfig.created_at,
          totalTrades,
          successfulTrades,
          successRate,
          totalProfit,
          netProfit
        };
      }
    }

    // Calculate risk metrics
    const riskMetrics = calculateRiskMetrics(trades || []);

    const response = {
      timeframe,
      period: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalTrades,
        successfulTrades,
        failedTrades,
        successRate: parseFloat(successRate.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(6)),
        totalGasCost: parseFloat(totalGasCost.toFixed(6)),
        netProfit: parseFloat(netProfit.toFixed(6)),
        averageProfitPerTrade: parseFloat(averageProfitPerTrade.toFixed(6))
      },
      timeSeries: timeSeriesData,
      portfolioTimeSeries,
      riskMetrics,
      botPerformance,
      rawMetrics: metrics || []
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in GET /api/performance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function groupTradesByTime(trades: any[], granularity: string) {
  const grouped: { [key: string]: any } = {};
  
  trades.forEach(trade => {
    const date = new Date(trade.created_at);
    let key: string;
    
    switch (granularity) {
      case 'minute':
        key = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
        break;
      case 'hour':
        key = date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
        break;
      case 'day':
        key = date.toISOString().substring(0, 10); // YYYY-MM-DD
        break;
      default:
        key = date.toISOString().substring(0, 13);
    }
    
    if (!grouped[key]) {
      grouped[key] = {
        timestamp: key,
        trades: 0,
        successful: 0,
        failed: 0,
        profit: 0,
        gasCost: 0
      };
    }
    
    grouped[key].trades++;
    if (trade.status === 'completed') grouped[key].successful++;
    if (trade.status === 'failed') grouped[key].failed++;
    grouped[key].profit += parseFloat(trade.profit_loss || '0');
    grouped[key].gasCost += parseFloat(trade.gas_used || '0');
  });
  
  return Object.values(grouped).sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
}

function calculatePortfolioTimeSeries(trades: any[]) {
  let cumulativeProfit = 0;
  const portfolio: Array<{
    timestamp: string;
    cumulativeProfit: number;
    tradeProfit: number;
  }> = [];
  
  trades.forEach(trade => {
    if (trade.status === 'completed') {
      cumulativeProfit += parseFloat(trade.profit_loss || '0');
      portfolio.push({
        timestamp: trade.created_at,
        cumulativeProfit: parseFloat(cumulativeProfit.toFixed(6)),
        tradeProfit: parseFloat(trade.profit_loss || '0')
      });
    }
  });
  
  return portfolio;
}

function calculateRiskMetrics(trades: any[]) {
  const completedTrades = trades.filter(t => t.status === 'completed');
  const profits = completedTrades.map(t => parseFloat(t.profit_loss || '0'));
  
  if (profits.length === 0) {
    return {
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0
    };
  }
  
  const wins = profits.filter(p => p > 0);
  const losses = profits.filter(p => p < 0);
  
  const averageProfit = profits.reduce((sum, p) => sum + p, 0) / profits.length;
  const variance = profits.reduce((sum, p) => sum + Math.pow(p - averageProfit, 2), 0) / profits.length;
  const volatility = Math.sqrt(variance);
  
  const winRate = (wins.length / profits.length) * 100;
  const averageWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
  const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, l) => sum + l, 0) / losses.length) : 0;
  
  const totalWins = wins.reduce((sum, w) => sum + w, 0);
  const totalLosses = Math.abs(losses.reduce((sum, l) => sum + l, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  
  // Simple Sharpe ratio calculation (assuming 0% risk-free rate)
  const sharpeRatio = volatility > 0 ? averageProfit / volatility : 0;
  
  // Calculate max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumulativeProfit = 0;
  
  for (const profit of profits) {
    cumulativeProfit += profit;
    if (cumulativeProfit > peak) {
      peak = cumulativeProfit;
    }
    const drawdown = peak - cumulativeProfit;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return {
    sharpeRatio: parseFloat(sharpeRatio.toFixed(4)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(6)),
    volatility: parseFloat(volatility.toFixed(6)),
    winRate: parseFloat(winRate.toFixed(2)),
    averageWin: parseFloat(averageWin.toFixed(6)),
    averageLoss: parseFloat(averageLoss.toFixed(6)),
    profitFactor: parseFloat(profitFactor.toFixed(4))
  };
}
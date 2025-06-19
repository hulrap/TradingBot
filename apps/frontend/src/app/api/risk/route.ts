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

const RiskActionSchema = z.object({
  action: z.enum(['get_status', 'trigger_kill_switch', 'reset_kill_switch', 'update_limits', 'acknowledge_alert']),
  data: z.any().optional()
});

const UpdateLimitsSchema = z.object({
  maxDailyLoss: z.number().positive().optional(),
  maxDrawdown: z.number().min(0).max(100).optional(),
  maxConsecutiveFailures: z.number().positive().optional(),
  maxPortfolioRisk: z.number().min(5).max(50).optional(),
  maxSectorConcentration: z.number().min(5).max(100).optional(),
  maxCorrelation: z.number().min(0).max(1).optional()
});

const TriggerKillSwitchSchema = z.object({
  reason: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('high')
});

const ResetKillSwitchSchema = z.object({
  reason: z.string().min(1),
  resetBy: z.string().min(1)
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

    const userId = authResult.payload?.sub;

    // Get current risk status
    const riskStatus = await getCurrentRiskStatus(userId!);

    return NextResponse.json({
      success: true,
      data: riskStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Risk API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for actions)
    const rateLimitResult = await rateLimiter.checkLimit(request, 'action');
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

    const userId = authResult.payload?.sub;
    const body = await request.json();

    // Validate request
    const validationResult = RiskActionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request',
          details: (validationResult as any).error?.errors || []
        },
        { status: 400 }
      );
    }

    const { action, data } = validationResult.data;

    // Handle different risk actions
    switch (action) {
      case 'get_status':
        const status = await getCurrentRiskStatus(userId!);
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'trigger_kill_switch':
        const triggerResult = await triggerKillSwitch(userId!, data);
        return NextResponse.json(triggerResult);

      case 'reset_kill_switch':
        const resetResult = await resetKillSwitch(userId!, data);
        return NextResponse.json(resetResult);

      case 'update_limits':
        const updateResult = await updateRiskLimits(userId!, data);
        return NextResponse.json(updateResult);

      case 'acknowledge_alert':
        const ackResult = await acknowledgeAlert(userId!, data);
        return NextResponse.json(ackResult);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Risk API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getCurrentRiskStatus(userId: string) {
  try {
    // Get user's active bots
    const supabase = getSupabaseClient();
    const { data: bots, error: botsError } = await supabase
      .from('bot_configurations')
      .select(`
        id,
        name,
        type,
        status,
        is_active,
        is_paper_trading,
        configuration
      `)
      .eq('user_id', userId);

    if (botsError) {
      console.error('Error fetching bots:', botsError);
      throw new Error('Failed to fetch bot data');
    }

    // Get recent trades for risk analysis
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTrades, error: tradesError } = await supabase
      .from('trade_history')
      .select(`
        profit_loss_usd,
        gas_fee_usd,
        status,
        executed_at,
        bot_configurations!inner(user_id)
      `)
      .eq('bot_configurations.user_id', userId)
      .gte('executed_at', twentyFourHoursAgo);

    if (tradesError) {
      console.error('Error fetching trades:', tradesError);
    }

    // Get user's risk configuration
    const { data: riskConfig, error: configError } = await supabase
      .from('user_risk_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (configError && configError.code !== 'PGRST116') { // Not found is okay
      console.error('Error fetching risk config:', configError);
    }

    // Calculate portfolio risk metrics
    const portfolioMetrics = calculatePortfolioRisk(recentTrades || [], riskConfig);

    // Get active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('risk_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
    }

    // Determine kill switch status
    const killSwitchStatus = await getKillSwitchStatus(userId, portfolioMetrics);

    // Get recommendations
    const recommendations = generateRiskRecommendations(portfolioMetrics, bots || [], alerts || []);

    return {
      portfolioRisk: portfolioMetrics,
      killSwitch: killSwitchStatus,
      activeBots: {
        total: bots?.length || 0,
        active: bots?.filter(b => b.is_active).length || 0,
        paperTrading: bots?.filter(b => b.is_paper_trading).length || 0
      },
      alerts: alerts || [],
      recommendations,
      configuration: riskConfig || getDefaultRiskConfig(),
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error getting risk status:', error);
    throw error;
  }
}

async function triggerKillSwitch(userId: string, data: any) {
  try {
    // Validate trigger data
    const validation = TriggerKillSwitchSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid trigger data',
        details: (validation as any).error?.errors || []
      };
    }

    const { reason, severity } = validation.data;
    const supabase = getSupabaseClient();

    // Stop all active bots
    const { data: activeBots, error: botsError } = await supabase
      .from('bot_configurations')
      .select('id, name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (botsError) {
      console.error('Error fetching active bots:', botsError);
      return {
        success: false,
        error: 'Failed to fetch active bots'
      };
    }

    // Update all active bots to stopped
    if (activeBots && activeBots.length > 0) {
      const { error: stopError } = await supabase
        .from('bot_configurations')
        .update({
          is_active: false,
          status: 'stopped',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (stopError) {
        console.error('Error stopping bots:', stopError);
        return {
          success: false,
          error: 'Failed to stop bots'
        };
      }
    }

    // Log kill switch event
    const { error: logError } = await supabase
      .from('kill_switch_events')
      .insert({
        user_id: userId,
        event_type: 'triggered',
        reason,
        severity,
        affected_bots: activeBots?.map(b => b.id) || [],
        metadata: {
          timestamp: new Date().toISOString(),
          triggeredBy: 'user'
        }
      });

    if (logError) {
      console.error('Error logging kill switch event:', logError);
    }

    // Create alert
    await supabase
      .from('risk_alerts')
      .insert({
        user_id: userId,
        alert_type: 'kill_switch',
        severity: 'critical',
        message: `Kill switch triggered: ${reason}`,
        metadata: {
          stoppedBots: activeBots?.length || 0,
          severity
        }
      });

    return {
      success: true,
      message: 'Kill switch triggered successfully',
      data: {
        reason,
        severity,
        botsStoppedCount: activeBots?.length || 0,
        stoppedBots: activeBots || []
      }
    };

  } catch (error) {
    console.error('Error triggering kill switch:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

async function resetKillSwitch(userId: string, data: any) {
  try {
    // Validate reset data
    const validation = ResetKillSwitchSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid reset data',
        details: (validation as any).error?.errors || []
      };
    }

    const { reason, resetBy } = validation.data;
    const supabase = getSupabaseClient();

    // Log reset event
    const { error: logError } = await supabase
      .from('kill_switch_events')
      .insert({
        user_id: userId,
        event_type: 'reset',
        reason: `Reset: ${reason}`,
        severity: 'low',
        metadata: {
          resetBy,
          timestamp: new Date().toISOString()
        }
      });

    if (logError) {
      console.error('Error logging reset event:', logError);
    }

    // Clear critical alerts
    await supabase
      .from('risk_alerts')
      .update({ acknowledged: true })
      .eq('user_id', userId)
      .eq('alert_type', 'kill_switch');

    return {
      success: true,
      message: 'Kill switch reset successfully',
      data: {
        reason,
        resetBy,
        resetAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Error resetting kill switch:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

async function updateRiskLimits(userId: string, data: any) {
  try {
    // Validate limits data
    const validation = UpdateLimitsSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid limits data',
        details: (validation as any).error?.errors || []
      };
    }

    const limits = validation.data;
    const supabase = getSupabaseClient();

    // Update or create risk configuration
    const { data: updatedConfig, error: updateError } = await supabase
      .from('user_risk_settings')
      .upsert({
        user_id: userId,
        max_daily_loss: limits.maxDailyLoss,
        max_drawdown: limits.maxDrawdown,
        max_consecutive_failures: limits.maxConsecutiveFailures,
        max_portfolio_risk: limits.maxPortfolioRisk,
        max_sector_concentration: limits.maxSectorConcentration,
        max_correlation: limits.maxCorrelation,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (updateError) {
      console.error('Error updating risk limits:', updateError);
      return {
        success: false,
        error: 'Failed to update risk limits'
      };
    }

    return {
      success: true,
      message: 'Risk limits updated successfully',
      data: updatedConfig
    };

  } catch (error) {
    console.error('Error updating risk limits:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

async function acknowledgeAlert(userId: string, data: any) {
  try {
    const { alertId } = data;

    if (!alertId) {
      return {
        success: false,
        error: 'Alert ID is required'
      };
    }

    const supabase = getSupabaseClient();

    // Acknowledge the alert
    const { error: ackError } = await supabase
      .from('risk_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    if (ackError) {
      console.error('Error acknowledging alert:', ackError);
      return {
        success: false,
        error: 'Failed to acknowledge alert'
      };
    }

    return {
      success: true,
      message: 'Alert acknowledged successfully'
    };

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

function calculatePortfolioRisk(trades: any[], riskConfig: any) {
  const completedTrades = trades.filter(t => t.status === 'completed');
  const failedTrades = trades.filter(t => t.status === 'failed');

  const totalPnL = completedTrades.reduce((sum, trade) => 
    sum + parseFloat(trade.profit_loss_usd || '0'), 0);

  const totalFees = trades.reduce((sum, trade) => 
    sum + parseFloat(trade.gas_fee_usd || '0'), 0);

  const netProfit = totalPnL - totalFees;

  // Calculate daily risk metrics
  const winRate = completedTrades.length > 0 ? 
    (completedTrades.filter(t => parseFloat(t.profit_loss_usd || '0') > 0).length / completedTrades.length) * 100 : 0;

  // Calculate failure rate and failed trade costs
  const failureRate = trades.length > 0 ? (failedTrades.length / trades.length) * 100 : 0;
  
  // Calculate costs from failed trades (gas fees lost)
  const failedTradeCosts = failedTrades.reduce((sum, trade) => 
    sum + parseFloat(trade.gas_fee_usd || '0'), 0);
  
  // Calculate average failed trade cost
  const avgFailedTradeCost = failedTrades.length > 0 ? failedTradeCosts / failedTrades.length : 0;
  
  // Calculate failure impact on total portfolio
  const failureImpact = Math.abs(totalPnL) > 0 ? (failedTradeCosts / Math.abs(totalPnL)) * 100 : 0;

  // Enhanced risk calculations including failed trades
  const netProfitWithFailureCosts = netProfit - failedTradeCosts;
  const dailyLoss = Math.abs(Math.min(0, netProfitWithFailureCosts));
  const consecutiveFailures = calculateConsecutiveFailures(trades);

  const config = riskConfig || getDefaultRiskConfig();

  return {
    dailyPnL: Math.round(netProfit * 100) / 100,
    dailyPnLAdjusted: Math.round(netProfitWithFailureCosts * 100) / 100,
    dailyLoss: Math.round(dailyLoss * 100) / 100,
    totalTrades: trades.length,
    completedTrades: completedTrades.length,
    failedTrades: failedTrades.length,
    winRate: Math.round(winRate * 100) / 100,
    failureRate: Math.round(failureRate * 100) / 100,
    failedTradeCosts: Math.round(failedTradeCosts * 100) / 100,
    avgFailedTradeCost: Math.round(avgFailedTradeCost * 100) / 100,
    failureImpact: Math.round(failureImpact * 100) / 100,
    consecutiveFailures,
    riskLimits: {
      maxDailyLoss: config.max_daily_loss || 1000,
      maxDrawdown: config.max_drawdown || 15,
      maxConsecutiveFailures: config.max_consecutive_failures || 5,
      maxFailureRate: config.max_failure_rate || 30 // 30% max failure rate
    },
    riskUtilization: {
      dailyLoss: dailyLoss / (config.max_daily_loss || 1000),
      consecutiveFailures: consecutiveFailures / (config.max_consecutive_failures || 5),
      failureRate: failureRate / (config.max_failure_rate || 30)
    }
  };
}

function calculateConsecutiveFailures(trades: any[]): number {
  let consecutiveFailures = 0;
  const sortedTrades = trades.sort((a, b) => 
    new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
  );

  for (const trade of sortedTrades) {
    if (trade.status === 'failed') {
      consecutiveFailures++;
    } else if (trade.status === 'completed') {
      break;
    }
  }

  return consecutiveFailures;
}

async function getKillSwitchStatus(userId: string, portfolioMetrics: any) {
  const supabase = getSupabaseClient();
  
  // Get last kill switch event
  const { data: lastEvent } = await supabase
    .from('kill_switch_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const isTriggered = lastEvent?.[0]?.event_type === 'triggered';
  const lastTriggered = isTriggered ? lastEvent[0].created_at : null;

  // Check if auto-trigger conditions are met
  const autoTriggerRisk = checkAutoTriggerConditions(portfolioMetrics);

  return {
    isActive: true,
    isTriggered,
    lastTriggered,
    autoTriggerRisk,
    status: isTriggered ? 'triggered' : autoTriggerRisk.shouldTrigger ? 'warning' : 'normal'
  };
}

function checkAutoTriggerConditions(metrics: any) {
  const risks = [];
  let shouldTrigger = false;

  // Check daily loss limit
  if (metrics.dailyLoss >= metrics.riskLimits.maxDailyLoss) {
    risks.push({
      type: 'daily_loss',
      current: metrics.dailyLoss,
      limit: metrics.riskLimits.maxDailyLoss,
      severity: 'high'
    });
    shouldTrigger = true;
  }

  // Check consecutive failures
  if (metrics.consecutiveFailures >= metrics.riskLimits.maxConsecutiveFailures) {
    risks.push({
      type: 'consecutive_failures',
      current: metrics.consecutiveFailures,
      limit: metrics.riskLimits.maxConsecutiveFailures,
      severity: 'medium'
    });
    shouldTrigger = true;
  }

  // Check failure rate
  if (metrics.failureRate >= (metrics.riskLimits.maxFailureRate || 30)) {
    risks.push({
      type: 'high_failure_rate',
      current: metrics.failureRate,
      limit: metrics.riskLimits.maxFailureRate || 30,
      severity: 'medium'
    });
    shouldTrigger = true;
  }

  return {
    shouldTrigger,
    risks
  };
}

function generateRiskRecommendations(portfolioMetrics: any, bots: any[], alerts: any[]) {
  const recommendations = [];

  // High daily loss
  if (portfolioMetrics.riskUtilization.dailyLoss > 0.8) {
    recommendations.push({
      type: 'reduce_risk',
      priority: 'high',
      title: 'Reduce Daily Risk Exposure',
      description: 'Daily losses are approaching the limit. Consider reducing position sizes or stopping some bots.',
      action: 'Consider stopping non-essential bots or reducing trade sizes'
    });
  }

  // Too many consecutive failures
  if (portfolioMetrics.consecutiveFailures > 3) {
    recommendations.push({
      type: 'review_strategy',
      priority: 'medium',
      title: 'Review Trading Strategy',
      description: 'Multiple consecutive failures detected. Strategy may need adjustment.',
      action: 'Review bot configurations and market conditions'
    });
  }

  // High failure rate
  if (portfolioMetrics.failureRate > 25) {
    recommendations.push({
      type: 'high_failure_rate',
      priority: 'high',
      title: 'High Trade Failure Rate',
      description: `${portfolioMetrics.failureRate.toFixed(1)}% of trades are failing. This may indicate strategy or market issues.`,
      action: 'Review trade execution parameters and market conditions'
    });
  }

  // Significant costs from failed trades
  if (portfolioMetrics.failureImpact > 10) {
    recommendations.push({
      type: 'failure_costs',
      priority: 'medium',
      title: 'High Failed Trade Costs',
      description: `Failed trades are costing ${portfolioMetrics.failureImpact.toFixed(1)}% of total trading profit in gas fees.`,
      action: 'Optimize gas fee settings and trade execution timing'
    });
  }

  // Too many active bots
  const activeBots = bots.filter(b => b.is_active);
  if (activeBots.length > 5) {
    recommendations.push({
      type: 'reduce_exposure',
      priority: 'medium',
      title: 'Reduce Active Bots',
      description: 'Multiple active bots increase complexity and risk.',
      action: 'Consider focusing on best-performing bots'
    });
  }

  // Unacknowledged critical alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
  if (criticalAlerts.length > 0) {
    recommendations.push({
      type: 'address_alerts',
      priority: 'critical',
      title: 'Address Critical Alerts',
      description: `${criticalAlerts.length} critical alerts require immediate attention.`,
      action: 'Review and acknowledge critical risk alerts'
    });
  }

  return recommendations;
}

function getDefaultRiskConfig() {
  return {
    max_daily_loss: 1000,
    max_drawdown: 15,
    max_consecutive_failures: 5,
    max_failure_rate: 30, // 30% maximum failure rate
    max_portfolio_risk: 20,
    max_sector_concentration: 25,
    max_correlation: 0.8
  };
}
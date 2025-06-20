import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

/**
 * Risk Management API Configuration
 * Centralized configuration for risk calculations and system parameters
 */
const RISK_CONFIG = {
  // Default risk limits (configurable via environment)
  DEFAULT_MAX_DAILY_LOSS: parseFloat(process.env['RISK_DEFAULT_MAX_DAILY_LOSS'] || '1000'),
  DEFAULT_MAX_DRAWDOWN: parseFloat(process.env['RISK_DEFAULT_MAX_DRAWDOWN'] || '15'),
  DEFAULT_MAX_CONSECUTIVE_FAILURES: parseInt(process.env['RISK_DEFAULT_MAX_CONSECUTIVE_FAILURES'] || '5'),
  DEFAULT_MAX_FAILURE_RATE: parseFloat(process.env['RISK_DEFAULT_MAX_FAILURE_RATE'] || '30'),
  DEFAULT_MAX_PORTFOLIO_RISK: parseFloat(process.env['RISK_DEFAULT_MAX_PORTFOLIO_RISK'] || '20'),
  DEFAULT_MAX_SECTOR_CONCENTRATION: parseFloat(process.env['RISK_DEFAULT_MAX_SECTOR_CONCENTRATION'] || '25'),
  DEFAULT_MAX_CORRELATION: parseFloat(process.env['RISK_DEFAULT_MAX_CORRELATION'] || '0.8'),
  
  // Auto-trigger thresholds
  AUTO_TRIGGER_DAILY_LOSS_THRESHOLD: parseFloat(process.env['RISK_AUTO_TRIGGER_DAILY_LOSS'] || '0.9'), // 90% of limit
  AUTO_TRIGGER_FAILURE_RATE_THRESHOLD: parseFloat(process.env['RISK_AUTO_TRIGGER_FAILURE_RATE'] || '0.8'), // 80% of limit
  
  // Caching configuration
  CACHE_TTL_SECONDS: parseInt(process.env['RISK_CACHE_TTL'] || '60'), // 1 minute for risk data
  
  // Rate limiting
  RATE_LIMIT_GET_REQUESTS: parseInt(process.env['RISK_RATE_LIMIT_GET'] || '60'),
  RATE_LIMIT_ACTION_REQUESTS: parseInt(process.env['RISK_RATE_LIMIT_ACTIONS'] || '20'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env['RISK_RATE_LIMIT_WINDOW'] || '3600000'), // 1 hour
  
  // Risk calculation windows
  RISK_ANALYSIS_WINDOW_HOURS: parseInt(process.env['RISK_ANALYSIS_WINDOW_HOURS'] || '24'),
  
  // Alert retention
  MAX_ALERTS_RETURNED: parseInt(process.env['RISK_MAX_ALERTS_RETURNED'] || '50'),
} as const;

/**
 * Simple in-memory cache for risk calculations
 * In production, this should be replaced with Redis
 */
class RiskCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttlSeconds: number = RISK_CONFIG.CACHE_TTL_SECONDS): void {
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
  
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

const riskCache = new RiskCache();

/**
 * Enhanced error types for better risk management error handling
 */
class RiskAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public errorCode: string = 'RISK_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'RiskAPIError';
  }
}

/**
 * Enhanced logging for risk management operations
 */
function logRiskOperation(
  operation: string,
  userId: string,
  details: any,
  duration?: number,
  error?: Error
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    operation,
    userId,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      stack: error.stack?.split('\n')[0]
    } : undefined,
    cacheStats: riskCache.getStats()
  };
  
  if (error) {
    console.error('[RISK_API_ERROR]', logData);
  } else {
    console.log('[RISK_API_SUCCESS]', logData);
  }
}

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new RiskAPIError(
      'Supabase configuration is missing',
      500,
      'CONFIG_ERROR',
      { missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] }
    );
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Enhanced validation schemas with better error messages
 */
const RiskActionSchema = z.object({
  action: z.enum(['get_status', 'trigger_kill_switch', 'reset_kill_switch', 'update_limits', 'acknowledge_alert'], {
    errorMap: () => ({ message: 'Action must be one of: get_status, trigger_kill_switch, reset_kill_switch, update_limits, acknowledge_alert' })
  }),
  data: z.any().optional()
});

const UpdateLimitsSchema = z.object({
  maxDailyLoss: z.number().positive('Daily loss limit must be positive').optional(),
  maxDrawdown: z.number().min(0, 'Drawdown must be 0 or greater').max(100, 'Drawdown cannot exceed 100%').optional(),
  maxConsecutiveFailures: z.number().positive('Consecutive failures limit must be positive').optional(),
  maxPortfolioRisk: z.number().min(5, 'Portfolio risk must be at least 5%').max(50, 'Portfolio risk cannot exceed 50%').optional(),
  maxSectorConcentration: z.number().min(5, 'Sector concentration must be at least 5%').max(100, 'Sector concentration cannot exceed 100%').optional(),
  maxCorrelation: z.number().min(0, 'Correlation must be 0 or greater').max(1, 'Correlation cannot exceed 1').optional()
});

const TriggerKillSwitchSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason cannot exceed 500 characters'),
  severity: z.enum(['low', 'medium', 'high', 'critical'], {
    errorMap: () => ({ message: 'Severity must be one of: low, medium, high, critical' })
  }).default('high')
});

const ResetKillSwitchSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason cannot exceed 500 characters'),
  resetBy: z.string().min(1, 'Reset by field is required').max(100, 'Reset by cannot exceed 100 characters')
});

/**
 * Risk Management API Endpoints
 * 
 * @route GET /api/risk
 * @description Get comprehensive risk status and analysis
 * 
 * @returns {Object} Risk status including:
 *   - portfolioRisk: Current portfolio risk metrics
 *   - killSwitch: Kill switch status and conditions
 *   - activeBots: Bot status summary
 *   - alerts: Active risk alerts
 *   - recommendations: Risk management recommendations
 *   - configuration: Current risk limits
 * 
 * @throws {401} Unauthorized - invalid or missing JWT token
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let userId: string = '';
  
  try {
    // Rate limiting for GET requests
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.success) {
      throw new RiskAPIError(
        'Rate limit exceeded for risk status requests',
        429,
        'RATE_LIMIT_EXCEEDED',
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          limit: RISK_CONFIG.RATE_LIMIT_GET_REQUESTS
        }
      );
    }

    // Authentication
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      throw new RiskAPIError(
        'Authentication failed',
        401,
        'AUTH_FAILED',
        { details: authResult.error }
      );
    }

    userId = authResult.payload?.sub || '';
    if (!userId) {
      throw new RiskAPIError(
        'Invalid token payload - missing user ID',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    // Check cache first
    const cacheKey = `risk_status:${userId}`;
    const cachedData = riskCache.get(cacheKey);
    if (cachedData) {
      logRiskOperation('GET_RISK_STATUS_CACHED', userId, { cached: true }, Date.now() - startTime);
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Get current risk status
    const riskStatus = await getCurrentRiskStatus(userId);

    // Cache the result
    riskCache.set(cacheKey, riskStatus);

    logRiskOperation('GET_RISK_STATUS_SUCCESS', userId, { 
      activeBots: riskStatus.activeBots.total,
      alerts: riskStatus.alerts.length,
      killSwitchStatus: riskStatus.killSwitch.status
    }, Date.now() - startTime);

    return NextResponse.json({
      success: true,
      data: riskStatus,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof RiskAPIError) {
      logRiskOperation('GET_RISK_STATUS_ERROR', userId, { errorCode: error.errorCode }, duration, error);
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

    logRiskOperation('GET_RISK_STATUS_UNEXPECTED_ERROR', userId, {}, duration, error as Error);
    console.error('Unexpected risk API error:', error);
    
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
 * Risk Management Actions API
 * 
 * @route POST /api/risk
 * @description Execute risk management actions
 * 
 * @param {Object} body - Action configuration
 * @param {string} body.action - Action to perform
 * @param {Object} [body.data] - Action-specific data
 * 
 * @returns {Object} Action result with success status and data
 * 
 * @throws {400} Invalid request parameters
 * @throws {401} Unauthorized - invalid or missing JWT token
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string = '';
  let action: string = '';
  
  try {
    // Stricter rate limiting for actions
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.success) {
      throw new RiskAPIError(
        'Rate limit exceeded for risk actions',
        429,
        'RATE_LIMIT_EXCEEDED',
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          limit: RISK_CONFIG.RATE_LIMIT_ACTION_REQUESTS
        }
      );
    }

    // Authentication
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      throw new RiskAPIError(
        'Authentication failed',
        401,
        'AUTH_FAILED',
        { details: authResult.error }
      );
    }

    userId = authResult.payload?.sub || '';
    if (!userId) {
      throw new RiskAPIError(
        'Invalid token payload - missing user ID',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    const body = await request.json();

    // Validate request
    const validationResult = RiskActionSchema.safeParse(body);
    if (!validationResult.success) {
      throw new RiskAPIError(
        'Invalid request parameters',
        400,
        'VALIDATION_ERROR',
        { 
          errors: validationResult.error.errors,
          received: body
        }
      );
    }

    const { action: actionType, data } = validationResult.data;
    action = actionType;

    // Clear cache after any action that might change risk status
    if (['trigger_kill_switch', 'reset_kill_switch', 'update_limits'].includes(action)) {
      riskCache.clear();
    }

    // Handle different risk actions
    let result;
    switch (action) {
      case 'get_status':
        const statusData = await getCurrentRiskStatus(userId);
        result = {
          success: true,
          data: statusData
        };
        break;

      case 'trigger_kill_switch':
        result = await triggerKillSwitch(userId, data);
        break;

      case 'reset_kill_switch':
        result = await resetKillSwitch(userId, data);
        break;

      case 'update_limits':
        result = await updateRiskLimits(userId, data);
        break;

      case 'acknowledge_alert':
        result = await acknowledgeAlert(userId, data);
        break;

      default:
        throw new RiskAPIError(
          'Unknown action',
          400,
          'UNKNOWN_ACTION',
          { action }
        );
    }

    logRiskOperation('RISK_ACTION_SUCCESS', userId, { action, success: result.success }, Date.now() - startTime);

    return NextResponse.json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof RiskAPIError) {
      logRiskOperation('RISK_ACTION_ERROR', userId, { action, errorCode: error.errorCode }, duration, error);
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

    logRiskOperation('RISK_ACTION_UNEXPECTED_ERROR', userId, { action }, duration, error as Error);
    console.error('Unexpected risk action error:', error);
    
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
 * Get comprehensive current risk status with enhanced error handling
 */
async function getCurrentRiskStatus(userId: string) {
  try {
    const supabase = getSupabaseClient();
    
    // Get user's active bots
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
      throw new RiskAPIError(
        'Failed to fetch bot configurations',
        500,
        'DATABASE_ERROR',
        { supabaseError: botsError }
      );
    }

    // Get recent trades for risk analysis
    const analysisWindowAgo = new Date(Date.now() - RISK_CONFIG.RISK_ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
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
      .gte('executed_at', analysisWindowAgo);

    if (tradesError) {
      console.error('Error fetching trades for risk analysis:', tradesError);
      // Continue with empty trades array rather than failing
    }

    // Get user's risk configuration
    const { data: riskConfig, error: configError } = await supabase
      .from('user_risk_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (configError && configError.code !== 'PGRST116') { // Not found is okay
      console.error('Error fetching risk configuration:', configError);
    }

    // Calculate portfolio risk metrics with enhanced configuration
    const portfolioMetrics = calculatePortfolioRisk(recentTrades || [], riskConfig);

    // Get active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('risk_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(RISK_CONFIG.MAX_ALERTS_RETURNED);

    if (alertsError) {
      console.error('Error fetching risk alerts:', alertsError);
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
      systemHealth: {
        analysisWindow: `${RISK_CONFIG.RISK_ANALYSIS_WINDOW_HOURS} hours`,
        tradesAnalyzed: recentTrades?.length || 0,
        configurationSource: riskConfig ? 'user_configured' : 'default'
      },
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    if (error instanceof RiskAPIError) {
      throw error;
    }
    throw new RiskAPIError(
      'Failed to get risk status',
      500,
      'RISK_STATUS_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Enhanced portfolio risk calculation with configurable parameters
 */
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
      maxDailyLoss: config.max_daily_loss || RISK_CONFIG.DEFAULT_MAX_DAILY_LOSS,
      maxDrawdown: config.max_drawdown || RISK_CONFIG.DEFAULT_MAX_DRAWDOWN,
      maxConsecutiveFailures: config.max_consecutive_failures || RISK_CONFIG.DEFAULT_MAX_CONSECUTIVE_FAILURES,
      maxFailureRate: config.max_failure_rate || RISK_CONFIG.DEFAULT_MAX_FAILURE_RATE
    },
    riskUtilization: {
      dailyLoss: dailyLoss / (config.max_daily_loss || RISK_CONFIG.DEFAULT_MAX_DAILY_LOSS),
      consecutiveFailures: consecutiveFailures / (config.max_consecutive_failures || RISK_CONFIG.DEFAULT_MAX_CONSECUTIVE_FAILURES),
      failureRate: failureRate / (config.max_failure_rate || RISK_CONFIG.DEFAULT_MAX_FAILURE_RATE)
    }
  };
}

// Keeping the rest of the helper functions with enhanced error handling
function calculateConsecutiveFailures(trades: any[]): number {
  try {
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
  } catch (error) {
    console.error('Error calculating consecutive failures:', error);
    return 0;
  }
}

async function getKillSwitchStatus(userId: string, portfolioMetrics: any) {
  try {
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

    // Check if auto-trigger conditions are met with configurable thresholds
    const autoTriggerRisk = checkAutoTriggerConditions(portfolioMetrics);

    return {
      isActive: true,
      isTriggered,
      lastTriggered,
      autoTriggerRisk,
      status: isTriggered ? 'triggered' : autoTriggerRisk.shouldTrigger ? 'warning' : 'normal',
      configuration: {
        autoTriggerThresholds: {
          dailyLossThreshold: RISK_CONFIG.AUTO_TRIGGER_DAILY_LOSS_THRESHOLD,
          failureRateThreshold: RISK_CONFIG.AUTO_TRIGGER_FAILURE_RATE_THRESHOLD
        }
      }
    };
  } catch (error) {
    console.error('Error getting kill switch status:', error);
    return {
      isActive: false,
      isTriggered: false,
      lastTriggered: null,
      autoTriggerRisk: { shouldTrigger: false, risks: [] },
      status: 'unknown'
    };
  }
}

function checkAutoTriggerConditions(metrics: any) {
  try {
    const risks = [];
    let shouldTrigger = false;

    // Check daily loss limit with configurable threshold
    const dailyLossRatio = metrics.dailyLoss / metrics.riskLimits.maxDailyLoss;
    if (dailyLossRatio >= RISK_CONFIG.AUTO_TRIGGER_DAILY_LOSS_THRESHOLD) {
      risks.push({
        type: 'daily_loss',
        current: metrics.dailyLoss,
        limit: metrics.riskLimits.maxDailyLoss,
        utilization: dailyLossRatio,
        severity: dailyLossRatio >= 1.0 ? 'critical' : 'high'
      });
      shouldTrigger = dailyLossRatio >= 1.0;
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

    // Check failure rate with configurable threshold
    const failureRateRatio = metrics.failureRate / metrics.riskLimits.maxFailureRate;
    if (failureRateRatio >= RISK_CONFIG.AUTO_TRIGGER_FAILURE_RATE_THRESHOLD) {
      risks.push({
        type: 'high_failure_rate',
        current: metrics.failureRate,
        limit: metrics.riskLimits.maxFailureRate,
        utilization: failureRateRatio,
        severity: failureRateRatio >= 1.0 ? 'high' : 'medium'
      });
      shouldTrigger = shouldTrigger || failureRateRatio >= 1.0;
    }

    return {
      shouldTrigger,
      risks
    };
  } catch (error) {
    console.error('Error checking auto-trigger conditions:', error);
    return {
      shouldTrigger: false,
      risks: []
    };
  }
}

// Enhanced trigger and management functions with better error handling
async function triggerKillSwitch(userId: string, data: any) {
  try {
    // Validate trigger data
    const validation = TriggerKillSwitchSchema.safeParse(data);
    if (!validation.success) {
      throw new RiskAPIError(
        'Invalid kill switch trigger data',
        400,
        'VALIDATION_ERROR',
        { errors: validation.error.errors }
      );
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
      throw new RiskAPIError(
        'Failed to fetch active bots for kill switch',
        500,
        'DATABASE_ERROR',
        { supabaseError: botsError }
      );
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
        throw new RiskAPIError(
          'Failed to stop bots during kill switch activation',
          500,
          'BOT_STOP_ERROR',
          { supabaseError: stopError }
        );
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

    logRiskOperation('KILL_SWITCH_TRIGGERED', userId, {
      reason,
      severity,
      botsStoppedCount: activeBots?.length || 0
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
    if (error instanceof RiskAPIError) {
      throw error;
    }
    throw new RiskAPIError(
      'Kill switch trigger failed',
      500,
      'KILL_SWITCH_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

async function resetKillSwitch(userId: string, data: any) {
  try {
    // Validate reset data
    const validation = ResetKillSwitchSchema.safeParse(data);
    if (!validation.success) {
      throw new RiskAPIError(
        'Invalid kill switch reset data',
        400,
        'VALIDATION_ERROR',
        { errors: validation.error.errors }
      );
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

    logRiskOperation('KILL_SWITCH_RESET', userId, { reason, resetBy });

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
    if (error instanceof RiskAPIError) {
      throw error;
    }
    throw new RiskAPIError(
      'Kill switch reset failed',
      500,
      'KILL_SWITCH_RESET_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

async function updateRiskLimits(userId: string, data: any) {
  try {
    // Validate limits data
    const validation = UpdateLimitsSchema.safeParse(data);
    if (!validation.success) {
      throw new RiskAPIError(
        'Invalid risk limits data',
        400,
        'VALIDATION_ERROR',
        { errors: validation.error.errors }
      );
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
      throw new RiskAPIError(
        'Failed to update risk limits',
        500,
        'DATABASE_ERROR',
        { supabaseError: updateError }
      );
    }

    logRiskOperation('RISK_LIMITS_UPDATED', userId, limits);

    return {
      success: true,
      message: 'Risk limits updated successfully',
      data: updatedConfig
    };

  } catch (error) {
    if (error instanceof RiskAPIError) {
      throw error;
    }
    throw new RiskAPIError(
      'Risk limits update failed',
      500,
      'RISK_LIMITS_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

async function acknowledgeAlert(userId: string, data: any) {
  try {
    const { alertId } = data;

    if (!alertId) {
      throw new RiskAPIError(
        'Alert ID is required',
        400,
        'MISSING_ALERT_ID'
      );
    }

    const supabase = getSupabaseClient();

    // Acknowledge the alert with user validation
    const { error: ackError } = await supabase
      .from('risk_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    if (ackError) {
      throw new RiskAPIError(
        'Failed to acknowledge alert',
        500,
        'DATABASE_ERROR',
        { supabaseError: ackError }
      );
    }

    logRiskOperation('ALERT_ACKNOWLEDGED', userId, { alertId });

    return {
      success: true,
      message: 'Alert acknowledged successfully'
    };

  } catch (error) {
    if (error instanceof RiskAPIError) {
      throw error;
    }
    throw new RiskAPIError(
      'Alert acknowledgment failed',
      500,
      'ALERT_ACK_ERROR',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

function generateRiskRecommendations(portfolioMetrics: any, bots: any[], alerts: any[]) {
  try {
    const recommendations = [];

    // High daily loss
    if (portfolioMetrics.riskUtilization.dailyLoss > 0.8) {
      recommendations.push({
        type: 'reduce_risk',
        priority: 'high',
        title: 'Reduce Daily Risk Exposure',
        description: 'Daily losses are approaching the limit. Consider reducing position sizes or stopping some bots.',
        action: 'Consider stopping non-essential bots or reducing trade sizes',
        urgency: portfolioMetrics.riskUtilization.dailyLoss > 0.95 ? 'critical' : 'high'
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
  } catch (error) {
    console.error('Error generating risk recommendations:', error);
    return [];
  }
}

/**
 * Get default risk configuration with environment-driven values
 */
function getDefaultRiskConfig() {
  return {
    max_daily_loss: RISK_CONFIG.DEFAULT_MAX_DAILY_LOSS,
    max_drawdown: RISK_CONFIG.DEFAULT_MAX_DRAWDOWN,
    max_consecutive_failures: RISK_CONFIG.DEFAULT_MAX_CONSECUTIVE_FAILURES,
    max_failure_rate: RISK_CONFIG.DEFAULT_MAX_FAILURE_RATE,
    max_portfolio_risk: RISK_CONFIG.DEFAULT_MAX_PORTFOLIO_RISK,
    max_sector_concentration: RISK_CONFIG.DEFAULT_MAX_SECTOR_CONCENTRATION,
    max_correlation: RISK_CONFIG.DEFAULT_MAX_CORRELATION
  };
}
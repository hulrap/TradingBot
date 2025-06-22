import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyJWT } from '@/lib/auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { generateSecureRandom } from '@trading-bot/crypto';

// Import proper schemas from packages folder
import { 
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema,
  BotConfigSchema,
  type ArbitrageBotConfig,
  type CopyTradingBotConfig,
  type SandwichBotConfig,
  type BotConfig,
  BOT_TYPES,
  SUPPORTED_CHAINS,
  SUPPORTED_DEXES
} from '@trading-bot/types/src/bot';
import { isValidEthereumAddress } from '@trading-bot/types';
import { z } from 'zod';

// Define bot type from BOT_TYPES
type BotType = typeof BOT_TYPES[number];

// Create update schema for bot configurations
const BotConfigUpdateSchema = z.object({
  botId: z.string().min(1, 'Bot ID is required'),
  isActive: z.boolean().optional(),
  isPaperTrading: z.boolean().optional(),
  configuration: BotConfigSchema.optional(),
  botType: z.enum(BOT_TYPES).optional()
});

// Simple risk calculation function (fallback implementation)
function calculateBotRiskScore(config: any): number {
  let riskScore = 0;
  
  // Basic risk factors
  if (!config || Object.keys(config).length === 0) return 0;
  
  // Check for high trade sizes
  if (config.tradeSize && typeof config.tradeSize === 'object' && config.tradeSize.value > 1000) {
    riskScore += 2;
  }
  
  // Check for copy trading target wallet validation
  if (config.targetWallet && !config.targetWallet.verified) {
    riskScore += 1;
  }
  
  // Check for risk management settings
  if (config.riskManagement) {
    if (!config.riskManagement.stopLoss?.enabled) riskScore += 2;
    if (!config.riskManagement.takeProfit?.enabled) riskScore += 1;
  }
  
  return Math.min(riskScore, 10); // Cap at 10
}

// Simple bot configuration validation (fallback implementation)
function validateBotConfig(config: any, botType: string): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!config) {
    errors.push('Configuration is required');
    return { isValid: false, errors };
  }
  
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Bot name is required');
  }
  
  if (!config.walletId) {
    errors.push('Wallet ID is required');
  }
  
  // Bot type specific validation
  if (botType === 'arbitrage' && !config.tokenPairs?.length) {
    errors.push('At least one token pair is required for arbitrage bots');
  }
  
  if (botType === 'copy-trader' && !config.targetWallet?.address) {
    errors.push('Target wallet address is required for copy trading bots');
  }
  
  return { isValid: errors.length === 0, ...(errors.length > 0 && { errors }) };
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

// Enhanced bot status interface aligned with packages
interface BotStatusResponse {
  id: string;
  type: BotType;
  name: string;
  description: string;
  isActive: boolean;
  isConfigured: boolean;
  isPaperTrading: boolean;
  profitLoss: number;
  dailyTrades: number;
  totalTrades: number;
  winRate: number;
  riskScore: number;
  lastActivity?: string;
  configuration: BotConfig;
  href: string;
  status: 'running' | 'stopped' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

// Enhanced bot creation interface
interface CreateBotRequest {
  botType: BotType;
  configuration: ArbitrageBotConfig | CopyTradingBotConfig | SandwichBotConfig;
}

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

    // Get bot configurations from Supabase with enhanced data
    const supabase = getSupabaseClient();
    const { data: botConfigs, error } = await supabase
      .from('bot_configurations')
      .select(`
        id,
        user_id,
        name,
        type,
        status,
        is_active,
        is_paper_trading,
        configuration,
        profit_loss,
        daily_trades,
        total_trades,
        win_rate,
        risk_score,
        last_activity,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bot configurations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bot configurations' },
        { status: 500 }
      );
    }

    // Transform data to match frontend expectations with enhanced information
    const transformedBots: BotStatusResponse[] = (botConfigs || []).map(bot => ({
      id: bot.id,
      type: bot.type as BotType,
      name: bot.name,
      description: getBotDescription(bot.type as BotType),
      isActive: bot.is_active || false,
      isConfigured: !!bot.configuration,
      isPaperTrading: bot.is_paper_trading || true,
      profitLoss: bot.profit_loss || 0,
      dailyTrades: bot.daily_trades || 0,
      totalTrades: bot.total_trades || 0,
      winRate: bot.win_rate || 0,
      riskScore: bot.risk_score || calculateBotRiskScore(bot.configuration || {}),
      lastActivity: bot.last_activity || undefined,
      configuration: bot.configuration || {},
      href: getBotHref(bot.type as BotType),
      status: bot.status || 'stopped',
      createdAt: bot.created_at,
      updatedAt: bot.updated_at
    }));

    // Also return default bot templates for UI
    const defaultBotTemplates = [
      {
        id: 'template-arbitrage',
        type: 'arbitrage',
        name: 'Arbitrage Bot',
        description: 'Exploits price differences across DEXs for profit opportunities with sophisticated risk management.',
        isActive: false,
        isConfigured: false,
        isPaperTrading: true,
        profitLoss: 0,
        dailyTrades: 0,
        totalTrades: 0,
        winRate: 0,
        riskScore: 0,
        configuration: {},
        href: '/dashboard/arbitrage',
        status: 'stopped' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'template-copy-trading',
        type: 'copy-trader',
        name: 'Copy-Trading Bot',
        description: 'Mirrors trades from successful wallet addresses with advanced filtering and risk controls.',
        isActive: false,
        isConfigured: false,
        isPaperTrading: true,
        profitLoss: 0,
        dailyTrades: 0,
        totalTrades: 0,
        winRate: 0,
        riskScore: 0,
        configuration: {},
        href: '/dashboard/copy-trader',
        status: 'stopped' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'template-sandwich',
        type: 'mev-sandwich',
        name: 'MEV Sandwich Bot (Advanced)',
        description: 'Advanced MEV extraction strategies for experienced users with sophisticated slippage protection.',
        isActive: false,
        isConfigured: false,
        isPaperTrading: true,
        profitLoss: 0,
        dailyTrades: 0,
        totalTrades: 0,
        winRate: 0,
        riskScore: 0,
        configuration: {},
        href: '/dashboard/sandwich',
        status: 'stopped' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      bots: transformedBots,
      templates: defaultBotTemplates,
      meta: {
        totalBots: transformedBots.length,
        activeBots: transformedBots.filter(bot => bot.isActive).length,
        totalProfitLoss: transformedBots.reduce((sum, bot) => sum + bot.profitLoss, 0),
        supportedChains: SUPPORTED_CHAINS,
        supportedDexes: SUPPORTED_DEXES
      }
    });

  } catch (error) {
    console.error('Error in GET bot configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot configurations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for bot creation)
    const rateLimitResult = await rateLimiter.check(request, 5, 60 * 60 * 1000); // 5 per hour
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

    // Parse request body
    const body: CreateBotRequest = await request.json();
    const { botType, configuration } = body;

    if (!botType || !['arbitrage', 'copy-trader', 'mev-sandwich'].includes(botType)) {
      return NextResponse.json(
        { error: 'Invalid or missing bot type' },
        { status: 400 }
      );
    }

    // Validate configuration based on bot type using packages schemas
    let validationResult;
    let validatedConfig: BotConfig;

    switch (botType) {
      case 'arbitrage':
        validationResult = ArbitrageBotConfigSchema.safeParse(configuration);
        if (!validationResult.success) {
          return NextResponse.json(
            { 
              error: 'Invalid arbitrage bot configuration',
              details: validationResult.error.errors
            },
            { status: 400 }
          );
        }
        validatedConfig = validationResult.data;
        break;

      case 'copy-trader':
        validationResult = CopyTradingBotConfigSchema.safeParse(configuration);
        if (!validationResult.success) {
          return NextResponse.json(
            { 
              error: 'Invalid copy trading bot configuration',
              details: validationResult.error.errors
            },
            { status: 400 }
          );
        }
        validatedConfig = validationResult.data;
        
        // Additional validation for copy trading wallet address
        if (!isValidEthereumAddress(validatedConfig.targetWallet.address)) {
          return NextResponse.json(
            { error: 'Invalid target wallet address format' },
            { status: 400 }
          );
        }
        break;

      case 'mev-sandwich':
        validationResult = SandwichBotConfigSchema.safeParse(configuration);
        if (!validationResult.success) {
          return NextResponse.json(
            { 
              error: 'Invalid sandwich bot configuration',
              details: validationResult.error.errors
            },
            { status: 400 }
          );
        }
        validatedConfig = validationResult.data;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid bot type' },
          { status: 400 }
        );
    }

    // Advanced bot configuration validation using risk management package
    const configValidation = validateBotConfig(validatedConfig, botType);
    if (!configValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Bot configuration failed advanced validation',
          details: configValidation.errors
        },
        { status: 400 }
      );
    }

    // Calculate risk score using risk management package
    const riskScore = calculateBotRiskScore(validatedConfig);
    
    // Verify wallet belongs to user and check compatibility
    const supabase = getSupabaseClient();
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, chain, balance, address')
      .eq('id', validatedConfig.walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Invalid wallet or wallet does not belong to user' },
        { status: 400 }
      );
    }

    // Advanced chain compatibility validation
    const chainValidation = validateChainCompatibility(validatedConfig.chain, wallet.chain);
    if (!chainValidation.compatible) {
      return NextResponse.json(
        { 
          error: 'Wallet chain is not compatible with bot configuration',
          details: chainValidation.reason
        },
        { status: 400 }
      );
    }

    // Check wallet balance for minimum requirements
    const minBalanceCheck = checkMinimumBalance(validatedConfig, wallet.balance);
    if (!minBalanceCheck.sufficient) {
      return NextResponse.json(
        { 
          error: 'Insufficient wallet balance for bot configuration',
          details: minBalanceCheck.requirements
        },
        { status: 400 }
      );
    }

    // Generate secure bot ID
    const botId = `bot_${Date.now()}_${generateSecureRandom(12)}`;

    // Create bot configuration in database with enhanced data
    const { data: newBot, error: createError } = await supabase
      .from('bot_configurations')
      .insert({
        id: botId,
        user_id: userId,
        name: validatedConfig.name,
        type: botType,
        status: 'stopped',
        is_active: false,
        is_paper_trading: validatedConfig.isPaperTrading !== false, // Default to paper trading for safety
        configuration: validatedConfig,
        risk_score: riskScore,
        profit_loss: 0,
        daily_trades: 0,
        total_trades: 0,
        win_rate: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating bot configuration:', createError);
      return NextResponse.json(
        { error: 'Failed to create bot configuration' },
        { status: 500 }
      );
    }

    console.log(`Bot configuration created for user ${userId}: ${botType} - ${validatedConfig.name} (Risk Score: ${riskScore})`);

    // Return enhanced bot data
    const responseBot: BotStatusResponse = {
      id: newBot.id,
      type: newBot.type as BotType,
      name: newBot.name,
      description: getBotDescription(newBot.type as BotType),
      isActive: newBot.is_active,
      isConfigured: true,
      isPaperTrading: newBot.is_paper_trading,
      profitLoss: newBot.profit_loss || 0,
      dailyTrades: newBot.daily_trades || 0,
      totalTrades: newBot.total_trades || 0,
      winRate: newBot.win_rate || 0,
      riskScore: newBot.risk_score,
      configuration: newBot.configuration,
      href: getBotHref(newBot.type as BotType),
      status: newBot.status,
      createdAt: newBot.created_at,
      updatedAt: newBot.updated_at
    };

    return NextResponse.json({
      success: true,
      bot: responseBot,
      validation: configValidation,
      riskAssessment: {
        score: riskScore,
        level: riskScore < 3 ? 'low' : riskScore < 6 ? 'medium' : riskScore < 8 ? 'high' : 'extreme'
      }
    });

  } catch (error) {
    console.error('Error creating bot configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create bot configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    // Parse and validate request body using packages schema
    const body = await request.json();
    const validationResult = BotConfigUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid update data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { botId, isActive, isPaperTrading, configuration } = validationResult.data;

    // Prepare update data with enhanced validation
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive;
      updateData.status = isActive ? 'running' : 'stopped';
    }

    if (typeof isPaperTrading === 'boolean') {
      updateData.is_paper_trading = isPaperTrading;
    }

    if (configuration) {
      // Re-validate configuration if provided
      const configValidation = validateBotConfig(configuration, body.botType);
      if (!configValidation.isValid) {
        return NextResponse.json(
          { 
            error: 'Updated configuration failed validation',
            details: configValidation.errors
          },
          { status: 400 }
        );
      }
      
      updateData.configuration = configuration;
      updateData.risk_score = calculateBotRiskScore(configuration);
    }

    // Update bot configuration (only if it belongs to user)
    const supabase = getSupabaseClient();
    const { data: updatedBot, error: updateError } = await supabase
      .from('bot_configurations')
      .update(updateData)
      .eq('id', botId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bot configuration:', updateError);
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Bot configuration not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update bot configuration' },
        { status: 500 }
      );
    }

    console.log(`Bot configuration updated by user ${userId}: ${botId}`);

    // Return enhanced bot data
    const responseBot: BotStatusResponse = {
      id: updatedBot.id,
      type: updatedBot.type as BotType,
      name: updatedBot.name,
      description: getBotDescription(updatedBot.type as BotType),
      isActive: updatedBot.is_active,
      isConfigured: !!updatedBot.configuration,
      isPaperTrading: updatedBot.is_paper_trading,
      profitLoss: updatedBot.profit_loss || 0,
      dailyTrades: updatedBot.daily_trades || 0,
      totalTrades: updatedBot.total_trades || 0,
      winRate: updatedBot.win_rate || 0,
      riskScore: updatedBot.risk_score || 0,
      lastActivity: updatedBot.last_activity,
      configuration: updatedBot.configuration,
      href: getBotHref(updatedBot.type as BotType),
      status: updatedBot.status,
      createdAt: updatedBot.created_at,
      updatedAt: updatedBot.updated_at
    };

    return NextResponse.json({
      success: true,
      bot: responseBot
    });

  } catch (error) {
    console.error('Error updating bot configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update bot configuration' },
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
    const botId = searchParams.get('botId');

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // First, ensure bot is stopped for safety
    await supabase
      .from('bot_configurations')
      .update({
        is_active: false,
        status: 'stopped',
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
      .eq('user_id', userId);

    // Archive bot data before deletion (for audit trail)
    const { data: botToDelete } = await supabase
      .from('bot_configurations')
      .select('*')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botToDelete) {
      // Archive the bot configuration
      await supabase
        .from('bot_configurations_archive')
        .insert({
          ...botToDelete,
          deleted_at: new Date().toISOString(),
          deleted_by: userId
        });
    }

    // Delete the bot configuration
    const { error: deleteError } = await supabase
      .from('bot_configurations')
      .delete()
      .eq('id', botId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting bot configuration:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete bot configuration' },
        { status: 500 }
      );
    }

    console.log(`Bot configuration deleted by user ${userId}: ${botId}`);

    return NextResponse.json({
      success: true,
      message: 'Bot configuration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting bot configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot configuration' },
      { status: 500 }
    );
  }
}

// Helper functions

function getBotDescription(botType: any): string {
  switch (botType) {
    case 'arbitrage':
      return 'Exploits price differences across DEXs for profit opportunities with sophisticated risk management.';
    case 'copy-trader':
      return 'Mirrors trades from successful wallet addresses with advanced filtering and risk controls.';
    case 'mev-sandwich':
      return 'Advanced MEV extraction strategies for experienced users with sophisticated slippage protection.';
    default:
      return 'Trading bot with advanced configuration options.';
  }
}

function getBotHref(botType: any): string {
  switch (botType) {
    case 'arbitrage':
      return '/dashboard/arbitrage';
    case 'copy-trader':
      return '/dashboard/copy-trader';
    case 'mev-sandwich':
      return '/dashboard/sandwich';
    default:
      return '/dashboard';
  }
}

function validateChainCompatibility(configChain: string, walletChain: string): { compatible: boolean; reason?: string } {
  const chainMap: Record<string, string[]> = {
    'ETHEREUM': ['ethereum', 'eth', 'mainnet'],
    'BSC': ['bsc', 'bnb', 'binance'],
    'POLYGON': ['polygon', 'matic'],
    'ARBITRUM': ['arbitrum', 'arb'],
    'OPTIMISM': ['optimism', 'op']
  };

  const configNormalized = configChain.toUpperCase();
  const walletNormalized = walletChain.toLowerCase();

  const compatibleChains = chainMap[configNormalized] || [];
  
  if (compatibleChains.includes(walletNormalized) || configNormalized === walletChain.toUpperCase()) {
    return { compatible: true };
  }

  return { 
    compatible: false, 
    reason: `Wallet chain ${walletChain} is not compatible with bot chain ${configChain}` 
  };
}

function checkMinimumBalance(config: BotConfig, walletBalance: number): { sufficient: boolean; requirements?: string } {
  // Base minimum requirements (in ETH equivalent)
  const baseMinimum = 0.01; // 0.01 ETH for gas fees
  
  let requiredBalance = baseMinimum;
  
  // Add configuration-specific requirements
  if ('tradeSize' in config && config.tradeSize && typeof config.tradeSize === 'object' && 'value' in config.tradeSize && typeof config.tradeSize.value === 'number') {
    requiredBalance += config.tradeSize.value * 0.001; // Convert to ETH equivalent
  }
  
  if ('copySettings' in config && config.copySettings?.maxTradeValue) {
    requiredBalance += config.copySettings.maxTradeValue * 0.001; // Convert to ETH equivalent
  }

  if (walletBalance < requiredBalance) {
    return {
      sufficient: false,
      requirements: `Minimum balance required: ${requiredBalance} ETH (Current: ${walletBalance} ETH)`
    };
  }

  return { sufficient: true };
} 
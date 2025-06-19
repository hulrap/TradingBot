import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Bot configuration schemas
const BotConfigSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['arbitrage', 'copy-trader', 'mev-sandwich']),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana']),
  status: z.enum(['active', 'inactive', 'paused']).default('inactive'),
  configuration: z.object({
    // Arbitrage bot config
    minProfitThreshold: z.number().min(0).optional(),
    maxTradeSize: z.string().optional(),
    slippageTolerance: z.number().min(0).max(100).optional(),
    gasMultiplier: z.number().min(1).max(3).optional(),
    
    // Copy trader config
    targetWallet: z.string().optional(),
    copyPercentage: z.number().min(1).max(100).optional(),
    maxCopyAmount: z.string().optional(),
    tokenWhitelist: z.array(z.string()).optional(),
    tokenBlacklist: z.array(z.string()).optional(),
    
    // MEV sandwich config
    minVictimTradeSize: z.string().optional(),
    maxGasBid: z.string().optional(),
    flashbotsEnabled: z.boolean().optional(),
    jitoEnabled: z.boolean().optional(),
    
    // Common risk settings
    maxDailyLoss: z.string().optional(),
    stopLossPercentage: z.number().min(0).max(100).optional(),
    emergencyStop: z.boolean().default(false)
  }),
  walletId: z.string().uuid(),
  isActive: z.boolean().default(false),
  isPaperTrading: z.boolean().default(true)
});

const UpdateBotConfigSchema = BotConfigSchema.partial().omit(['type']);

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
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const type = url.searchParams.get('type');
    const chain = url.searchParams.get('chain');
    const status = url.searchParams.get('status');

    // Build query
    let query = supabase
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Add filters
    if (type) query = query.eq('type', type);
    if (chain) query = query.eq('chain', chain);
    if (status) query = query.eq('status', status);

    const { data: bots, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bots', details: error.message },
        { status: 500 }
      );
    }

    // Get performance metrics for each bot
    const botsWithMetrics = await Promise.all(
      (bots || []).map(async (bot) => {
        const { data: metrics } = await supabase
          .from('bot_performance_metrics')
          .select('total_trades, total_profit, win_rate, sharpe_ratio, max_drawdown')
          .eq('bot_id', bot.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...bot,
          metrics: metrics?.[0] || {
            total_trades: 0,
            total_profit: '0',
            win_rate: 0,
            sharpe_ratio: 0,
            max_drawdown: 0
          }
        };
      })
    );

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('bot_configurations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      data: {
        bots: botsWithMetrics,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit)
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

export async function POST(request: NextRequest) {
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
    const body = await request.json();

    // Validate input
    const validationResult = BotConfigSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const botConfig = validationResult.data;

    // Verify wallet ownership
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, chain')
      .eq('id', botConfig.walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet not found or not owned by user' },
        { status: 400 }
      );
    }

    // Validate chain compatibility
    if (wallet.chain !== botConfig.chain) {
      return NextResponse.json(
        { error: 'Wallet chain does not match bot chain' },
        { status: 400 }
      );
    }

    // Check bot limits (max 10 bots per user)
    const { count: botCount } = await supabase
      .from('bot_configurations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((botCount || 0) >= 10) {
      return NextResponse.json(
        { error: 'Maximum number of bots reached (10)' },
        { status: 400 }
      );
    }

    // Validate configuration based on bot type
    const configValidation = validateBotConfiguration(botConfig.type, botConfig.configuration);
    if (!configValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid bot configuration', details: configValidation.errors },
        { status: 400 }
      );
    }

    // Create bot configuration
    const { data: newBot, error: createError } = await supabase
      .from('bot_configurations')
      .insert({
        user_id: userId,
        name: botConfig.name,
        type: botConfig.type,
        chain: botConfig.chain,
        status: 'inactive',
        configuration: botConfig.configuration,
        wallet_id: botConfig.walletId,
        is_active: false,
        is_paper_trading: botConfig.isPaperTrading
      })
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
        updated_at
      `)
      .single();

    if (createError) {
      console.error('Database error:', createError);
      return NextResponse.json(
        { error: 'Failed to create bot', details: createError.message },
        { status: 500 }
      );
    }

    // Initialize performance metrics
    await supabase
      .from('bot_performance_metrics')
      .insert({
        bot_id: newBot.id,
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
      });

    return NextResponse.json({
      success: true,
      data: newBot
    }, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function validateBotConfiguration(type: string, config: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  switch (type) {
    case 'arbitrage':
      if (config.minProfitThreshold !== undefined && config.minProfitThreshold < 0.1) {
        errors.push('Minimum profit threshold must be at least 0.1%');
      }
      if (config.slippageTolerance !== undefined && config.slippageTolerance > 5) {
        errors.push('Slippage tolerance should not exceed 5%');
      }
      break;

    case 'copy-trader':
      if (!config.targetWallet) {
        errors.push('Target wallet address is required for copy trader');
      }
      if (config.copyPercentage !== undefined && (config.copyPercentage < 1 || config.copyPercentage > 50)) {
        errors.push('Copy percentage must be between 1% and 50%');
      }
      break;

    case 'mev-sandwich':
      if (!config.minVictimTradeSize) {
        errors.push('Minimum victim trade size is required for MEV sandwich bot');
      }
      if (!config.flashbotsEnabled && !config.jitoEnabled) {
        errors.push('At least one MEV relay must be enabled');
      }
      break;
  }

  // Common validations
  if (config.maxDailyLoss) {
    try {
      const loss = parseFloat(config.maxDailyLoss);
      if (loss <= 0) {
        errors.push('Maximum daily loss must be positive');
      }
    } catch {
      errors.push('Invalid maximum daily loss format');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

export async function PUT(request: NextRequest) {
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
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Validate input
    const validationResult = UpdateBotConfigSchema.safeParse(updateData);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    // Verify bot ownership
    const { data: existingBot, error: fetchError } = await supabase
      .from('bot_configurations')
      .select('id, type, is_active')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingBot) {
      return NextResponse.json(
        { error: 'Bot not found or not owned by user' },
        { status: 404 }
      );
    }

    // Prevent updating active bots
    if (existingBot.is_active && (updateData.configuration || updateData.walletId)) {
      return NextResponse.json(
        { error: 'Cannot update configuration of active bot. Stop the bot first.' },
        { status: 400 }
      );
    }

    // Validate configuration if provided
    if (updateData.configuration) {
      const configValidation = validateBotConfiguration(existingBot.type, updateData.configuration);
      if (!configValidation.valid) {
        return NextResponse.json(
          { error: 'Invalid bot configuration', details: configValidation.errors },
          { status: 400 }
        );
      }
    }

    // Update bot
    const { data: updatedBot, error: updateError } = await supabase
      .from('bot_configurations')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
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
        updated_at
      `)
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update bot', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedBot
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Verify bot ownership and check if active
    const { data: bot, error: fetchError } = await supabase
      .from('bot_configurations')
      .select('id, is_active')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !bot) {
      return NextResponse.json(
        { error: 'Bot not found or not owned by user' },
        { status: 404 }
      );
    }

    // Prevent deleting active bots
    if (bot.is_active) {
      return NextResponse.json(
        { error: 'Cannot delete active bot. Stop the bot first.' },
        { status: 400 }
      );
    }

    // Delete bot (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('bot_configurations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete bot', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bot deleted successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
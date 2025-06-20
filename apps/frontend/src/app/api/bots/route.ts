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

// Validation schemas for different bot types
const ArbitrageBotConfigSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  walletId: z.string().uuid('Invalid wallet ID'),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum'], { invalid_type_error: 'Invalid chain' }),
  tokenPair: z.object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenB: z.string().min(1, 'Token B is required')
  }),
  minProfitThreshold: z.number().min(0.01, 'Minimum profit threshold must be at least 0.01%'),
  tradeSize: z.number().min(0.001, 'Trade size must be at least 0.001'),
  maxSlippage: z.number().min(0.1).max(5, 'Max slippage must be between 0.1% and 5%').optional(),
  maxGasPrice: z.number().min(1, 'Max gas price must be at least 1 gwei').optional(),
  isPaperTrading: z.boolean().optional().default(true)
});

const CopyTraderBotConfigSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  walletId: z.string().uuid('Invalid wallet ID'),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum'], { invalid_type_error: 'Invalid chain' }),
  targetWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  tradeSize: z.object({
    type: z.enum(['FIXED', 'PERCENTAGE']),
    value: z.number().min(0.001, 'Trade size must be at least 0.001')
  }),
  maxTradeSize: z.number().min(0.01, 'Max trade size must be at least 0.01').optional(),
  minTradeSize: z.number().min(0.001, 'Min trade size must be at least 0.001').optional(),
  copyDelay: z.number().min(0).max(60, 'Copy delay must be between 0-60 seconds').optional(),
  isPaperTrading: z.boolean().optional().default(true)
});

const SandwichBotConfigSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  walletId: z.string().uuid('Invalid wallet ID'),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum'], { invalid_type_error: 'Invalid chain' }),
  targetDex: z.enum(['uniswap', 'sushiswap', 'pancakeswap'], { invalid_type_error: 'Invalid DEX' }),
  minVictimTradeSize: z.number().min(0.1, 'Minimum victim trade size must be at least 0.1 ETH'),
  maxGasPrice: z.number().min(1, 'Max gas price must be at least 1 gwei'),
  maxSlippage: z.number().min(0.1).max(5, 'Max slippage must be between 0.1% and 5%').optional(),
  isPaperTrading: z.boolean().optional().default(true)
});

const BotUpdateSchema = z.object({
  botId: z.string().uuid('Invalid bot ID'),
  isActive: z.boolean().optional(),
  isPaperTrading: z.boolean().optional(),
  configuration: z.record(z.any()).optional()
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

    // Get bot configurations from Supabase
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
        max_daily_trades,
        max_position_size,
        stop_loss_percentage,
        take_profit_percentage,
        configuration,
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

    return NextResponse.json({
      success: true,
      data: botConfigs || []
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
    const rateLimitResult = await rateLimiter.check(request, 10, 60 * 60 * 1000); // 10 per hour
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
    const body = await request.json();
    const { botType, ...configData } = body;

    if (!botType || !['arbitrage', 'copy-trader', 'mev-sandwich'].includes(botType)) {
      return NextResponse.json(
        { error: 'Invalid or missing bot type' },
        { status: 400 }
      );
    }

    // Validate configuration based on bot type
    let validationResult;
    switch (botType) {
      case 'arbitrage':
        validationResult = ArbitrageBotConfigSchema.safeParse(configData);
        break;
      case 'copy-trader':
        validationResult = CopyTraderBotConfigSchema.safeParse(configData);
        break;
      case 'mev-sandwich':
        validationResult = SandwichBotConfigSchema.safeParse(configData);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid bot type' },
          { status: 400 }
        );
    }

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid configuration data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const validatedConfig = validationResult.data;

    // Verify wallet belongs to user
    const supabase = getSupabaseClient();
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, chain')
      .eq('id', validatedConfig.walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Invalid wallet or wallet does not belong to user' },
        { status: 400 }
      );
    }

    // Check wallet chain compatibility (basic validation)
    const configChain = validatedConfig.chain.toLowerCase();
    const walletChain = wallet.chain.toLowerCase();
    
    // Simple chain compatibility check
    const chainCompatible = (
      (configChain === 'ethereum' && walletChain === 'eth') ||
      (configChain === 'bsc' && walletChain === 'bsc') ||
      configChain === walletChain
    );

    if (!chainCompatible) {
      return NextResponse.json(
        { error: 'Wallet chain is not compatible with bot configuration' },
        { status: 400 }
      );
    }

    // Generate secure bot ID
    const botId = `bot_${Date.now()}_${generateSecureRandom(8)}`;

    // Create bot configuration in database
    const { data: newBot, error: createError } = await supabase
      .from('bot_configurations')
      .insert({
        id: botId,
        user_id: userId,
        name: validatedConfig.name,
        type: botType,
        status: 'stopped',
        is_active: false,
        is_paper_trading: validatedConfig.isPaperTrading || true,
        max_daily_trades: 100, // Default limit
        configuration: validatedConfig,
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

    console.log(`Bot configuration created for user ${userId}: ${botType} - ${validatedConfig.name}`);

    return NextResponse.json({
      success: true,
      data: newBot
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = BotUpdateSchema.safeParse(body);
    
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

    // Prepare update data
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
      updateData.configuration = configuration;
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

    return NextResponse.json({
      success: true,
      data: updatedBot
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

    // First, stop the bot if it's active (safety measure)
    const supabase = getSupabaseClient();
    await supabase
      .from('bot_configurations')
      .update({
        is_active: false,
        status: 'stopped',
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
      .eq('user_id', userId);

    // Then delete the bot configuration
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
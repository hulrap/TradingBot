import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const StartBotSchema = z.object({
  forceStart: z.boolean().default(false),
  paperTrading: z.boolean().optional(),
  riskOverrides: z.object({
    maxDailyLoss: z.string().optional(),
    stopLossPercentage: z.number().min(0).max(100).optional(),
    emergencyStop: z.boolean().optional()
  }).optional()
});

interface BotStartParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: BotStartParams) {
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
    const botId = params.id;

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validationResult = StartBotSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { forceStart, paperTrading, riskOverrides } = validationResult.data;

    // Get bot configuration with related data
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
          chain,
          private_key_encrypted
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

    // Check if bot is already active
    if (bot.is_active && !forceStart) {
      return NextResponse.json(
        { error: 'Bot is already active. Use forceStart=true to restart.' },
        { status: 400 }
      );
    }

    // Validate bot configuration
    const configValidation = validateBotStartConfiguration(bot.type, bot.configuration);
    if (!configValidation.valid) {
      return NextResponse.json(
        { 
          error: 'Bot configuration is invalid', 
          details: configValidation.errors 
        },
        { status: 400 }
      );
    }

    // Check wallet validity
    if (!bot.wallets || !bot.wallets.private_key_encrypted) {
      return NextResponse.json(
        { error: 'Bot wallet is not properly configured' },
        { status: 400 }
      );
    }

    // Check user limits (max 3 active bots)
    const { count: activeBotCount } = await supabase
      .from('bot_configurations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if ((activeBotCount || 0) >= 3 && !bot.is_active) {
      return NextResponse.json(
        { error: 'Maximum number of active bots reached (3)' },
        { status: 400 }
      );
    }

    // Prepare bot configuration for start
    const startConfiguration = {
      ...bot.configuration,
      ...(riskOverrides || {}),
      isPaperTrading: paperTrading !== undefined ? paperTrading : bot.is_paper_trading,
      walletAddress: bot.wallets.address,
      chain: bot.chain
    };

    // Update bot status to starting
    const { error: updateError } = await supabase
      .from('bot_configurations')
      .update({
        status: 'starting',
        is_active: true,
        is_paper_trading: startConfiguration.isPaperTrading,
        configuration: {
          ...bot.configuration,
          ...(riskOverrides || {}),
          lastStartedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update bot status', details: updateError.message },
        { status: 500 }
      );
    }

    // Log bot start event
    await supabase
      .from('bot_activity_logs')
      .insert({
        bot_id: botId,
        user_id: userId,
        activity_type: 'start',
        details: {
          paperTrading: startConfiguration.isPaperTrading,
          riskOverrides: riskOverrides || null,
          forceStart,
          timestamp: new Date().toISOString()
        }
      });

    // Send start command to bot service (implementation depends on your bot architecture)
    try {
      await sendBotStartCommand(botId, bot.type, startConfiguration);
    } catch (commandError) {
      console.error('Bot start command failed:', commandError);
      
      // Rollback bot status
      await supabase
        .from('bot_configurations')
        .update({
          status: 'error',
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', botId);

      return NextResponse.json(
        { error: 'Failed to start bot service', details: 'Bot service unavailable' },
        { status: 500 }
      );
    }

    // Update status to active after successful start
    await supabase
      .from('bot_configurations')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', botId);

    // Get updated bot data
    const { data: updatedBot } = await supabase
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
        updated_at
      `)
      .eq('id', botId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Bot started successfully',
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

function validateBotStartConfiguration(type: string, config: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!config) {
    errors.push('Bot configuration is missing');
    return { valid: false, errors };
  }

  switch (type) {
    case 'arbitrage':
      if (!config.minProfitThreshold) {
        errors.push('Minimum profit threshold is required');
      }
      if (!config.maxTradeSize) {
        errors.push('Maximum trade size is required');
      }
      break;

    case 'copy-trader':
      if (!config.targetWallet) {
        errors.push('Target wallet address is required');
      }
      if (!config.copyPercentage) {
        errors.push('Copy percentage is required');
      }
      break;

    case 'mev-sandwich':
      if (!config.minVictimTradeSize) {
        errors.push('Minimum victim trade size is required');
      }
      if (!config.flashbotsEnabled && !config.jitoEnabled) {
        errors.push('At least one MEV relay must be enabled');
      }
      break;

    default:
      errors.push(`Unknown bot type: ${type}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

async function sendBotStartCommand(botId: string, botType: string, configuration: any): Promise<void> {
  // This is where you would send the start command to your bot service
  // The implementation depends on your bot architecture:
  
  // Option 1: HTTP API call to bot service
  // Option 2: Message queue (Redis, RabbitMQ)
  // Option 3: Database flag that bots poll
  // Option 4: WebSocket command

  // For now, we'll simulate the command with a placeholder
  console.log(`Starting bot ${botId} of type ${botType} with configuration:`, configuration);
  
  // Simulate potential network/service failure
  if (Math.random() < 0.1) { // 10% chance of failure for testing
    throw new Error('Bot service connection failed');
  }
  
  // In a real implementation, you might do something like:
  /*
  const response = await fetch(`${process.env.BOT_SERVICE_URL}/bots/${botId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BOT_SERVICE_TOKEN}`
    },
    body: JSON.stringify({
      botType,
      configuration,
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Bot service returned ${response.status}: ${response.statusText}`);
  }
  */
}
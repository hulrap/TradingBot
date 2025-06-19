import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase';
import { z } from 'zod';

// Bot configuration schema
const BotConfigSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  botType: z.enum(['arbitrage', 'copy-trading', 'mev-sandwich']),
  isPaperTrading: z.boolean().default(true),
  maxDailyTrades: z.number().min(1).max(1000).default(100),
  maxPositionSize: z.string().optional(),
  stopLossPercentage: z.number().min(0).max(100).optional(),
  takeProfitPercentage: z.number().min(0).max(1000).optional(),
  configuration: z.object({
    // Arbitrage bot specific
    minProfitThreshold: z.number().optional(),
    maxSlippage: z.number().optional(),
    supportedChains: z.array(z.string()).optional(),
    
    // Copy trading specific
    targetWallets: z.array(z.string()).optional(),
    copyPercentage: z.number().optional(),
    followedTokens: z.array(z.string()).optional(),
    excludedTokens: z.array(z.string()).optional(),
    
    // MEV sandwich specific
    minVictimTradeSize: z.string().optional(),
    maxGasPrice: z.string().optional(),
    profitThreshold: z.number().optional()
  }).optional()
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get bot configurations for the user
    const { data: bots, error } = await supabase
      .from('bot_configurations')
      .select(`
        id,
        name,
        bot_type,
        is_paper_trading,
        is_active,
        max_daily_trades,
        max_position_size,
        stop_loss_percentage,
        take_profit_percentage,
        configuration,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bots:', error);
      return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 });
    }

    return NextResponse.json({ bots });

  } catch (error) {
    console.error('Error in GET /api/bots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = BotConfigSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const botConfig = validationResult.data;

    // Create bot configuration
    const { data: newBot, error } = await supabase
      .from('bot_configurations')
      .insert({
        user_id: user.id,
        name: botConfig.name,
        bot_type: botConfig.botType,
        is_paper_trading: botConfig.isPaperTrading,
        is_active: false, // New bots start inactive
        max_daily_trades: botConfig.maxDailyTrades,
        max_position_size: botConfig.maxPositionSize,
        stop_loss_percentage: botConfig.stopLossPercentage,
        take_profit_percentage: botConfig.takeProfitPercentage,
        configuration: botConfig.configuration || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bot:', error);
      return NextResponse.json({ error: 'Failed to create bot' }, { status: 500 });
    }

    return NextResponse.json({ bot: newBot }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/bots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const StopBotSchema = z.object({
  forceStop: z.boolean().default(false),
  reason: z.string().optional(),
  savePerformanceSnapshot: z.boolean().default(true)
});

interface BotStopParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: BotStopParams) {
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
    const validationResult = StopBotSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { forceStop, reason, savePerformanceSnapshot } = validationResult.data;

    // Get bot configuration
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
        updated_at
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

    // Check if bot is actually running
    if (!bot.is_active && !forceStop) {
      return NextResponse.json(
        { error: 'Bot is not currently active' },
        { status: 400 }
      );
    }

    // Update bot status to stopping
    const { error: updateError } = await supabase
      .from('bot_configurations')
      .update({
        status: 'stopping',
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

    // Get current performance metrics before stopping
    let performanceSnapshot = null;
    if (savePerformanceSnapshot) {
      const { data: currentMetrics } = await supabase
        .from('bot_performance_metrics')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(1);

      performanceSnapshot = currentMetrics?.[0] || null;
    }

    // Send stop command to bot service
    try {
      await sendBotStopCommand(botId, bot.type, forceStop);
    } catch (commandError) {
      console.error('Bot stop command failed:', commandError);
      
      if (!forceStop) {
        // Rollback bot status if graceful stop failed
        await supabase
          .from('bot_configurations')
          .update({
            status: 'active', // Revert to previous status
            updated_at: new Date().toISOString()
          })
          .eq('id', botId);

        return NextResponse.json(
          { 
            error: 'Failed to stop bot gracefully', 
            details: 'Use forceStop=true to force termination',
            suggestion: 'Bot service may be unresponsive'
          },
          { status: 500 }
        );
      }
      // Continue with force stop even if command fails
    }

    // Update bot status to inactive
    const { data: updatedBot, error: finalUpdateError } = await supabase
      .from('bot_configurations')
      .update({
        status: 'inactive',
        is_active: false,
        configuration: {
          ...bot.configuration,
          lastStoppedAt: new Date().toISOString(),
          lastStopReason: reason || (forceStop ? 'Force stopped' : 'Manual stop')
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
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

    if (finalUpdateError) {
      console.error('Database error:', finalUpdateError);
      return NextResponse.json(
        { error: 'Failed to finalize bot stop', details: finalUpdateError.message },
        { status: 500 }
      );
    }

    // Log bot stop event
    await supabase
      .from('bot_activity_logs')
      .insert({
        bot_id: botId,
        user_id: userId,
        activity_type: 'stop',
        details: {
          reason: reason || 'Manual stop',
          forceStop,
          performanceSnapshot,
          timestamp: new Date().toISOString()
        }
      });

    // Create performance history record if we have current metrics
    if (performanceSnapshot && savePerformanceSnapshot) {
      await supabase
        .from('bot_performance_history')
        .insert({
          bot_id: botId,
          user_id: userId,
          session_start: bot.configuration?.lastStartedAt || bot.created_at,
          session_end: new Date().toISOString(),
          total_trades: performanceSnapshot.total_trades,
          successful_trades: performanceSnapshot.successful_trades,
          failed_trades: performanceSnapshot.failed_trades,
          total_profit: performanceSnapshot.total_profit,
          total_fees: performanceSnapshot.total_fees,
          win_rate: performanceSnapshot.win_rate,
          sharpe_ratio: performanceSnapshot.sharpe_ratio,
          max_drawdown: performanceSnapshot.max_drawdown,
          average_trade_size: performanceSnapshot.average_trade_size,
          stop_reason: reason || (forceStop ? 'Force stopped' : 'Manual stop')
        });
    }

    // Reset current performance metrics for next session
    await supabase
      .from('bot_performance_metrics')
      .update({
        total_trades: 0,
        successful_trades: 0,
        failed_trades: 0,
        total_profit: '0',
        total_fees: '0',
        win_rate: 0,
        sharpe_ratio: 0,
        max_drawdown: 0,
        average_trade_size: '0',
        average_profit_per_trade: '0',
        updated_at: new Date().toISOString()
      })
      .eq('bot_id', botId);

    return NextResponse.json({
      success: true,
      message: forceStop ? 'Bot force stopped successfully' : 'Bot stopped successfully',
      data: {
        bot: updatedBot,
        performanceSnapshot: savePerformanceSnapshot ? performanceSnapshot : undefined
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

async function sendBotStopCommand(botId: string, botType: string, forceStop: boolean): Promise<void> {
  // This is where you would send the stop command to your bot service
  // The implementation depends on your bot architecture:
  
  console.log(`Stopping bot ${botId} of type ${botType}, force: ${forceStop}`);
  
  if (forceStop) {
    // Force stop should always succeed (kill process)
    console.log(`Force stopping bot ${botId}`);
    return;
  }
  
  // Simulate potential failure for graceful stop
  if (Math.random() < 0.15) { // 15% chance of failure for graceful stop
    throw new Error('Graceful stop failed - bot may be processing critical transaction');
  }
  
  // Simulate graceful stop delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // 1-3 second delay
  
  // In a real implementation, you might do something like:
  /*
  const endpoint = forceStop ? 'force-stop' : 'stop';
  const response = await fetch(`${process.env.BOT_SERVICE_URL}/bots/${botId}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BOT_SERVICE_TOKEN}`
    },
    body: JSON.stringify({
      botType,
      forceStop,
      timestamp: new Date().toISOString()
    }),
    timeout: forceStop ? 5000 : 30000 // Shorter timeout for force stop
  });

  if (!response.ok) {
    throw new Error(`Bot service returned ${response.status}: ${response.statusText}`);
  }
  */
}
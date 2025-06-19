import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botId = params.id;

    // Verify bot belongs to user and get bot configuration
    const { data: bot, error: fetchError } = await supabase
      .from('bot_configurations')
      .select('*')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (bot.is_active) {
      return NextResponse.json({ error: 'Bot is already running' }, { status: 400 });
    }

    // Update bot status to active
    const { data: updatedBot, error: updateError } = await supabase
      .from('bot_configurations')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
      .select()
      .single();

    if (updateError) {
      console.error('Error starting bot:', updateError);
      return NextResponse.json({ error: 'Failed to start bot' }, { status: 500 });
    }

    // Here you would typically send a message to your bot service
    // to actually start the bot process. For now, we'll just update the database.
    
    // TODO: Implement actual bot starting logic
    // - Send message to bot service queue
    // - Start bot process on server
    // - Initialize bot monitoring

    return NextResponse.json({ 
      message: 'Bot started successfully',
      bot: updatedBot 
    });

  } catch (error) {
    console.error('Error in POST /api/bots/[id]/start:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
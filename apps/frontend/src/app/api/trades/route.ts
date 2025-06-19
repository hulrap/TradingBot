import { NextRequest, NextResponse } from 'next/server';
import { tradeDb } from '../../../lib/database';
import { Trade, ApiResponse } from '@trading-bot/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Trade[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const botConfigId = searchParams.get('botConfigId');
    
    if (!userId && !botConfigId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID or Bot Config ID is required' 
      }, { status: 400 });
    }
    
    let trades: Trade[];
    
    if (botConfigId) {
      trades = tradeDb.findByBotConfigId(botConfigId);
    } else if (userId) {
      trades = tradeDb.findByUserId(userId);
    } else {
      trades = [];
    }
    
    return NextResponse.json({ 
      success: true, 
      data: trades 
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch trades' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const trade: Omit<Trade, 'id' | 'createdAt' | 'completedAt'> = await request.json();
    
    // Generate a unique ID for the trade
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTrade: Omit<Trade, 'createdAt' | 'completedAt'> = {
      id: tradeId,
      ...trade
    };
    
    tradeDb.create(newTrade);
    
    return NextResponse.json({ 
      success: true, 
      data: { id: tradeId } 
    });
  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to record trade' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<boolean>>> {
  try {
    const { id, status, completedAt } = await request.json();
    
    if (!id || !status) {
      return NextResponse.json({ 
        success: false, 
        error: 'Trade ID and status are required' 
      }, { status: 400 });
    }
    
    tradeDb.updateStatus(id, status, completedAt);
    
    return NextResponse.json({ 
      success: true, 
      data: true 
    });
  } catch (error) {
    console.error('Error updating trade:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update trade' 
    }, { status: 500 });
  }
} 
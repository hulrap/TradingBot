import { NextRequest, NextResponse } from 'next/server';
import { botConfigDb } from '../../../lib/database';
import { BotConfig, ApiResponse, ArbitrageBotConfig, CopyTraderBotConfig, SandwichBotConfig } from '@trading-bot/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<BotConfig[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }
    
    const botConfigs = botConfigDb.findByUserId(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: botConfigs 
    });
  } catch (error) {
    console.error('Error fetching bot configurations:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch bot configurations' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const botConfigData = await request.json();
    
    // Validate required fields
    if (!botConfigData.userId || !botConfigData.walletId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and Wallet ID are required' 
      }, { status: 400 });
    }
    
    // Generate bot config ID
    const botConfigId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let newBotConfig: BotConfig;
    
    // Determine bot type and create appropriate config
    if (botConfigData.tokenPair) {
      // Arbitrage bot
      newBotConfig = {
        id: botConfigId,
        userId: botConfigData.userId,
        walletId: botConfigData.walletId,
        chain: botConfigData.chain || 'ETH',
        tokenPair: botConfigData.tokenPair,
        minProfitThreshold: botConfigData.minProfitThreshold || 0.1,
        tradeSize: botConfigData.tradeSize || 0.1,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ArbitrageBotConfig;
    } else if (botConfigData.targetWalletAddress) {
      // Copy trader bot
      newBotConfig = {
        id: botConfigId,
        userId: botConfigData.userId,
        walletId: botConfigData.walletId,
        chain: botConfigData.chain || 'ETH',
        targetWalletAddress: botConfigData.targetWalletAddress,
        tradeSize: botConfigData.tradeSize || { type: 'FIXED', value: 0.1 },
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as CopyTraderBotConfig;
    } else if (botConfigData.targetDex) {
      // Sandwich bot
      newBotConfig = {
        id: botConfigId,
        userId: botConfigData.userId,
        walletId: botConfigData.walletId,
        chain: botConfigData.chain || 'ETH',
        targetDex: botConfigData.targetDex,
        minVictimTradeSize: botConfigData.minVictimTradeSize || 1,
        maxGasPrice: botConfigData.maxGasPrice || 100,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SandwichBotConfig;
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid bot configuration type' 
      }, { status: 400 });
    }
    
    botConfigDb.create(newBotConfig);
    
    return NextResponse.json({ 
      success: true, 
      data: { id: botConfigId } 
    });
  } catch (error) {
    console.error('Error creating bot configuration:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create bot configuration' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<boolean>>> {
  try {
    const { id, isActive } = await request.json();
    
    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json({ 
        success: false, 
        error: 'Bot configuration ID and active status are required' 
      }, { status: 400 });
    }
    
    botConfigDb.updateStatus(id, isActive);
    
    return NextResponse.json({ 
      success: true, 
      data: true 
    });
  } catch (error) {
    console.error('Error updating bot configuration:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update bot configuration' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<boolean>>> {
  try {
    const { searchParams } = new URL(request.url);
    const botConfigId = searchParams.get('botConfigId');
    
    if (!botConfigId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bot configuration ID is required' 
      }, { status: 400 });
    }
    
    // First set bot to inactive
    botConfigDb.updateStatus(botConfigId, false);
    
    // Then delete the configuration
    botConfigDb.delete(botConfigId);
    
    return NextResponse.json({ 
      success: true, 
      data: true 
    });
  } catch (error) {
    console.error('Error deleting bot configuration:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete bot configuration' 
    }, { status: 500 });
  }
} 
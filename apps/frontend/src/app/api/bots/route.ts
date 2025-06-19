import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { botConfigDb } from '../../../lib/database';
import { verifyJWT } from '../../../lib/auth';
import { BotConfig, ApiResponse } from '@trading-bot/types';

// Rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// Input validation schemas
const CreateBotConfigSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana']).optional().default('ethereum'),
  botType: z.enum(['ARBITRAGE', 'COPY_TRADING', 'MEV_SANDWICH', 'PAPER_TRADING']),
  
  // Arbitrage bot specific fields
  tokenPair: z.string().optional(),
  minProfitThreshold: z.number().min(0).max(100).optional(),
  
  // Copy trading bot specific fields
  targetWalletAddress: z.string().optional(),
  copyAmount: z.number().positive().optional(),
  maxSlippage: z.number().min(0).max(50).optional(),
  
  // MEV sandwich bot specific fields
  targetDex: z.string().optional(),
  minVictimTradeSize: z.number().positive().optional(),
  maxGasPrice: z.number().positive().optional(),
  
  // Common fields
  tradeSize: z.number().positive().max(1000).default(0.1),
  isActive: z.boolean().default(false),
  
  // Risk management
  maxDailyLoss: z.number().positive().optional(),
  stopLossPercentage: z.number().min(0).max(100).optional(),
});

const UpdateBotConfigSchema = z.object({
  id: z.string().min(1, 'Bot configuration ID is required'),
  isActive: z.boolean(),
});

const GetBotsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  status: z.enum(['active', 'inactive', 'all']).optional().default('all'),
  botType: z.enum(['ARBITRAGE', 'COPY_TRADING', 'MEV_SANDWICH', 'PAPER_TRADING']).optional(),
});

/**
 * Authenticate request and get user ID
 */
async function authenticateRequest(request: NextRequest): Promise<{ success: true; userId: string } | { success: false; error: string; status: number }> {
  try {
    const authResult = await verifyJWT(request);
    
    if (!authResult.success || !authResult.payload) {
      return {
        success: false,
        error: authResult.error || 'Authentication failed',
        status: 401
      };
    }
    
    return {
      success: true,
      userId: authResult.payload.sub
    };
  } catch (error) {
    return {
      success: false,
      error: 'Authentication verification failed',
      status: 401
    };
  }
}

/**
 * Check rate limiting for IP address
 */
function checkRateLimit(clientIp: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const limitData = rateLimitStore.get(clientIp);
  
  if (!limitData) {
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (now > limitData.resetTime) {
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (limitData.count >= RATE_LIMIT) {
    return { allowed: false, resetTime: limitData.resetTime };
  }
  
  rateLimitStore.set(clientIp, { count: limitData.count + 1, resetTime: limitData.resetTime });
  return { allowed: true };
}

/**
 * Validate bot configuration based on type
 */
function validateBotTypeSpecificFields(data: any): { valid: boolean; error?: string } {
  switch (data.botType) {
    case 'ARBITRAGE':
      if (!data.tokenPair) {
        return { valid: false, error: 'Token pair is required for arbitrage bots' };
      }
      if (!data.minProfitThreshold) {
        return { valid: false, error: 'Minimum profit threshold is required for arbitrage bots' };
      }
      break;
      
    case 'COPY_TRADING':
      if (!data.targetWalletAddress) {
        return { valid: false, error: 'Target wallet address is required for copy trading bots' };
      }
      if (!data.copyAmount) {
        return { valid: false, error: 'Copy amount is required for copy trading bots' };
      }
      break;
      
    case 'MEV_SANDWICH':
      if (!data.targetDex) {
        return { valid: false, error: 'Target DEX is required for MEV sandwich bots' };
      }
      if (!data.minVictimTradeSize) {
        return { valid: false, error: 'Minimum victim trade size is required for MEV sandwich bots' };
      }
      break;
      
    case 'PAPER_TRADING':
      // Paper trading bots have minimal requirements
      break;
      
    default:
      return { valid: false, error: 'Invalid bot type' };
  }
  
  return { valid: true };
}

/**
 * GET /api/bots - Fetch user's bot configurations
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ bots: BotConfig[]; pagination: any }>>> {
  try {
    // Check rate limiting
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitCheck = checkRateLimit(clientIp);
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000).toString()
        }
      });
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error
      }, { status: authResult.status });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = GetBotsQuerySchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      botType: searchParams.get('botType'),
    });

    if (!queryValidation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.issues
      }, { status: 400 });
    }

    const { page, limit, status, botType } = queryValidation.data;

    // Fetch bot configurations with pagination
    const allBots = botConfigDb.findByUserId(authResult.userId);
    
    // Filter bots based on query parameters
    let filteredBots = allBots;
    
    if (status !== 'all') {
      filteredBots = filteredBots.filter(bot => 
        status === 'active' ? bot.isActive : !bot.isActive
      );
    }
    
    if (botType) {
      filteredBots = filteredBots.filter(bot => {
        // Determine bot type from configuration
        const configBotType = determineBotType(bot);
        return configBotType === botType;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBots = filteredBots.slice(startIndex, endIndex);

    const pagination = {
      page,
      limit,
      total: filteredBots.length,
      totalPages: Math.ceil(filteredBots.length / limit),
      hasNext: endIndex < filteredBots.length,
      hasPrev: page > 1
    };

    return NextResponse.json({
      success: true,
      data: {
        bots: paginatedBots,
        pagination
      }
    });

  } catch (error) {
    console.error('Error fetching bot configurations:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch bot configurations'
    }, { status: 500 });
  }
}

/**
 * POST /api/bots - Create new bot configuration
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string; message: string }>>> {
  try {
    // Check rate limiting
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitCheck = checkRateLimit(clientIp);
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      }, { status: 429 });
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication failed'
      }, { status: authResult.status });
    }

    // Parse and validate request body
    const requestBody = await request.json();
    const validation = CreateBotConfigSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      }, { status: 400 });
    }

    const botConfigData = validation.data;

    // Validate bot type specific fields
    const typeValidation = validateBotTypeSpecificFields(botConfigData);
    if (!typeValidation.valid) {
      return NextResponse.json({
        success: false,
        error: typeValidation.error || 'Invalid bot configuration'
      }, { status: 400 });
    }

    // Generate secure bot config ID
    const botConfigId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create bot configuration object
    const newBotConfig = {
      id: botConfigId,
      userId: authResult.userId,
      ...botConfigData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to database with user validation
    await botConfigDb.create(newBotConfig as any);

    return NextResponse.json({
      success: true,
      data: {
        id: botConfigId,
        message: `${botConfigData.botType} bot configuration created successfully`
      }
    });

  } catch (error) {
    console.error('Error creating bot configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create bot configuration'
    }, { status: 500 });
  }
}

/**
 * PUT /api/bots - Update bot configuration status
 */
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  try {
    // Check rate limiting
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitCheck = checkRateLimit(clientIp);
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      }, { status: 429 });
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error
      }, { status: authResult.status });
    }

    // Parse and validate request body
    const requestBody = await request.json();
    const validation = UpdateBotConfigSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      }, { status: 400 });
    }

    const { id, isActive } = validation.data;

    // Update bot configuration with user validation
    await botConfigDb.updateStatus(id, isActive, authResult.userId);

    return NextResponse.json({
      success: true,
      data: {
        message: `Bot configuration ${isActive ? 'activated' : 'deactivated'} successfully`
      }
    });

  } catch (error) {
    console.error('Error updating bot configuration:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Bot configuration not found or access denied'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update bot configuration'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/bots - Delete bot configuration
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  try {
    // Check rate limiting
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitCheck = checkRateLimit(clientIp);
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      }, { status: 429 });
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error
      }, { status: authResult.status });
    }

    // Get bot config ID from query parameters
    const { searchParams } = new URL(request.url);
    const botConfigId = searchParams.get('botConfigId');

    if (!botConfigId) {
      return NextResponse.json({
        success: false,
        error: 'Bot configuration ID is required'
      }, { status: 400 });
    }

    // First deactivate the bot for safety
    try {
      await botConfigDb.updateStatus(botConfigId, false, authResult.userId);
    } catch (error) {
      // If update fails, the bot might not exist or user doesn't have access
    }

    // Delete the bot configuration with user validation
    await botConfigDb.delete(botConfigId, authResult.userId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Bot configuration deleted successfully'
      }
    });

  } catch (error) {
    console.error('Error deleting bot configuration:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Bot configuration not found or access denied'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to delete bot configuration'
    }, { status: 500 });
  }
}

/**
 * Helper function to determine bot type from configuration
 */
function determineBotType(config: any): string {
  if (config.tokenPair && config.minProfitThreshold) return 'ARBITRAGE';
  if (config.targetWalletAddress) return 'COPY_TRADING';
  if (config.targetDex && config.minVictimTradeSize) return 'MEV_SANDWICH';
  return 'PAPER_TRADING';
} 
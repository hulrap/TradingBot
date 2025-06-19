import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { tradeDb } from '../../../lib/database';
import { verifyJWT } from '../../../lib/auth';
import { Trade, ApiResponse } from '@trading-bot/types';

// Rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 200; // requests per hour (higher for trades)
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// Input validation schemas
const CreateTradeSchema = z.object({
  botConfigId: z.string().min(1, 'Bot configuration ID is required'),
  botType: z.enum(['ARBITRAGE', 'COPY_TRADER', 'SANDWICH']),
  txHash: z.string().min(1, 'Transaction hash is required'),
  chain: z.enum(['ETH', 'BSC', 'SOL']),
  tokenIn: z.string().min(1, 'Input token is required'),
  tokenOut: z.string().min(1, 'Output token is required'),
  amountIn: z.string().min(1, 'Input amount is required'),
  amountOut: z.string().min(1, 'Output amount is required'),
  gasUsed: z.string().min(1, 'Gas used is required'),
  gasPrice: z.string().min(1, 'Gas price is required'),
  profit: z.string().optional(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED']).default('PENDING'),
});

const UpdateTradeSchema = z.object({
  id: z.string().min(1, 'Trade ID is required'),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED']),
  completedAt: z.string().optional(),
  profit: z.string().optional(),
});

const GetTradesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'all']).optional().default('all'),
  botType: z.enum(['ARBITRAGE', 'COPY_TRADER', 'SANDWICH', 'all']).optional().default('all'),
  botConfigId: z.string().optional(),
  fromDate: z.string().optional(), // ISO date string
  toDate: z.string().optional(), // ISO date string
  sortBy: z.enum(['createdAt', 'amountIn', 'amountOut']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
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
 * GET /api/trades - Fetch user's trades
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ trades: Trade[]; pagination: any; analytics: any }>>> {
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
    const queryValidation = GetTradesQuerySchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      botType: searchParams.get('botType'),
      botConfigId: searchParams.get('botConfigId'),
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    });

    if (!queryValidation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.issues
      }, { status: 400 });
    }

    const query = queryValidation.data;

    // Fetch trades with user validation
    let allTrades: Trade[];
    
    if (query.botConfigId) {
      // Get trades for specific bot config (database will validate user ownership)
      allTrades = tradeDb.findByBotConfigId(query.botConfigId, authResult.userId);
    } else {
      allTrades = tradeDb.findByUserId(authResult.userId);
    }

    // Apply filters
    let filteredTrades = allTrades;
    
    // Status filter
    if (query.status !== 'all') {
      filteredTrades = filteredTrades.filter(trade => trade.status === query.status);
    }
    
    // Bot type filter
    if (query.botType !== 'all') {
      filteredTrades = filteredTrades.filter(trade => trade.botType === query.botType);
    }
    
    // Date range filter
    if (query.fromDate) {
      const fromDate = new Date(query.fromDate);
      filteredTrades = filteredTrades.filter(trade => 
        new Date(trade.createdAt) >= fromDate
      );
    }
    
    if (query.toDate) {
      const toDate = new Date(query.toDate);
      filteredTrades = filteredTrades.filter(trade => 
        new Date(trade.createdAt) <= toDate
      );
    }

    // Sort trades
    filteredTrades.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (query.sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'amountIn':
          aValue = parseFloat(a.amountIn);
          bValue = parseFloat(b.amountIn);
          break;
        case 'amountOut':
          aValue = parseFloat(a.amountOut);
          bValue = parseFloat(b.amountOut);
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }
      
      return query.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Apply pagination
    const startIndex = (query.page - 1) * query.limit;
    const endIndex = startIndex + query.limit;
    const paginatedTrades = filteredTrades.slice(startIndex, endIndex);

    // Calculate analytics
    const analytics = calculateTradeAnalytics(filteredTrades);

    const pagination = {
      page: query.page,
      limit: query.limit,
      total: filteredTrades.length,
      totalPages: Math.ceil(filteredTrades.length / query.limit),
      hasNext: endIndex < filteredTrades.length,
      hasPrev: query.page > 1
    };

    return NextResponse.json({
      success: true,
      data: {
        trades: paginatedTrades,
        pagination,
        analytics
      }
    });

  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch trades'
    }, { status: 500 });
  }
}

/**
 * POST /api/trades - Create new trade record
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
        error: authResult.error
      }, { status: authResult.status });
    }

    // Parse and validate request body
    const requestBody = await request.json();
    const validation = CreateTradeSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid trade data',
        details: validation.error.issues
      }, { status: 400 });
    }

    const tradeData = validation.data;

    // Generate secure trade ID
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create trade record
    const newTrade = {
      id: tradeId,
      ...tradeData,
      createdAt: new Date().toISOString(),
      completedAt: tradeData.status === 'SUCCESS' ? new Date().toISOString() : undefined
    };

    // Save to database with user validation
    await tradeDb.create(newTrade as any);

    return NextResponse.json({
      success: true,
      data: {
        id: tradeId,
        message: 'Trade record created successfully'
      }
    });

  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create trade record'
    }, { status: 500 });
  }
}

/**
 * PUT /api/trades - Update trade record
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
    const validation = UpdateTradeSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid update data',
        details: validation.error.issues
      }, { status: 400 });
    }

    const updateData = validation.data;

    // Update trade with user validation
    await tradeDb.updateStatus(
      updateData.id, 
      updateData.status, 
      authResult.userId, 
      updateData.completedAt || undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'Trade record updated successfully'
      }
    });

  } catch (error) {
    console.error('Error updating trade:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Trade record not found or access denied'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update trade record'
    }, { status: 500 });
  }
}

/**
 * Calculate trade analytics
 */
function calculateTradeAnalytics(trades: Trade[]): any {
  const successfulTrades = trades.filter(trade => trade.status === 'SUCCESS');
  const failedTrades = trades.filter(trade => trade.status === 'FAILED');
  
  const totalTrades = trades.length;
  const successRate = totalTrades > 0 ? (successfulTrades.length / totalTrades) * 100 : 0;
  
  let totalVolumeIn = 0;
  let totalVolumeOut = 0;
  let totalProfit = 0;
  
  successfulTrades.forEach(trade => {
    totalVolumeIn += parseFloat(trade.amountIn);
    totalVolumeOut += parseFloat(trade.amountOut);
    if (trade.profit) {
      totalProfit += parseFloat(trade.profit);
    }
  });

  return {
    totalTrades,
    successfulTrades: successfulTrades.length,
    failedTrades: failedTrades.length,
    successRate: Number(successRate.toFixed(2)),
    totalVolumeIn: totalVolumeIn.toFixed(6),
    totalVolumeOut: totalVolumeOut.toFixed(6),
    totalProfit: totalProfit.toFixed(6),
    lastTradeAt: totalTrades > 0 ? trades[0].createdAt : null,
  };
} 
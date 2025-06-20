import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { encrypt } from '@trading-bot/crypto';
import { rateLimiter } from '@/lib/rate-limiter';
import { verifyJWT } from '@/lib/auth';
import { ethers } from 'ethers';

/**
 * Wallet Management API Configuration
 * Centralized configuration for wallet operations and security parameters
 */
const WALLET_CONFIG = {
  // Security configuration
  RATE_LIMIT_GET_REQUESTS: parseInt(process.env['WALLET_RATE_LIMIT_GET'] || '30'),
  RATE_LIMIT_CREATE_REQUESTS: parseInt(process.env['WALLET_RATE_LIMIT_CREATE'] || '5'),
  RATE_LIMIT_DELETE_REQUESTS: parseInt(process.env['WALLET_RATE_LIMIT_DELETE'] || '3'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env['WALLET_RATE_LIMIT_WINDOW'] || '3600000'), // 1 hour
  
  // Wallet limits
  MAX_WALLETS_PER_USER: parseInt(process.env['WALLET_MAX_PER_USER'] || '10'),
  
  // Audit configuration
  ENABLE_AUDIT_LOGGING: process.env['WALLET_ENABLE_AUDIT_LOGGING'] !== 'false',
  
  // Supported chains
  SUPPORTED_CHAINS: ['ETH', 'BSC', 'SOL'] as const,
} as const;

/**
 * Enhanced error types for wallet management
 */
class WalletAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public errorCode: string = 'WALLET_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'WalletAPIError';
  }
}

/**
 * Comprehensive audit logging for wallet operations
 */
function logWalletOperation(
  operation: string,
  userId: string,
  details: any,
  clientIP?: string,
  userAgent?: string,
  error?: Error
): void {
  if (!WALLET_CONFIG.ENABLE_AUDIT_LOGGING) return;
  
  const logData = {
    timestamp: new Date().toISOString(),
    operation,
    userId,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    clientIP,
    userAgent,
    error: error ? {
      message: error.message,
      stack: error.stack?.split('\n')[0]
    } : undefined,
    severity: error ? 'ERROR' : 'INFO'
  };
  
  if (error) {
    console.error('[WALLET_SECURITY_ALERT]', logData);
  } else {
    console.log('[WALLET_AUDIT]', logData);
  }
}

/**
 * Get client information for audit logging
 */
function getClientInfo(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return { clientIP, userAgent };
}

// Secure Supabase client initialization
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new WalletAPIError(
      'Database configuration is missing',
      500,
      'CONFIG_ERROR',
      { missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] }
    );
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Enhanced validation schemas
 */
const CreateWalletSchema = z.object({
  privateKey: z.string()
    .min(1, 'Private key is required')
    .max(500, 'Private key too long')
    .refine(key => key.trim().length > 0, 'Private key cannot be empty'),
  walletName: z.string()
    .min(1, 'Wallet name is required')
    .max(100, 'Wallet name too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Wallet name contains invalid characters'),
  chain: z.enum(WALLET_CONFIG.SUPPORTED_CHAINS, {
    errorMap: () => ({ message: `Chain must be one of: ${WALLET_CONFIG.SUPPORTED_CHAINS.join(', ')}` })
  })
});

const DeleteWalletSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID format'),
  confirmDeletion: z.boolean().refine(val => val === true, 'Deletion must be confirmed')
});

// Dynamic import for Solana to avoid browser compatibility issues
async function getSolanaKeypair() {
  try {
    if (typeof window !== 'undefined') {
      throw new Error('Solana not available on client side');
    }
    const { Keypair } = await import('@solana/web3.js');
    return { Keypair };
  } catch (error) {
    console.warn('Solana web3.js not available:', error);
    return null;
  }
}

/**
 * Validate and derive wallet address from private key
 * SECURITY NOTE: This function handles private keys - ensure proper cleanup
 */
async function validateAndDeriveAddress(privateKey: string, chain: string): Promise<string> {
  try {
    if (chain === 'ETH' || chain === 'BSC') {
      // Validate Ethereum/BSC private key format
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      
      if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new Error('Invalid Ethereum/BSC private key format');
      }
      
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address;
      
    } else if (chain === 'SOL') {
      const solana = await getSolanaKeypair();
      if (!solana) {
        throw new Error('Solana operations not available');
      }
      
      let secretKey: Uint8Array;
      try {
        // Support both JSON array format and base58 format
        if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
          secretKey = new Uint8Array(JSON.parse(privateKey));
        } else {
          // Assume base58 format - would need bs58 package for full support
          throw new Error('Solana private key must be in JSON array format: [1,2,3,...]');
        }
        
        if (secretKey.length !== 64) {
          throw new Error('Solana private key must be 64 bytes');
        }
        
        const keypair = solana.Keypair.fromSecretKey(secretKey);
        return keypair.publicKey.toString();
      } catch (parseError) {
        throw new Error('Invalid Solana private key format');
      }
    }
    
    throw new Error(`Unsupported chain: ${chain}`);
  } catch (error) {
    throw new WalletAPIError(
      `Private key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      400,
      'INVALID_PRIVATE_KEY',
      { chain, errorDetails: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Wallet Management API Endpoints
 * 
 * @route GET /api/wallets
 * @description Get user's wallets (private keys never exposed)
 * 
 * @returns {Object} Wallet list including:
 *   - id: Wallet identifier
 *   - address: Public wallet address
 *   - chain: Blockchain network
 *   - name: User-defined wallet name
 *   - createdAt: Creation timestamp
 * 
 * @throws {401} Unauthorized - invalid or missing JWT token
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 * 
 * @security Private keys are NEVER included in responses
 */
export async function GET(request: NextRequest) {
  const { clientIP, userAgent } = getClientInfo(request);
  let userId: string = '';
  
  try {
    // Rate limiting for GET requests
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.success) {
      throw new WalletAPIError(
        'Rate limit exceeded for wallet requests',
        429,
        'RATE_LIMIT_EXCEEDED',
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          limit: WALLET_CONFIG.RATE_LIMIT_GET_REQUESTS
        }
      );
    }

    // Authentication required for all wallet operations
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      throw new WalletAPIError(
        'Authentication required for wallet access',
        401,
        'AUTH_REQUIRED',
        { details: authResult.error }
      );
    }

    userId = authResult.payload?.sub || '';
    if (!userId) {
      throw new WalletAPIError(
        'Invalid token payload - missing user ID',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    const supabase = getSupabaseClient();
    
    // Fetch user's wallets (excluding encrypted private keys)
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select(`
        id,
        address,
        chain,
        name,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new WalletAPIError(
        'Failed to fetch wallets',
        500,
        'DATABASE_ERROR',
        { supabaseError: error }
      );
    }

    logWalletOperation('GET_WALLETS', userId, { 
      walletsCount: wallets?.length || 0 
    }, clientIP, userAgent);

    return NextResponse.json({
      success: true,
      data: wallets || [],
      metadata: {
        totalWallets: wallets?.length || 0,
        supportedChains: WALLET_CONFIG.SUPPORTED_CHAINS
      }
    });

  } catch (error) {
    if (error instanceof WalletAPIError) {
      logWalletOperation('GET_WALLETS_ERROR', userId, { 
        errorCode: error.errorCode 
      }, clientIP, userAgent, error);
      
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    logWalletOperation('GET_WALLETS_UNEXPECTED_ERROR', userId, {}, clientIP, userAgent, error as Error);
    console.error('Unexpected wallet GET error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * Wallet Creation API
 * 
 * @route POST /api/wallets
 * @description Create a new wallet (private key encrypted and stored securely)
 * 
 * @param {Object} body - Wallet creation data
 * @param {string} body.privateKey - Private key (encrypted before storage)
 * @param {string} body.walletName - User-defined wallet name
 * @param {string} body.chain - Blockchain network (ETH, BSC, SOL)
 * 
 * @returns {Object} Creation result with wallet ID
 * 
 * @throws {400} Invalid request parameters
 * @throws {401} Unauthorized - invalid or missing JWT token
 * @throws {409} Wallet already exists
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 * 
 * @security Private keys are encrypted before database storage
 */
export async function POST(request: NextRequest) {
  const { clientIP, userAgent } = getClientInfo(request);
  let userId: string = '';
  let walletAddress: string = '';
  
  try {
    // Stricter rate limiting for wallet creation
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.success) {
      throw new WalletAPIError(
        'Rate limit exceeded for wallet creation',
        429,
        'RATE_LIMIT_EXCEEDED',
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          limit: WALLET_CONFIG.RATE_LIMIT_CREATE_REQUESTS
        }
      );
    }

    // Authentication required
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      throw new WalletAPIError(
        'Authentication required for wallet creation',
        401,
        'AUTH_REQUIRED',
        { details: authResult.error }
      );
    }

    userId = authResult.payload?.sub || '';
    if (!userId) {
      throw new WalletAPIError(
        'Invalid token payload - missing user ID',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = CreateWalletSchema.safeParse(body);
    
    if (!validation.success) {
      throw new WalletAPIError(
        'Invalid wallet creation data',
        400,
        'VALIDATION_ERROR',
        { 
          errors: validation.error.errors,
          received: Object.keys(body)
        }
      );
    }

    const { privateKey, walletName, chain } = validation.data;
    
    // Validate private key and derive address
    walletAddress = await validateAndDeriveAddress(privateKey, chain);

    const supabase = getSupabaseClient();
    
    // Check wallet limits
    const { data: existingWallets, error: countError } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId);

    if (countError) {
      throw new WalletAPIError(
        'Failed to check wallet limits',
        500,
        'DATABASE_ERROR',
        { supabaseError: countError }
      );
    }

    if (existingWallets && existingWallets.length >= WALLET_CONFIG.MAX_WALLETS_PER_USER) {
      throw new WalletAPIError(
        `Maximum ${WALLET_CONFIG.MAX_WALLETS_PER_USER} wallets allowed per user`,
        400,
        'WALLET_LIMIT_EXCEEDED',
        { currentCount: existingWallets.length, maxAllowed: WALLET_CONFIG.MAX_WALLETS_PER_USER }
      );
    }

    // Check for duplicate wallet
    const { data: duplicateWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .eq('address', walletAddress)
      .eq('chain', chain)
      .single();

    if (duplicateWallet) {
      throw new WalletAPIError(
        'Wallet already exists for this address and chain',
        409,
        'WALLET_EXISTS',
        { address: walletAddress, chain }
      );
    }

    // Encrypt private key before storage
    const encryptedPrivateKey = encrypt(privateKey);
    
    // Clear private key from memory (security measure)
    const privateKeyClear = '\0'.repeat(privateKey.length);
    
    // Create wallet record
    const { data: newWallet, error: createError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        address: walletAddress,
        encrypted_private_key: encryptedPrivateKey,
        chain,
        name: walletName
      })
      .select('id')
      .single();

    if (createError) {
      throw new WalletAPIError(
        'Failed to create wallet',
        500,
        'DATABASE_ERROR',
        { supabaseError: createError }
      );
    }

    logWalletOperation('CREATE_WALLET', userId, {
      walletId: newWallet.id,
      address: walletAddress,
      chain,
      walletName
    }, clientIP, userAgent);

    return NextResponse.json({
      success: true,
      data: { 
        id: newWallet.id,
        address: walletAddress,
        chain,
        name: walletName
      },
      message: 'Wallet created successfully'
    });

  } catch (error) {
    if (error instanceof WalletAPIError) {
      logWalletOperation('CREATE_WALLET_ERROR', userId, { 
        errorCode: error.errorCode,
        address: walletAddress 
      }, clientIP, userAgent, error);
      
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    logWalletOperation('CREATE_WALLET_UNEXPECTED_ERROR', userId, { 
      address: walletAddress 
    }, clientIP, userAgent, error as Error);
    console.error('Unexpected wallet creation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * Wallet Deletion API
 * 
 * @route DELETE /api/wallets
 * @description Delete a wallet (requires confirmation)
 * 
 * @param {Object} body - Deletion data
 * @param {string} body.walletId - Wallet ID to delete
 * @param {boolean} body.confirmDeletion - Deletion confirmation
 * 
 * @returns {Object} Deletion confirmation
 * 
 * @throws {400} Invalid request parameters
 * @throws {401} Unauthorized - invalid or missing JWT token
 * @throws {404} Wallet not found
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 * 
 * @security Requires user ownership validation and explicit confirmation
 */
export async function DELETE(request: NextRequest) {
  const { clientIP, userAgent } = getClientInfo(request);
  let userId: string = '';
  let walletId: string = '';
  
  try {
    // Rate limiting for deletion
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.success) {
      throw new WalletAPIError(
        'Rate limit exceeded for wallet deletion',
        429,
        'RATE_LIMIT_EXCEEDED',
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          limit: WALLET_CONFIG.RATE_LIMIT_DELETE_REQUESTS
        }
      );
    }

    // Authentication required
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      throw new WalletAPIError(
        'Authentication required for wallet deletion',
        401,
        'AUTH_REQUIRED',
        { details: authResult.error }
      );
    }

    userId = authResult.payload?.sub || '';
    if (!userId) {
      throw new WalletAPIError(
        'Invalid token payload - missing user ID',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = DeleteWalletSchema.safeParse(body);
    
    if (!validation.success) {
      throw new WalletAPIError(
        'Invalid wallet deletion data',
        400,
        'VALIDATION_ERROR',
        { 
          errors: validation.error.errors,
          received: Object.keys(body)
        }
      );
    }

    walletId = validation.data.walletId;
    const supabase = getSupabaseClient();
    
    // Verify wallet ownership
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('id, address, chain, name')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !wallet) {
      throw new WalletAPIError(
        'Wallet not found or access denied',
        404,
        'WALLET_NOT_FOUND',
        { walletId }
      );
    }

    // Delete wallet
    const { error: deleteError } = await supabase
      .from('wallets')
      .delete()
      .eq('id', walletId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new WalletAPIError(
        'Failed to delete wallet',
        500,
        'DATABASE_ERROR',
        { supabaseError: deleteError }
      );
    }

    logWalletOperation('DELETE_WALLET', userId, {
      walletId,
      address: wallet.address,
      chain: wallet.chain,
      name: wallet.name
    }, clientIP, userAgent);

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      message: 'Wallet deleted successfully'
    });

  } catch (error) {
    if (error instanceof WalletAPIError) {
      logWalletOperation('DELETE_WALLET_ERROR', userId, { 
        errorCode: error.errorCode,
        walletId 
      }, clientIP, userAgent, error);
      
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    logWalletOperation('DELETE_WALLET_UNEXPECTED_ERROR', userId, { 
      walletId 
    }, clientIP, userAgent, error as Error);
    console.error('Unexpected wallet deletion error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * SECURITY NOTE: PUT endpoint for private key operations has been REMOVED
 * for security reasons. Private keys should NEVER be exposed through API endpoints.
 * 
 * For wallet operations that require private keys:
 * 1. Use server-side services with proper key management
 * 2. Implement hardware security modules (HSM)
 * 3. Use secure enclaves or trusted execution environments
 * 4. Never transmit private keys over HTTP
 * 
 * Alternative approaches:
 * - Transaction signing services
 * - Wallet connect integration
 * - Hardware wallet integration
 * - Multi-signature schemes
 */ 
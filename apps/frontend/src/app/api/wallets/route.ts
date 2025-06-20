import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { encrypt, decrypt, generateSecureRandom } from '@trading-bot/crypto';
import { verifyJWT } from '@/lib/auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { ethers } from 'ethers';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

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

// Validation schemas
const WalletCreateSchema = z.object({
  privateKey: z.string().min(1, 'Private key is required'),
  walletName: z.string().optional(),
  chain: z.enum(['ETH', 'BSC', 'SOL'], { invalid_type_error: 'Invalid chain. Must be ETH, BSC, or SOL' })
});

const WalletOperationSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID'),
  operation: z.enum(['validate_key'], { invalid_type_error: 'Invalid operation. Only validate_key is allowed' })
});

// Helper function to derive wallet address from private key
async function getWalletAddress(privateKey: string, chain: string): Promise<string> {
  try {
    if (chain === 'ETH' || chain === 'BSC') {
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address;
    } else if (chain === 'SOL') {
      const solana = await getSolanaKeypair();
      if (!solana) {
        throw new Error('Solana web3.js not available');
      }
      const secretKey = new Uint8Array(JSON.parse(privateKey));
      const keypair = solana.Keypair.fromSecretKey(secretKey);
      return keypair.publicKey.toString();
    }
    throw new Error(`Unsupported chain: ${chain}`);
  } catch (error) {
    throw new Error(`Invalid private key for chain ${chain}`);
  }
}

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

    // Get wallets from Supabase
    const supabase = getSupabaseClient();
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('id, user_id, address, chain, name, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wallets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wallets' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: wallets || []
    });

  } catch (error) {
    console.error('Error in GET wallets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for wallet creation)
    const rateLimitResult = await rateLimiter.check(request, 5, 60 * 60 * 1000); // 5 per hour
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
    const validationResult = WalletCreateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { privateKey, walletName, chain } = validationResult.data;

    // Derive wallet address from private key
    let address: string;
    try {
      address = await getWalletAddress(privateKey, chain);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Check if wallet already exists for this user
    const supabase = getSupabaseClient();
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .eq('address', address)
      .eq('chain', chain)
      .single();

    if (existingWallet) {
      return NextResponse.json(
        { error: 'Wallet already exists for this chain' },
        { status: 409 }
      );
    }

    // Encrypt the private key before storing
    const encryptedPrivateKey = encrypt(privateKey);

    // Generate secure wallet ID
    const walletId = `wallet_${Date.now()}_${generateSecureRandom(8)}`;

    // Create wallet in database
    const { data: newWallet, error: createError } = await supabase
      .from('wallets')
      .insert({
        id: walletId,
        user_id: userId,
        address,
        encrypted_private_key: encryptedPrivateKey,
        chain,
        name: walletName || `${chain} Wallet`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, user_id, address, chain, name, created_at, updated_at')
      .single();

    if (createError) {
      console.error('Error creating wallet:', createError);
      return NextResponse.json(
        { error: 'Failed to create wallet' },
        { status: 500 }
      );
    }

    console.log(`Wallet created for user ${userId}: ${chain} - ${address}`);

    return NextResponse.json({
      success: true,
      data: newWallet
    });

  } catch (error) {
    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet' },
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
    const walletId = searchParams.get('walletId');

    if (!walletId) {
      return NextResponse.json(
        { error: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    // Delete wallet (only if it belongs to the authenticated user)
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from('wallets')
      .delete()
      .eq('id', walletId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting wallet:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete wallet' },
        { status: 500 }
      );
    }

    console.log(`Wallet deleted by user ${userId}: ${walletId}`);

    return NextResponse.json({
      success: true,
      message: 'Wallet deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { error: 'Failed to delete wallet' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Stricter rate limiting for sensitive operations
    const rateLimitResult = await rateLimiter.check(request, 3, 60 * 60 * 1000); // 3 per hour
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
    const validationResult = WalletOperationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { walletId, operation } = validationResult.data;

    // Get wallet (only if it belongs to the authenticated user)
    const supabase = getSupabaseClient();
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, address, encrypted_private_key, chain')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet not found or access denied' },
        { status: 404 }
      );
    }

    // Handle operations
    if (operation === 'validate_key') {
      // Validate that the stored encrypted key can be decrypted and matches expected address
      try {
        const decryptedPrivateKey = decrypt(wallet.encrypted_private_key);
        const derivedAddress = await getWalletAddress(decryptedPrivateKey, wallet.chain);
        
        const isValid = derivedAddress.toLowerCase() === wallet.address.toLowerCase();
        
        // Log validation attempt for security monitoring
        console.log(`Wallet validation by user ${userId}: ${walletId} - ${isValid ? 'Valid' : 'Invalid'}`);

        return NextResponse.json({
          success: true,
          data: {
            address: wallet.address,
            isValid
          }
        });
      } catch (error) {
        console.error('Failed to validate wallet key:', error);
        return NextResponse.json(
          { error: 'Failed to validate wallet key' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid operation' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in wallet operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform wallet operation' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { encryptPrivateKey } from '@trading-bot/crypto';
import { z } from 'zod';

const createWalletSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  chain: z.enum(['ethereum', 'bsc', 'solana', 'polygon', 'arbitrum', 'optimism']),
  privateKey: z.string().min(1),
  walletType: z.enum(['imported', 'generated']).default('imported')
});

// GET /api/wallets - Get user's wallets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('wallets')
      .select('id, name, address, chain, wallet_type, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get wallets API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST /api/wallets - Create new wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = createWalletSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { name, address, chain, privateKey, walletType } = validationResult.data;
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Encrypt the private key
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKey) {
      return NextResponse.json({
        success: false,
        error: 'Encryption configuration error'
      }, { status: 500 });
    }

    const encryptedPrivateKey = encryptPrivateKey(privateKey, masterKey);

    // Insert wallet into database
    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        name,
        address,
        chain,
        encrypted_private_key: encryptedPrivateKey.content,
        wallet_type: walletType,
        is_active: true
      })
      .select('id, name, address, chain, wallet_type, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Wallet added successfully'
    });

  } catch (error) {
    console.error('Create wallet API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
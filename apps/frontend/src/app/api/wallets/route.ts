import { NextRequest, NextResponse } from 'next/server';
import { encrypt, decrypt } from '@trading-bot/crypto';
import { walletDb } from '../../../lib/database';
import { Wallet, ApiResponse, Chain } from '@trading-bot/types';
import { ethers } from 'ethers';

// Dynamic import for Solana to avoid browser compatibility issues
async function getSolanaKeypair() {
  try {
    const { Keypair } = await import('@solana/web3.js');
    return { Keypair };
  } catch (error) {
    console.warn('Solana web3.js not available:', error);
    return null;
  }
}

// Helper function to derive wallet address from private key
async function getWalletAddress(privateKey: string, chain: Chain): Promise<string> {
  try {
    if (chain === 'ETH' || chain === 'BSC') {
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address;
    } else if (chain === 'SOL') {
      // For Solana, we expect the private key to be a JSON string of the secret key array
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

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }
    
    const wallets = walletDb.findByUserId(userId);
    
    // Remove encrypted private keys from response for security
    const safeWallets = wallets.map(wallet => {
      const { encryptedPrivateKey, ...safeWallet } = wallet;
      return safeWallet;
    });
    
    return NextResponse.json({ 
      success: true, 
      data: safeWallets 
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch wallets' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const { privateKey, walletName, chain, userId } = await request.json();
    
    if (!privateKey || !chain || !userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Private key, chain, and user ID are required' 
      }, { status: 400 });
    }
    
    // Validate chain
    if (!['ETH', 'BSC', 'SOL'].includes(chain)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid chain. Must be ETH, BSC, or SOL' 
      }, { status: 400 });
    }
    
    // Derive wallet address from private key
    let address: string;
    try {
      address = await getWalletAddress(privateKey, chain);
    } catch (error: any) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 400 });
    }
    
    // Check if wallet already exists for this user
    const existingWallets = walletDb.findByUserId(userId);
    if (existingWallets.some(w => w.address === address && w.chain === chain)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet already exists for this chain' 
      }, { status: 400 });
    }
    
    // Encrypt the private key before storing
    const encryptedPrivateKey = encrypt(privateKey);
    
    // Generate wallet ID
    const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newWallet: Omit<Wallet, 'createdAt'> = {
      id: walletId,
      userId,
      address,
      encryptedPrivateKey,
      chain,
      name: walletName || `${chain} Wallet`,
    };
    
    walletDb.create(newWallet);
    
    return NextResponse.json({ 
      success: true, 
      data: { id: walletId },
    });
  } catch (error) {
    console.error('Error adding wallet:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to add wallet' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<boolean>>> {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    
    if (!walletId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet ID is required' 
      }, { status: 400 });
    }
    
    walletDb.delete(walletId);
    
    return NextResponse.json({ 
      success: true, 
      data: true 
    });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete wallet' 
    }, { status: 500 });
  }
}

// Get decrypted private key (for internal bot use only)
export async function getDecryptedPrivateKey(walletId: string): Promise<string | null> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) return null;
    
    return decrypt(wallet.encryptedPrivateKey);
  } catch (error) {
    console.error('Error decrypting private key:', error);
    return null;
  }
} 
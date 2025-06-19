import { NextRequest, NextResponse } from 'next/server';
import { encrypt, decrypt } from '@trading-bot/crypto';
import { walletDb } from '../../../lib/database';
import { Wallet, ApiResponse, Chain } from '@trading-bot/types';
import { ethers } from 'ethers';

// Dynamic import for Solana to avoid browser compatibility issues
async function getSolanaKeypair() {
  try {
    // Only import on server-side and when actually needed
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

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<{ privateKey?: string; address: string }>>> {
  try {
    const { walletId, userId, operation } = await request.json();
    
    if (!walletId || !userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet ID and User ID are required' 
      }, { status: 400 });
    }
    
    // Find the wallet
    const wallets = walletDb.findByUserId(userId);
    const wallet = wallets.find(w => w.id === walletId);
    
    if (!wallet) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet not found' 
      }, { status: 404 });
    }
    
    // Handle different operations
    if (operation === 'getPrivateKey') {
      // This is a sensitive operation - in production, add additional security checks
      // such as 2FA, rate limiting, audit logging, etc.
      console.log(`Decrypting private key for wallet ${walletId} by user ${userId}`);
      
      try {
        const decryptedPrivateKey = decrypt(wallet.encryptedPrivateKey);
        
        // Return the decrypted private key (use with extreme caution)
        return NextResponse.json({ 
          success: true, 
          data: { 
            privateKey: decryptedPrivateKey,
            address: wallet.address
          }
        });
      } catch (error) {
        console.error('Failed to decrypt private key:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to decrypt private key' 
        }, { status: 500 });
      }
    } else if (operation === 'validateKey') {
      // Validate that the stored encrypted key can be decrypted and matches expected address
      try {
        const decryptedPrivateKey = decrypt(wallet.encryptedPrivateKey);
        const derivedAddress = await getWalletAddress(decryptedPrivateKey, wallet.chain);
        
        const isValid = derivedAddress.toLowerCase() === wallet.address.toLowerCase();
        
        return NextResponse.json({ 
          success: true, 
          data: { 
            address: wallet.address,
            isValid
          }
        });
      } catch (error) {
        console.error('Failed to validate wallet key:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to validate wallet key' 
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid operation. Supported operations: getPrivateKey, validateKey' 
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in wallet operation:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to perform wallet operation' 
    }, { status: 500 });
  }
} 
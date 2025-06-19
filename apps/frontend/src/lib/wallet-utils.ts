import { decrypt } from '@trading-bot/crypto';
import { walletDb } from './database';

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
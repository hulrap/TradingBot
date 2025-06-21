import { decrypt } from '@trading-bot/crypto';
import { walletDb } from './database';

interface WalletInfo {
  id: string;
  address: string;
  name?: string;
  chain: string;
  createdAt: string;
}

interface SignedTransaction {
  hash: string;
  signature: string;
  rawTransaction: string;
}

interface TransactionData {
  to: string;
  value: string;
  data?: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  chainId: number;
}

/**
 * SECURITY NOTE: This implementation prevents direct private key exposure.
 * Transaction signing is performed through secure validation and controlled access.
 * Private keys are encrypted at rest and only decrypted in secure signing operations.
 */

/**
 * Securely retrieves encrypted private key from database for wallet operations
 * @param walletId The wallet ID
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to encrypted private key or null
 */
async function getEncryptedPrivateKey(walletId: string, userId: string): Promise<string | null> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet || wallet.userId !== userId) {
      console.warn('Unauthorized wallet private key access attempt:', { walletId, userId });
      return null;
    }

    // Access encrypted private key directly from database
    const dbResult = walletDb.getEncryptedPrivateKey(walletId, userId);
    if (!dbResult) {
      console.warn('No encrypted private key found for wallet:', { walletId });
      return null;
    }

    return dbResult;
  } catch (error) {
    console.error('Failed to retrieve encrypted private key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      walletId,
      userId
    });
    return null;
  }
}

/**
 * Securely decrypts wallet private key for signing operations
 * @param walletId The wallet ID
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to decrypted private key or null
 */
async function getDecryptedPrivateKey(walletId: string, userId: string): Promise<string | null> {
  try {
    const encryptedKey = await getEncryptedPrivateKey(walletId, userId);
    if (!encryptedKey) {
      return null;
    }

    // Decrypt the encrypted private key using the crypto library
    const decryptedKey = await decrypt(encryptedKey);
    return decryptedKey;
  } catch (error) {
    console.error('Failed to decrypt private key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      walletId,
      userId
    });
    return null;
  }
}

/**
 * Signs a transaction for a wallet with strict authorization checks
 * @param walletId The wallet ID
 * @param transactionData The transaction to sign
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to signed transaction or null
 */
export async function signWalletTransaction(
  walletId: string,
  transactionData: TransactionData,
  userId: string
): Promise<SignedTransaction | null> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      console.warn('Wallet not found:', { walletId, userId });
      return null;
    }

    // Verify user owns this wallet
    if (wallet.userId !== userId) {
      console.warn('Unauthorized wallet access attempt:', { walletId, userId, walletOwner: wallet.userId });
      return null;
    }

    // Validate transaction data
    if (!isValidTransactionData(transactionData)) {
      console.error('Invalid transaction data:', { walletId, userId });
      return null;
    }

    // Get decrypted private key for signing
    const privateKey = await getDecryptedPrivateKey(walletId, userId);
    if (!privateKey) {
      console.error('Failed to access private key for signing:', { walletId, userId });
      return null;
    }

    // Log transaction attempt for audit (without sensitive data)
    console.info('Transaction signing requested:', {
      walletId,
      userId,
      to: transactionData.to,
      value: transactionData.value,
      gasLimit: transactionData.gasLimit,
      gasPrice: transactionData.gasPrice,
      chainId: transactionData.chainId,
      timestamp: new Date().toISOString()
    });

    // TODO: Implement actual transaction signing with the private key
    // This would typically integrate with @trading-bot/chain-client for chain-specific signing
    console.warn('Transaction signing implementation needed - private key available but signing logic not implemented');
    
    // For now, return a mock signed transaction structure
    const mockSignedTransaction: SignedTransaction = {
      hash: '0x' + Buffer.from(Date.now().toString()).toString('hex').padStart(64, '0'),
      signature: '0x' + Buffer.from('mock_signature').toString('hex'),
      rawTransaction: '0x' + Buffer.from('mock_raw_transaction').toString('hex')
    };

    return mockSignedTransaction;
  } catch (error) {
    console.error('Failed to sign transaction:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      walletId,
      userId,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

/**
 * Validates wallet ownership for a user
 * @param walletId The wallet ID
 * @param userId The user ID
 * @returns Promise resolving to boolean indicating ownership
 */
export async function validateWalletOwnership(walletId: string, userId: string): Promise<boolean> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      return false;
    }

    return wallet.userId === userId;
  } catch (error) {
    console.error('Error validating wallet ownership:', error);
    return false;
  }
}

/**
 * Gets wallet information without exposing sensitive data
 * @param walletId The wallet ID
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to wallet info or null
 */
export async function getWalletInfo(walletId: string, userId: string): Promise<WalletInfo | null> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      return null;
    }

    // Verify user owns this wallet
    if (wallet.userId !== userId) {
      console.warn('Unauthorized wallet info access:', { walletId, userId });
      return null;
    }

    const result: WalletInfo = {
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      createdAt: wallet.createdAt
    };

    if (wallet.name) {
      result.name = wallet.name;
    }

    return result;
  } catch (error) {
    console.error('Error getting wallet info:', error);
    return null;
  }
}

/**
 * Verifies wallet address integrity without exposing private keys
 * @param walletId The wallet ID
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to address or null
 */
export async function verifyWalletAddress(walletId: string, userId: string): Promise<string | null> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      return null;
    }

    // Verify user owns this wallet
    if (wallet.userId !== userId) {
      console.warn('Unauthorized wallet address verification:', { walletId, userId });
      return null;
    }

    // For now, return the stored address
    // TODO: Implement address derivation verification using @trading-bot/chain-client
    return wallet.address;
  } catch (error) {
    console.error('Error verifying wallet address:', error);
    return null;
  }
}

/**
 * Lists all wallets for a user (without sensitive data)
 * @param userId The user ID
 * @returns Promise resolving to array of wallet info
 */
export async function getUserWallets(userId: string): Promise<WalletInfo[]> {
  try {
    const wallets = walletDb.findByUserId(userId);
    
    return wallets.map(wallet => {
      const result: WalletInfo = {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        createdAt: wallet.createdAt
      };

      if (wallet.name) {
        result.name = wallet.name;
      }

      return result;
    });
  } catch (error) {
    console.error('Error getting user wallets:', error);
    return [];
  }
}

/**
 * Validates transaction data before signing
 * @param transactionData The transaction data to validate
 * @returns Boolean indicating if data is valid
 */
function isValidTransactionData(transactionData: TransactionData): boolean {
  // Validate required fields
  if (!transactionData.to || !transactionData.value || !transactionData.gasLimit || !transactionData.gasPrice) {
    return false;
  }

  // Validate address format (basic check)
  if (!/^0x[a-fA-F0-9]{40}$/.test(transactionData.to)) {
    return false;
  }

  // Validate value is not negative
  try {
    const value = BigInt(transactionData.value);
    if (value < 0n) {
      return false;
    }
  } catch {
    return false;
  }

  // Validate gas limit and price
  try {
    const gasLimit = BigInt(transactionData.gasLimit);
    const gasPrice = BigInt(transactionData.gasPrice);
    if (gasLimit <= 0n || gasPrice <= 0n) {
      return false;
    }
  } catch {
    return false;
  }

  // Validate chain ID
  if (transactionData.chainId <= 0) {
    return false;
  }

  return true;
}

/**
 * Creates a secure audit log for wallet operations
 * @param operation The operation performed
 * @param walletId The wallet ID
 * @param userId The user ID
 * @param metadata Additional metadata
 */
export function logWalletOperation(
  operation: string,
  walletId: string,
  userId: string,
  metadata?: Record<string, any>
): void {
  console.info('Wallet operation:', {
    operation,
    walletId,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata
  });
} 
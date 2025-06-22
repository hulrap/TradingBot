import { decrypt } from '@trading-bot/crypto';
import { walletDb } from './database';

// Import proper types and utilities from packages folder
import { 
  createChainClient, 
  signTransaction as chainSignTransaction,
  verifyAddress as chainVerifyAddress,
  type TransactionRequest,
  type SignedTransaction as ChainSignedTransaction,
  type ChainClientConfig
} from '@trading-bot/chain-client';
import { isValidEthereumAddress, type ChainType } from '@trading-bot/types';

// Enhanced wallet interfaces aligned with packages
interface WalletInfo {
  id: string;
  address: string;
  name?: string;
  chain: ChainType;
  balance?: string;
  nonce?: number;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

interface SignedTransaction {
  hash: string;
  signature: string;
  rawTransaction: string;
  gasUsed?: string;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  status: 'pending' | 'confirmed' | 'failed';
}

interface TransactionData {
  to: string;
  value: string;
  data?: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  chainId: number;
  type?: 0 | 1 | 2; // Transaction type (Legacy, EIP-2930, EIP-1559)
}

interface WalletValidationResult {
  isValid: boolean;
  address?: string;
  derivedAddress?: string;
  addressMatch: boolean;
  errors?: string[];
}

interface WalletOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// Cache for chain clients to avoid creating new instances
const chainClientCache = new Map<string, any>();

/**
 * SECURITY NOTE: This implementation prevents direct private key exposure.
 * Transaction signing is performed through secure validation and controlled access.
 * Private keys are encrypted at rest and only decrypted in secure signing operations.
 */

/**
 * Gets or creates a chain client for the specified chain
 * @param chain The blockchain to get client for
 * @param privateKey Optional private key for signing operations
 * @returns Chain client instance
 */
async function getChainClient(chain: ChainType, privateKey?: string): Promise<any> {
  const cacheKey = `${chain}-${privateKey ? 'with-key' : 'read-only'}`;
  
  if (chainClientCache.has(cacheKey)) {
    return chainClientCache.get(cacheKey);
  }

  const config: ChainClientConfig = {
    chain,
    rpcUrl: getRpcUrl(chain),
    privateKey: privateKey,
    options: {
      timeout: 30000,
      retries: 3,
      cacheTtl: 60000
    }
  };

  try {
    const client = await createChainClient(config);
    chainClientCache.set(cacheKey, client);
    return client;
  } catch (error) {
    console.error('Failed to create chain client:', { chain, error });
    throw new Error(`Failed to create chain client for ${chain}`);
  }
}

/**
 * Gets RPC URL for the specified chain
 * @param chain The blockchain
 * @returns RPC URL string
 */
function getRpcUrl(chain: ChainType): string {
  const rpcUrls: Record<ChainType, string> = {
    'ETHEREUM': process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/${INFURA_KEY}',
    'BSC': process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    'POLYGON': process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/',
    'ARBITRUM': process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    'OPTIMISM': process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    'SOLANA': process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  };

  return rpcUrls[chain] || rpcUrls['ETHEREUM'];
}

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
      logWalletOperation('PRIVATE_KEY_ACCESS_DENIED', walletId, userId, { reason: 'unauthorized' });
      return null;
    }

    // Access encrypted private key directly from database
    const dbResult = walletDb.getEncryptedPrivateKey(walletId, userId);
    if (!dbResult) {
      console.warn('No encrypted private key found for wallet:', { walletId });
      logWalletOperation('PRIVATE_KEY_NOT_FOUND', walletId, userId);
      return null;
    }

    logWalletOperation('PRIVATE_KEY_ACCESSED', walletId, userId);
    return dbResult;
  } catch (error) {
    console.error('Failed to retrieve encrypted private key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      walletId,
      userId
    });
    logWalletOperation('PRIVATE_KEY_ACCESS_ERROR', walletId, userId, { error: error instanceof Error ? error.message : 'Unknown error' });
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
    logWalletOperation('PRIVATE_KEY_DECRYPTED', walletId, userId);
    return decryptedKey;
  } catch (error) {
    console.error('Failed to decrypt private key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      walletId,
      userId
    });
    logWalletOperation('PRIVATE_KEY_DECRYPT_ERROR', walletId, userId, { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

/**
 * Signs a transaction for a wallet with strict authorization checks using chain client
 * @param walletId The wallet ID
 * @param transactionData The transaction to sign
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to signed transaction result
 */
export async function signWalletTransaction(
  walletId: string,
  transactionData: TransactionData,
  userId: string
): Promise<WalletOperationResult<SignedTransaction>> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      console.warn('Wallet not found:', { walletId, userId });
      logWalletOperation('SIGN_TRANSACTION_WALLET_NOT_FOUND', walletId, userId);
      return { success: false, error: 'Wallet not found' };
    }

    // Verify user owns this wallet
    if (wallet.userId !== userId) {
      console.warn('Unauthorized wallet access attempt:', { walletId, userId, walletOwner: wallet.userId });
      logWalletOperation('SIGN_TRANSACTION_UNAUTHORIZED', walletId, userId, { walletOwner: wallet.userId });
      return { success: false, error: 'Unauthorized wallet access' };
    }

    // Validate transaction data
    const validationResult = validateTransactionData(transactionData);
    if (!validationResult.isValid) {
      console.error('Invalid transaction data:', { walletId, userId, errors: validationResult.errors });
      logWalletOperation('SIGN_TRANSACTION_INVALID_DATA', walletId, userId, { errors: validationResult.errors });
      return { success: false, error: 'Invalid transaction data', warnings: validationResult.errors };
    }

    // Get decrypted private key for signing
    const privateKey = await getDecryptedPrivateKey(walletId, userId);
    if (!privateKey) {
      console.error('Failed to access private key for signing:', { walletId, userId });
      logWalletOperation('SIGN_TRANSACTION_PRIVATE_KEY_ERROR', walletId, userId);
      return { success: false, error: 'Failed to access private key' };
    }

    // Get chain client with private key for signing
    const chainClient = await getChainClient(wallet.chain as ChainType, privateKey);

    // Prepare transaction request for chain client
    const transactionRequest: TransactionRequest = {
      to: transactionData.to,
      value: transactionData.value,
      data: transactionData.data,
      gasLimit: transactionData.gasLimit,
      gasPrice: transactionData.gasPrice,
      maxFeePerGas: transactionData.maxFeePerGas,
      maxPriorityFeePerGas: transactionData.maxPriorityFeePerGas,
      nonce: transactionData.nonce,
      chainId: transactionData.chainId,
      type: transactionData.type
    };

    // Log transaction attempt for audit (without sensitive data)
    logWalletOperation('SIGN_TRANSACTION_STARTED', walletId, userId, {
      to: transactionData.to,
      value: transactionData.value,
      gasLimit: transactionData.gasLimit,
      gasPrice: transactionData.gasPrice,
      chainId: transactionData.chainId,
      chain: wallet.chain
    });

    // Sign transaction using chain client
    const signedTransaction: ChainSignedTransaction = await chainSignTransaction(chainClient, transactionRequest);

    // Transform chain client result to our interface
    const result: SignedTransaction = {
      hash: signedTransaction.hash,
      signature: signedTransaction.signature,
      rawTransaction: signedTransaction.rawTransaction,
      gasUsed: signedTransaction.gasUsed,
      blockNumber: signedTransaction.blockNumber,
      blockHash: signedTransaction.blockHash,
      transactionIndex: signedTransaction.transactionIndex,
      status: signedTransaction.status || 'pending'
    };

    // Update wallet last used timestamp
    walletDb.updateLastUsed(walletId);

    logWalletOperation('SIGN_TRANSACTION_SUCCESS', walletId, userId, {
      hash: result.hash,
      gasUsed: result.gasUsed,
      status: result.status
    });

    return { success: true, data: result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to sign transaction:', {
      error: errorMessage,
      walletId,
      userId,
      timestamp: new Date().toISOString()
    });
    logWalletOperation('SIGN_TRANSACTION_ERROR', walletId, userId, { error: errorMessage });
    return { success: false, error: `Transaction signing failed: ${errorMessage}` };
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
      logWalletOperation('VALIDATE_OWNERSHIP_WALLET_NOT_FOUND', walletId, userId);
      return false;
    }

    const isOwner = wallet.userId === userId;
    logWalletOperation('VALIDATE_OWNERSHIP', walletId, userId, { isOwner });
    return isOwner;
  } catch (error) {
    console.error('Error validating wallet ownership:', error);
    logWalletOperation('VALIDATE_OWNERSHIP_ERROR', walletId, userId, { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

/**
 * Gets comprehensive wallet information with real-time blockchain data
 * @param walletId The wallet ID
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to wallet operation result with info
 */
export async function getWalletInfo(walletId: string, userId: string): Promise<WalletOperationResult<WalletInfo>> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      logWalletOperation('GET_WALLET_INFO_NOT_FOUND', walletId, userId);
      return { success: false, error: 'Wallet not found' };
    }

    // Verify user owns this wallet
    if (wallet.userId !== userId) {
      console.warn('Unauthorized wallet info access:', { walletId, userId });
      logWalletOperation('GET_WALLET_INFO_UNAUTHORIZED', walletId, userId);
      return { success: false, error: 'Unauthorized wallet access' };
    }

    // Get real-time balance and nonce from blockchain
    try {
      const chainClient = await getChainClient(wallet.chain as ChainType);
      const [balance, nonce] = await Promise.all([
        chainClient.getBalance(wallet.address),
        chainClient.getTransactionCount(wallet.address)
      ]);

      const walletInfo: WalletInfo = {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain as ChainType,
        balance: balance.toString(),
        nonce: nonce,
        isActive: wallet.isActive || true,
        createdAt: wallet.createdAt,
        lastUsed: wallet.lastUsed
      };

      if (wallet.name) {
        walletInfo.name = wallet.name;
      }

      logWalletOperation('GET_WALLET_INFO_SUCCESS', walletId, userId, { balance, nonce });
      return { success: true, data: walletInfo };

    } catch (blockchainError) {
      // Fallback to database info if blockchain call fails
      const walletInfo: WalletInfo = {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain as ChainType,
        isActive: wallet.isActive || true,
        createdAt: wallet.createdAt,
        lastUsed: wallet.lastUsed
      };

      if (wallet.name) {
        walletInfo.name = wallet.name;
      }

      logWalletOperation('GET_WALLET_INFO_BLOCKCHAIN_ERROR', walletId, userId, { 
        error: blockchainError instanceof Error ? blockchainError.message : 'Unknown blockchain error'
      });

      return { 
        success: true, 
        data: walletInfo, 
        warnings: ['Could not fetch real-time blockchain data'] 
      };
    }

  } catch (error) {
    console.error('Error getting wallet info:', error);
    logWalletOperation('GET_WALLET_INFO_ERROR', walletId, userId, { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: 'Failed to get wallet information' };
  }
}

/**
 * Verifies wallet address integrity using chain client address derivation
 * @param walletId The wallet ID
 * @param userId The user ID (for authorization)
 * @returns Promise resolving to wallet validation result
 */
export async function verifyWalletAddress(walletId: string, userId: string): Promise<WalletOperationResult<WalletValidationResult>> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet) {
      logWalletOperation('VERIFY_ADDRESS_WALLET_NOT_FOUND', walletId, userId);
      return { success: false, error: 'Wallet not found' };
    }

    // Verify user owns this wallet
    if (wallet.userId !== userId) {
      console.warn('Unauthorized wallet address verification:', { walletId, userId });
      logWalletOperation('VERIFY_ADDRESS_UNAUTHORIZED', walletId, userId);
      return { success: false, error: 'Unauthorized wallet access' };
    }

    // Validate address format first
    if (!isValidEthereumAddress(wallet.address)) {
      logWalletOperation('VERIFY_ADDRESS_INVALID_FORMAT', walletId, userId, { address: wallet.address });
      return { 
        success: true, 
        data: {
          isValid: false,
          address: wallet.address,
          addressMatch: false,
          errors: ['Invalid address format']
        }
      };
    }

    // Get private key for address derivation verification
    const privateKey = await getDecryptedPrivateKey(walletId, userId);
    if (!privateKey) {
      logWalletOperation('VERIFY_ADDRESS_PRIVATE_KEY_ERROR', walletId, userId);
      return { success: false, error: 'Failed to access private key for verification' };
    }

    // Use chain client to derive address from private key
    const chainClient = await getChainClient(wallet.chain as ChainType, privateKey);
    const derivedAddress = await chainVerifyAddress(chainClient, privateKey);

    const addressMatch = derivedAddress.toLowerCase() === wallet.address.toLowerCase();
    
    const validationResult: WalletValidationResult = {
      isValid: addressMatch,
      address: wallet.address,
      derivedAddress: derivedAddress,
      addressMatch: addressMatch,
      errors: addressMatch ? undefined : ['Address does not match private key']
    };

    logWalletOperation('VERIFY_ADDRESS_COMPLETE', walletId, userId, {
      addressMatch,
      storedAddress: wallet.address,
      derivedAddress: derivedAddress
    });

    return { success: true, data: validationResult };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying wallet address:', error);
    logWalletOperation('VERIFY_ADDRESS_ERROR', walletId, userId, { error: errorMessage });
    return { success: false, error: `Address verification failed: ${errorMessage}` };
  }
}

/**
 * Lists all wallets for a user with enhanced information
 * @param userId The user ID
 * @returns Promise resolving to array of wallet info
 */
export async function getUserWallets(userId: string): Promise<WalletOperationResult<WalletInfo[]>> {
  try {
    const wallets = walletDb.findByUserId(userId);
    
    // Enhance wallet data with real-time blockchain information
    const enhancedWallets = await Promise.allSettled(
      wallets.map(async (wallet) => {
        try {
          const chainClient = await getChainClient(wallet.chain as ChainType);
          const [balance, nonce] = await Promise.all([
            chainClient.getBalance(wallet.address),
            chainClient.getTransactionCount(wallet.address)
          ]);

          const walletInfo: WalletInfo = {
            id: wallet.id,
            address: wallet.address,
            chain: wallet.chain as ChainType,
            balance: balance.toString(),
            nonce: nonce,
            isActive: wallet.isActive || true,
            createdAt: wallet.createdAt,
            lastUsed: wallet.lastUsed
          };

          if (wallet.name) {
            walletInfo.name = wallet.name;
          }

          return walletInfo;
        } catch (blockchainError) {
          // Fallback to basic wallet info if blockchain call fails
          const walletInfo: WalletInfo = {
            id: wallet.id,
            address: wallet.address,
            chain: wallet.chain as ChainType,
            isActive: wallet.isActive || true,
            createdAt: wallet.createdAt,
            lastUsed: wallet.lastUsed
          };

          if (wallet.name) {
            walletInfo.name = wallet.name;
          }

          return walletInfo;
        }
      })
    );

    const successfulWallets = enhancedWallets
      .filter((result): result is PromiseFulfilledResult<WalletInfo> => result.status === 'fulfilled')
      .map(result => result.value);

    const warnings = enhancedWallets
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => `Wallet data fetch failed: ${result.reason}`);

    logWalletOperation('GET_USER_WALLETS', 'multiple', userId, { 
      walletsCount: successfulWallets.length,
      warnings: warnings.length > 0 ? warnings : undefined
    });

    return { 
      success: true, 
      data: successfulWallets,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error) {
    console.error('Error getting user wallets:', error);
    logWalletOperation('GET_USER_WALLETS_ERROR', 'multiple', userId, { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: 'Failed to get user wallets' };
  }
}

/**
 * Validates transaction data before signing with comprehensive checks
 * @param transactionData The transaction data to validate
 * @returns Validation result with detailed errors
 */
function validateTransactionData(transactionData: TransactionData): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Validate required fields
  if (!transactionData.to) errors.push('Recipient address is required');
  if (!transactionData.value) errors.push('Transaction value is required');
  if (!transactionData.gasLimit) errors.push('Gas limit is required');
  if (!transactionData.chainId) errors.push('Chain ID is required');

  // Validate address format using packages validation
  if (transactionData.to && !isValidEthereumAddress(transactionData.to)) {
    errors.push('Invalid recipient address format');
  }

  // Validate value is not negative
  if (transactionData.value) {
    try {
      const value = BigInt(transactionData.value);
      if (value < 0n) {
        errors.push('Transaction value cannot be negative');
      }
    } catch {
      errors.push('Invalid transaction value format');
    }
  }

  // Validate gas parameters
  if (transactionData.gasLimit) {
    try {
      const gasLimit = BigInt(transactionData.gasLimit);
      if (gasLimit <= 0n) {
        errors.push('Gas limit must be positive');
      }
      if (gasLimit > 30000000n) { // Reasonable upper limit
        errors.push('Gas limit too high');
      }
    } catch {
      errors.push('Invalid gas limit format');
    }
  }

  // Validate gas price (legacy) or EIP-1559 parameters
  if (transactionData.gasPrice) {
    try {
      const gasPrice = BigInt(transactionData.gasPrice);
      if (gasPrice <= 0n) {
        errors.push('Gas price must be positive');
      }
    } catch {
      errors.push('Invalid gas price format');
    }
  }

  if (transactionData.maxFeePerGas) {
    try {
      const maxFee = BigInt(transactionData.maxFeePerGas);
      if (maxFee <= 0n) {
        errors.push('Max fee per gas must be positive');
      }
    } catch {
      errors.push('Invalid max fee per gas format');
    }
  }

  if (transactionData.maxPriorityFeePerGas) {
    try {
      const maxPriorityFee = BigInt(transactionData.maxPriorityFeePerGas);
      if (maxPriorityFee <= 0n) {
        errors.push('Max priority fee per gas must be positive');
      }
    } catch {
      errors.push('Invalid max priority fee per gas format');
    }
  }

  // Validate chain ID
  if (transactionData.chainId <= 0) {
    errors.push('Chain ID must be positive');
  }

  // Validate transaction type
  if (transactionData.type !== undefined && ![0, 1, 2].includes(transactionData.type)) {
    errors.push('Invalid transaction type');
  }

  return { isValid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Creates a secure audit log for wallet operations with enhanced metadata
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
  const logEntry = {
    operation,
    walletId,
    userId,
    timestamp: new Date().toISOString(),
    sessionId: generateSessionId(),
    ...metadata
  };

  console.info('Wallet operation:', logEntry);

  // In production, this should also write to a secure audit log database
  try {
    walletDb.logAuditEvent({
      operation,
      walletId,
      userId,
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Generates a session ID for operation tracking
 * @returns Session ID string
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates and estimates gas for a transaction
 * @param walletId The wallet ID
 * @param transactionData The transaction data
 * @param userId The user ID
 * @returns Promise resolving to gas estimation result
 */
export async function estimateTransactionGas(
  walletId: string,
  transactionData: Omit<TransactionData, 'gasLimit'>,
  userId: string
): Promise<WalletOperationResult<{ gasLimit: string; gasPrice: string; totalCost: string }>> {
  try {
    const wallet = walletDb.findById(walletId);
    if (!wallet || wallet.userId !== userId) {
      return { success: false, error: 'Wallet not found or unauthorized' };
    }

    const chainClient = await getChainClient(wallet.chain as ChainType);
    
    const gasEstimate = await chainClient.estimateGas({
      to: transactionData.to,
      value: transactionData.value,
      data: transactionData.data,
      from: wallet.address
    });

    const gasPrice = await chainClient.getGasPrice();
    const totalCost = (BigInt(gasEstimate) * BigInt(gasPrice)).toString();

    logWalletOperation('ESTIMATE_GAS', walletId, userId, {
      gasEstimate,
      gasPrice,
      totalCost,
      to: transactionData.to,
      value: transactionData.value
    });

    return {
      success: true,
      data: {
        gasLimit: gasEstimate,
        gasPrice: gasPrice,
        totalCost: totalCost
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logWalletOperation('ESTIMATE_GAS_ERROR', walletId, userId, { error: errorMessage });
    return { success: false, error: `Gas estimation failed: ${errorMessage}` };
  }
} 
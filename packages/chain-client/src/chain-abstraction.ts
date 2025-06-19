import { EventEmitter } from 'events';
import winston from 'winston';
import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction as SolanaTransaction, SystemProgram } from '@solana/web3.js';
import { RPCManager, RPCRequest } from './rpc-manager';
import { ConnectionPool } from './connection-pool';

export interface ChainConfig {
  id: string;
  name: string;
  type: 'evm' | 'solana';
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockTime: number; // average block time in seconds
  confirmations: number; // required confirmations for finality
  gasSettings: {
    gasLimit: number;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  explorerUrl: string;
  faucetUrl?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

export interface WalletBalance {
  address: string;
  balance: string;
  balanceFormatted: string;
  token?: TokenInfo;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface TransactionResponse {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  data: string;
  chainId: number;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  confirmations: number;
  status?: number;
  gasUsed?: string;
}

export interface BlockInfo {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  difficulty?: string;
  gasLimit?: string;
  gasUsed?: string;
  miner?: string;
  transactionCount: number;
  transactions: string[];
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  totalCost: string;
  totalCostFormatted: string;
}

export interface SwapQuote {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  price: string;
  priceImpact: string;
  gasEstimate: GasEstimate;
  route: string[];
  dex: string;
  slippage: string;
}

export interface ChainState {
  latestBlock: number;
  gasPrice: string;
  isHealthy: boolean;
  syncProgress: number;
  peerCount: number;
  pendingTransactions: number;
}

export class ChainAbstraction extends EventEmitter {
  private logger: winston.Logger;
  private rpcManager: RPCManager;
  private connectionPool: ConnectionPool;
  private chainConfigs: Map<string, ChainConfig> = new Map();
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private solanaConnection: Connection | null = null;

  constructor(
    rpcManager: RPCManager,
    connectionPool: ConnectionPool,
    logger: winston.Logger
  ) {
    super();
    this.rpcManager = rpcManager;
    this.connectionPool = connectionPool;
    this.logger = logger;
    
    this.setupChainConfigs();
    this.initializeProviders();
  }

  private setupChainConfigs(): void {
    // Ethereum Mainnet
    this.chainConfigs.set('ethereum', {
      id: 'ethereum',
      name: 'Ethereum',
      type: 'evm',
      chainId: 1,
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockTime: 12,
      confirmations: 12,
      gasSettings: {
        gasLimit: 21000,
        maxFeePerGas: '30000000000', // 30 gwei
        maxPriorityFeePerGas: '2000000000' // 2 gwei
      },
      explorerUrl: 'https://etherscan.io',
      faucetUrl: 'https://faucet.ethereum.org'
    });

    // BSC Mainnet
    this.chainConfigs.set('bsc', {
      id: 'bsc',
      name: 'BNB Smart Chain',
      type: 'evm',
      chainId: 56,
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      },
      blockTime: 3,
      confirmations: 15,
      gasSettings: {
        gasLimit: 21000,
        maxFeePerGas: '5000000000', // 5 gwei
        maxPriorityFeePerGas: '1000000000' // 1 gwei
      },
      explorerUrl: 'https://bscscan.com'
    });

    // Polygon
    this.chainConfigs.set('polygon', {
      id: 'polygon',
      name: 'Polygon',
      type: 'evm',
      chainId: 137,
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      blockTime: 2,
      confirmations: 20,
      gasSettings: {
        gasLimit: 21000,
        maxFeePerGas: '40000000000', // 40 gwei
        maxPriorityFeePerGas: '30000000000' // 30 gwei
      },
      explorerUrl: 'https://polygonscan.com'
    });

    // Arbitrum One
    this.chainConfigs.set('arbitrum', {
      id: 'arbitrum',
      name: 'Arbitrum One',
      type: 'evm',
      chainId: 42161,
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockTime: 1,
      confirmations: 1,
      gasSettings: {
        gasLimit: 21000,
        maxFeePerGas: '1000000000', // 1 gwei
        maxPriorityFeePerGas: '100000000' // 0.1 gwei
      },
      explorerUrl: 'https://arbiscan.io'
    });

    // Optimism
    this.chainConfigs.set('optimism', {
      id: 'optimism',
      name: 'Optimism',
      type: 'evm',
      chainId: 10,
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockTime: 2,
      confirmations: 1,
      gasSettings: {
        gasLimit: 21000,
        maxFeePerGas: '1000000000', // 1 gwei
        maxPriorityFeePerGas: '100000000' // 0.1 gwei
      },
      explorerUrl: 'https://optimistic.etherscan.io'
    });

    // Solana
    this.chainConfigs.set('solana', {
      id: 'solana',
      name: 'Solana',
      type: 'solana',
      chainId: 101, // Mainnet-beta
      nativeCurrency: {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9
      },
      blockTime: 0.4,
      confirmations: 1,
      gasSettings: {
        gasLimit: 200000 // Compute units
      },
      explorerUrl: 'https://explorer.solana.com'
    });

    this.logger.info('Chain configurations initialized', {
      chains: Array.from(this.chainConfigs.keys())
    });
  }

  private async initializeProviders(): Promise<void> {
    for (const [chainId, config] of this.chainConfigs.entries()) {
      if (config.type === 'evm') {
        // Create ethers provider using our RPC manager
        const provider = new ethers.JsonRpcProvider(
          'http://localhost', // Placeholder, will be overridden
          config.chainId
        );

        // Override the send method to use our RPC manager
        provider.send = async (method: string, params: any[]): Promise<any> => {
          try {
            const request: RPCRequest = {
              id: `${Date.now()}-${Math.random()}`,
              method,
              params,
              chain: chainId,
              priority: 'medium',
              timestamp: Date.now()
            };

            const response = await this.connectionPool.executeRequest(request);
            return response.result;
          } catch (error) {
            this.logger.error('RPC request failed through provider', {
              chain: chainId,
              method,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
          }
        };

        this.providers.set(chainId, provider);
      } else if (config.type === 'solana') {
        // Solana connection will be created on-demand using RPC manager
        this.solanaConnection = null;
      }
    }
  }

  // Unified balance checking across all chains
  async getBalance(chainId: string, address: string, tokenAddress?: string): Promise<WalletBalance> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    try {
      if (config.type === 'evm') {
        return await this.getEVMBalance(chainId, address, tokenAddress);
      } else if (config.type === 'solana') {
        return await this.getSolanaBalance(address, tokenAddress);
      } else {
        throw new Error(`Unsupported chain type: ${config.type}`);
      }
    } catch (error: any) {
      this.logger.error('Failed to get balance', {
        chainId,
        address,
        tokenAddress,
        error: error.message
      });
      throw error;
    }
  }

  private async getEVMBalance(chainId: string, address: string, tokenAddress?: string): Promise<WalletBalance> {
    const provider = this.providers.get(chainId);
    const config = this.chainConfigs.get(chainId);
    
    if (!provider || !config) {
      throw new Error(`Provider or config not found for chain: ${chainId}`);
    }

    if (tokenAddress) {
      // ERC-20 token balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function symbol() view returns (string)',
          'function name() view returns (string)'
        ],
        provider
      );

      const [balance, decimals, symbol, name] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.decimals(),
        tokenContract.symbol(),
        tokenContract.name()
      ]);

      const balanceFormatted = ethers.formatUnits(balance, decimals);

      return {
        address,
        balance: balance.toString(),
        balanceFormatted,
        token: {
          address: tokenAddress,
          symbol,
          name,
          decimals,
          chainId: config.chainId
        }
      };
    } else {
      // Native token balance
      const balance = await provider.getBalance(address);
      const balanceFormatted = ethers.formatEther(balance);

      return {
        address,
        balance: balance.toString(),
        balanceFormatted,
        token: {
          address: 'native',
          symbol: config.nativeCurrency.symbol,
          name: config.nativeCurrency.name,
          decimals: config.nativeCurrency.decimals,
          chainId: config.chainId
        }
      };
    }
  }

  private async getSolanaBalance(address: string, tokenAddress?: string): Promise<WalletBalance> {
    // For now, return a placeholder implementation
    // In a full implementation, this would use Solana's token program
    return {
      address,
      balance: '0',
      balanceFormatted: '0',
      token: {
        address: tokenAddress || 'native',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        chainId: 101
      }
    };
  }

  // Unified transaction building and sending
  async sendTransaction(
    chainId: string,
    txRequest: TransactionRequest,
    privateKey: string
  ): Promise<TransactionResponse> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    try {
      if (config.type === 'evm') {
        return await this.sendEVMTransaction(chainId, txRequest, privateKey);
      } else if (config.type === 'solana') {
        return await this.sendSolanaTransaction(txRequest, privateKey);
      } else {
        throw new Error(`Unsupported chain type: ${config.type}`);
      }
    } catch (error: any) {
      this.logger.error('Failed to send transaction', {
        chainId,
        to: txRequest.to,
        value: txRequest.value,
        error: error.message
      });
      throw error;
    }
  }

  private async sendEVMTransaction(
    chainId: string,
    txRequest: TransactionRequest,
    privateKey: string
  ): Promise<TransactionResponse> {
    const provider = this.providers.get(chainId);
    const config = this.chainConfigs.get(chainId);
    
    if (!provider || !config) {
      throw new Error(`Provider or config not found for chain: ${chainId}`);
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Build transaction object
    const tx: ethers.TransactionRequest = {
      to: txRequest.to,
      value: txRequest.value || '0',
      data: txRequest.data || '0x',
      gasLimit: txRequest.gasLimit || config.gasSettings.gasLimit.toString(),
    };

    // Set gas pricing based on chain capabilities
    if (config.chainId === 1 || config.chainId === 137) {
      // EIP-1559 chains
      tx.maxFeePerGas = txRequest.maxFeePerGas || config.gasSettings.maxFeePerGas;
      tx.maxPriorityFeePerGas = txRequest.maxPriorityFeePerGas || config.gasSettings.maxPriorityFeePerGas;
    } else {
      // Legacy gas pricing
      tx.gasPrice = txRequest.gasPrice || config.gasSettings.maxFeePerGas;
    }

    // Set nonce if provided
    if (txRequest.nonce !== undefined) {
      tx.nonce = txRequest.nonce;
    }

    // Send transaction
    const sentTx = await wallet.sendTransaction(tx);
    
    return {
      hash: sentTx.hash,
      from: sentTx.from!,
      to: sentTx.to!,
      value: sentTx.value!.toString(),
      gasLimit: sentTx.gasLimit!.toString(),
      gasPrice: sentTx.gasPrice?.toString() || sentTx.maxFeePerGas?.toString() || '0',
      nonce: sentTx.nonce,
      data: sentTx.data,
      chainId: config.chainId,
      confirmations: 0
    };
  }

  private async sendSolanaTransaction(
    txRequest: TransactionRequest,
    privateKey: string
  ): Promise<TransactionResponse> {
    // Placeholder for Solana transaction implementation
    throw new Error('Solana transactions not yet implemented');
  }

  // Gas estimation across chains
  async estimateGas(
    chainId: string,
    txRequest: TransactionRequest
  ): Promise<GasEstimate> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (config.type === 'evm') {
      return await this.estimateEVMGas(chainId, txRequest);
    } else if (config.type === 'solana') {
      return await this.estimateSolanaGas(txRequest);
    } else {
      throw new Error(`Unsupported chain type: ${config.type}`);
    }
  }

  private async estimateEVMGas(
    chainId: string,
    txRequest: TransactionRequest
  ): Promise<GasEstimate> {
    const provider = this.providers.get(chainId);
    const config = this.chainConfigs.get(chainId);
    
    if (!provider || !config) {
      throw new Error(`Provider or config not found for chain: ${chainId}`);
    }

    // Estimate gas limit
    const gasLimit = await provider.estimateGas({
      to: txRequest.to,
      value: txRequest.value || '0',
      data: txRequest.data || '0x'
    });

    // Get current gas prices
    const feeData = await provider.getFeeData();
    
    const gasPrice = feeData.gasPrice?.toString() || config.gasSettings.maxFeePerGas!;
    const maxFeePerGas = feeData.maxFeePerGas?.toString();
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.toString();

    // Calculate total cost
    const totalCost = (BigInt(gasLimit.toString()) * BigInt(gasPrice)).toString();
    const totalCostFormatted = ethers.formatEther(totalCost);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCost,
      totalCostFormatted: `${totalCostFormatted} ${config.nativeCurrency.symbol}`
    };
  }

  private async estimateSolanaGas(txRequest: TransactionRequest): Promise<GasEstimate> {
    // Placeholder for Solana gas estimation
    return {
      gasLimit: '200000',
      gasPrice: '5000',
      totalCost: '1000000000',
      totalCostFormatted: '0.001 SOL'
    };
  }

  // Block information retrieval
  async getBlockInfo(chainId: string, blockNumber?: number): Promise<BlockInfo> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (config.type === 'evm') {
      return await this.getEVMBlockInfo(chainId, blockNumber);
    } else if (config.type === 'solana') {
      return await this.getSolanaBlockInfo(blockNumber);
    } else {
      throw new Error(`Unsupported chain type: ${config.type}`);
    }
  }

  private async getEVMBlockInfo(chainId: string, blockNumber?: number): Promise<BlockInfo> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain: ${chainId}`);
    }

    const block = await provider.getBlock(blockNumber || 'latest', false);
    if (!block) {
      throw new Error('Block not found');
    }

    return {
      number: block.number,
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      difficulty: block.difficulty?.toString(),
      gasLimit: block.gasLimit?.toString(),
      gasUsed: block.gasUsed?.toString(),
      miner: block.miner,
      transactionCount: block.transactions.length,
      transactions: [...block.transactions] // Convert readonly array to mutable
    };
  }

  private async getSolanaBlockInfo(blockNumber?: number): Promise<BlockInfo> {
    // Placeholder for Solana block info
    return {
      number: blockNumber || 0,
      hash: '0x',
      parentHash: '0x',
      timestamp: Date.now() / 1000,
      transactionCount: 0,
      transactions: []
    };
  }

  // Chain state monitoring
  async getChainState(chainId: string): Promise<ChainState> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (config.type === 'evm') {
      return await this.getEVMChainState(chainId);
    } else if (config.type === 'solana') {
      return await this.getSolanaChainState();
    } else {
      throw new Error(`Unsupported chain type: ${config.type}`);
    }
  }

  private async getEVMChainState(chainId: string): Promise<ChainState> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain: ${chainId}`);
    }

    try {
      const [blockNumber, feeData] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData()
      ]);

      return {
        latestBlock: blockNumber,
        gasPrice: feeData.gasPrice?.toString() || '0',
        isHealthy: true,
        syncProgress: 100,
        peerCount: 0, // Not available in most RPC endpoints
        pendingTransactions: 0 // Not available in most RPC endpoints
      };
    } catch (error: any) {
      this.logger.error('Failed to get chain state', {
        chainId,
        error: error.message
      });

      return {
        latestBlock: 0,
        gasPrice: '0',
        isHealthy: false,
        syncProgress: 0,
        peerCount: 0,
        pendingTransactions: 0
      };
    }
  }

  private async getSolanaChainState(): Promise<ChainState> {
    // Placeholder for Solana chain state
    return {
      latestBlock: 0,
      gasPrice: '5000',
      isHealthy: true,
      syncProgress: 100,
      peerCount: 0,
      pendingTransactions: 0
    };
  }

  // Utility methods
  getChainConfig(chainId: string): ChainConfig | undefined {
    return this.chainConfigs.get(chainId);
  }

  getSupportedChains(): string[] {
    return Array.from(this.chainConfigs.keys());
  }

  isValidAddress(chainId: string, address: string): boolean {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      return false;
    }

    if (config.type === 'evm') {
      return ethers.isAddress(address);
    } else if (config.type === 'solana') {
      try {
        new PublicKey(address);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  formatAmount(amount: string, decimals: number): string {
    return ethers.formatUnits(amount, decimals);
  }

  parseAmount(amount: string, decimals: number): string {
    return ethers.parseUnits(amount, decimals).toString();
  }

  // Transaction waiting and confirmation
  async waitForTransaction(
    chainId: string,
    txHash: string,
    confirmations?: number
  ): Promise<TransactionResponse> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const requiredConfirmations = confirmations || config.confirmations;

    if (config.type === 'evm') {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain: ${chainId}`);
      }

      const receipt = await provider.waitForTransaction(txHash, requiredConfirmations);
      if (!receipt) {
        throw new Error('Transaction not found');
      }

      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        throw new Error('Transaction details not found');
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        nonce: tx.nonce,
        data: tx.data,
        chainId: config.chainId,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        transactionIndex: receipt.index,
        confirmations: receipt.confirmations,
        status: receipt.status || undefined,
        gasUsed: receipt.gasUsed.toString()
      };
    } else {
      throw new Error('Solana transaction waiting not yet implemented');
    }
  }

  async close(): Promise<void> {
    // Cleanup providers and connections
    this.providers.clear();
    this.solanaConnection = null;
    this.logger.info('Chain abstraction layer closed');
  }
}
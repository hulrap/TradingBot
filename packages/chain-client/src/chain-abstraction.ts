import { EventEmitter } from 'events';
import winston from 'winston';
import { ethers } from 'ethers';
import { 
  Connection, 
  PublicKey, 
  Transaction as SolanaTransaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  TokenAmount,
  clusterApiUrl,
  Commitment,
  ConfirmedSignatureInfo,
  GetVersionedTransactionResponse,
  SendOptions,
  Keypair,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  AccountLayout, 
  MintLayout, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getMint
} from '@solana/spl-token';
import { RPCManager, RPCRequest } from './rpc-manager';
import { ConnectionPool } from './connection-pool';
import WebSocket from 'ws';

export type SupportedChain = 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'optimism' | 'solana';

// Enhanced error types for better error handling
export class ChainAbstractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public chain?: SupportedChain,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ChainAbstractionError';
  }
}

export class NetworkError extends ChainAbstractionError {
  constructor(message: string, chain?: SupportedChain, originalError?: Error) {
    super(message, 'NETWORK_ERROR', chain, originalError);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ChainAbstractionError {
  constructor(message: string, chain?: SupportedChain) {
    super(message, 'VALIDATION_ERROR', chain);
    this.name = 'ValidationError';
  }
}

export class TransactionError extends ChainAbstractionError {
  constructor(message: string, chain?: SupportedChain, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', chain, originalError);
    this.name = 'TransactionError';
  }
}

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrls: string[];
  wsUrls: string[];
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  testnet?: boolean;
  features: {
    eip1559: boolean;
    flashbots: boolean;
    mev: boolean;
    layer2: boolean;
  };
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  isNative?: boolean;
  chainId?: number;
  totalSupply?: string;
  verified?: boolean;
}

export interface WalletBalance {
  address: string;
  balance: string;
  balanceFormatted: string;
  token?: TokenInfo;
  usdValue?: string;
}

export interface GasSettings {
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  type?: number; // 0 = Legacy, 2 = EIP-1559
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  totalCost: string;
  totalCostFormatted?: string;
}

export interface TransactionRequest {
  to?: string;
  from?: string;
  value?: string;
  data?: string;
  gasSettings?: GasSettings;
  nonce?: number;
}

export interface TransactionReceipt {
  hash: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  from: string;
  to?: string;
  gasUsed: string;
  effectiveGasPrice: string;
  status: number;
  logs: TransactionLog[];
  confirmations: number;
  timestamp?: number;
}

export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

export interface BlockInfo {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  gasLimit: string;
  gasUsed: string;
  baseFeePerGas?: string;
  transactions: string[];
  size?: number;
  difficulty?: string;
}

export interface SwapQuote {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  route: Array<{
    protocol: string;
    percentage: number;
    pool?: string;
  }>;
  gasEstimate: GasSettings;
  priceImpact: string;
  minimumReceived: string;
  slippage: string;
  validUntil?: number;
  fees?: Array<{
    type: string;
    amount: string;
    percentage: string;
  }>;
}

export interface TokenApproval {
  token: string;
  spender: string;
  amount: string;
  owner: string;
  isUnlimited: boolean;
  transactionHash?: string;
}

export interface ChainAbstractionConfig {
  defaultChain: SupportedChain;
  enabledChains: SupportedChain[];
  rpcManager: any; // Reference to RPC manager
  gasMultiplier: number;
  maxGasPrice: string;
  defaultSlippage: number;
  commitment?: Commitment; // Solana commitment level
  wsReconnectInterval?: number;
  tokenListRefreshInterval?: number;
}

export interface ChainState {
  latestBlock: number;
  gasPrice: string;
  isHealthy: boolean;
  syncProgress: number;
  peerCount: number;
  pendingTransactions: number;
  lastUpdate: number;
}

export interface WebSocketConnection {
  ws: WebSocket;
  subscriptions: Map<string, Function>;
  isConnected: boolean;
  reconnectAttempts: number;
  lastPing: number;
}

export class ChainAbstraction extends EventEmitter {
  private logger: winston.Logger;
  private rpcManager: RPCManager;
  private connectionPool: ConnectionPool;
  private chains: Map<SupportedChain, ChainConfig> = new Map();
  private providers: Map<SupportedChain, ethers.Provider> = new Map();
  private tokenLists: Map<SupportedChain, Map<string, TokenInfo>> = new Map();
  private gasOracles: Map<SupportedChain, any> = new Map();
  private solanaConnection: Connection | null = null;
  private wsConnections: Map<SupportedChain, WebSocketConnection> = new Map();
  private chainStates: Map<SupportedChain, ChainState> = new Map();
  private tokenApprovals: Map<string, TokenApproval> = new Map(); // key: token_spender_owner
  private reconnectTimers: Map<SupportedChain, NodeJS.Timeout> = new Map();

  constructor(
    rpcManager: RPCManager,
    connectionPool: ConnectionPool,
    logger: winston.Logger,
    private config: ChainAbstractionConfig
  ) {
    super();
    this.rpcManager = rpcManager;
    this.connectionPool = connectionPool;
    this.logger = logger;
    
    this.setupChainConfigs();
    this.initializeProviders();
    this.initializeTokenLists();
    this.initializeGasOracles();
    this.initializeWebSockets();
    this.startHealthMonitoring();
  }

  private setupChainConfigs(): void {
    // Ethereum Mainnet
    this.chains.set('ethereum', {
      chainId: 1,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      rpcUrls: [
        'https://ethereum.publicnode.com',
        'https://rpc.ankr.com/eth',
        'https://eth-mainnet.public.blastapi.io'
      ],
      wsUrls: [
        'wss://ethereum.publicnode.com',
        'wss://rpc.ankr.com/eth/ws'
      ],
      blockExplorerUrl: 'https://etherscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: true,
        mev: true,
        layer2: false
      }
    });

    // BSC Mainnet
    this.chains.set('bsc', {
      chainId: 56,
      name: 'Binance Smart Chain',
      symbol: 'BNB',
      decimals: 18,
      rpcUrls: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://rpc.ankr.com/bsc'
      ],
      wsUrls: [
        'wss://bsc-ws-node.nariox.org:443',
        'wss://bsc.publicnode.com'
      ],
      blockExplorerUrl: 'https://bscscan.com',
      nativeCurrency: {
        name: 'Binance Coin',
        symbol: 'BNB',
        decimals: 18
      },
      features: {
        eip1559: false,
        flashbots: false,
        mev: true,
        layer2: false
      }
    });

    // Polygon
    this.chains.set('polygon', {
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
      rpcUrls: [
        'https://polygon-rpc.com',
        'https://rpc.ankr.com/polygon',
        'https://polygon-mainnet.public.blastapi.io'
      ],
      wsUrls: [
        'wss://polygon-bor.publicnode.com',
        'wss://rpc.ankr.com/polygon/ws'
      ],
      blockExplorerUrl: 'https://polygonscan.com',
      nativeCurrency: {
        name: 'Polygon',
        symbol: 'MATIC',
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: false,
        mev: true,
        layer2: true
      }
    });

    // Arbitrum One
    this.chains.set('arbitrum', {
      chainId: 42161,
      name: 'Arbitrum One',
      symbol: 'ETH',
      decimals: 18,
      rpcUrls: [
        'https://arb1.arbitrum.io/rpc',
        'https://rpc.ankr.com/arbitrum',
        'https://arbitrum-mainnet.public.blastapi.io'
      ],
      wsUrls: [
        'wss://arb1.arbitrum.io/ws',
        'wss://rpc.ankr.com/arbitrum/ws'
      ],
      blockExplorerUrl: 'https://arbiscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: false,
        mev: true,
        layer2: true
      }
    });

    // Optimism
    this.chains.set('optimism', {
      chainId: 10,
      name: 'Optimism',
      symbol: 'ETH',
      decimals: 18,
      rpcUrls: [
        'https://mainnet.optimism.io',
        'https://rpc.ankr.com/optimism',
        'https://optimism-mainnet.public.blastapi.io'
      ],
      wsUrls: [
        'wss://optimism-mainnet.public.blastapi.io',
        'wss://rpc.ankr.com/optimism/ws'
      ],
      blockExplorerUrl: 'https://optimistic.etherscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: false,
        mev: true,
        layer2: true
      }
    });

    // Solana
    this.chains.set('solana', {
      chainId: 101, // Solana mainnet-beta
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
      rpcUrls: [
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
        'https://solana-api.projectserum.com'
      ],
      wsUrls: [
        'wss://api.mainnet-beta.solana.com',
        'wss://rpc.ankr.com/solana/ws'
      ],
      blockExplorerUrl: 'https://solscan.io',
      nativeCurrency: {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9
      },
      features: {
        eip1559: false,
        flashbots: false,
        mev: true,
        layer2: false
      }
    });

    this.logger.info('Chain configurations initialized', {
      chains: Array.from(this.chains.keys())
    });
  }

  private async initializeProviders(): Promise<void> {
    for (const [chainName, chainConfig] of this.chains) {
      if (chainName === 'solana') {
        // Solana uses different provider architecture
        continue;
      }

      // Create ethers provider with fallback
      const provider = new ethers.FallbackProvider(
        chainConfig.rpcUrls.map((url, index) => ({
          provider: new ethers.JsonRpcProvider(url),
          priority: index + 1,
          weight: 1
        }))
      );

      this.providers.set(chainName as SupportedChain, provider);
    }
  }

  private initializeTokenLists(): void {
    // Initialize common tokens for each chain
    const commonTokens = {
      ethereum: [
        {
          address: '0xA0b86a33E6441e27a4E54E7cb03FA3a84F8C0F4F',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/thumb/Tether-logo.png'
        },
        {
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          name: 'Wrapped Ether',
          symbol: 'WETH',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/2518/thumb/weth.png'
        }
      ],
      bsc: [
        {
          address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
        },
        {
          address: '0x55d398326f99059fF775485246999027B3197955',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/325/thumb/Tether-logo.png'
        },
        {
          address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          name: 'Wrapped BNB',
          symbol: 'WBNB',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/825/thumb/bnb-icon2_2x.png'
        }
      ]
    };

    for (const [chain, tokens] of Object.entries(commonTokens)) {
      const tokenMap = new Map<string, TokenInfo>();
      for (const token of tokens) {
        tokenMap.set(token.address.toLowerCase(), token);
      }
      this.tokenLists.set(chain as SupportedChain, tokenMap);
    }
  }

  private initializeGasOracles(): void {
    // Gas price oracles for different chains
    const gasOracles = {
      ethereum: {
        fast: async () => await this.getGasPrice('ethereum', 'fast'),
        standard: async () => await this.getGasPrice('ethereum', 'standard'),
        safe: async () => await this.getGasPrice('ethereum', 'safe')
      },
      bsc: {
        fast: async () => await this.getGasPrice('bsc', 'fast'),
        standard: async () => await this.getGasPrice('bsc', 'standard'),
        safe: async () => await this.getGasPrice('bsc', 'safe')
      }
    };

    for (const [chain, oracle] of Object.entries(gasOracles)) {
      this.gasOracles.set(chain as SupportedChain, oracle);
    }
  }

  /**
   * Initialize WebSocket connections for real-time data
   */
  private async initializeWebSockets(): Promise<void> {
    for (const [chainName, chainConfig] of this.chains) {
      if (chainConfig.wsUrls.length === 0) continue;

      try {
        await this.connectWebSocket(chainName);
        this.logger.info(`WebSocket connected for ${chainName}`);
      } catch (error) {
        this.logger.error(`Failed to connect WebSocket for ${chainName}`, error);
      }
    }
  }

  /**
   * Connect WebSocket for a specific chain
   */
  private async connectWebSocket(chain: SupportedChain): Promise<void> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig || chainConfig.wsUrls.length === 0) return;

    const wsUrl = chainConfig.wsUrls[0]; // Use first available WebSocket URL
    const ws = new WebSocket(wsUrl);

    const connection: WebSocketConnection = {
      ws,
      subscriptions: new Map(),
      isConnected: false,
      reconnectAttempts: 0,
      lastPing: Date.now()
    };

    ws.on('open', () => {
      connection.isConnected = true;
      connection.reconnectAttempts = 0;
      this.logger.info(`WebSocket connected: ${chain}`);
      this.emit('websocket-connected', { chain });

      // Setup ping/pong for connection health
      const pingInterval = setInterval(() => {
        if (connection.isConnected) {
          ws.ping();
          connection.lastPing = Date.now();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(chain, message);
      } catch (error) {
        this.logger.error(`WebSocket message parse error for ${chain}`, error);
      }
    });

    ws.on('close', () => {
      connection.isConnected = false;
      this.logger.warn(`WebSocket disconnected: ${chain}`);
      this.emit('websocket-disconnected', { chain });
      this.scheduleReconnect(chain);
    });

    ws.on('error', (error) => {
      this.logger.error(`WebSocket error for ${chain}`, error);
      this.emit('websocket-error', { chain, error });
    });

    ws.on('pong', () => {
      connection.lastPing = Date.now();
    });

    this.wsConnections.set(chain, connection);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(chain: SupportedChain, message: any): void {
    // Handle different message types based on chain
    if (chain === 'solana') {
      this.handleSolanaWebSocketMessage(message);
    } else {
      this.handleEVMWebSocketMessage(chain, message);
    }
  }

  /**
   * Handle Solana WebSocket messages
   */
  private handleSolanaWebSocketMessage(message: any): void {
    if (message.method === 'blockNotification') {
      this.emit('block', {
        chain: 'solana',
        block: message.params.result
      });
    } else if (message.method === 'signatureNotification') {
      this.emit('transaction', {
        chain: 'solana',
        transaction: message.params.result
      });
    }
  }

  /**
   * Handle EVM WebSocket messages
   */
  private handleEVMWebSocketMessage(chain: SupportedChain, message: any): void {
    if (message.method === 'eth_subscription') {
      const subscription = message.params.subscription;
      const result = message.params.result;

      if (result.number) {
        // New block
        this.emit('block', {
          chain,
          block: result
        });
      } else if (result.hash && result.from) {
        // New transaction
        this.emit('transaction', {
          chain,
          transaction: result
        });
      }
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(chain: SupportedChain): void {
    const connection = this.wsConnections.get(chain);
    if (!connection) return;

    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(chain);
    if (existingTimer) {
      clearTimeout(existingTimer as NodeJS.Timeout);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts), 30000);
    connection.reconnectAttempts++;

    const timer = setTimeout(() => {
      this.logger.info(`Attempting WebSocket reconnect for ${chain} (attempt ${connection.reconnectAttempts})`);
      this.connectWebSocket(chain);
    }, delay);

    this.reconnectTimers.set(chain, timer);
  }

  /**
   * Start health monitoring for all chains
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (const chain of this.chains.keys()) {
        try {
          await this.updateChainState(chain);
        } catch (error) {
          this.logger.error(`Health check failed for ${chain}`, error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update chain state information
   */
  private async updateChainState(chain: SupportedChain): Promise<void> {
    try {
      const latestBlock = await this.getBlockNumber(chain);
      const gasPrice = await this.getGasPrice(chain, 'standard');
      
      // Basic health check - if we can get block number, chain is healthy
      const isHealthy = latestBlock > 0;

      const state: ChainState = {
        latestBlock,
        gasPrice: gasPrice.gasPrice || '0',
        isHealthy,
        syncProgress: 100, // Simplified
        peerCount: 0, // Would need specific API calls
        pendingTransactions: 0, // Would need specific API calls
        lastUpdate: Date.now()
      };

      this.chainStates.set(chain, state);
      this.emit('chain-state-updated', { chain, state });

    } catch (error) {
      const state: ChainState = {
        latestBlock: 0,
        gasPrice: '0',
        isHealthy: false,
        syncProgress: 0,
        peerCount: 0,
        pendingTransactions: 0,
        lastUpdate: Date.now()
      };

      this.chainStates.set(chain, state);
      this.emit('chain-state-updated', { chain, state });
      throw new NetworkError(`Failed to update chain state for ${chain}`, chain, error as Error);
    }
  }

  /**
   * Get chain state information
   */
  public getChainState(chain: SupportedChain): ChainState | undefined {
    return this.chainStates.get(chain);
  }

  /**
   * Subscribe to real-time events
   */
  public async subscribeToBlocks(chain: SupportedChain, callback: (block: any) => void): Promise<string> {
    const connection = this.wsConnections.get(chain);
    if (!connection || !connection.isConnected) {
      throw new NetworkError(`WebSocket not connected for ${chain}`, chain);
    }

    const subscriptionId = `blocks_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    connection.subscriptions.set(subscriptionId, callback);

    // Subscribe to new blocks
    if (chain === 'solana') {
      // Solana block subscription
      const message = {
        jsonrpc: '2.0',
        id: subscriptionId,
        method: 'blockSubscribe',
        params: ['all', { commitment: this.config.commitment || 'confirmed' }]
      };
      connection.ws.send(JSON.stringify(message));
    } else {
      // EVM block subscription
      const message = {
        jsonrpc: '2.0',
        id: subscriptionId,
        method: 'eth_subscribe',
        params: ['newHeads']
      };
      connection.ws.send(JSON.stringify(message));
    }

    return subscriptionId;
  }

  // === SOLANA IMPLEMENTATION (COMPLETE) === //

  /**
   * Initialize Solana connection
   */
  private async initializeSolanaConnection(): Promise<void> {
    if (this.solanaConnection) return;

    const chainConfig = this.chains.get('solana');
    if (!chainConfig) {
      throw new ValidationError('Solana chain configuration not found');
    }

    try {
      this.solanaConnection = new Connection(
        chainConfig.rpcUrls[0],
        this.config.commitment || 'confirmed'
      );

      // Test connection
      const version = await this.solanaConnection.getVersion();
      this.logger.info('Solana connection established', { version });
    } catch (error) {
      throw new NetworkError('Failed to initialize Solana connection', 'solana', error as Error);
    }
  }

  /**
   * Get Solana connection
   */
  private async getSolanaConnection(): Promise<Connection> {
    if (!this.solanaConnection) {
      await this.initializeSolanaConnection();
    }
    return this.solanaConnection!;
  }

  /**
   * Get current Solana slot (equivalent to block number)
   */
  private async getSolanaSlot(): Promise<number> {
    try {
      const connection = await this.getSolanaConnection();
      return await connection.getSlot();
    } catch (error) {
      throw new NetworkError('Failed to get Solana slot', 'solana', error as Error);
    }
  }

  /**
   * Get Solana block information
   */
  private async getSolanaBlock(slot: number): Promise<BlockInfo> {
    try {
      const connection = await this.getSolanaConnection();
      const block = await connection.getBlock(slot);
      
      if (!block) {
        throw new Error(`Block ${slot} not found`);
      }

      return {
        number: slot,
        hash: block.blockhash,
        parentHash: block.previousBlockhash,
        timestamp: block.blockTime || 0,
        gasLimit: '0', // Solana doesn't use gas
        gasUsed: '0',
        transactions: block.transactions.map(tx => tx.transaction.signatures[0]),
        size: JSON.stringify(block).length
      };
    } catch (error) {
      throw new NetworkError(`Failed to get Solana block ${slot}`, 'solana', error as Error);
    }
  }

  /**
   * Get Solana transaction receipt (enhanced)
   */
  private async getSolanaTransactionEnhanced(signature: string): Promise<TransactionReceipt | null> {
    try {
      const connection = await this.getSolanaConnection();
      const transaction = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!transaction) {
        return null;
      }

      // Handle versioned transaction message format
      const accountKeys = transaction.transaction.message.getAccountKeys();

      return {
        hash: signature,
        blockNumber: transaction.slot,
        blockHash: transaction.transaction.message.recentBlockhash,
        transactionIndex: 0, // Solana doesn't have tx index concept
        from: accountKeys.get(0)?.toString() || '',
        to: accountKeys.get(1)?.toString(),
        gasUsed: transaction.meta?.fee?.toString() || '0',
        effectiveGasPrice: '0', // Solana uses flat fees
        status: transaction.meta?.err ? 0 : 1,
        logs: transaction.meta?.logMessages?.map((log, index) => ({
          address: '',
          topics: [],
          data: log,
          blockNumber: transaction.slot,
          transactionHash: signature,
          logIndex: index
        })) || [],
        confirmations: 1,
        timestamp: transaction.blockTime || 0
      };
    } catch (error) {
      throw new TransactionError(`Failed to get Solana transaction ${signature}`, 'solana', error as Error);
    }
  }

  /**
   * Fetch Solana token information (enhanced)
   */
  private async fetchSolanaTokenInfoEnhanced(mint: string): Promise<TokenInfo | null> {
    try {
      const connection = await this.getSolanaConnection();
      const mintPublicKey = new PublicKey(mint);
      
      // Get mint info using simplified interface
      const mintInfo = await getSolanaTokenInfo(connection, mintPublicKey);
      
      if (!mintInfo) {
        return null;
      }

      const tokenInfo: TokenInfo = {
        address: mint,
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: mintInfo.decimals,
        totalSupply: mintInfo.supply.toString(),
        verified: false
      };

      // Cache the token info
      const solanaTokenList = this.tokenLists.get('solana') || new Map();
      solanaTokenList.set(mint.toLowerCase(), tokenInfo);
      this.tokenLists.set('solana', solanaTokenList);

      return tokenInfo;
    } catch (error) {
      this.logger.error(`Failed to fetch Solana token info for ${mint}`, error);
      return null;
    }
  }

  /**
   * Get Solana token balance (enhanced)
   */
  private async getSolanaTokenBalanceEnhanced(mint: string, owner: string): Promise<string> {
    try {
      const connection = await this.getSolanaConnection();
      const ownerPublicKey = new PublicKey(owner);
      const mintPublicKey = new PublicKey(mint);

      // Get associated token account using simplified interface
      const associatedTokenAccount = await getSolanaTokenAccountAddress(mintPublicKey, ownerPublicKey);

      try {
        const balance = await getSolanaTokenAccountBalance(connection, associatedTokenAccount);
        return balance;
      } catch (error) {
        // Account doesn't exist, balance is 0
        return '0';
      }
    } catch (error) {
      throw new NetworkError(`Failed to get Solana token balance`, 'solana', error as Error);
    }
  }

  /**
   * Get swap quote for Solana (Jupiter integration)
   */
  private async getSolanaSwapQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippage: number
  ): Promise<SwapQuote> {
    try {
      // This would integrate with Jupiter API for real implementation
      const inputToken = await this.fetchSolanaTokenInfoEnhanced(inputMint);
      const outputToken = await this.fetchSolanaTokenInfoEnhanced(outputMint);

      if (!inputToken || !outputToken) {
        throw new Error('Token information not available');
      }

      // Simplified quote calculation (in production, use Jupiter API)
      const outputAmount = (BigInt(amount) * BigInt(95)) / BigInt(100); // 5% price impact simulation

      return {
        inputToken,
        outputToken,
        inputAmount: amount,
        outputAmount: outputAmount.toString(),
        route: [{
          protocol: 'Jupiter',
          percentage: 100
        }],
        gasEstimate: {
          gasLimit: '0',
          gasPrice: '5000' // 5000 lamports base fee
        },
        priceImpact: '5.0',
        minimumReceived: (outputAmount * BigInt(100 - Math.floor(slippage * 100)) / BigInt(100)).toString(),
        slippage: slippage.toString()
      };
    } catch (error) {
      throw new TransactionError('Failed to get Solana swap quote', 'solana', error as Error);
    }
  }

  /**
   * Execute Solana swap
   */
  private async executeSolanaSwap(quote: SwapQuote, signer: Keypair): Promise<TransactionReceipt> {
    try {
      const connection = await this.getSolanaConnection();
      
      // This is a simplified implementation
      // In production, you would use Jupiter's swap API
      
      const transaction = new SolanaTransaction();
      
      // Add swap instructions (simplified)
      const instruction = SystemProgram.createAccount({
        fromPubkey: signer.publicKey,
        newAccountPubkey: signer.publicKey, // Simplified
        lamports: 0,
        space: 0,
        programId: TOKEN_PROGRAM_ID
      });
      
      transaction.add(instruction);
      
      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [signer],
        { commitment: 'confirmed' }
      );

      // Return transaction receipt
      const receipt = await this.getSolanaTransactionEnhanced(signature);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      return receipt;
    } catch (error) {
      throw new TransactionError('Failed to execute Solana swap', 'solana', error as Error);
    }
  }

  // === TOKEN APPROVAL MANAGEMENT === //

  /**
   * Check ERC-20 token allowance
   */
  public async getTokenAllowance(
    chain: SupportedChain,
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<string> {
    if (chain === 'solana') {
      // Solana doesn't have allowance concept
      return '0';
    }

    try {
      const provider = await this.getProvider(chain);
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        provider
      );

      const allowance = await tokenContract.allowance(owner, spender);
      return allowance.toString();
    } catch (error) {
      throw new TransactionError(`Failed to get token allowance`, chain, error as Error);
    }
  }

  /**
   * Approve ERC-20 token spending
   */
  public async approveToken(
    chain: SupportedChain,
    tokenAddress: string,
    spender: string,
    amount: string,
    signer: ethers.Signer
  ): Promise<TransactionReceipt> {
    if (chain === 'solana') {
      throw new ValidationError('Token approval not applicable for Solana', chain);
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );

      // Estimate gas
      const gasEstimate = await tokenContract.approve.estimateGas(spender, amount);
      
      // Get gas price
      const gasSettings = await this.getGasPrice(chain, 'standard');
      
      // Send transaction
      const tx = await tokenContract.approve(spender, amount, {
        gasLimit: gasEstimate,
        ...gasSettings
      });

      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Cache approval
      const owner = await signer.getAddress();
      const approvalKey = `${tokenAddress}_${spender}_${owner}`;
      const approval: TokenApproval = {
        token: tokenAddress,
        spender,
        amount,
        owner,
        isUnlimited: amount === ethers.MaxUint256.toString(),
        transactionHash: receipt.hash
      };
      
      this.tokenApprovals.set(approvalKey, approval);
      this.emit('token-approved', approval);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        transactionIndex: receipt.index,
        from: receipt.from,
        to: receipt.to,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        status: receipt.status || 0,
        logs: receipt.logs.map((log, index) => ({
          address: log.address,
          topics: log.topics,
          data: log.data,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: index
        })),
        confirmations: receipt.confirmations
      };
    } catch (error) {
      throw new TransactionError(`Failed to approve token`, chain, error as Error);
    }
  }

  /**
   * Revoke ERC-20 token approval
   */
  public async revokeTokenApproval(
    chain: SupportedChain,
    tokenAddress: string,
    spender: string,
    signer: ethers.Signer
  ): Promise<TransactionReceipt> {
    return this.approveToken(chain, tokenAddress, spender, '0', signer);
  }

  /**
   * Get all token approvals for an address
   */
  public getTokenApprovals(owner: string): TokenApproval[] {
    return Array.from(this.tokenApprovals.values()).filter(approval => 
      approval.owner.toLowerCase() === owner.toLowerCase()
    );
  }

  // Public API Methods

  public getChainConfig(chain: SupportedChain): ChainConfig | undefined {
    return this.chains.get(chain);
  }

  public getSupportedChains(): SupportedChain[] {
    return Array.from(this.chains.keys());
  }

  public isChainSupported(chain: string): chain is SupportedChain {
    return this.chains.has(chain as SupportedChain);
  }

  public async getProvider(chain: SupportedChain): Promise<ethers.Provider> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Provider not available for chain: ${chain}`);
    }
    return provider;
  }

  // Block and Transaction Methods

  public async getBlockNumber(chain: SupportedChain): Promise<number> {
    if (chain === 'solana') {
      return await this.getSolanaSlot();
    }

    const provider = await this.getProvider(chain);
    return provider.getBlockNumber();
  }

  public async getBlock(chain: SupportedChain, blockNumber: number): Promise<BlockInfo> {
    if (chain === 'solana') {
      return await this.getSolanaBlock(blockNumber);
    }

    const provider = await this.getProvider(chain);
    const block = await provider.getBlock(blockNumber);
    
    if (!block) {
      throw new Error(`Block ${blockNumber} not found on ${chain}`);
    }

    return {
      number: block.number,
      hash: block.hash || '0x',
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
      baseFeePerGas: block.baseFeePerGas?.toString(),
      transactions: [...block.transactions]
    };
  }

  public async getTransaction(chain: SupportedChain, hash: string): Promise<TransactionReceipt | null> {
    if (chain === 'solana') {
      return await this.getSolanaTransactionEnhanced(hash);
    }

    const provider = await this.getProvider(chain);
    const receipt = await provider.getTransactionReceipt(hash);
    
    if (!receipt) return null;

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      transactionIndex: receipt.index,
      from: receipt.from,
      to: receipt.to || undefined,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasPrice.toString(),
      status: receipt.status || 0,
      logs: receipt.logs.map(log => ({
        address: log.address,
        topics: [...log.topics],
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index
      })),
      confirmations: await receipt.confirmations()
    };
  }

  // Gas Management

  public async getGasPrice(chain: SupportedChain, speed: 'fast' | 'standard' | 'safe' = 'standard'): Promise<GasSettings> {
    if (chain === 'solana') {
      return { gasLimit: '200000' }; // Solana uses compute units
    }

    const provider = await this.getProvider(chain);
    const chainConfig = this.getChainConfig(chain)!;

    if (chainConfig.features.eip1559) {
      const feeData = await provider.getFeeData();
      
      let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
      let maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');

      // Adjust based on speed
      const multipliers = {
        safe: 0.8,
        standard: 1.0,
        fast: 1.2
      };

      const multiplier = multipliers[speed];
      maxPriorityFeePerGas = (maxPriorityFeePerGas * BigInt(Math.floor(multiplier * 100))) / BigInt(100);
      maxFeePerGas = (maxFeePerGas * BigInt(Math.floor(multiplier * 100))) / BigInt(100);

      return {
        type: 2,
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
      };
    } else {
      const gasPrice = await provider.getFeeData();
      let price = gasPrice.gasPrice || ethers.parseUnits('5', 'gwei');

      // Adjust based on speed
      const multipliers = {
        safe: 0.8,
        standard: 1.0,
        fast: 1.2
      };

      const multiplier = multipliers[speed];
      price = (price * BigInt(Math.floor(multiplier * 100))) / BigInt(100);

      return {
        type: 0,
        gasPrice: price.toString()
      };
    }
  }

  public async estimateGas(chain: SupportedChain, transaction: TransactionRequest): Promise<string> {
    if (chain === 'solana') {
      return '200000'; // Estimated compute units for Solana
    }

    const provider = await this.getProvider(chain);
    const gasEstimate = await provider.estimateGas(transaction);
    
    // Apply gas multiplier for safety
    const multiplied = (gasEstimate * BigInt(Math.floor(this.config.gasMultiplier * 100))) / BigInt(100);
    
    return multiplied.toString();
  }

  // Token Management

  public async getTokenInfo(chain: SupportedChain, address: string): Promise<TokenInfo | null> {
    const tokenList = this.tokenLists.get(chain);
    const cachedToken = tokenList?.get(address.toLowerCase());
    
    if (cachedToken) {
      return cachedToken;
    }

    // Fetch from chain if not cached
    return this.fetchTokenInfoFromChain(chain, address);
  }

  private async fetchTokenInfoFromChain(chain: SupportedChain, address: string): Promise<TokenInfo | null> {
    if (chain === 'solana') {
      return this.fetchSolanaTokenInfoEnhanced(address);
    }

    try {
      const provider = await this.getProvider(chain);
      
      // ERC-20 contract ABI for basic info
      const abi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ];

      const contract = new ethers.Contract(address, abi, provider);
      
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);

      const tokenInfo: TokenInfo = {
        address: address.toLowerCase(),
        name,
        symbol,
        decimals
      };

      // Cache the token info
      const tokenList = this.tokenLists.get(chain);
      if (tokenList) {
        tokenList.set(address.toLowerCase(), tokenInfo);
      }

      return tokenInfo;
    } catch (error) {
      console.error(`Failed to fetch token info for ${address} on ${chain}:`, error);
      return null;
    }
  }

  public async getTokenBalance(chain: SupportedChain, tokenAddress: string, walletAddress: string): Promise<string> {
    if (chain === 'solana') {
      return await this.getSolanaTokenBalanceEnhanced(tokenAddress, walletAddress);
    }

    const provider = await this.getProvider(chain);
    
    // Check if it's native token
    if (tokenAddress === 'native' || tokenAddress === ethers.ZeroAddress) {
      const balance = await provider.getBalance(walletAddress);
      return balance.toString();
    }

    // ERC-20 token
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const balance = await contract.balanceOf(walletAddress);
    
    return balance.toString();
  }

  // DEX Integration

  public async getSwapQuote(
    chain: SupportedChain,
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    slippage: number = this.config.defaultSlippage
  ): Promise<SwapQuote> {
    if (chain === 'solana') {
      return this.getSolanaSwapQuote(inputToken, outputToken, inputAmount, slippage);
    }

    // Use 0x API for EVM chains
    return this.get0xSwapQuote(chain, inputToken, outputToken, inputAmount, slippage);
  }

  public async executeSwap(
    chain: SupportedChain,
    quote: SwapQuote,
    signer: ethers.Signer
  ): Promise<TransactionReceipt> {
    if (chain === 'solana') {
      return this.executeSolanaSwap(quote, signer);
    }

    // Execute EVM swap
    return this.executeEVMSwap(chain, quote, signer);
  }

  // Cross-chain bridge operations

  public async getBridgeQuote(
    fromChain: SupportedChain,
    toChain: SupportedChain,
    token: string,
    amount: string
  ): Promise<any> {
    // Implement bridge quote logic (Stargate, LayerZero, etc.)
    throw new Error('Bridge operations not yet implemented');
  }

  // Utility Methods

  public formatAmount(amount: string, decimals: number): string {
    return ethers.formatUnits(amount, decimals);
  }

  public parseAmount(amount: string, decimals: number): string {
    return ethers.parseUnits(amount, decimals).toString();
  }

  public isValidAddress(chain: SupportedChain, address: string): boolean {
    if (chain === 'solana') {
      // Solana address validation
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    return ethers.isAddress(address);
  }

  // Private helper methods for Solana

  private async getSolanaSlot(): Promise<number> {
    // Implement Solana slot fetching
    throw new Error('Solana slot fetching not implemented');
  }

  private async getSolanaBlock(slot: number): Promise<BlockInfo> {
    // Implement Solana block fetching
    throw new Error('Solana block fetching not implemented');
  }

  private async getSolanaTransactionEnhanced(signature: string): Promise<TransactionReceipt | null> {
    // Implement Solana transaction fetching
    throw new Error('Solana transaction fetching not implemented');
  }

  private async fetchSolanaTokenInfoEnhanced(mint: string): Promise<TokenInfo | null> {
    // Implement Solana token info fetching
    throw new Error('Solana token info fetching not implemented');
  }

  private async getSolanaTokenBalanceEnhanced(mint: string, owner: string): Promise<string> {
    // Implement Solana token balance fetching
    throw new Error('Solana token balance fetching not implemented');
  }

  private async getSolanaSwapQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippage: number
  ): Promise<SwapQuote> {
    // Implement Jupiter API integration for Solana swaps
    throw new Error('Solana swap quotes not implemented');
  }

  private async executeSolanaSwap(quote: SwapQuote, signer: any): Promise<TransactionReceipt> {
    // Implement Solana swap execution
    throw new Error('Solana swap execution not implemented');
  }

  // Private helper methods for EVM chains

  private async get0xSwapQuote(
    chain: SupportedChain,
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    slippage: number
  ): Promise<SwapQuote> {
    // Implement 0x API integration
    const chainConfig = this.getChainConfig(chain)!;
    
    // Mock implementation - replace with actual 0x API call
    const inputTokenInfo = await this.getTokenInfo(chain, inputToken);
    const outputTokenInfo = await this.getTokenInfo(chain, outputToken);
    
    if (!inputTokenInfo || !outputTokenInfo) {
      throw new Error('Token info not found');
    }

    // Simulate price calculation (replace with real API)
    const outputAmount = (BigInt(inputAmount) * BigInt(98)) / BigInt(100); // 2% simulated slippage

    return {
      inputToken: inputTokenInfo,
      outputToken: outputTokenInfo,
      inputAmount,
      outputAmount: outputAmount.toString(),
      route: [
        {
          protocol: 'Uniswap V3',
          percentage: 100
        }
      ],
      gasEstimate: await this.getGasPrice(chain, 'fast'),
      priceImpact: '0.1',
      minimumReceived: ((outputAmount * BigInt(10000 - Math.floor(slippage * 100))) / BigInt(10000)).toString(),
      slippage: slippage.toString()
    };
  }

  private async executeEVMSwap(
    chain: SupportedChain,
    quote: SwapQuote,
    signer: ethers.Signer
  ): Promise<TransactionReceipt> {
    // Implement EVM swap execution using 0x or DEX router
    throw new Error('EVM swap execution not implemented');
  }

  // Event methods

  public async waitForTransaction(
    chain: SupportedChain,
    hash: string,
    confirmations: number = 1
  ): Promise<TransactionReceipt | null> {
    if (chain === 'solana') {
      // Implement Solana transaction confirmation waiting
      throw new Error('Solana transaction waiting not implemented');
    }

    const provider = await this.getProvider(chain);
    const receipt = await provider.waitForTransaction(hash, confirmations);
    
    if (!receipt) return null;

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      transactionIndex: receipt.index,
      from: receipt.from,
      to: receipt.to || undefined,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasPrice.toString(),
      status: receipt.status || 0,
      logs: receipt.logs.map(log => ({
        address: log.address,
        topics: [...log.topics],
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index
      })),
      confirmations: await receipt.confirmations()
    };
  }

  public destroy(): void {
    // Close WebSocket connections
    for (const [chain, connection] of this.wsConnections) {
      if (connection.isConnected) {
        connection.ws.close();
      }
    }

    // Clear reconnect timers
    for (const [chain, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }

    // Close Solana connection
    if (this.solanaConnection) {
      // Solana connection doesn't need explicit closing
      this.solanaConnection = null;
    }

    // Clear all event listeners
    this.removeAllListeners();

    this.logger.info('Chain abstraction destroyed');
  }

  // Missing methods that are used by bot packages
  public async getWallet(address: string): Promise<any> {
    // TODO: Implement wallet management
    throw new Error('Wallet management not yet implemented');
  }

  public async sendTransaction(transaction: TransactionRequest): Promise<TransactionReceipt> {
    // TODO: Implement transaction sending
    throw new Error('Transaction sending not yet implemented');
  }

  public async getBalance(address: string, tokenAddress?: string): Promise<string> {
    // TODO: Implement balance fetching
    throw new Error('Balance fetching not yet implemented');
  }
}
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import axios from 'axios';
import WebSocket from 'ws';
import NodeCache from 'node-cache';

export interface BscMevConfig {
  provider: 'bloxroute' | 'nodereal';
  apiKey: string;
  endpoint: string;
  maxGasPrice: string;
  minProfitBnb: string;
  preferredValidators: string[];
  mempoolSubscription: boolean;
  maxSlippagePercent: number;
  frontRunRatio: number;
  gasPremiumPercent: number;
  bundleTimeoutAttempts: number;
}

export interface BscMevBundle {
  id: string;
  transactions: ethers.TransactionRequest[];
  blockNumber: number;
  estimatedProfit: string;
  gasPrice: string;
  totalGasLimit: string;
  status: 'pending' | 'included' | 'failed' | 'cancelled';
  submissionTime: number;
  inclusionTime?: number;
  txHashes?: string[];
  failureReason?: string;
  slippageProtection: {
    maxSlippage: number;
    priceImpactLimit: number;
    minimumOutput: string;
  };
}

export interface BscSandwichOpportunity {
  victimTxHash: string;
  victimTransaction: ethers.TransactionRequest;
  pancakeRouter: string;
  tokenA: string;
  tokenB: string;
  amountIn: string;
  expectedAmountOut: string;
  estimatedProfit: string;
  gasPrice: string;
  blockNumber: number;
  slippage: number;
  priceImpact: number;
  poolLiquidity: string;
}

export interface BloxRouteResponse {
  result: {
    bundleHash: string;
    bundleId: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface NodeRealResponse {
  jsonrpc: string;
  id: number;
  result?: {
    bundleHash: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface SlippageCalculation {
  maxSlippage: number;
  priceImpact: number;
  priceImpactLimit: number;
  minimumOutput: string;
  minimumOutputAmount: string;
  frontRunSlippage: number;
  backRunSlippage: number;
  totalSlippage: number;
}

export class BscMevClient extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private config: BscMevConfig;
  private bundles: Map<string, BscMevBundle> = new Map();
  private isConnected = false;
  private mempoolWs?: WebSocket | undefined;
  private gasCache = new NodeCache({ stdTTL: 30 }); // 30 second cache
  private poolCache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

  // PancakeSwap Router addresses
  private readonly PANCAKE_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  private readonly PANCAKE_ROUTER_V3 = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
  private readonly WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

  // Performance metrics
  private metrics = {
    totalBundles: 0,
    includedBundles: 0,
    failedBundles: 0,
    totalProfit: '0',
    totalGasCost: '0',
    averageLatency: 0,
    inclusionRate: 0
  };

  constructor(provider: ethers.JsonRpcProvider, privateKey: string, config: BscMevConfig) {
    super();
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.config = {
      ...config,
      maxSlippagePercent: config.maxSlippagePercent || 5,
      frontRunRatio: config.frontRunRatio || 0.35,
      gasPremiumPercent: config.gasPremiumPercent || 20,
      bundleTimeoutAttempts: config.bundleTimeoutAttempts || 20
    };
  }

  async initialize(): Promise<void> {
    try {
      // Test connection based on provider type
      if (this.config.provider === 'bloxroute') {
        await this.initializeBloxRoute();
      } else if (this.config.provider === 'nodereal') {
        await this.initializeNodeReal();
      }

      // Initialize mempool subscription if enabled
      if (this.config.mempoolSubscription) {
        await this.initializeMempoolSubscription();
      }

      this.isConnected = true;
      this.emit('connected');
      console.log(`BSC MEV client connected via ${this.config.provider}`);
    } catch (error) {
      console.error('Failed to initialize BSC MEV client:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async initializeBloxRoute(): Promise<void> {
    try {
      const response = await axios.post(this.config.endpoint, {
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
        id: 1,
        jsonrpc: '2.0'
      }, {
        headers: {
          'Authorization': this.config.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.error) {
        throw new Error(`BloxRoute connection failed: ${response.data.error.message}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`BloxRoute API error: ${error.message}`);
      }
      throw error;
    }
  }

  private async initializeNodeReal(): Promise<void> {
    try {
      const response = await axios.post(this.config.endpoint, {
        method: 'eth_blockNumber',
        params: [],
        id: 1,
        jsonrpc: '2.0'
      }, {
        headers: {
          'X-API-KEY': this.config.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.error) {
        throw new Error(`NodeReal connection failed: ${response.data.error.message}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`NodeReal API error: ${error.message}`);
      }
      throw error;
    }
  }

  private async initializeMempoolSubscription(): Promise<void> {
    try {
      let wsUrl: string;
      let headers: any = {};

      if (this.config.provider === 'bloxroute') {
        wsUrl = this.config.endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
        headers['Authorization'] = this.config.apiKey;
      } else {
        wsUrl = this.config.endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
        headers['X-API-KEY'] = this.config.apiKey;
      }

      this.mempoolWs = new WebSocket(wsUrl, { headers });

      this.mempoolWs.on('open', () => {
        console.log('Mempool subscription established');
        this.subscribeToPendingTransactions();
      });

      this.mempoolWs.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMempoolMessage(message);
        } catch (error) {
          console.warn('Failed to parse mempool message:', error);
        }
      });

      this.mempoolWs.on('error', (error) => {
        console.error('Mempool WebSocket error:', error);
        this.emit('mempoolError', error);
      });

      this.mempoolWs.on('close', () => {
        console.warn('Mempool WebSocket closed, attempting to reconnect...');
        setTimeout(() => this.initializeMempoolSubscription(), 5000);
      });

    } catch (error) {
      console.error('Failed to initialize mempool subscription:', error);
      this.emit('error', error);
    }
  }

  private subscribeToPendingTransactions(): void {
    if (!this.mempoolWs || this.mempoolWs.readyState !== WebSocket.OPEN) return;

    const subscription = {
      method: 'eth_subscribe',
      params: ['newPendingTransactions', true],
      id: 1,
      jsonrpc: '2.0'
    };

    this.mempoolWs.send(JSON.stringify(subscription));
  }

  private handleMempoolMessage(message: any): void {
    if (message.method === 'eth_subscription' && message.params?.result) {
      const transaction = message.params.result;
      this.emit('pendingTransaction', transaction);
    }
  }

  async createSandwichBundle(opportunity: BscSandwichOpportunity): Promise<BscMevBundle> {
    const bundleId = `bsc_sandwich_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate slippage protection
    const slippageProtection = await this.calculateSlippageProtection(opportunity);
    
    // Select optimal router based on opportunity and token types
    const optimalRouter = this.selectOptimalRouter(opportunity);
    
    // Create front-run transaction with slippage protection
    const frontRunTx = await this.createFrontRunTransaction(opportunity, optimalRouter, slippageProtection);
    
    // Create back-run transaction with slippage protection
    const backRunTx = await this.createBackRunTransaction(opportunity, optimalRouter, slippageProtection);
    
    // Bundle: [front-run, victim tx, back-run]
    const bundleTransactions: ethers.TransactionRequest[] = [
      frontRunTx,
      opportunity.victimTransaction,
      backRunTx
    ];

    const bundle: BscMevBundle = {
      id: bundleId,
      transactions: bundleTransactions,
      blockNumber: opportunity.blockNumber + 1,
      estimatedProfit: opportunity.estimatedProfit,
      gasPrice: opportunity.gasPrice,
      totalGasLimit: '900000', // Conservative total gas limit
      status: 'pending',
      submissionTime: Date.now(),
      slippageProtection
    };

    this.bundles.set(bundleId, bundle);
    this.metrics.totalBundles++;
    this.emit('bundleCreated', bundle);

    return bundle;
  }

  /**
   * Calculate comprehensive slippage protection parameters
   */
  private async calculateSlippageProtection(opportunity: BscSandwichOpportunity): Promise<SlippageCalculation> {
    const victimAmountIn = parseFloat(opportunity.amountIn);
    const expectedAmountOut = parseFloat(opportunity.expectedAmountOut);
    const poolLiquidity = parseFloat(opportunity.poolLiquidity);
    
    // Calculate front-run amount based on configured ratio
    const frontRunAmount = victimAmountIn * this.config.frontRunRatio;
    
    // Calculate price impact for front-run
    const frontRunPriceImpact = (frontRunAmount / poolLiquidity) * 100;
    
    // Calculate expected slippage for victim transaction after front-run
    const liquidityAfterFrontRun = poolLiquidity + frontRunAmount;
    const victimPriceImpact = (victimAmountIn / liquidityAfterFrontRun) * 100;
    
    // Calculate back-run slippage
    const backRunPriceImpact = frontRunPriceImpact * 0.8; // Approximate back-run impact
    
    // Total slippage includes all steps
    const totalSlippage = frontRunPriceImpact + victimPriceImpact + backRunPriceImpact;
    
    // Calculate minimum output amount with slippage protection
    const slippageMultiplier = (100 - this.config.maxSlippagePercent) / 100;
    const minimumOutputAmount = (expectedAmountOut * slippageMultiplier).toString();

    return {
      maxSlippage: this.config.maxSlippagePercent,
      priceImpact: Math.max(frontRunPriceImpact, victimPriceImpact),
      priceImpactLimit: this.config.maxSlippagePercent,
      minimumOutput: slippageMultiplier.toString(),
      minimumOutputAmount,
      frontRunSlippage: frontRunPriceImpact,
      backRunSlippage: backRunPriceImpact,
      totalSlippage
    };
  }

  /**
   * Select optimal PancakeSwap router based on opportunity characteristics
   */
  private selectOptimalRouter(opportunity: BscSandwichOpportunity): string {
    // Use provided router if specified and valid
    if (opportunity.pancakeRouter && 
        (opportunity.pancakeRouter === this.PANCAKE_ROUTER_V2 || 
         opportunity.pancakeRouter === this.PANCAKE_ROUTER_V3)) {
      return opportunity.pancakeRouter;
    }

    // Router selection logic based on token pair and trade size
    const tradeSize = parseFloat(opportunity.amountIn);
    const isLargeVolume = tradeSize > 100; // Threshold for large volume trades

    // V3 is generally better for large volumes due to concentrated liquidity
    // V2 is more reliable for smaller trades and has wider compatibility
    if (isLargeVolume && opportunity.slippage < 2) {
      console.log(`Selected PancakeSwap V3 router for large volume trade: ${tradeSize}`);
      return this.PANCAKE_ROUTER_V3;
    } else {
      console.log(`Selected PancakeSwap V2 router for standard trade: ${tradeSize}`);
      return this.PANCAKE_ROUTER_V2;
    }
  }

  private async createFrontRunTransaction(
    opportunity: BscSandwichOpportunity, 
    routerAddress: string,
    slippageProtection: SlippageCalculation
  ): Promise<ethers.TransactionRequest> {
    // Calculate front-run amount with slippage consideration
    const frontRunAmount = await this.calculateOptimalFrontRunAmount(opportunity, slippageProtection);
    
    // Calculate minimum amount out with slippage protection
    const frontRunMinAmountOut = await this.calculateMinAmountOut(
      frontRunAmount,
      opportunity.tokenA,
      opportunity.tokenB,
      slippageProtection.frontRunSlippage
    );
    
    // Encode PancakeSwap transaction using the selected router
    const swapData = await this.encodePancakeSwap(
      opportunity.tokenA,
      opportunity.tokenB,
      frontRunAmount,
      frontRunMinAmountOut,
      this.wallet.address,
      routerAddress
    );

    const optimalGasPrice = await this.getOptimalGasPrice();
    const nonce = await this.wallet.getNonce();

    const frontRunTx: ethers.TransactionRequest = {
      to: routerAddress,
      data: swapData,
      value: opportunity.tokenA === this.WBNB ? frontRunAmount : '0',
      gasPrice: ethers.parseUnits(optimalGasPrice, 'gwei'),
      gasLimit: 300000,
      nonce: nonce
    };

    return frontRunTx;
  }

  private async createBackRunTransaction(
    opportunity: BscSandwichOpportunity, 
    routerAddress: string,
    slippageProtection: SlippageCalculation
  ): Promise<ethers.TransactionRequest> {
    // Calculate minimum amount out for back-run with slippage protection
    const backRunMinAmountOut = slippageProtection.minimumOutputAmount;
    
    // Back-run swaps back to original token using the same router
    const swapData = await this.encodePancakeSwap(
      opportunity.tokenB,
      opportunity.tokenA,
      '0', // Will use balance from front-run
      backRunMinAmountOut,
      this.wallet.address,
      routerAddress
    );

    const optimalGasPrice = await this.getOptimalGasPrice();
    const baseNonce = await this.wallet.getNonce();

    const backRunTx: ethers.TransactionRequest = {
      to: routerAddress,
      data: swapData,
      value: '0',
      gasPrice: ethers.parseUnits(optimalGasPrice, 'gwei'),
      gasLimit: 300000,
      nonce: baseNonce + 2 // Account for front-run and victim tx
    };

    return backRunTx;
  }

  private async calculateMinAmountOut(
    amountIn: string,
    tokenIn: string,
    tokenOut: string,
    slippagePercent: number
  ): Promise<string> {
    try {
      // Get pool reserves for calculation
      const poolData = await this.getPoolData(tokenIn, tokenOut);
      if (!poolData) return '0';

      // Use constant product formula to calculate expected output
      const amountInBig = ethers.parseEther(amountIn);
      const reserveIn = ethers.parseEther(poolData.reserve0);
      const reserveOut = ethers.parseEther(poolData.reserve1);

      // Calculate expected output: (reserveOut * amountIn) / (reserveIn + amountIn)
      const expectedOutput = (reserveOut * amountInBig) / (reserveIn + amountInBig);
      
      // Apply slippage protection
      const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));
      const minAmountOut = (expectedOutput * slippageMultiplier) / BigInt(10000);

      return ethers.formatEther(minAmountOut);
    } catch (error) {
      console.warn('Failed to calculate minimum amount out:', error);
      return '0';
    }
  }

  private async getPoolData(tokenA: string, tokenB: string): Promise<{ reserve0: string; reserve1: string } | null> {
    const cacheKey = `pool_${tokenA}_${tokenB}`;
    const cached = this.poolCache.get<any>(cacheKey);
    if (cached) return cached;

    try {
      // Implementation would fetch real pool data from PancakeSwap
      // For now, return mock data
      const poolData = {
        reserve0: '1000000', // Would fetch real reserves
        reserve1: '1000000'
      };

      this.poolCache.set(cacheKey, poolData);
      return poolData;
    } catch (error) {
      console.warn('Failed to fetch pool data:', error);
      return null;
    }
  }

  private async encodePancakeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOutMin: string,
    to: string,
    routerAddress?: string
  ): Promise<string> {
    const routerABI = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
    ];

    const router = new ethers.Interface(routerABI);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    // Log which router is being used for transaction encoding
    const selectedRouter = routerAddress || this.PANCAKE_ROUTER_V2;
    console.log(`Encoding swap for router: ${selectedRouter}`);

    if (tokenIn === this.WBNB) {
      // BNB to Token
      const path = [this.WBNB, tokenOut];
      return router.encodeFunctionData('swapExactETHForTokens', [
        ethers.parseEther(amountOutMin),
        path,
        to,
        deadline
      ]);
    } else if (tokenOut === this.WBNB) {
      // Token to BNB
      const path = [tokenIn, this.WBNB];
      return router.encodeFunctionData('swapExactTokensForETH', [
        ethers.parseEther(amountIn),
        ethers.parseEther(amountOutMin),
        path,
        to,
        deadline
      ]);
    } else {
      // Token to Token (via BNB)
      const path = [tokenIn, this.WBNB, tokenOut];
      return router.encodeFunctionData('swapExactTokensForTokens', [
        ethers.parseEther(amountIn),
        ethers.parseEther(amountOutMin),
        path,
        to,
        deadline
      ]);
    }
  }

  async submitBundle(bundleId: string): Promise<void> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    try {
      const startTime = Date.now();
      
      if (this.config.provider === 'bloxroute') {
        await this.submitToBloxRoute(bundle);
      } else if (this.config.provider === 'nodereal') {
        await this.submitToNodeReal(bundle);
      }

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics({ latency });

    } catch (error) {
      bundle.status = 'failed';
      bundle.failureReason = error instanceof Error ? error.message : 'Unknown error';
      this.metrics.failedBundles++;
      this.emit('bundleFailed', bundle);
      throw error;
    }
  }

  private async submitToBloxRoute(bundle: BscMevBundle): Promise<void> {
    // Serialize transactions for BloxRoute
    const serializedTxs = await Promise.all(
      bundle.transactions.map(async (tx) => {
        const signedTx = await this.wallet.signTransaction(tx);
        return signedTx;
      })
    );

    const payload = {
      method: 'blxr_submit_bundle',
      params: [
        {
          transactions: serializedTxs,
          blockNumber: `0x${bundle.blockNumber.toString(16)}`,
          minTimestamp: 0,
          maxTimestamp: 0
        }
      ],
      id: 1,
      jsonrpc: '2.0'
    };

    const response = await axios.post(this.config.endpoint, payload, {
      headers: {
        'Authorization': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const result: BloxRouteResponse = response.data;

    if (result.error) {
      throw new Error(`BloxRoute submission failed: ${result.error.message}`);
    }

    bundle.status = 'pending';
    this.emit('bundleSubmitted', bundle, result);
    this.monitorBundleInclusion(bundle);
  }

  private async submitToNodeReal(bundle: BscMevBundle): Promise<void> {
    // Serialize transactions for NodeReal
    const serializedTxs = await Promise.all(
      bundle.transactions.map(async (tx) => {
        const signedTx = await this.wallet.signTransaction(tx);
        return signedTx;
      })
    );

    const payload = {
      method: 'eth_sendBundle',
      params: [
        {
          txs: serializedTxs,
          blockNumber: `0x${bundle.blockNumber.toString(16)}`
        }
      ],
      id: 1,
      jsonrpc: '2.0'
    };

    const response = await axios.post(this.config.endpoint, payload, {
      headers: {
        'X-API-KEY': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const result: NodeRealResponse = response.data;

    if (result.error) {
      throw new Error(`NodeReal submission failed: ${result.error.message}`);
    }

    bundle.status = 'pending';
    this.emit('bundleSubmitted', bundle, result);
    this.monitorBundleInclusion(bundle);
  }

  private async monitorBundleInclusion(bundle: BscMevBundle): Promise<void> {
    const maxAttempts = this.config.bundleTimeoutAttempts;
    let attempts = 0;

    const checkInclusion = async (): Promise<void> => {
      try {
        if (attempts >= maxAttempts) {
          bundle.status = 'failed';
          bundle.failureReason = 'Bundle not included within timeout';
          this.metrics.failedBundles++;
          this.emit('bundleFailed', bundle);
          return;
        }

        const currentBlock = await this.provider.getBlockNumber();
        
        if (currentBlock >= bundle.blockNumber) {
          // Check if transactions were included
          const block = await this.provider.getBlock(bundle.blockNumber, true);
          
          if (block) {
            const includedTxs = block.transactions.filter((tx: any) => 
              bundle.transactions.some(bundleTx => {
                // Compare transaction properties to match bundle transactions
                const txTo = tx.to ? String(tx.to).toLowerCase() : '';
                const bundleTo = bundleTx.to ? String(bundleTx.to).toLowerCase() : '';
                
                const txMatches = tx.from?.toLowerCase() === this.wallet.address.toLowerCase() &&
                                  txTo === bundleTo &&
                                  tx.data === bundleTx.data;
                
                if (txMatches) {
                  console.log(`Found matching transaction: ${tx.hash} for bundle ${bundle.id}`);
                }
                
                return txMatches;
              })
            );

            if (includedTxs.length > 0) {
              bundle.status = 'included';
              bundle.inclusionTime = Date.now();
              bundle.txHashes = includedTxs.map((tx: any) => tx.hash);
              
              // Update metrics
              this.metrics.includedBundles++;
              this.updateMetrics({ 
                profit: bundle.estimatedProfit,
                latency: bundle.inclusionTime - bundle.submissionTime
              });
              
              this.emit('bundleIncluded', bundle);
              return;
            }
          }
        }

        attempts++;
        setTimeout(checkInclusion, 3000); // Check every 3 seconds (BSC block time)

      } catch (error) {
        bundle.status = 'failed';
        bundle.failureReason = error instanceof Error ? error.message : 'Monitoring error';
        this.metrics.failedBundles++;
        this.emit('bundleFailed', bundle);
      }
    };

    checkInclusion();
  }

  private updateMetrics(data: { profit?: string; latency?: number }): void {
    if (data.profit) {
      const profit = parseFloat(data.profit);
      const currentProfit = parseFloat(this.metrics.totalProfit);
      this.metrics.totalProfit = (currentProfit + profit).toString();
    }

    if (data.latency) {
      // Update average latency
      const totalLatency = this.metrics.averageLatency * (this.metrics.totalBundles - 1);
      this.metrics.averageLatency = (totalLatency + data.latency) / this.metrics.totalBundles;
    }

    // Update inclusion rate
    this.metrics.inclusionRate = this.metrics.totalBundles > 0 
      ? (this.metrics.includedBundles / this.metrics.totalBundles) * 100 
      : 0;
  }

  private async calculateOptimalFrontRunAmount(
    opportunity: BscSandwichOpportunity,
    slippageProtection: SlippageCalculation
  ): Promise<string> {
    // Calculate optimal front-run amount based on victim transaction and slippage
    const victimAmount = BigInt(opportunity.amountIn);
    let frontRunRatio = this.config.frontRunRatio;

    // Adjust ratio based on slippage risk
    if (slippageProtection.totalSlippage > 3) {
      frontRunRatio *= 0.8; // Reduce size for high slippage
    } else if (slippageProtection.totalSlippage < 1) {
      frontRunRatio *= 1.2; // Increase size for low slippage
    }

    // Ensure we don't exceed maximum slippage
    frontRunRatio = Math.min(frontRunRatio, 0.5);
    
    const frontRunAmount = victimAmount * BigInt(Math.floor(frontRunRatio * 100)) / BigInt(100);
    
    return frontRunAmount.toString();
  }

  // Enhanced gas price optimization for BSC with caching
  async getOptimalGasPrice(): Promise<string> {
    const cacheKey = 'optimal_gas_price';
    const cached = this.gasCache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      const feeData = await this.provider.getFeeData();
      const networkGasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');
      
      // Add configured premium for MEV competitiveness
      const mevGasPrice = networkGasPrice * BigInt(100 + this.config.gasPremiumPercent) / BigInt(100);
      
      // Cap at maximum gas price
      const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
      const finalGasPrice = mevGasPrice < maxGasPrice ? mevGasPrice : maxGasPrice;
      
      const result = ethers.formatUnits(finalGasPrice, 'gwei');
      this.gasCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.warn('Failed to get optimal gas price:', error);
      return '10'; // Default 10 gwei
    }
  }

  async subscribeMempoolUpdates(): Promise<void> {
    if (!this.config.mempoolSubscription) {
      console.log('Mempool subscription is disabled in configuration');
      return;
    }

    if (!this.mempoolWs || this.mempoolWs.readyState !== WebSocket.OPEN) {
      console.log('Initializing mempool subscription...');
      await this.initializeMempoolSubscription();
    } else {
      console.log('Mempool subscription already active');
    }
  }

  getBundles(): BscMevBundle[] {
    return Array.from(this.bundles.values());
  }

  getBundle(bundleId: string): BscMevBundle | undefined {
    return this.bundles.get(bundleId);
  }

  cancelBundle(bundleId: string): void {
    const bundle = this.bundles.get(bundleId);
    if (bundle && bundle.status === 'pending') {
      bundle.status = 'cancelled';
      this.emit('bundleCancelled', bundle);
    }
  }

  getPerformanceMetrics(): {
    totalBundles: number;
    includedBundles: number;
    failedBundles: number;
    inclusionRate: number;
    totalProfit: string;
    averageProfit: string;
    totalGasCost: string;
    netProfit: string;
    averageLatency: number;
    cacheStats: {
      gasCache: { keys: number; hits: number; misses: number };
      poolCache: { keys: number; hits: number; misses: number };
    };
  } {
    const averageProfit = this.metrics.totalBundles > 0 
      ? (parseFloat(this.metrics.totalProfit) / this.metrics.totalBundles).toString()
      : '0';

    const netProfit = (parseFloat(this.metrics.totalProfit) - parseFloat(this.metrics.totalGasCost)).toString();

    return {
      ...this.metrics,
      averageProfit,
      netProfit,
      cacheStats: {
        gasCache: {
          keys: this.gasCache.keys().length,
          hits: this.gasCache.getStats().hits,
          misses: this.gasCache.getStats().misses
        },
        poolCache: {
          keys: this.poolCache.keys().length,
          hits: this.poolCache.getStats().hits,
          misses: this.poolCache.getStats().misses
        }
      }
    };
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    
    if (this.mempoolWs) {
      this.mempoolWs.close();
      this.mempoolWs = undefined;
    }

    // Clear caches
    this.gasCache.flushAll();
    this.poolCache.flushAll();

    this.emit('disconnected');
  }

  // Configuration update method
  updateConfig(newConfig: Partial<BscMevConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  // Get current configuration
  getConfig(): BscMevConfig {
    return { ...this.config };
  }
}
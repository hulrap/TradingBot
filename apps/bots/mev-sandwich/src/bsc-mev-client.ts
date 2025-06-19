import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import axios from 'axios';

export interface BscMevConfig {
  provider: 'bloxroute' | 'nodereal';
  apiKey: string;
  endpoint: string;
  maxGasPrice: string;
  minProfitBnb: string;
  preferredValidators: string[];
  mempoolSubscription: boolean;
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

export class BscMevClient extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private config: BscMevConfig;
  private bundles: Map<string, BscMevBundle> = new Map();
  private isConnected = false;

  // PancakeSwap Router addresses
  private readonly PANCAKE_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  private readonly PANCAKE_ROUTER_V3 = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
  private readonly WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

  constructor(provider: ethers.JsonRpcProvider, privateKey: string, config: BscMevConfig) {
    super();
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Test connection based on provider type
      if (this.config.provider === 'bloxroute') {
        await this.initializeBloxRoute();
      } else if (this.config.provider === 'nodereal') {
        await this.initializeNodeReal();
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
    // Test BloxRoute connection
    const response = await axios.post(this.config.endpoint, {
      method: 'eth_getBlockByNumber',
      params: ['latest', false],
      id: 1,
      jsonrpc: '2.0'
    }, {
      headers: {
        'Authorization': this.config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.error) {
      throw new Error(`BloxRoute connection failed: ${response.data.error.message}`);
    }
  }

  private async initializeNodeReal(): Promise<void> {
    // Test NodeReal connection
    const response = await axios.post(this.config.endpoint, {
      method: 'eth_blockNumber',
      params: [],
      id: 1,
      jsonrpc: '2.0'
    }, {
      headers: {
        'X-API-KEY': this.config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.error) {
      throw new Error(`NodeReal connection failed: ${response.data.error.message}`);
    }
  }

  async createSandwichBundle(opportunity: BscSandwichOpportunity): Promise<BscMevBundle> {
    const bundleId = `bsc_sandwich_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create front-run transaction
    const frontRunTx = await this.createFrontRunTransaction(opportunity);
    
    // Create back-run transaction
    const backRunTx = await this.createBackRunTransaction(opportunity);
    
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
      submissionTime: Date.now()
    };

    this.bundles.set(bundleId, bundle);
    this.emit('bundleCreated', bundle);

    return bundle;
  }

  private async createFrontRunTransaction(opportunity: BscSandwichOpportunity): Promise<ethers.TransactionRequest> {
    // Calculate front-run amount
    const frontRunAmount = await this.calculateOptimalFrontRunAmount(opportunity);
    
    // Encode PancakeSwap transaction
    const swapData = await this.encodePancakeSwap(
      opportunity.tokenA,
      opportunity.tokenB,
      frontRunAmount,
      '0', // Accept any amount out initially
      this.wallet.address
    );

    const frontRunTx: ethers.TransactionRequest = {
      to: opportunity.pancakeRouter,
      data: swapData,
      value: opportunity.tokenA === this.WBNB ? frontRunAmount : '0',
      gasPrice: ethers.parseUnits(opportunity.gasPrice, 'gwei'),
      gasLimit: 300000,
      nonce: await this.wallet.getNonce()
    };

    return frontRunTx;
  }

  private async createBackRunTransaction(opportunity: BscSandwichOpportunity): Promise<ethers.TransactionRequest> {
    // Back-run swaps back to original token
    const swapData = await this.encodePancakeSwap(
      opportunity.tokenB,
      opportunity.tokenA,
      '0', // Will use balance from front-run
      '0', // Accept any amount out
      this.wallet.address
    );

    const backRunTx: ethers.TransactionRequest = {
      to: opportunity.pancakeRouter,
      data: swapData,
      value: '0',
      gasPrice: ethers.parseUnits(opportunity.gasPrice, 'gwei'),
      gasLimit: 300000,
      nonce: await this.wallet.getNonce() + 2 // Account for front-run and victim tx
    };

    return backRunTx;
  }

  private async encodePancakeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOutMin: string,
    to: string
  ): Promise<string> {
    const routerABI = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
    ];

    const router = new ethers.Interface(routerABI);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    if (tokenIn === this.WBNB) {
      // BNB to Token
      const path = [this.WBNB, tokenOut];
      return router.encodeFunctionData('swapExactETHForTokens', [
        amountOutMin,
        path,
        to,
        deadline
      ]);
    } else if (tokenOut === this.WBNB) {
      // Token to BNB
      const path = [tokenIn, this.WBNB];
      return router.encodeFunctionData('swapExactTokensForETH', [
        amountIn,
        amountOutMin,
        path,
        to,
        deadline
      ]);
    } else {
      // Token to Token (via BNB)
      const path = [tokenIn, this.WBNB, tokenOut];
      return router.encodeFunctionData('swapExactTokensForTokens', [
        amountIn,
        amountOutMin,
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
      if (this.config.provider === 'bloxroute') {
        await this.submitToBloxRoute(bundle);
      } else if (this.config.provider === 'nodereal') {
        await this.submitToNodeReal(bundle);
      }
    } catch (error) {
      bundle.status = 'failed';
      bundle.failureReason = error instanceof Error ? error.message : 'Unknown error';
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
      }
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
      }
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
    const maxAttempts = 20; // Monitor for ~1 minute (3s block time)
    let attempts = 0;

    const checkInclusion = async (): Promise<void> => {
      try {
        if (attempts >= maxAttempts) {
          bundle.status = 'failed';
          bundle.failureReason = 'Bundle not included within timeout';
          this.emit('bundleFailed', bundle);
          return;
        }

        const currentBlock = await this.provider.getBlockNumber();
        
        if (currentBlock >= bundle.blockNumber) {
          // Check if transactions were included
          const block = await this.provider.getBlock(bundle.blockNumber, true);
          
          if (block) {
            const includedTxs = block.transactions.filter((tx: any) => 
              bundle.transactions.some(bundleTx => 
                tx.from?.toLowerCase() === this.wallet.address.toLowerCase()
              )
            );

            if (includedTxs.length > 0) {
              bundle.status = 'included';
              bundle.inclusionTime = Date.now();
              bundle.txHashes = includedTxs.map((tx: any) => tx.hash);
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
        this.emit('bundleFailed', bundle);
      }
    };

    checkInclusion();
  }

  private async calculateOptimalFrontRunAmount(opportunity: BscSandwichOpportunity): Promise<string> {
    // Calculate optimal front-run amount based on victim transaction
    const victimAmount = BigInt(opportunity.amountIn);
    const frontRunRatio = 0.35; // Front-run with 35% of victim's trade size
    const frontRunAmount = victimAmount * BigInt(Math.floor(frontRunRatio * 100)) / BigInt(100);
    
    return frontRunAmount.toString();
  }

  // Gas price optimization for BSC
  async getOptimalGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      const networkGasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');
      
      // Add 20% premium for MEV competitiveness
      const mevGasPrice = networkGasPrice * BigInt(120) / BigInt(100);
      
      // Cap at maximum gas price
      const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
      const finalGasPrice = mevGasPrice < maxGasPrice ? mevGasPrice : maxGasPrice;
      
      return ethers.formatUnits(finalGasPrice, 'gwei');
    } catch (error) {
      console.warn('Failed to get optimal gas price:', error);
      return '10'; // Default 10 gwei
    }
  }

  // BSC-specific mempool monitoring
  async subscribeMempoolUpdates(): Promise<void> {
    if (!this.config.mempoolSubscription) return;

    try {
      // This would implement real-time mempool monitoring
      // for BSC using WebSocket connections to the MEV provider
      console.log('Starting BSC mempool monitoring...');
      
      // Implementation would depend on the specific MEV provider's API
      // BloxRoute and NodeReal have different WebSocket endpoints
      
    } catch (error) {
      console.error('Failed to subscribe to mempool updates:', error);
    }
  }

  // Bundle management
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

  // Performance metrics
  getPerformanceMetrics(): {
    totalBundles: number;
    includedBundles: number;
    failedBundles: number;
    inclusionRate: number;
    totalProfit: string;
    averageProfit: string;
    totalGasCost: string;
    netProfit: string;
  } {
    const bundles = Array.from(this.bundles.values());
    const includedBundles = bundles.filter(b => b.status === 'included');
    const failedBundles = bundles.filter(b => b.status === 'failed');
    
    const totalProfit = includedBundles.reduce((sum, bundle) => {
      return sum + parseFloat(bundle.estimatedProfit);
    }, 0);
    
    const totalGasCost = bundles.reduce((sum, bundle) => {
      const gasPrice = parseFloat(bundle.gasPrice);
      const gasLimit = parseFloat(bundle.totalGasLimit);
      return sum + (gasPrice * gasLimit / 1e9); // Convert to BNB
    }, 0);
    
    const averageProfit = includedBundles.length > 0 ? totalProfit / includedBundles.length : 0;
    const netProfit = totalProfit - totalGasCost;

    return {
      totalBundles: bundles.length,
      includedBundles: includedBundles.length,
      failedBundles: failedBundles.length,
      inclusionRate: bundles.length > 0 ? (includedBundles.length / bundles.length) * 100 : 0,
      totalProfit: totalProfit.toFixed(6),
      averageProfit: averageProfit.toFixed(6),
      totalGasCost: totalGasCost.toFixed(6),
      netProfit: netProfit.toFixed(6)
    };
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.emit('disconnected');
  }
}
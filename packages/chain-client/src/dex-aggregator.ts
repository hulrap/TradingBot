import { EventEmitter } from 'events';
import winston from 'winston';
import axios from 'axios';
import { ChainAbstraction, TokenInfo, GasEstimate } from './chain-abstraction';

export interface DEXConfig {
  id: string;
  name: string;
  chain: string;
  type: 'uniswap-v2' | 'uniswap-v3' | 'curve' | 'balancer' | 'jupiter' | '1inch';
  routerAddress?: string;
  factoryAddress?: string;
  apiUrl?: string;
  apiKey?: string;
  fee: number; // in basis points (100 = 1%)
  gasMultiplier: number;
  isActive: boolean;
  supportedFeatures: string[];
}

export interface SwapRoute {
  dex: string;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  expectedOutputAmount: string;
  minimumOutputAmount: string;
  price: string;
  priceImpact: string;
  slippage: string;
  gasEstimate: GasEstimate;
  route: RouteStep[];
  confidence: number; // 0-100
  executionTime: number; // estimated ms
}

export interface RouteStep {
  dex: string;
  pool: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  fee: number;
  priceImpact: string;
}

export interface SwapQuoteRequest {
  inputToken: string;
  outputToken: string;
  amount: string;
  slippage: number; // 0.5 = 0.5%
  chain: string;
  userAddress?: string;
  maxHops?: number;
  excludeDEXes?: string[];
  includeDEXes?: string[];
  preferredDEX?: string;
  gasPrice?: string;
}

export interface SwapQuoteResponse {
  routes: SwapRoute[];
  bestRoute: SwapRoute;
  estimatedGas: string;
  totalGasCost: string;
  netOutput: string; // output after gas costs
  executionTime: number;
  timestamp: number;
}

export interface DEXStats {
  totalVolume24h: string;
  totalLiquidity: string;
  successRate: number;
  averageSlippage: number;
  averageGasCost: string;
  responseTime: number;
  lastUpdated: number;
}

export interface AggregatorStats {
  totalQuotes: number;
  successfulQuotes: number;
  averageResponseTime: number;
  totalVolumeRouted: string;
  activeDEXes: number;
  chainStats: Map<string, {
    quotes: number;
    volume: string;
    averageSlippage: number;
  }>;
}

export class DEXAggregator extends EventEmitter {
  private logger: winston.Logger;
  private chainAbstraction: ChainAbstraction;
  private dexConfigs: Map<string, DEXConfig> = new Map();
  private tokenLists: Map<string, TokenInfo[]> = new Map(); // chain -> tokens
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private routeCache: Map<string, { routes: SwapRoute[]; timestamp: number }> = new Map();
  private dexStats: Map<string, DEXStats> = new Map();
  private stats: AggregatorStats;

  constructor(chainAbstraction: ChainAbstraction, logger: winston.Logger) {
    super();
    this.chainAbstraction = chainAbstraction;
    this.logger = logger;
    
    this.stats = {
      totalQuotes: 0,
      successfulQuotes: 0,
      averageResponseTime: 0,
      totalVolumeRouted: '0',
      activeDEXes: 0,
      chainStats: new Map()
    };

    this.setupDEXConfigs();
    this.loadTokenLists();
    this.startStatsCollection();
  }

  private setupDEXConfigs(): void {
    // Ethereum DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-eth',
      name: 'Uniswap V3',
      chain: 'ethereum',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.2,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'uniswap-v2-eth',
      name: 'Uniswap V2',
      chain: 'ethereum',
      type: 'uniswap-v2',
      routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    this.addDEXConfig({
      id: '1inch-eth',
      name: '1inch',
      chain: 'ethereum',
      type: '1inch',
      apiUrl: 'https://api.1inch.dev/swap/v5.2/1',
      apiKey: process.env.ONEINCH_API_KEY,
      fee: 0, // 1inch handles fees internally
      gasMultiplier: 1.1,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-dex', 'gas-optimization', 'partial-fill']
    });

    // BSC DEXes
    this.addDEXConfig({
      id: 'pancakeswap-v3-bsc',
      name: 'PancakeSwap V3',
      chain: 'bsc',
      type: 'uniswap-v3',
      routerAddress: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      factoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      fee: 25, // 0.25%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'pancakeswap-v2-bsc',
      name: 'PancakeSwap V2',
      chain: 'bsc',
      type: 'uniswap-v2',
      routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      fee: 25, // 0.25%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    this.addDEXConfig({
      id: '1inch-bsc',
      name: '1inch',
      chain: 'bsc',
      type: '1inch',
      apiUrl: 'https://api.1inch.dev/swap/v5.2/56',
      apiKey: process.env.ONEINCH_API_KEY,
      fee: 0,
      gasMultiplier: 1.1,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-dex', 'gas-optimization']
    });

    // Polygon DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-polygon',
      name: 'Uniswap V3',
      chain: 'polygon',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'quickswap-polygon',
      name: 'QuickSwap',
      chain: 'polygon',
      type: 'uniswap-v2',
      routerAddress: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    // Arbitrum DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-arbitrum',
      name: 'Uniswap V3',
      chain: 'arbitrum',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'camelot-arbitrum',
      name: 'Camelot',
      chain: 'arbitrum',
      type: 'uniswap-v2',
      routerAddress: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
      factoryAddress: '0x6EcCab422D763aC031210895C81787E87B91425a',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    // Optimism DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-optimism',
      name: 'Uniswap V3',
      chain: 'optimism',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    // Solana DEXes
    this.addDEXConfig({
      id: 'jupiter-solana',
      name: 'Jupiter',
      chain: 'solana',
      type: 'jupiter',
      apiUrl: 'https://quote-api.jup.ag/v6',
      fee: 0, // Jupiter aggregates multiple DEXes
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-dex', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'raydium-solana',
      name: 'Raydium',
      chain: 'solana',
      type: 'uniswap-v2', // Similar AMM model
      apiUrl: 'https://api.raydium.io/v2',
      fee: 25, // 0.25%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    this.logger.info('DEX configurations initialized', {
      totalDEXes: this.dexConfigs.size,
      chains: Array.from(new Set(Array.from(this.dexConfigs.values()).map(d => d.chain)))
    });
  }

  private addDEXConfig(config: DEXConfig): void {
    this.dexConfigs.set(config.id, config);
    this.dexStats.set(config.id, {
      totalVolume24h: '0',
      totalLiquidity: '0',
      successRate: 100,
      averageSlippage: 0,
      averageGasCost: '0',
      responseTime: 0,
      lastUpdated: Date.now()
    });
  }

  private async loadTokenLists(): Promise<void> {
    // Load popular token lists for each chain
    const tokenListUrls = {
      ethereum: 'https://tokens.uniswap.org',
      bsc: 'https://tokens.pancakeswap.finance/pancakeswap-extended.json',
      polygon: 'https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json',
      arbitrum: 'https://bridge.arbitrum.io/token-list-42161.json',
      optimism: 'https://static.optimism.io/optimism.tokenlist.json'
    };

    for (const [chain, url] of Object.entries(tokenListUrls)) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        const tokenList = response.data.tokens || response.data;
        
        // Filter and format tokens for our use
        const formattedTokens = tokenList
          .filter((token: any) => token.chainId === this.getChainId(chain))
          .map((token: any) => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI,
            chainId: token.chainId
          }));

        this.tokenLists.set(chain, formattedTokens);
        
        this.logger.info('Token list loaded', {
          chain,
          tokenCount: formattedTokens.length
        });
      } catch (error: any) {
        this.logger.warn('Failed to load token list', {
          chain,
          url,
          error: error.message
        });
      }
    }
  }

  private getChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      solana: 101
    };
    return chainIds[chain] || 1;
  }

  // Main quote aggregation method
  async getSwapQuote(request: SwapQuoteRequest): Promise<SwapQuoteResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      await this.validateQuoteRequest(request);

      // Get available DEXes for the chain
      const availableDEXes = this.getAvailableDEXes(request.chain, request.excludeDEXes, request.includeDEXes);
      
      if (availableDEXes.length === 0) {
        throw new Error(`No available DEXes for chain: ${request.chain}`);
      }

      // Get quotes from multiple DEXes in parallel
      const quotePromises = availableDEXes.map(dex => 
        this.getQuoteFromDEX(dex, request).catch(error => {
          this.logger.warn('DEX quote failed', {
            dex: dex.id,
            error: error.message
          });
          return null;
        })
      );

      const quoteResults = await Promise.allSettled(quotePromises);
      const successfulQuotes = quoteResults
        .filter((result): result is PromiseFulfilledResult<SwapRoute | null> => 
          result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value!);

      if (successfulQuotes.length === 0) {
        throw new Error('No successful quotes from any DEX');
      }

      // Find the best route considering price, gas costs, and confidence
      const bestRoute = this.selectBestRoute(successfulQuotes, request);

      // Update statistics
      this.updateStats(request.chain, successfulQuotes.length > 0);

      const response: SwapQuoteResponse = {
        routes: successfulQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount)),
        bestRoute,
        estimatedGas: bestRoute.gasEstimate.gasLimit,
        totalGasCost: bestRoute.gasEstimate.totalCost,
        netOutput: this.calculateNetOutput(bestRoute),
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      this.emit('quoteGenerated', { request, response, executionTime: response.executionTime });
      
      return response;
    } catch (error: any) {
      this.updateStats(request.chain, false);
      this.logger.error('Failed to get swap quote', {
        request,
        error: error.message,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  private async validateQuoteRequest(request: SwapQuoteRequest): Promise<void> {
    // Validate chain
    if (!this.chainAbstraction.getSupportedChains().includes(request.chain as any)) {
      throw new Error(`Unsupported chain: ${request.chain}`);
    }

    // Validate addresses
    if (!this.chainAbstraction.isValidAddress(request.chain as any, request.inputToken)) {
      throw new Error(`Invalid input token address: ${request.inputToken}`);
    }

    if (!this.chainAbstraction.isValidAddress(request.chain as any, request.outputToken)) {
      throw new Error(`Invalid output token address: ${request.outputToken}`);
    }

    // Validate amount
    if (parseFloat(request.amount) <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate slippage
    if (request.slippage < 0 || request.slippage > 50) {
      throw new Error('Slippage must be between 0 and 50%');
    }
  }

  private getAvailableDEXes(
    chain: string, 
    excludeDEXes?: string[], 
    includeDEXes?: string[]
  ): DEXConfig[] {
    let dexes = Array.from(this.dexConfigs.values())
      .filter(dex => dex.chain === chain && dex.isActive);

    if (includeDEXes && includeDEXes.length > 0) {
      dexes = dexes.filter(dex => includeDEXes.includes(dex.id));
    }

    if (excludeDEXes && excludeDEXes.length > 0) {
      dexes = dexes.filter(dex => !excludeDEXes.includes(dex.id));
    }

    return dexes;
  }

  private async getQuoteFromDEX(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute | null> {
    const startTime = Date.now();

    try {
      let route: SwapRoute;

      switch (dex.type) {
        case '1inch':
          route = await this.get1inchQuote(dex, request);
          break;
        case 'jupiter':
          route = await this.getJupiterQuote(dex, request);
          break;
        case 'uniswap-v3':
          route = await this.getUniswapV3Quote(dex, request);
          break;
        case 'uniswap-v2':
          route = await this.getUniswapV2Quote(dex, request);
          break;
        default:
          throw new Error(`Unsupported DEX type: ${dex.type}`);
      }

      // Update DEX stats
      const responseTime = Date.now() - startTime;
      this.updateDEXStats(dex.id, responseTime, true);

      return route;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.updateDEXStats(dex.id, responseTime, false);
      throw error;
    }
  }

  private async get1inchQuote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    const params = new URLSearchParams({
      fromTokenAddress: request.inputToken,
      toTokenAddress: request.outputToken,
      amount: request.amount,
      slippage: request.slippage.toString(),
      disableEstimate: 'false',
      allowPartialFill: 'true'
    });

    if (request.userAddress) {
      params.append('fromAddress', request.userAddress);
    }

    const response = await axios.get(`${dex.apiUrl}/quote?${params}`, {
      headers: {
        'Authorization': `Bearer ${dex.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const quote = response.data;

    // Get token info
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);

    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount: quote.toTokenAmount,
      expectedOutputAmount: quote.toTokenAmount,
      minimumOutputAmount: quote.toTokenAmount,
      price: (parseFloat(quote.toTokenAmount) / parseFloat(request.amount)).toString(),
      priceImpact: (quote.estimatedGas / parseFloat(quote.toTokenAmount) * 100).toString(),
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: quote.estimatedGas.toString(),
        gasPrice: quote.gasPrice?.toString() || '0',
        estimatedCost: quote.estimatedGas.toString(),
        totalCost: quote.estimatedGas.toString(),
        totalCostFormatted: '0 ETH'
      },
      route: this.parse1inchRoute(quote.protocols),
      confidence: 85, // 1inch generally reliable
      executionTime: 2000 // estimated
    };
  }

  private async getJupiterQuote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    const params = new URLSearchParams({
      inputMint: request.inputToken,
      outputMint: request.outputToken,
      amount: request.amount,
      slippageBps: (request.slippage * 100).toString()
    });

    const response = await axios.get(`${dex.apiUrl}/quote?${params}`, {
      timeout: 10000
    });

    const quote = response.data;

    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);

    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount: quote.outAmount,
      expectedOutputAmount: quote.outAmount,
      minimumOutputAmount: quote.otherAmountThreshold,
      price: (parseFloat(quote.outAmount) / parseFloat(request.amount)).toString(),
      priceImpact: quote.priceImpactPct || '0',
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: '200000', // Solana compute units
        gasPrice: '5000',
        estimatedCost: '1000000',
        totalCost: '1000000',
        totalCostFormatted: '0.001 SOL'
      },
      route: this.parseJupiterRoute(quote.routePlan),
      confidence: 90, // Jupiter is highly optimized
      executionTime: 1000
    };
  }

  private async getUniswapV3Quote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    // For now, return a simulated quote
    // In production, this would call Uniswap V3 quoter contract
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);

    // Simulate price calculation (simplified)
    const mockPrice = 1.0; // Would get from price oracle
    const outputAmount = (parseFloat(request.amount) * mockPrice * 0.997).toString(); // 0.3% fee

    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount,
      expectedOutputAmount: outputAmount,
      minimumOutputAmount: (parseFloat(outputAmount) * (1 - request.slippage / 100)).toString(),
      price: mockPrice.toString(),
      priceImpact: '0.1',
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: '150000',
        gasPrice: '20000000000',
        estimatedCost: '3000000000000000',
        totalCost: '3000000000000000',
        totalCostFormatted: '0.003 ETH'
      },
      route: [{
        dex: dex.id,
        pool: '0x...',
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: request.amount,
        amountOut: outputAmount,
        fee: dex.fee,
        priceImpact: '0.1'
      }],
      confidence: 80,
      executionTime: 3000
    };
  }

  private async getUniswapV2Quote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    // Similar to V3 but simpler routing
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);

    const mockPrice = 1.0;
    const outputAmount = (parseFloat(request.amount) * mockPrice * 0.997).toString();

    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount,
      expectedOutputAmount: outputAmount,
      minimumOutputAmount: (parseFloat(outputAmount) * (1 - request.slippage / 100)).toString(),
      price: mockPrice.toString(),
      priceImpact: '0.2',
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: '120000',
        gasPrice: '20000000000',
        estimatedCost: '2400000000000000',
        totalCost: '2400000000000000',
        totalCostFormatted: '0.0024 ETH'
      },
      route: [{
        dex: dex.id,
        pool: '0x...',
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: request.amount,
        amountOut: outputAmount,
        fee: dex.fee,
        priceImpact: '0.2'
      }],
      confidence: 75,
      executionTime: 2500
    };
  }

  private async getTokenInfo(chain: string, address: string): Promise<TokenInfo> {
    // Check cache first
    const tokenList = this.tokenLists.get(chain) || [];
    const cachedToken = tokenList.find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    );

    if (cachedToken) {
      return cachedToken;
    }

    // If not in token list, try to fetch from chain
    try {
      const tokenInfo = await this.chainAbstraction.getTokenInfo(chain as any, address);
      if (tokenInfo) {
        return tokenInfo;
      }
    } catch (error) {
      // Fallback
    }

    // Return default token info
    return {
      address,
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
      chainId: this.getChainId(chain)
    };
  }

  private parse1inchRoute(protocols: any[]): RouteStep[] {
    // Parse 1inch protocol route format
    return protocols.map((protocol: any) => ({
      dex: protocol.name || '1inch',
      pool: protocol.part?.toString() || '100',
      tokenIn: {} as TokenInfo, // Would be populated
      tokenOut: {} as TokenInfo,
      amountIn: '0',
      amountOut: '0',
      fee: 0,
      priceImpact: '0'
    }));
  }

  private parseJupiterRoute(routePlan: any[]): RouteStep[] {
    return routePlan.map((step: any) => ({
      dex: step.swapInfo?.label || 'jupiter',
      pool: step.swapInfo?.ammKey || '',
      tokenIn: {} as TokenInfo,
      tokenOut: {} as TokenInfo,
      amountIn: step.swapInfo?.inAmount || '0',
      amountOut: step.swapInfo?.outAmount || '0',
      fee: step.swapInfo?.feeAmount || 0,
      priceImpact: '0'
    }));
  }

  private selectBestRoute(routes: SwapRoute[], request: SwapQuoteRequest): SwapRoute {
    // Score routes based on multiple factors
    const scoredRoutes = routes.map(route => {
      let score = 0;

      // Output amount (40% weight)
      const outputScore = parseFloat(route.outputAmount) / Math.max(...routes.map(r => parseFloat(r.outputAmount)));
      score += outputScore * 0.4;

      // Confidence (25% weight)
      score += (route.confidence / 100) * 0.25;

      // Gas efficiency (20% weight)
      const gasScore = 1 - (parseFloat(route.gasEstimate.totalCost) / 
        Math.max(...routes.map(r => parseFloat(r.gasEstimate.totalCost))));
      score += gasScore * 0.2;

      // Execution time (10% weight)
      const timeScore = 1 - (route.executionTime / Math.max(...routes.map(r => r.executionTime)));
      score += timeScore * 0.1;

      // Price impact (5% weight)
      const impactScore = 1 - (parseFloat(route.priceImpact) / 
        Math.max(...routes.map(r => parseFloat(r.priceImpact))));
      score += impactScore * 0.05;

      return { route, score };
    });

    // Return route with highest score
    return scoredRoutes.reduce((best, current) => 
      current.score > best.score ? current : best
    ).route;
  }

  private calculateNetOutput(route: SwapRoute): string {
    const outputAmount = parseFloat(route.outputAmount);
    const gasCost = parseFloat(route.gasEstimate.totalCost);
    
    // Convert gas cost to output token value (simplified)
    // In production, would use price oracles
    const gasCostInOutputToken = gasCost * 0.001; // Rough conversion
    
    return Math.max(0, outputAmount - gasCostInOutputToken).toString();
  }

  private updateStats(chain: string, success: boolean): void {
    this.stats.totalQuotes++;
    
    if (success) {
      this.stats.successfulQuotes++;
    }

    // Update chain-specific stats
    const chainStats = this.stats.chainStats.get(chain) || {
      quotes: 0,
      volume: '0',
      averageSlippage: 0
    };
    
    chainStats.quotes++;
    this.stats.chainStats.set(chain, chainStats);
  }

  private updateDEXStats(dexId: string, responseTime: number, success: boolean): void {
    const stats = this.dexStats.get(dexId);
    if (!stats) return;

    stats.responseTime = (stats.responseTime * 0.8) + (responseTime * 0.2);
    
    if (success) {
      stats.successRate = Math.min(100, stats.successRate + 0.1);
    } else {
      stats.successRate = Math.max(0, stats.successRate - 1);
    }

    stats.lastUpdated = Date.now();
  }

  private startStatsCollection(): void {
    // Log aggregator stats every 10 minutes
    setInterval(() => {
      this.logger.info('DEX Aggregator Statistics', {
        ...this.stats,
        activeDEXes: Array.from(this.dexConfigs.values()).filter(d => d.isActive).length,
        chainBreakdown: Object.fromEntries(this.stats.chainStats)
      });
    }, 10 * 60 * 1000);
  }

  // Public API methods
  getStats(): AggregatorStats {
    return { ...this.stats };
  }

  getDEXStats(): Map<string, DEXStats> {
    return new Map(this.dexStats);
  }

  getSupportedDEXes(chain?: string): DEXConfig[] {
    let dexes = Array.from(this.dexConfigs.values());
    
    if (chain) {
      dexes = dexes.filter(dex => dex.chain === chain);
    }
    
    return dexes.filter(dex => dex.isActive);
  }

  getTokenList(chain: string): TokenInfo[] {
    return this.tokenLists.get(chain) || [];
  }

  async enableDEX(dexId: string): Promise<void> {
    const dex = this.dexConfigs.get(dexId);
    if (dex) {
      dex.isActive = true;
      this.logger.info('DEX enabled', { dexId });
    }
  }

  async disableDEX(dexId: string): Promise<void> {
    const dex = this.dexConfigs.get(dexId);
    if (dex) {
      dex.isActive = false;
      this.logger.info('DEX disabled', { dexId });
    }
  }

  async close(): Promise<void> {
    // Cleanup resources
    this.priceCache.clear();
    this.routeCache.clear();
    this.logger.info('DEX Aggregator closed');
  }
}
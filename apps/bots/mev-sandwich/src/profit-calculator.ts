import { ethers } from 'ethers';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

export interface ProfitParams {
  victimAmountIn: string;
  victimAmountOutMin: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  tokenInPrice: number; // USD price
  tokenOutPrice: number; // USD price
  poolReserve0: string;
  poolReserve1: string;
  poolFee: number; // In basis points (300 = 0.3%)
  gasPrice: string; // In gwei for EVM chains, lamports for Solana
  chain: 'ethereum' | 'bsc' | 'solana';
  dexType: string;
}

export interface PriceOracleConfig {
  coinGeckoApiKey?: string;
  chainlinkRpcUrl?: string;
  pythApiUrl?: string;
  enableBackupOracles: boolean;
}

export interface GasEstimationConfig {
  provider?: ethers.JsonRpcProvider;
  networkMultiplier: number;
  maxGasPrice: string;
  priorityFeeBoost: number;
}

export interface ProfitCalculation {
  frontRunAmount: string;
  frontRunOutput: string;
  backRunOutput: string;
  grossProfit: string;
  gasCost: string;
  netProfit: string;
  profitabilityPercent: number;
  roi: number; // Return on investment
  priceImpact: number;
  slippage: number;
  confidenceScore: number;
  riskScore: number;
  breakdownUsd: {
    victimTradeValueUsd: number;
    frontRunCostUsd: number;
    backRunRevenueUsd: number;
    gasCostUsd: number;
    netProfitUsd: number;
  };
}

export interface OptimizationResult {
  optimalFrontRunAmount: string;
  maxProfit: string;
  optimalProfitability: number;
  simulationResults: ProfitCalculation[];
  gasEfficiency: number;
  riskAdjustedReturn: number;
}

export class ProfitCalculator {
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private gasCache = new Map<string, { gasPrice: string; timestamp: number }>();
  private priceConfig: PriceOracleConfig;
  private gasConfig: GasEstimationConfig;

  // Gas cost estimates by chain and operation
  private readonly GAS_ESTIMATES = {
    ethereum: {
      swap: 150000,
      transfer: 21000,
      approve: 45000
    },
    bsc: {
      swap: 120000,
      transfer: 21000,
      approve: 45000
    },
    solana: {
      swap: 200000, // Compute units
      transfer: 5000,
      createAccount: 2500
    }
  };

  // Network-specific gas price multipliers for MEV competitiveness
  private readonly MEV_GAS_MULTIPLIERS = {
    ethereum: 1.5, // 50% premium for competitive inclusion
    bsc: 1.3,      // 30% premium
    solana: 2.0    // 100% tip multiplier for Jito
  };

  constructor(priceConfig?: PriceOracleConfig, gasConfig?: GasEstimationConfig) {
    this.priceConfig = {
      enableBackupOracles: true,
      ...priceConfig
    };
    this.gasConfig = {
      networkMultiplier: 1.2,
      maxGasPrice: '300',
      priorityFeeBoost: 50,
      ...gasConfig
    };
  }

  /**
   * Get real-time token price from multiple oracle sources
   */
  private async getTokenPrice(address: string, chain: string): Promise<number> {
    const cacheKey = `${chain}_${address}`;
    const cached = this.priceCache.get(cacheKey);
    
    // Use cache if less than 30 seconds old
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.price;
    }

    try {
      let price = 0;

      // Try CoinGecko first (most reliable)
      price = await this.getCoinGeckoPrice(address, chain);
      
      if (price === 0 && this.priceConfig.enableBackupOracles) {
        // Try Chainlink as backup for mainnet
        if (chain === 'ethereum' && this.priceConfig.chainlinkRpcUrl) {
          price = await this.getChainlinkPrice(address);
        }
        
        // Try Pyth for Solana
        if (chain === 'solana' && this.priceConfig.pythApiUrl) {
          price = await this.getPythPrice(address);
        }
      }

      // Cache the result
      this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${address} on ${chain}:`, error);
      
      // Return cached price if available, otherwise 0
      return cached?.price || 0;
    }
  }

  private async getCoinGeckoPrice(address: string, chain: string): Promise<number> {
    try {
      const platformMap: Record<string, string> = {
        ethereum: 'ethereum',
        bsc: 'binance-smart-chain',
        solana: 'solana'
      };

      const platform = platformMap[chain];
      if (!platform) return 0;

      const apiKey = this.priceConfig.coinGeckoApiKey;
      const baseUrl = 'https://api.coingecko.com/api/v3';
      const url = `${baseUrl}/simple/token_price/${platform}`;
      
      const headers: any = { 'accept': 'application/json' };
      if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey;
      }

      const response = await axios.get(url, {
        params: {
          contract_addresses: address,
          vs_currencies: 'usd'
        },
        headers,
        timeout: 5000
      });

      const price = response.data[address.toLowerCase()]?.usd;
      return price || 0;
    } catch (error) {
      console.warn('CoinGecko API error:', error);
      return 0;
    }
  }

  private async getChainlinkPrice(address: string): Promise<number> {
    try {
      if (!this.priceConfig.chainlinkRpcUrl) return 0;

      // This would implement Chainlink price feed integration
      // For now, return 0 to indicate unavailable
      console.log(`Chainlink price lookup for ${address} not implemented`);
      return 0;
    } catch (error) {
      console.warn('Chainlink price fetch error:', error);
      return 0;
    }
  }

  private async getPythPrice(address: string): Promise<number> {
    try {
      if (!this.priceConfig.pythApiUrl) return 0;

      // This would implement Pyth price feed integration
      // For now, return 0 to indicate unavailable
      console.log(`Pyth price lookup for ${address} not implemented`);
      return 0;
    } catch (error) {
      console.warn('Pyth price fetch error:', error);
      return 0;
    }
  }

  /**
   * Get dynamic gas price from network
   */
  private async getDynamicGasPrice(chain: string): Promise<string> {
    const cacheKey = `gas_${chain}`;
    const cached = this.gasCache.get(cacheKey);
    
    // Use cache if less than 15 seconds old
    if (cached && Date.now() - cached.timestamp < 15000) {
      return cached.gasPrice;
    }

    try {
      let gasPrice = '10'; // Default fallback

      if (chain === 'ethereum' || chain === 'bsc') {
        gasPrice = await this.getEvmGasPrice(chain);
      } else if (chain === 'solana') {
        gasPrice = await this.getSolanaGasPrice();
      }

      // Cache the result
      this.gasCache.set(cacheKey, { gasPrice, timestamp: Date.now() });
      return gasPrice;
    } catch (error) {
      console.warn(`Failed to fetch gas price for ${chain}:`, error);
      return cached?.gasPrice || '10';
    }
  }

  private async getEvmGasPrice(chain: string): Promise<string> {
    try {
      if (!this.gasConfig.provider) {
        // Fallback to public APIs
        return await this.getGasPriceFromApi(chain);
      }

      const feeData = await this.gasConfig.provider.getFeeData();
      let gasPrice = feeData.gasPrice || ethers.parseUnits('10', 'gwei');

      // Apply MEV premium
      const multiplier = this.MEV_GAS_MULTIPLIERS[chain as keyof typeof this.MEV_GAS_MULTIPLIERS] || 1.5;
      gasPrice = gasPrice * BigInt(Math.floor(multiplier * 100)) / BigInt(100);

      // Cap at maximum
      const maxGasPrice = ethers.parseUnits(this.gasConfig.maxGasPrice, 'gwei');
      if (gasPrice > maxGasPrice) {
        gasPrice = maxGasPrice;
      }

      return ethers.formatUnits(gasPrice, 'gwei');
    } catch (error) {
      console.warn('EVM gas price fetch error:', error);
      return '10';
    }
  }

  private async getGasPriceFromApi(chain: string): Promise<string> {
    try {
      if (chain === 'ethereum') {
        const response = await axios.get('https://api.etherscan.io/api', {
          params: {
            module: 'gastracker',
            action: 'gasoracle',
            apikey: 'YourApiKeyToken'
          },
          timeout: 5000
        });
        
        const fastGasPrice = response.data.result?.FastGasPrice;
        return fastGasPrice ? (parseFloat(fastGasPrice) * 1.2).toString() : '20';
      } else if (chain === 'bsc') {
        // BSC gas price API
        const response = await axios.get('https://api.bscscan.com/api', {
          params: {
            module: 'gastracker',
            action: 'gasoracle'
          },
          timeout: 5000
        });
        
        const fastGasPrice = response.data.result?.FastGasPrice;
        return fastGasPrice ? (parseFloat(fastGasPrice) * 1.1).toString() : '5';
      }
      
      return '10';
    } catch (error) {
      console.warn('Gas price API error:', error);
      return '10';
    }
  }

  private async getSolanaGasPrice(): Promise<string> {
    try {
      // For Solana, this would fetch compute unit prices
      // For now, return a reasonable default priority fee
      const baseFee = 5000; // Base compute unit fee in lamports
      const priorityMultiplier = this.gasConfig.priorityFeeBoost / 100 + 1;
      return Math.floor(baseFee * priorityMultiplier).toString();
    } catch (error) {
      console.warn('Solana gas price fetch error:', error);
      return '5000';
    }
  }

  /**
   * Calculate optimal front-run amount and expected profit with real data
   */
  async calculateOptimalProfit(params: ProfitParams): Promise<OptimizationResult> {
    // Update params with real-time data
    const updatedParams = await this.updateParamsWithRealData(params);
    
    const victimAmount = parseFloat(ethers.formatUnits(updatedParams.victimAmountIn, updatedParams.tokenInDecimals));
    
    // Test different front-run amounts (10% to 100% of victim trade)
    const testRatios = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const simulationResults: ProfitCalculation[] = [];
    
    let optimalResult: ProfitCalculation | null = null;
    let maxNetProfit = 0;

    for (const ratio of testRatios) {
      const frontRunAmount = victimAmount * ratio;
      const simulationParams = {
        ...updatedParams,
        victimAmountIn: ethers.parseUnits(frontRunAmount.toString(), updatedParams.tokenInDecimals).toString()
      };
      
      const result = await this.calculateProfit(simulationParams);
      simulationResults.push(result);

      const netProfitValue = parseFloat(result.breakdownUsd.netProfitUsd.toString());
      if (netProfitValue > maxNetProfit) {
        maxNetProfit = netProfitValue;
        optimalResult = result;
      }
    }

    if (!optimalResult) {
      optimalResult = simulationResults[0] || this.createEmptyResult();
    }

    // Calculate gas efficiency (profit per gas unit)
    const gasEfficiency = maxNetProfit / parseFloat(optimalResult.gasCost);
    
    // Calculate risk-adjusted return
    const riskAdjustedReturn = maxNetProfit * optimalResult.confidenceScore * (1 - optimalResult.riskScore);

    return {
      optimalFrontRunAmount: optimalResult.frontRunAmount,
      maxProfit: maxNetProfit.toString(),
      optimalProfitability: optimalResult.profitabilityPercent,
      simulationResults,
      gasEfficiency: isFinite(gasEfficiency) ? gasEfficiency : 0,
      riskAdjustedReturn
    };
  }

  /**
   * Update profit calculation parameters with real-time data
   */
  private async updateParamsWithRealData(params: ProfitParams): Promise<ProfitParams> {
    try {
      // Get real-time prices
      const [tokenInPrice, tokenOutPrice, dynamicGasPrice] = await Promise.all([
        this.getTokenPrice(params.tokenInAddress, params.chain),
        this.getTokenPrice(params.tokenOutAddress, params.chain),
        this.getDynamicGasPrice(params.chain)
      ]);

      return {
        ...params,
        tokenInPrice: tokenInPrice || params.tokenInPrice, // Fallback to provided price
        tokenOutPrice: tokenOutPrice || params.tokenOutPrice,
        gasPrice: dynamicGasPrice || params.gasPrice
      };
    } catch (error) {
      console.warn('Failed to update params with real data:', error);
      return params; // Return original params if update fails
    }
  }

  /**
   * Calculate profit for a specific front-run amount
   */
  async calculateProfit(params: ProfitParams): Promise<ProfitCalculation> {
    try {
      // Parse amounts
      const victimAmountIn = parseFloat(ethers.formatUnits(params.victimAmountIn, params.tokenInDecimals));
      const reserve0 = parseFloat(ethers.formatUnits(params.poolReserve0, params.tokenInDecimals));
      const reserve1 = parseFloat(ethers.formatUnits(params.poolReserve1, params.tokenOutDecimals));

      // Determine which reserve corresponds to which token
      const isToken0In = params.tokenInAddress.toLowerCase() < params.tokenOutAddress.toLowerCase();
      const reserveIn = isToken0In ? reserve0 : reserve1;
      const reserveOut = isToken0In ? reserve1 : reserve0;

      // Calculate optimal front-run amount (start with victim amount)
      const frontRunAmount = victimAmountIn;

      // Calculate sandwich attack sequence
      const sandwichResult = this.simulateSandwichAttack(
        frontRunAmount,
        victimAmountIn,
        reserveIn,
        reserveOut,
        params.poolFee
      );

      // Calculate USD values using real prices
      const frontRunCostUsd = frontRunAmount * params.tokenInPrice;
      const backRunRevenueUsd = sandwichResult.backRunOutput * params.tokenInPrice;
      const victimTradeValueUsd = victimAmountIn * params.tokenInPrice;

      // Calculate gas costs with real data
      const gasCostData = await this.calculateGasCosts(params.gasPrice, params.chain);
      const gasCostUsd = gasCostData.totalCostUsd;

      // Calculate profits
      const grossProfitUsd = backRunRevenueUsd - frontRunCostUsd;
      const netProfitUsd = grossProfitUsd - gasCostUsd;
      const profitabilityPercent = (netProfitUsd / frontRunCostUsd) * 100;
      const roi = (netProfitUsd / frontRunCostUsd) * 100;

      // Calculate risk metrics
      const priceImpact = (frontRunAmount / reserveIn) * 100;
      const slippage = this.calculateSlippage(sandwichResult, params);
      const confidenceScore = this.calculateConfidenceScore(priceImpact, reserveIn, params);
      const riskScore = this.calculateRiskScore(params, priceImpact, slippage);

      return {
        frontRunAmount: ethers.parseUnits(frontRunAmount.toString(), params.tokenInDecimals).toString(),
        frontRunOutput: ethers.parseUnits(sandwichResult.frontRunOutput.toString(), params.tokenOutDecimals).toString(),
        backRunOutput: ethers.parseUnits(sandwichResult.backRunOutput.toString(), params.tokenInDecimals).toString(),
        grossProfit: ethers.parseUnits(Math.max(0, grossProfitUsd / params.tokenInPrice).toString(), params.tokenInDecimals).toString(),
        gasCost: gasCostData.totalCost,
        netProfit: ethers.parseUnits(Math.max(0, netProfitUsd / params.tokenInPrice).toString(), params.tokenInDecimals).toString(),
        profitabilityPercent,
        roi,
        priceImpact,
        slippage,
        confidenceScore,
        riskScore,
        breakdownUsd: {
          victimTradeValueUsd,
          frontRunCostUsd,
          backRunRevenueUsd,
          gasCostUsd,
          netProfitUsd
        }
      };
    } catch (error) {
      console.error('Error calculating profit:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Simulate the three-step sandwich attack
   */
  private simulateSandwichAttack(
    frontRunAmount: number,
    victimAmount: number,
    reserveIn: number,
    reserveOut: number,
    poolFee: number
  ): {
    frontRunOutput: number;
    victimOutput: number;
    backRunOutput: number;
    finalReserveIn: number;
    finalReserveOut: number;
  } {
    const fee = poolFee / 10000; // Convert basis points to decimal

    // Step 1: Front-run transaction
    const frontRunAmountWithFee = frontRunAmount * (1 - fee);
    const frontRunOutput = (reserveOut * frontRunAmountWithFee) / (reserveIn + frontRunAmountWithFee);

    // Update reserves after front-run
    const reserve1In = reserveIn + frontRunAmount;
    const reserve1Out = reserveOut - frontRunOutput;

    // Step 2: Victim transaction
    const victimAmountWithFee = victimAmount * (1 - fee);
    const victimOutput = (reserve1Out * victimAmountWithFee) / (reserve1In + victimAmountWithFee);

    // Update reserves after victim transaction
    const reserve2In = reserve1In + victimAmount;
    const reserve2Out = reserve1Out - victimOutput;

    // Step 3: Back-run transaction (sell acquired tokens)
    const backRunAmountWithFee = frontRunOutput * (1 - fee);
    const backRunOutput = (reserve2In * backRunAmountWithFee) / (reserve2Out + backRunAmountWithFee);

    // Final reserves
    const finalReserveIn = reserve2In - backRunOutput;
    const finalReserveOut = reserve2Out + frontRunOutput;

    return {
      frontRunOutput,
      victimOutput,
      backRunOutput,
      finalReserveIn,
      finalReserveOut
    };
  }

  /**
   * Calculate gas costs for sandwich attack
   */
  private async calculateGasCosts(gasPrice: string, chain: 'ethereum' | 'bsc' | 'solana'): Promise<{
    totalCost: string;
    totalCostUsd: number;
    breakdown: {
      frontRunCost: string;
      backRunCost: string;
      totalGasUnits: number;
    };
  }> {
    const gasEstimates = this.GAS_ESTIMATES[chain];
    const gasPriceValue = parseFloat(gasPrice);
    const mevMultiplier = this.MEV_GAS_MULTIPLIERS[chain];

    if (chain === 'solana') {
      // Solana uses compute units and lamports
      const totalComputeUnits = gasEstimates.swap * 2; // Front-run + back-run
      const priorityFee = gasPriceValue * mevMultiplier;
      const totalCostLamports = totalComputeUnits * priorityFee;
      const totalCostSol = totalCostLamports / LAMPORTS_PER_SOL;
      const solPrice = await this.getTokenPrice('So11111111111111111111111111111111111111112', 'solana') || 100;
      const totalCostUsd = totalCostSol * solPrice;

      return {
        totalCost: totalCostLamports.toString(),
        totalCostUsd,
        breakdown: {
          frontRunCost: ((gasEstimates.swap * priorityFee) / LAMPORTS_PER_SOL).toString(),
          backRunCost: ((gasEstimates.swap * priorityFee) / LAMPORTS_PER_SOL).toString(),
          totalGasUnits: totalComputeUnits
        }
      };
    } else {
      // EVM chains use gas and gwei
      const totalGasUnits = gasEstimates.swap * 2; // Front-run + back-run
      const effectiveGasPrice = gasPriceValue * mevMultiplier;
      const totalCostWei = BigInt(Math.floor(totalGasUnits * effectiveGasPrice * 1e9));
      const totalCostEth = parseFloat(ethers.formatEther(totalCostWei));
      
      // Get real native token prices
      const nativeTokenAddress = chain === 'ethereum' 
        ? '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
        : '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // WBNB
      const nativeTokenPrice = await this.getTokenPrice(nativeTokenAddress, chain) || (chain === 'ethereum' ? 3000 : 300);
      const totalCostUsd = totalCostEth * nativeTokenPrice;

      return {
        totalCost: totalCostWei.toString(),
        totalCostUsd,
        breakdown: {
          frontRunCost: ethers.formatEther(BigInt(Math.floor(gasEstimates.swap * effectiveGasPrice * 1e9))),
          backRunCost: ethers.formatEther(BigInt(Math.floor(gasEstimates.swap * effectiveGasPrice * 1e9))),
          totalGasUnits
        }
      };
    }
  }

  /**
   * Calculate slippage impact
   */
  private calculateSlippage(sandwichResult: any, params: ProfitParams): number {
    // Calculate expected output without sandwich
    const expectedOutput = parseFloat(ethers.formatUnits(params.victimAmountOutMin, params.tokenOutDecimals));
    
    // Calculate actual output with sandwich
    const actualOutput = sandwichResult.victimOutput;
    
    // Calculate slippage percentage
    const slippage = ((expectedOutput - actualOutput) / expectedOutput) * 100;
    return Math.max(0, slippage);
  }

  /**
   * Calculate confidence score based on various factors
   */
  private calculateConfidenceScore(priceImpact: number, reserveIn: number, params: ProfitParams): number {
    let confidence = 1.0;

    // Price impact penalty
    if (priceImpact > 10) confidence *= 0.3;
    else if (priceImpact > 5) confidence *= 0.6;
    else if (priceImpact > 2) confidence *= 0.8;

    // Liquidity penalty
    if (reserveIn < 10000) confidence *= 0.4;
    else if (reserveIn < 100000) confidence *= 0.7;
    else if (reserveIn < 1000000) confidence *= 0.9;

    // Pool fee consideration
    if (params.poolFee > 1000) confidence *= 0.8; // High fee pools are riskier

    // Gas price impact
    const gasPrice = parseFloat(params.gasPrice);
    if (params.chain === 'ethereum' && gasPrice > 100) confidence *= 0.7;
    if (params.chain === 'bsc' && gasPrice > 20) confidence *= 0.7;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate risk score (0 = low risk, 1 = high risk)
   */
  private calculateRiskScore(params: ProfitParams, priceImpact: number, slippage: number): number {
    let risk = 0.0;

    // Price impact risk
    risk += Math.min(priceImpact / 20, 0.3); // Max 30% risk from price impact

    // Slippage risk
    risk += Math.min(slippage / 10, 0.2); // Max 20% risk from slippage

    // Pool risk (based on DEX type and liquidity)
    if (params.dexType.includes('v3')) risk += 0.1; // V3 pools have concentrated liquidity risk
    
    // Chain risk
    if (params.chain === 'bsc') risk += 0.05; // Slightly higher risk on BSC
    if (params.chain === 'solana') risk += 0.1; // Higher risk on Solana due to transaction ordering

    // Gas price risk (high gas = failed transactions)
    const gasPrice = parseFloat(params.gasPrice);
    if (params.chain === 'ethereum' && gasPrice > 150) risk += 0.15;
    if (params.chain === 'bsc' && gasPrice > 30) risk += 0.1;

    return Math.max(0.0, Math.min(1.0, risk));
  }

  /**
   * Calculate minimum profitable front-run amount
   */
  async calculateMinimumProfitableAmount(params: ProfitParams, minProfitUsd: number = 10): Promise<string> {
    const victimAmount = parseFloat(ethers.formatUnits(params.victimAmountIn, params.tokenInDecimals));
    
    // Binary search for minimum profitable amount
    let low = victimAmount * 0.01; // 1% of victim trade
    let high = victimAmount * 2.0;  // 200% of victim trade
    let result = '0';

    for (let i = 0; i < 20; i++) { // 20 iterations should be enough for precision
      const mid = (low + high) / 2;
      const testParams = {
        ...params,
        victimAmountIn: ethers.parseUnits(mid.toString(), params.tokenInDecimals).toString()
      };

      const calculation = await this.calculateProfit(testParams);
      
      if (calculation.breakdownUsd.netProfitUsd >= minProfitUsd) {
        result = calculation.frontRunAmount;
        high = mid;
      } else {
        low = mid;
      }

      // Convergence check
      if (Math.abs(high - low) < victimAmount * 0.001) break;
    }

    return result;
  }

  /**
   * Analyze profit sensitivity to gas price changes
   */
  async analyzeProfitSensitivity(params: ProfitParams): Promise<{
    baseProfit: number;
    sensitivity: {
      gasPrice: { change: number; newProfit: number }[];
      priceImpact: { change: number; newProfit: number }[];
      slippage: { change: number; newProfit: number }[];
    };
  }> {
    const baseCalculation = await this.calculateProfit(params);
    const baseProfit = baseCalculation.breakdownUsd.netProfitUsd;

    // Test gas price sensitivity
    const gasPriceSensitivity = [];
    const gasPriceChanges = [-50, -25, -10, 10, 25, 50, 100]; // Percentage changes
    const baseGasPrice = parseFloat(params.gasPrice);

    for (const change of gasPriceChanges) {
      const newGasPrice = baseGasPrice * (1 + change / 100);
      const testParams = { ...params, gasPrice: newGasPrice.toString() };
      const calculation = await this.calculateProfit(testParams);
      gasPriceSensitivity.push({
        change,
        newProfit: calculation.breakdownUsd.netProfitUsd
      });
    }

    // Additional sensitivity analysis would go here for price impact and slippage

    return {
      baseProfit,
      sensitivity: {
        gasPrice: gasPriceSensitivity,
        priceImpact: [], // Would implement if needed
        slippage: []     // Would implement if needed
      }
    };
  }

  /**
   * Create empty/failed result
   */
  private createEmptyResult(): ProfitCalculation {
    return {
      frontRunAmount: '0',
      frontRunOutput: '0',
      backRunOutput: '0',
      grossProfit: '0',
      gasCost: '0',
      netProfit: '0',
      profitabilityPercent: 0,
      roi: 0,
      priceImpact: 0,
      slippage: 0,
      confidenceScore: 0,
      riskScore: 1.0,
      breakdownUsd: {
        victimTradeValueUsd: 0,
        frontRunCostUsd: 0,
        backRunRevenueUsd: 0,
        gasCostUsd: 0,
        netProfitUsd: 0
      }
    };
  }

  /**
   * Calculate maximum extractable value for a given opportunity
   */
  async calculateMaxExtractableValue(params: ProfitParams): Promise<{
    mev: number;
    optimalStrategy: string;
    alternativeStrategies: Array<{
      strategy: string;
      profit: number;
      description: string;
    }>;
  }> {
    // Calculate sandwich profit
    const optimized = await this.calculateOptimalProfit(params);
    const sandwichProfit = parseFloat(optimized.maxProfit);

    // Analyze alternative MEV strategies
    const alternatives = [
      {
        strategy: 'sandwich',
        profit: sandwichProfit,
        description: 'Front-run and back-run victim transaction'
      },
      {
        strategy: 'front-run-only',
        profit: sandwichProfit * 0.4, // Estimated lower profit
        description: 'Only front-run without back-run'
      },
      {
        strategy: 'arbitrage',
        profit: sandwichProfit * 0.2, // Estimated arbitrage opportunity
        description: 'Cross-DEX arbitrage opportunity'
      }
    ];

    const maxProfit = Math.max(...alternatives.map(a => a.profit));
    const optimalStrategy = alternatives.find(a => a.profit === maxProfit)?.strategy || 'sandwich';

    return {
      mev: maxProfit,
      optimalStrategy,
      alternativeStrategies: alternatives.sort((a, b) => b.profit - a.profit)
    };
  }
}
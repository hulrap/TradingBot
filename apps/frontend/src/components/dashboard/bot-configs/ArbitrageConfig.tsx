'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  DollarSign, 
  Settings2,
  Zap,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Shield,
  Activity
} from 'lucide-react';

// Import proper types from packages folder
import { ArbitrageBotConfig, SUPPORTED_CHAINS, SUPPORTED_DEXES } from '@trading-bot/types/src/bot';
import { BotConfig } from '@trading-bot/types';

interface ArbitrageConfigProps {
  config: ArbitrageBotConfig;
  onChange: (config: ArbitrageBotConfig) => void;
}

// Enhanced DEX data with real-time status simulation
const AVAILABLE_DEXES = [
  { 
    id: 'uniswap-v3', 
    name: 'Uniswap V3', 
    icon: '🦄', 
    chains: ['ethereum', 'arbitrum', 'polygon'],
    tvl: 4200000000, // $4.2B
    dailyVolume: 1200000000, // $1.2B
    avgSlippage: 0.05,
    status: 'active' as const,
    latency: 45,
    gasEfficiency: 'medium'
  },
  { 
    id: 'sushiswap', 
    name: 'SushiSwap', 
    icon: '🍣', 
    chains: ['ethereum', 'arbitrum', 'polygon'],
    tvl: 800000000, // $800M
    dailyVolume: 150000000, // $150M
    avgSlippage: 0.08,
    status: 'active' as const,
    latency: 52,
    gasEfficiency: 'medium'
  },
  { 
    id: 'pancakeswap', 
    name: 'PancakeSwap', 
    icon: '🥞', 
    chains: ['bsc'],
    tvl: 2100000000, // $2.1B
    dailyVolume: 400000000, // $400M
    avgSlippage: 0.06,
    status: 'active' as const,
    latency: 35,
    gasEfficiency: 'high'
  },
  { 
    id: 'uniswap-v2', 
    name: 'Uniswap V2', 
    icon: '🦄', 
    chains: ['ethereum'],
    tvl: 1500000000, // $1.5B
    dailyVolume: 300000000, // $300M
    avgSlippage: 0.06,
    status: 'active' as const,
    latency: 42,
    gasEfficiency: 'medium'
  }
];

// Enhanced token pairs with market data
const POPULAR_TOKEN_PAIRS = [
  { 
    tokenA: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // ETH
    tokenASymbol: 'ETH', 
    tokenB: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // USDC
    tokenBSymbol: 'USDC', 
    popular: true,
    marketCap: 300000000000, // $300B
    dailyVolume: 2000000000, // $2B
    volatility: 0.15,
    spread: 0.02
  },
  { 
    tokenA: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // ETH
    tokenASymbol: 'ETH', 
    tokenB: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    tokenBSymbol: 'USDT', 
    popular: true,
    marketCap: 300000000000,
    dailyVolume: 1500000000,
    volatility: 0.15,
    spread: 0.03
  },
  { 
    tokenA: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    tokenASymbol: 'WBTC', 
    tokenB: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // USDC
    tokenBSymbol: 'USDC', 
    popular: true,
    marketCap: 800000000000, // $800B
    dailyVolume: 800000000,
    volatility: 0.18,
    spread: 0.04
  },
  { 
    tokenA: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    tokenASymbol: 'WBTC', 
    tokenB: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // ETH
    tokenBSymbol: 'ETH', 
    popular: true,
    marketCap: 800000000000,
    dailyVolume: 400000000,
    volatility: 0.12,
    spread: 0.05
  },
  { 
    tokenA: '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
    tokenASymbol: 'LINK', 
    tokenB: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // ETH
    tokenBSymbol: 'ETH', 
    popular: true,
    marketCap: 8000000000, // $8B
    dailyVolume: 150000000,
    volatility: 0.25,
    spread: 0.08
  },
  { 
    tokenA: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
    tokenASymbol: 'UNI', 
    tokenB: '0xA0b86a33E6417e19f203bC64a1eF22b59ff88A6d', // ETH
    tokenBSymbol: 'ETH', 
    popular: false,
    marketCap: 5000000000,
    dailyVolume: 100000000,
    volatility: 0.30,
    spread: 0.12
  }
];

// Advanced arbitrage opportunity calculation
const calculateArbitrageOpportunities = (config: ArbitrageBotConfig): {
  totalOpportunities: number;
  estimatedDailyProfit: number;
  riskScore: number;
  recommendations: string[];
} => {
  const enabledPairs = config.tokenPairs.filter(pair => pair.enabled);
  // Arbitrage works across all available DEXes automatically
  const activeDexes = AVAILABLE_DEXES.filter(dex => dex.status === 'active');
  
  // Calculate opportunity matrix (pairs x DEX combinations)
  const pairDexCombinations = enabledPairs.length * activeDexes.length * (activeDexes.length - 1);
  
  // Adjust for market conditions
  const marketEfficiency = 0.85; // Market efficiency factor
  const competitionFactor = Math.max(0.3, 1 - (activeDexes.length * 0.1)); // More DEXes = more competition
  
  const totalOpportunities = Math.floor(pairDexCombinations * marketEfficiency * competitionFactor);
  
  // Estimate daily profit based on opportunities and configuration
  const avgOpportunityProfit = config.minProfitPercentage * 0.6; // Conservative estimate
  const dailyOpportunityCount = Math.min(
    totalOpportunities, 
    config.riskParams.maxConcurrentTrades * 24
  ); // Max per day
  const avgTradeSize = parseFloat(config.riskParams.maxPositionSize) / 2; // Conservative estimate
  
  const estimatedDailyProfit = dailyOpportunityCount * avgOpportunityProfit * 0.01 * avgTradeSize;
  
  // Calculate risk score
  const riskFactors = {
    highTradeSize: parseFloat(config.riskParams.maxPositionSize) > 5000 ? 2 : 0,
    lowProfitThreshold: config.minProfitPercentage < 0.2 ? 3 : 0,
    highSlippage: config.maxSlippage > 1 ? 2 : 0,
    manySimultaneous: config.riskParams.maxConcurrentTrades > 5 ? 1 : 0,
    highGasLimit: parseInt(config.gasSettings.gasLimit) > 400000 ? 1 : 0,
    lowStopLoss: config.riskParams.stopLossPercentage < 5 ? 1 : 0
  };
  
  const riskScore = Object.values(riskFactors).reduce((sum, factor) => sum + factor, 0);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (config.minProfitPercentage < 0.3) recommendations.push('Increase profit threshold to reduce risk');
  if (config.maxSlippage > 0.8) recommendations.push('Lower slippage tolerance for better execution');
  if (enabledPairs.length < 3) recommendations.push('Add more token pairs to diversify opportunities');
  if (config.riskParams.maxConcurrentTrades > 3) recommendations.push('Consider reducing simultaneous trades to manage risk');
  if (parseFloat(config.riskParams.maxPositionSize) > 5000) recommendations.push('Consider reducing position size for better risk management');
  
  return {
    totalOpportunities,
    estimatedDailyProfit,
    riskScore,
    recommendations
  };
};

export function ArbitrageConfig({ config, onChange }: ArbitrageConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Memoized calculations for performance
  const opportunityAnalysis = useMemo(() => 
    calculateArbitrageOpportunities(config), 
    [config]
  );

  const activeDexes = useMemo(() => 
    AVAILABLE_DEXES.filter(dex => dex.status === 'active'),
    []
  );

  const totalTVL = useMemo(() => 
    activeDexes.reduce((sum, dex) => sum + dex.tvl, 0),
    [activeDexes]
  );

  const updateConfig = useCallback((updates: Partial<ArbitrageBotConfig>) => {
    onChange({
      ...config,
      ...updates
    });
  }, [config, onChange]);

  const addTokenPair = useCallback(() => {
    const newPair = {
      tokenA: '',
      tokenASymbol: '',
      tokenB: '',
      tokenBSymbol: '',
      minLiquidity: '100000',
      enabled: true,
      priority: 5,
      maxPositionUsd: config.riskParams.maxPositionSize
    };
    updateConfig({
      tokenPairs: [...config.tokenPairs, newPair]
    });
  }, [config.tokenPairs, config.riskParams.maxPositionSize, updateConfig]);

  const updateTokenPair = useCallback((index: number, updates: Partial<typeof config.tokenPairs[0]>) => {
    const updatedPairs = config.tokenPairs.map((pair, i) => 
      i === index ? { ...pair, ...updates } : pair
    );
    updateConfig({ tokenPairs: updatedPairs });
  }, [config.tokenPairs, updateConfig]);

  const removeTokenPair = useCallback((index: number) => {
    const updatedPairs = config.tokenPairs.filter((_, i) => i !== index);
    updateConfig({ tokenPairs: updatedPairs });
  }, [config.tokenPairs, updateConfig]);

  const addPopularPair = useCallback((popularPair: { tokenA: string; tokenASymbol: string; tokenB: string; tokenBSymbol: string }) => {
    const exists = config.tokenPairs.some(
      pair => pair.tokenASymbol === popularPair.tokenASymbol && pair.tokenBSymbol === popularPair.tokenBSymbol
    );
    
    if (!exists) {
      const newPair = {
        tokenA: popularPair.tokenA,
        tokenASymbol: popularPair.tokenASymbol,
        tokenB: popularPair.tokenB,
        tokenBSymbol: popularPair.tokenBSymbol,
        minLiquidity: '100000',
        enabled: true,
        priority: 5,
        maxPositionUsd: config.riskParams.maxPositionSize
      };
      updateConfig({
        tokenPairs: [...config.tokenPairs, newPair]
      });
    }
  }, [config.tokenPairs, config.riskParams.maxPositionSize, updateConfig]);



  const getRiskLevel = (): { level: 'low' | 'medium' | 'high' | 'extreme'; color: string } => {
    const score = opportunityAnalysis.riskScore;
    if (score >= 8) return { level: 'extreme', color: 'text-red-700' };
    if (score >= 5) return { level: 'high', color: 'text-red-600' };
    if (score >= 3) return { level: 'medium', color: 'text-yellow-600' };
    return { level: 'low', color: 'text-green-600' };
  };

  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Risk Warning */}
      {risk.level === 'high' || risk.level === 'extreme' ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium text-red-800 mb-1">High Risk Configuration</div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>Risk Score: {opportunityAnalysis.riskScore}/10 - Consider the following recommendations:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    {opportunityAnalysis.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Enhanced Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Arbitrage Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{config.tokenPairs.filter(p => p.enabled).length}</div>
              <div className="text-sm text-muted-foreground">Active Token Pairs</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{opportunityAnalysis.totalOpportunities}</div>
              <div className="text-sm text-muted-foreground">Est. Opportunities</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600 flex items-center justify-center gap-1">
                <DollarSign className="h-6 w-6" />
                {opportunityAnalysis.estimatedDailyProfit.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Est. Daily Profit</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${risk.color} flex items-center justify-center gap-1`}>
                {risk.level === 'extreme' && <AlertCircle className="h-6 w-6" />}
                {risk.level === 'high' && <AlertCircle className="h-6 w-6" />}
                {risk.level === 'medium' && <Activity className="h-6 w-6" />}
                {risk.level === 'low' && <Shield className="h-6 w-6" />}
                {risk.level.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-500" />
            Market Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${(totalTVL / 1000000000).toFixed(1)}B
              </div>
              <div className="text-sm text-muted-foreground">Total Value Locked</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {activeDexes.length}/{AVAILABLE_DEXES.length}
              </div>
              <div className="text-sm text-muted-foreground">Active DEXes</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {activeDexes.length > 0 ? Math.round(activeDexes.reduce((sum, dex) => sum + dex.latency, 0) / activeDexes.length) : 0}ms
              </div>
              <div className="text-sm text-muted-foreground">Avg Latency</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Basic Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bot Name and General Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                className="w-full p-3 border rounded-md"
                placeholder="e.g., ETH-ARB-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Enabled</label>
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => updateConfig({ enabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Enable bot for trading</span>
              </div>
            </div>
          </div>

          {/* Profit and Slippage Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Profit Threshold (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={config.minProfitPercentage}
                onChange={(e) => updateConfig({ minProfitPercentage: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="0.3"
              />
              <p className="text-xs text-muted-foreground">Minimum profit required to execute trade</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slippage Tolerance (%)</label>
              <input
                type="number"
                step="0.1"
                value={config.maxSlippage}
                onChange={(e) => updateConfig({ maxSlippage: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="0.5"
              />
            </div>
          </div>

          {/* Risk Management Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Position Size (USD)</label>
              <input
                type="text"
                value={config.riskParams.maxPositionSize}
                onChange={(e) => updateConfig({ 
                  riskParams: { ...config.riskParams, maxPositionSize: e.target.value }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Concurrent Trades</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.riskParams.maxConcurrentTrades}
                onChange={(e) => updateConfig({ 
                  riskParams: { ...config.riskParams, maxConcurrentTrades: Number(e.target.value) }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DEX Information */}
      <Card>
        <CardHeader>
          <CardTitle>Available DEXes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Arbitrage bot automatically searches for opportunities across all available DEXes
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AVAILABLE_DEXES.map((dex) => {
              return (
                <div
                  key={dex.id}
                  className={`p-4 border rounded-lg ${
                    dex.status === 'active'
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{dex.icon}</span>
                      <div>
                        <div className="font-medium">{dex.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dex.chains.join(', ')}
                        </div>
                      </div>
                    </div>
                    {dex.status === 'active' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    TVL: ${(dex.tvl / 1000000000).toFixed(1)}B | Latency: {dex.latency}ms
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Token Pairs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Token Pairs
            </CardTitle>
            <Button onClick={addTokenPair} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Pair
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Popular Pairs Quick Add */}
          <div>
            <h4 className="text-sm font-medium mb-2">Popular Pairs</h4>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TOKEN_PAIRS.filter(pair => pair.popular).map((pair, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => addPopularPair(pair)}
                >
                  {pair.tokenASymbol}/{pair.tokenBSymbol}
                </Badge>
              ))}
            </div>
          </div>

          {/* Configured Pairs */}
          <div className="space-y-3">
            {config.tokenPairs.map((pair, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Token A Symbol</label>
                    <input
                      type="text"
                      value={pair.tokenASymbol}
                      onChange={(e) => updateTokenPair(index, { tokenASymbol: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="ETH"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Token B Symbol</label>
                    <input
                      type="text"
                      value={pair.tokenBSymbol}
                      onChange={(e) => updateTokenPair(index, { tokenBSymbol: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="USDC"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Min Liquidity (USD)</label>
                    <input
                      type="text"
                      value={pair.minLiquidity}
                      onChange={(e) => updateTokenPair(index, { minLiquidity: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="100000"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pair.enabled}
                        onChange={(e) => updateTokenPair(index, { enabled: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs">Enabled</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeTokenPair(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {config.tokenPairs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No token pairs configured</p>
              <p className="text-sm">Add token pairs to start finding arbitrage opportunities</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Configuration Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {config.tokenPairs.filter(p => p.enabled).length > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Token pairs configured: {config.tokenPairs.filter(p => p.enabled).length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {activeDexes.length >= 2 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                Active DEXes available: {activeDexes.length} ({AVAILABLE_DEXES.length} total)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.walletId ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                Wallet configured: {config.walletId ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
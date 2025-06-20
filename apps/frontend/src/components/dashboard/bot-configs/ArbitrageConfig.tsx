'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
import { BotConfiguration, ArbitrageConfiguration, TokenPair } from '../BotConfigurationDashboard';

interface ArbitrageConfigProps {
  config: BotConfiguration;
  onChange: (config: BotConfiguration) => void;
}

// Enhanced DEX data with real-time status simulation
const AVAILABLE_DEXES = [
  { 
    id: 'uniswap', 
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
    id: '1inch', 
    name: '1inch', 
    icon: '1️⃣', 
    chains: ['ethereum', 'bsc', 'polygon'],
    tvl: 300000000, // $300M
    dailyVolume: 800000000, // $800M
    avgSlippage: 0.04,
    status: 'active' as const,
    latency: 38,
    gasEfficiency: 'high'
  },
  { 
    id: 'curve', 
    name: 'Curve', 
    icon: '🌀', 
    chains: ['ethereum', 'arbitrum', 'polygon'],
    tvl: 1800000000, // $1.8B
    dailyVolume: 200000000, // $200M
    avgSlippage: 0.02,
    status: 'active' as const,
    latency: 48,
    gasEfficiency: 'low'
  },
  { 
    id: 'balancer', 
    name: 'Balancer', 
    icon: '⚖️', 
    chains: ['ethereum', 'arbitrum', 'polygon'],
    tvl: 600000000, // $600M
    dailyVolume: 80000000, // $80M
    avgSlippage: 0.07,
    status: 'maintenance' as const,
    latency: 65,
    gasEfficiency: 'low'
  }
];

// Enhanced token pairs with market data
const POPULAR_TOKEN_PAIRS = [
  { 
    baseToken: 'ETH', 
    quoteToken: 'USDC', 
    popular: true,
    marketCap: 300000000000, // $300B
    dailyVolume: 2000000000, // $2B
    volatility: 0.15,
    spread: 0.02
  },
  { 
    baseToken: 'ETH', 
    quoteToken: 'USDT', 
    popular: true,
    marketCap: 300000000000,
    dailyVolume: 1500000000,
    volatility: 0.15,
    spread: 0.03
  },
  { 
    baseToken: 'WBTC', 
    quoteToken: 'USDC', 
    popular: true,
    marketCap: 800000000000, // $800B
    dailyVolume: 800000000,
    volatility: 0.18,
    spread: 0.04
  },
  { 
    baseToken: 'WBTC', 
    quoteToken: 'ETH', 
    popular: true,
    marketCap: 800000000000,
    dailyVolume: 400000000,
    volatility: 0.12,
    spread: 0.05
  },
  { 
    baseToken: 'LINK', 
    quoteToken: 'ETH', 
    popular: true,
    marketCap: 8000000000, // $8B
    dailyVolume: 150000000,
    volatility: 0.25,
    spread: 0.08
  },
  { 
    baseToken: 'UNI', 
    quoteToken: 'ETH', 
    popular: false,
    marketCap: 5000000000,
    dailyVolume: 100000000,
    volatility: 0.30,
    spread: 0.12
  },
  { 
    baseToken: 'AAVE', 
    quoteToken: 'ETH', 
    popular: false,
    marketCap: 2000000000,
    dailyVolume: 50000000,
    volatility: 0.35,
    spread: 0.15
  },
  { 
    baseToken: 'MATIC', 
    quoteToken: 'USDC', 
    popular: false,
    marketCap: 6000000000,
    dailyVolume: 80000000,
    volatility: 0.28,
    spread: 0.10
  }
];

// Advanced arbitrage opportunity calculation
const calculateArbitrageOpportunities = (config: ArbitrageConfiguration): {
  totalOpportunities: number;
  estimatedDailyProfit: number;
  riskScore: number;
  recommendations: string[];
} => {
  const enabledPairs = config.tokenPairs.filter(pair => pair.enabled);
  const selectedDexes = AVAILABLE_DEXES.filter(dex => (config.dexes || []).includes(dex.id) && dex.status === 'active');
  
  // Calculate opportunity matrix
  const pairDexCombinations = enabledPairs.length * selectedDexes.length * (selectedDexes.length - 1);
  
  // Adjust for market conditions
  const marketEfficiency = 0.85; // Market efficiency factor
  const competitionFactor = Math.max(0.3, 1 - (selectedDexes.length * 0.1)); // More DEXes = more competition
  
  const totalOpportunities = Math.floor(pairDexCombinations * marketEfficiency * competitionFactor);
  
  // Estimate daily profit based on opportunities and configuration
  const avgOpportunityProfit = config.profitThreshold * 0.6; // Conservative estimate
  const dailyOpportunityCount = Math.min(totalOpportunities, config.maxSimultaneousTrades * 24); // Max per day
  const avgTradeSize = (config.maxTradeSize + config.minTradeSize) / 2;
  
  const estimatedDailyProfit = dailyOpportunityCount * avgOpportunityProfit * 0.01 * avgTradeSize;
  
  // Calculate risk score
  const riskFactors = {
    highTradeSize: config.maxTradeSize > 5000 ? 2 : 0,
    lowProfitThreshold: config.profitThreshold < 0.2 ? 3 : 0,
    highSlippage: config.slippageTolerance > 1 ? 2 : 0,
    manySimultaneous: config.maxSimultaneousTrades > 5 ? 1 : 0,
    highGasLimit: config.gasLimit > 400000 ? 1 : 0,
    lowRebalanceThreshold: config.rebalanceThreshold < 5 ? 1 : 0
  };
  
  const riskScore = Object.values(riskFactors).reduce((sum, factor) => sum + factor, 0);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (selectedDexes.length < 3) recommendations.push('Consider adding more DEXes to increase opportunities');
  if (config.profitThreshold < 0.3) recommendations.push('Increase profit threshold to reduce risk');
  if (config.slippageTolerance > 0.8) recommendations.push('Lower slippage tolerance for better execution');
  if (enabledPairs.length < 3) recommendations.push('Add more token pairs to diversify opportunities');
  if (config.maxSimultaneousTrades > 3) recommendations.push('Consider reducing simultaneous trades to manage risk');
  
  return {
    totalOpportunities,
    estimatedDailyProfit,
    riskScore,
    recommendations
  };
};



export function ArbitrageConfig({ config, onChange }: ArbitrageConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const arbConfig = config.configuration as ArbitrageConfiguration;

  // Memoized calculations for performance
  const opportunityAnalysis = useMemo(() => 
    calculateArbitrageOpportunities(arbConfig), 
    [arbConfig]
  );

  const selectedDexes = useMemo(() => 
    AVAILABLE_DEXES.filter(dex => (arbConfig.dexes || []).includes(dex.id)),
    [arbConfig.dexes]
  );

  const totalTVL = useMemo(() => 
    selectedDexes.reduce((sum, dex) => sum + dex.tvl, 0),
    [selectedDexes]
  );

  const updateConfig = useCallback((updates: Partial<ArbitrageConfiguration>) => {
    onChange({
      ...config,
      configuration: { ...arbConfig, ...updates }
    });
  }, [config, arbConfig, onChange]);

  // Real-time pair validation - simplified for now
  const validatePairAsync = useCallback(async (_index: number, pair: TokenPair) => {
    if (!pair.baseToken || !pair.quoteToken) return;
    // Validation logic can be re-implemented later if needed
  }, []);

  const addTokenPair = useCallback(() => {
    const newPair: TokenPair = {
      baseToken: '',
      quoteToken: '',
      enabled: true,
      minProfitThreshold: arbConfig.profitThreshold
    };
    updateConfig({
      tokenPairs: [...arbConfig.tokenPairs, newPair]
    });
  }, [arbConfig.tokenPairs, arbConfig.profitThreshold, updateConfig]);

  const updateTokenPair = useCallback((index: number, updates: Partial<TokenPair>) => {
    const updatedPairs = arbConfig.tokenPairs.map((pair, i) => 
      i === index ? { ...pair, ...updates } : pair
    );
    updateConfig({ tokenPairs: updatedPairs });
    
    // Trigger validation if tokens changed
    if (updates.baseToken || updates.quoteToken) {
      const currentPair = arbConfig.tokenPairs[index];
      if (currentPair) {
        const updatedPair: TokenPair = {
          baseToken: updates.baseToken ?? currentPair.baseToken,
          quoteToken: updates.quoteToken ?? currentPair.quoteToken,
          enabled: updates.enabled ?? currentPair.enabled,
          minProfitThreshold: updates.minProfitThreshold ?? currentPair.minProfitThreshold ?? arbConfig.profitThreshold,
          maxTradeSize: updates.maxTradeSize ?? currentPair.maxTradeSize ?? arbConfig.maxTradeSize
        };
        validatePairAsync(index, updatedPair);
      }
    }
  }, [arbConfig.tokenPairs, updateConfig, validatePairAsync]);

  const removeTokenPair = useCallback((index: number) => {
    const updatedPairs = arbConfig.tokenPairs.filter((_, i) => i !== index);
    updateConfig({ tokenPairs: updatedPairs });
  }, [arbConfig.tokenPairs, updateConfig]);

  const addPopularPair = useCallback((popularPair: { baseToken: string; quoteToken: string }) => {
    const exists = arbConfig.tokenPairs.some(
      pair => pair.baseToken === popularPair.baseToken && pair.quoteToken === popularPair.quoteToken
    );
    
    if (!exists) {
      const newPair: TokenPair = {
        baseToken: popularPair.baseToken,
        quoteToken: popularPair.quoteToken,
        enabled: true,
        minProfitThreshold: arbConfig.profitThreshold
      };
      updateConfig({
        tokenPairs: [...arbConfig.tokenPairs, newPair]
      });
    }
  }, [arbConfig.tokenPairs, arbConfig.profitThreshold, updateConfig]);

  const toggleDex = useCallback((dexId: string) => {
    const currentDexes = arbConfig.dexes || [];
    const updatedDexes = currentDexes.includes(dexId)
      ? currentDexes.filter(id => id !== dexId)
      : [...currentDexes, dexId];
    
    updateConfig({ dexes: updatedDexes });
  }, [arbConfig.dexes, updateConfig]);

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
              <div className="text-2xl font-bold text-blue-600">{arbConfig.tokenPairs.filter(p => p.enabled).length}</div>
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
                {selectedDexes.filter(dex => dex.status === 'active').length}/{selectedDexes.length}
              </div>
              <div className="text-sm text-muted-foreground">Active DEXes</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {selectedDexes.length > 0 ? Math.round(selectedDexes.reduce((sum, dex) => sum + dex.latency, 0) / selectedDexes.length) : 0}ms
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
                onChange={(e) => onChange({ ...config, name: e.target.value })}
                className="w-full p-3 border rounded-md"
                placeholder="e.g., ETH-ARB-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paper Trading</label>
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <input
                  type="checkbox"
                  checked={config.isPaperTrading}
                  onChange={(e) => onChange({ ...config, isPaperTrading: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Enable paper trading mode</span>
              </div>
            </div>
          </div>

          {/* Profit and Size Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Profit Threshold (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={arbConfig.profitThreshold}
                onChange={(e) => updateConfig({ profitThreshold: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="0.3"
              />
              <p className="text-xs text-muted-foreground">Minimum profit required to execute trade</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Min Trade Size (USD)
              </label>
              <input
                type="number"
                value={arbConfig.minTradeSize}
                onChange={(e) => updateConfig({ minTradeSize: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Max Trade Size (USD)
              </label>
              <input
                type="number"
                value={arbConfig.maxTradeSize}
                onChange={(e) => updateConfig({ maxTradeSize: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="1000"
              />
            </div>
          </div>

          {/* Slippage and Gas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slippage Tolerance (%)</label>
              <input
                type="number"
                step="0.1"
                value={arbConfig.slippageTolerance}
                onChange={(e) => updateConfig({ slippageTolerance: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="0.5"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gas Limit</label>
              <input
                type="number"
                value={arbConfig.gasLimit}
                onChange={(e) => updateConfig({ gasLimit: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="300000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Simultaneous Trades</label>
              <input
                type="number"
                min="1"
                max="10"
                value={arbConfig.maxSimultaneousTrades}
                onChange={(e) => updateConfig({ maxSimultaneousTrades: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DEX Selection */}
      <Card>
        <CardHeader>
          <CardTitle>DEX Selection</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select at least 2 DEXes to enable arbitrage opportunities
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AVAILABLE_DEXES.map((dex) => {
              const isSelected = (arbConfig.dexes || []).includes(dex.id);
              return (
                <div
                  key={dex.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleDex(dex.id)}
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
                    {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                  </div>
                </div>
              );
            })}
          </div>
          
          {(arbConfig.dexes || []).length < 2 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Select at least 2 DEXes to enable arbitrage opportunities
                </span>
              </div>
            </div>
          )}
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
                  {pair.baseToken}/{pair.quoteToken}
                </Badge>
              ))}
            </div>
          </div>

          {/* Configured Pairs */}
          <div className="space-y-3">
            {arbConfig.tokenPairs.map((pair, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Base Token</label>
                    <input
                      type="text"
                      value={pair.baseToken}
                      onChange={(e) => updateTokenPair(index, { baseToken: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="ETH"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Quote Token</label>
                    <input
                      type="text"
                      value={pair.quoteToken}
                      onChange={(e) => updateTokenPair(index, { quoteToken: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="USDC"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Min Profit (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={pair.minProfitThreshold || arbConfig.profitThreshold}
                      onChange={(e) => updateTokenPair(index, { minProfitThreshold: Number(e.target.value) })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="0.3"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Max Size (USD)
                    </label>
                    <input
                      type="number"
                      value={pair.maxTradeSize || arbConfig.maxTradeSize}
                      onChange={(e) => updateTokenPair(index, { maxTradeSize: Number(e.target.value) })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="1000"
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

          {arbConfig.tokenPairs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No token pairs configured</p>
              <p className="text-sm">Add token pairs to start finding arbitrage opportunities</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Advanced Settings</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rebalance Threshold (%)</label>
                <input
                  type="number"
                  value={arbConfig.rebalanceThreshold}
                  onChange={(e) => updateConfig({ rebalanceThreshold: Number(e.target.value) })}
                  className="w-full p-3 border rounded-md"
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Rebalance when portfolio deviation exceeds this threshold
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Wallet</label>
                <input
                  type="text"
                  value={config.wallet}
                  onChange={(e) => onChange({ ...config, wallet: e.target.value })}
                  className="w-full p-3 border rounded-md"
                  placeholder="0x..."
                />
                <p className="text-xs text-muted-foreground">
                  Wallet address for executing trades
                </p>
              </div>
            </div>
          </CardContent>
        )}
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
              {arbConfig.tokenPairs.filter(p => p.enabled).length > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Token pairs configured: {arbConfig.tokenPairs.filter(p => p.enabled).length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(arbConfig.dexes || []).length >= 2 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                DEXes selected: {(arbConfig.dexes || []).length} (minimum 2 required)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.wallet ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                Wallet configured: {config.wallet ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
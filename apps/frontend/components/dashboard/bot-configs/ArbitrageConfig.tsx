'use client';

import React, { useState } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { BotConfiguration, ArbitrageConfiguration, TokenPair } from '../BotConfigurationDashboard';

interface ArbitrageConfigProps {
  config: BotConfiguration;
  onChange: (config: BotConfiguration) => void;
}

// Available DEXes for arbitrage
const AVAILABLE_DEXES = [
  { id: 'uniswap', name: 'Uniswap V3', icon: '🦄', chains: ['ethereum', 'arbitrum', 'polygon'] },
  { id: 'sushiswap', name: 'SushiSwap', icon: '🍣', chains: ['ethereum', 'arbitrum', 'polygon'] },
  { id: 'pancakeswap', name: 'PancakeSwap', icon: '🥞', chains: ['bsc'] },
  { id: '1inch', name: '1inch', icon: '1️⃣', chains: ['ethereum', 'bsc', 'polygon'] },
  { id: 'curve', name: 'Curve', icon: '🌀', chains: ['ethereum', 'arbitrum', 'polygon'] },
  { id: 'balancer', name: 'Balancer', icon: '⚖️', chains: ['ethereum', 'arbitrum', 'polygon'] }
];

// Popular token pairs for arbitrage
const POPULAR_TOKEN_PAIRS = [
  { baseToken: 'ETH', quoteToken: 'USDC', popular: true },
  { baseToken: 'ETH', quoteToken: 'USDT', popular: true },
  { baseToken: 'WBTC', quoteToken: 'USDC', popular: true },
  { baseToken: 'WBTC', quoteToken: 'ETH', popular: true },
  { baseToken: 'LINK', quoteToken: 'ETH', popular: true },
  { baseToken: 'UNI', quoteToken: 'ETH', popular: false },
  { baseToken: 'AAVE', quoteToken: 'ETH', popular: false },
  { baseToken: 'MATIC', quoteToken: 'USDC', popular: false }
];

export function ArbitrageConfig({ config, onChange }: ArbitrageConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const arbConfig = config.configuration as ArbitrageConfiguration;

  const updateConfig = (updates: Partial<ArbitrageConfiguration>) => {
    onChange({
      ...config,
      configuration: { ...arbConfig, ...updates }
    });
  };

  const addTokenPair = () => {
    const newPair: TokenPair = {
      baseToken: '',
      quoteToken: '',
      enabled: true,
      minProfitThreshold: arbConfig.profitThreshold
    };
    updateConfig({
      tokenPairs: [...arbConfig.tokenPairs, newPair]
    });
  };

  const updateTokenPair = (index: number, updates: Partial<TokenPair>) => {
    const updatedPairs = arbConfig.tokenPairs.map((pair, i) => 
      i === index ? { ...pair, ...updates } : pair
    );
    updateConfig({ tokenPairs: updatedPairs });
  };

  const removeTokenPair = (index: number) => {
    const updatedPairs = arbConfig.tokenPairs.filter((_, i) => i !== index);
    updateConfig({ tokenPairs: updatedPairs });
  };

  const addPopularPair = (popularPair: { baseToken: string; quoteToken: string }) => {
    const exists = arbConfig.tokenPairs.some(
      pair => pair.baseToken === popularPair.baseToken && pair.quoteToken === popularPair.quoteToken
    );
    
    if (!exists) {
      const newPair: TokenPair = {
        ...popularPair,
        enabled: true,
        minProfitThreshold: arbConfig.profitThreshold
      };
      updateConfig({
        tokenPairs: [...arbConfig.tokenPairs, newPair]
      });
    }
  };

  const toggleDex = (dexId: string) => {
    const currentDexes = arbConfig.dexes || [];
    const updatedDexes = currentDexes.includes(dexId)
      ? currentDexes.filter(id => id !== dexId)
      : [...currentDexes, dexId];
    
    updateConfig({ dexes: updatedDexes });
  };

  const getEstimatedOpportunities = () => {
    const enabledPairs = arbConfig.tokenPairs.filter(pair => pair.enabled).length;
    const selectedDexes = (arbConfig.dexes || []).length;
    return enabledPairs * selectedDexes * (selectedDexes - 1);
  };

  const getRiskLevel = () => {
    const riskFactors = {
      highTradeSize: arbConfig.maxTradeSize > 2000,
      lowProfitThreshold: arbConfig.profitThreshold < 0.2,
      highSlippage: arbConfig.slippageTolerance > 1,
      manySimultaneous: arbConfig.maxSimultaneousTrades > 5
    };

    const riskCount = Object.values(riskFactors).filter(Boolean).length;
    
    if (riskCount >= 3) return { level: 'high', color: 'text-red-600' };
    if (riskCount >= 2) return { level: 'medium', color: 'text-yellow-600' };
    return { level: 'low', color: 'text-green-600' };
  };

  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Arbitrage Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{arbConfig.tokenPairs.filter(p => p.enabled).length}</div>
              <div className="text-sm text-muted-foreground">Active Token Pairs</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{getEstimatedOpportunities()}</div>
              <div className="text-sm text-muted-foreground">Est. Opportunities</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${risk.color}`}>{risk.level.toUpperCase()}</div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
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
              <label className="text-sm font-medium">Profit Threshold (%)</label>
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
              <label className="text-sm font-medium">Min Trade Size (USD)</label>
              <input
                type="number"
                value={arbConfig.minTradeSize}
                onChange={(e) => updateConfig({ minTradeSize: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Trade Size (USD)</label>
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
                    <label className="text-xs text-muted-foreground">Min Profit (%)</label>
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
                    <label className="text-xs text-muted-foreground">Max Size (USD)</label>
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
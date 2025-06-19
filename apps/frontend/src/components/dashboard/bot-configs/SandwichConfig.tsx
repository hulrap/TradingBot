'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  Zap, 
  Shield, 
  Settings2,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Timer,
  DollarSign
} from 'lucide-react';
import { BotConfiguration, SandwichConfiguration } from '../BotConfigurationDashboard';

interface SandwichConfigProps {
  config: BotConfiguration;
  onChange: (config: BotConfiguration) => void;
}

// Available DEXes for sandwich attacks
const TARGET_DEXES = [
  { id: 'uniswap', name: 'Uniswap V2', volume: 'High', competition: 'Very High' },
  { id: 'uniswap-v3', name: 'Uniswap V3', volume: 'Very High', competition: 'Extreme' },
  { id: 'sushiswap', name: 'SushiSwap', volume: 'Medium', competition: 'High' },
  { id: 'pancakeswap', name: 'PancakeSwap', volume: 'High', competition: 'Medium' },
  { id: '0x', name: '0x Protocol', volume: 'Medium', competition: 'Low' },
  { id: 'curve', name: 'Curve', volume: 'Medium', competition: 'Medium' }
];

// MEV Protection Networks
const MEV_NETWORKS = [
  { 
    id: 'flashbots', 
    name: 'Flashbots', 
    description: 'Private mempool for Ethereum',
    fee: '10%',
    success: '95%',
    chains: ['ethereum']
  },
  { 
    id: 'jito', 
    name: 'Jito', 
    description: 'Solana MEV infrastructure',
    fee: '5%',
    success: '88%',
    chains: ['solana']
  },
  { 
    id: 'bloxroute', 
    name: 'bloXroute', 
    description: 'Multi-chain MEV protection',
    fee: '8%',
    success: '92%',
    chains: ['ethereum', 'bsc', 'polygon']
  }
];

export function SandwichConfig({ config, onChange }: SandwichConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const sandwichConfig = config.configuration as SandwichConfiguration;

  const updateConfig = (updates: Partial<SandwichConfiguration>) => {
    onChange({
      ...config,
      configuration: { ...sandwichConfig, ...updates }
    });
  };

  const toggleDex = (dexId: string) => {
    const currentDexes = sandwichConfig.targetDexes || [];
    const updatedDexes = currentDexes.includes(dexId)
      ? currentDexes.filter(id => id !== dexId)
      : [...currentDexes, dexId];
    
    updateConfig({ targetDexes: updatedDexes });
  };

  const toggleMevProtection = (network: 'flashbots' | 'jito' | 'bloxroute') => {
    updateConfig({
      mevProtection: {
        ...sandwichConfig.mevProtection,
        [network]: !sandwichConfig.mevProtection[network]
      }
    });
  };

  const getEstimatedProfit = () => {
    const avgTradeSize = sandwichConfig.minVictimTradeSize * 2;
    const profitRate = sandwichConfig.profitThreshold / 100;
    return avgTradeSize * profitRate;
  };

  const getRiskLevel = () => {
    const riskFactors = {
      aggressiveGas: sandwichConfig.gasBidStrategy === 'aggressive',
      highMaxGas: sandwichConfig.maxGasBid > 200,
      lowProfitThreshold: sandwichConfig.profitThreshold < 1,
      noMevProtection: !Object.values(sandwichConfig.mevProtection).some(Boolean),
      highBlockDelay: sandwichConfig.maxBlockDelay > 3
    };

    const riskCount = Object.values(riskFactors).filter(Boolean).length;
    
    if (riskCount >= 4) return { level: 'extreme', color: 'text-red-700' };
    if (riskCount >= 3) return { level: 'high', color: 'text-red-600' };
    if (riskCount >= 2) return { level: 'medium', color: 'text-yellow-600' };
    return { level: 'low', color: 'text-green-600' };
  };

  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="font-medium text-yellow-800">High-Risk Strategy</div>
              <div className="text-sm text-yellow-700">
                Sandwich attacks are complex MEV strategies with significant legal and technical risks. 
                Use only on testnets or with proper legal guidance.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-500" />
            Sandwich Bot Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600 flex items-center justify-center gap-1">
                <DollarSign className="h-6 w-6" />
                {getEstimatedProfit().toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Est. Profit/Trade</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {sandwichConfig.targetDexes.length}
              </div>
              <div className="text-sm text-muted-foreground">Target DEXes</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600 flex items-center justify-center gap-1">
                <Timer className="h-6 w-6" />
                {sandwichConfig.maxBlockDelay}
              </div>
              <div className="text-sm text-muted-foreground">Max Block Delay</div>
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
          {/* Bot Name and Paper Trading */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => onChange({ ...config, name: e.target.value })}
                className="w-full p-3 border rounded-md"
                placeholder="e.g., MEV-SANDWICH-001"
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
                <span className="text-sm">Enable paper trading mode (strongly recommended)</span>
              </div>
            </div>
          </div>

          {/* Profit and Trade Size Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Profit Threshold (%)</label>
              <input
                type="number"
                step="0.1"
                value={sandwichConfig.profitThreshold}
                onChange={(e) => updateConfig({ profitThreshold: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="1.0"
              />
              <p className="text-xs text-muted-foreground">Minimum profit required after fees and slippage</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Victim Trade Size (USD)</label>
              <input
                type="number"
                value={sandwichConfig.minVictimTradeSize}
                onChange={(e) => updateConfig({ minVictimTradeSize: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">Minimum size of victim trade to target</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Slippage (%)</label>
              <input
                type="number"
                step="0.1"
                value={sandwichConfig.maxSlippage}
                onChange={(e) => updateConfig({ maxSlippage: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="2.0"
              />
              <p className="text-xs text-muted-foreground">Maximum acceptable slippage</p>
            </div>
          </div>

          {/* Gas Strategy */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Gas Bidding Strategy</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'conservative', label: 'Conservative', desc: 'Lower gas, higher success rate' },
                { value: 'adaptive', label: 'Adaptive', desc: 'Dynamic gas based on competition' },
                { value: 'aggressive', label: 'Aggressive', desc: 'Maximum gas for priority' }
              ].map((strategy) => (
                <div
                  key={strategy.value}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    sandwichConfig.gasBidStrategy === strategy.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => updateConfig({ gasBidStrategy: strategy.value as any })}
                >
                  <div className="font-medium">{strategy.label}</div>
                  <div className="text-xs text-muted-foreground">{strategy.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Gas Bid (Gwei)</label>
              <input
                type="number"
                value={sandwichConfig.maxGasBid}
                onChange={(e) => updateConfig({ maxGasBid: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">Maximum gas price to bid</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Block Delay</label>
              <input
                type="number"
                min="1"
                max="5"
                value={sandwichConfig.maxBlockDelay}
                onChange={(e) => updateConfig({ maxBlockDelay: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="2"
              />
              <p className="text-xs text-muted-foreground">Maximum blocks to wait for execution</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target DEXes */}
      <Card>
        <CardHeader>
          <CardTitle>Target DEXes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select DEXes to monitor for sandwich opportunities
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TARGET_DEXES.map((dex) => {
              const isSelected = sandwichConfig.targetDexes.includes(dex.id);
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{dex.name}</div>
                    {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Volume</div>
                      <div className="font-medium flex items-center gap-1">
                        {dex.volume}
                        {dex.volume === 'Very High' && <Zap className="h-3 w-3 text-yellow-500" />}
                        {dex.volume === 'High' && <TrendingUp className="h-3 w-3 text-green-500" />}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Competition</div>
                      <div className="font-medium">
                        <Badge 
                          variant={
                            dex.competition === 'Extreme' ? 'destructive' :
                            dex.competition === 'Very High' ? 'destructive' :
                            dex.competition === 'High' ? 'secondary' :
                            dex.competition === 'Medium' ? 'outline' : 'default'
                          }
                          className="text-xs"
                        >
                          {dex.competition}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* MEV Protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            MEV Protection Networks
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Use private mempools to avoid competition and ensure execution
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MEV_NETWORKS.map((network) => {
              const isEnabled = sandwichConfig.mevProtection[network.id as keyof typeof sandwichConfig.mevProtection];
              return (
                <div
                  key={network.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isEnabled
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleMevProtection(network.id as any)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{network.name}</div>
                      <div className="text-sm text-muted-foreground">{network.description}</div>
                    </div>
                    {isEnabled && <CheckCircle className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Fee</div>
                      <div className="font-medium">{network.fee}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Success Rate</div>
                      <div className="font-medium">{network.success}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Chains</div>
                      <div className="font-medium">{network.chains.join(', ')}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sandwichConfig.competitionAnalysis}
                  onChange={(e) => updateConfig({ competitionAnalysis: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm font-medium">Competition Analysis</label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Analyze competing MEV bots to optimize bidding strategy
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Wallet Address</label>
              <input
                type="text"
                value={config.wallet}
                onChange={(e) => onChange({ ...config, wallet: e.target.value })}
                className="w-full p-3 border rounded-md font-mono text-sm"
                placeholder="0x..."
              />
              <p className="text-xs text-muted-foreground">
                Wallet for executing sandwich transactions
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="font-medium text-red-800 mb-1">Legal Risks</div>
              <div className="text-sm text-red-700">
                Sandwich attacks may be considered market manipulation in some jurisdictions. 
                Consult legal counsel before use.
              </div>
            </div>
            
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="font-medium text-yellow-800 mb-1">Technical Risks</div>
              <div className="text-sm text-yellow-700">
                High gas costs, failed transactions, and MEV bot competition can result in losses.
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="font-medium text-blue-800 mb-1">Recommendation</div>
              <div className="text-sm text-blue-700">
                Start with paper trading and small amounts. Use MEV protection networks to reduce competition.
              </div>
            </div>
          </div>
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
              {sandwichConfig.targetDexes.length > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Target DEXes: {sandwichConfig.targetDexes.length > 0 ? 'Configured' : 'Required'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {Object.values(sandwichConfig.mevProtection).some(Boolean) ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                MEV Protection: {Object.values(sandwichConfig.mevProtection).some(Boolean) ? 'Enabled' : 'Recommended'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.isPaperTrading ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Paper Trading: {config.isPaperTrading ? 'Enabled (Recommended)' : 'Disabled (High Risk)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.wallet ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                Wallet: {config.wallet ? 'Configured' : 'Required for live trading'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
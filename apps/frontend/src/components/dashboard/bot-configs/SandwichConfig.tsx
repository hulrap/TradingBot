'use client';

import React, { useState, useMemo } from 'react';
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
  DollarSign,
  Globe,
  Activity
} from 'lucide-react';
import { BotConfiguration, SandwichConfiguration } from '../BotConfigurationDashboard';

interface SandwichConfigProps {
  config: BotConfiguration;
  onChange: (config: BotConfiguration) => void;
}

// Enhanced MEV network data with real-time status simulation
const MEV_NETWORKS = [
  { 
    id: 'flashbots', 
    name: 'Flashbots', 
    description: 'Private mempool for Ethereum',
    fee: '10%',
    success: '95%',
    chains: ['ethereum'],
    status: 'active' as const,
    avgLatency: '12ms',
    currentLoad: 'medium'
  },
  { 
    id: 'jito', 
    name: 'Jito', 
    description: 'Solana MEV infrastructure',
    fee: '5%',
    success: '88%',
    chains: ['solana'],
    status: 'active' as const,
    avgLatency: '8ms',
    currentLoad: 'low'
  },
  { 
    id: 'bloxroute', 
    name: 'bloXroute', 
    description: 'Multi-chain MEV protection',
    fee: '8%',
    success: '92%',
    chains: ['ethereum', 'bsc', 'polygon'],
    status: 'active' as const,
    avgLatency: '15ms',
    currentLoad: 'high'
  }
];

// Enhanced DEX data with competition metrics
const TARGET_DEXES = [
  { id: 'uniswap', name: 'Uniswap V2', volume: 'High', competition: 'Very High', avgSlippage: '0.3%', mevBots: 1200 },
  { id: 'uniswap-v3', name: 'Uniswap V3', volume: 'Very High', competition: 'Extreme', avgSlippage: '0.2%', mevBots: 2400 },
  { id: 'sushiswap', name: 'SushiSwap', volume: 'Medium', competition: 'High', avgSlippage: '0.4%', mevBots: 800 },
  { id: 'pancakeswap', name: 'PancakeSwap', volume: 'High', competition: 'Medium', avgSlippage: '0.3%', mevBots: 600 },
  { id: '0x', name: '0x Protocol', volume: 'Medium', competition: 'Low', avgSlippage: '0.5%', mevBots: 200 },
  { id: 'curve', name: 'Curve', volume: 'Medium', competition: 'Medium', avgSlippage: '0.2%', mevBots: 400 }
];

// Legal compliance data
const LEGAL_JURISDICTIONS = {
  'US': { status: 'prohibited', reason: 'Market manipulation regulations' },
  'EU': { status: 'restricted', reason: 'MiCA regulations apply' },
  'UK': { status: 'unclear', reason: 'FCA guidance pending' },
  'SG': { status: 'restricted', reason: 'MAS DeFi guidelines' },
  'JP': { status: 'prohibited', reason: 'FSA crypto regulations' },
  'CA': { status: 'unclear', reason: 'CSA guidance needed' }
};

// Enhanced profit calculation with MEV competition modeling
const calculateSophisticatedProfit = (config: SandwichConfiguration): {
  estimatedProfit: number;
  confidence: number;
  factors: Record<string, any>;
} => {
  const baseTradeSize = config.minVictimTradeSize * 1.5; // Average victim trade
  const profitRate = config.profitThreshold / 100;
  
  // Competition factor based on selected DEXes
  const competitionFactors = config.targetDexes.map(dexId => {
    const dex = TARGET_DEXES.find(d => d.id === dexId);
    if (!dex) return 1;
    
    switch (dex.competition) {
      case 'Extreme': return 0.3; // 70% reduction due to competition
      case 'Very High': return 0.4;
      case 'High': return 0.6;
      case 'Medium': return 0.8;
      case 'Low': return 0.95;
      default: return 0.7;
    }
  });
  
  const avgCompetitionFactor = competitionFactors.reduce((sum, factor) => sum + factor, 0) / competitionFactors.length;
  
  // Gas cost estimation
  const gasCostMultiplier = config.gasBidStrategy === 'aggressive' ? 2.5 : 
                           config.gasBidStrategy === 'adaptive' ? 1.8 : 1.2;
  const estimatedGasCost = config.maxGasBid * 0.3 * gasCostMultiplier; // Rough estimate
  
  // MEV protection overhead
  const mevProtectionCount = Object.values(config.mevProtection).filter(Boolean).length;
  const mevOverhead = mevProtectionCount * 0.05; // 5% per protection service
  
  // Slippage impact
  const slippageImpact = config.maxSlippage / 100;
  
  const grossProfit = baseTradeSize * profitRate;
  const netProfit = grossProfit * avgCompetitionFactor * (1 - mevOverhead) * (1 - slippageImpact) - estimatedGasCost;
  
  // Confidence based on configuration quality
  const confidenceFactors = {
    hasCompetitionAnalysis: config.competitionAnalysis ? 0.2 : 0,
    hasMevProtection: mevProtectionCount > 0 ? 0.3 : 0,
    reasonableGasStrategy: config.gasBidStrategy !== 'aggressive' ? 0.2 : 0,
    reasonableProfitThreshold: config.profitThreshold >= 0.5 ? 0.2 : 0,
    conservativeSlippage: config.maxSlippage <= 2 ? 0.1 : 0
  };
  
  const confidence = Math.min(95, Object.values(confidenceFactors).reduce((sum, factor) => sum + factor, 0) * 100 + 20);
  
  return {
    estimatedProfit: Math.max(0, netProfit),
    confidence,
    factors: {
      baseTradeSize,
      competitionFactor: avgCompetitionFactor,
      gasCost: estimatedGasCost,
      mevOverhead,
      slippageImpact,
      confidenceFactors
    }
  };
};

// Enhanced risk assessment with MEV-specific factors
const calculateMevRisk = (config: SandwichConfiguration): {
  level: 'low' | 'medium' | 'high' | 'extreme';
  color: string;
  score: number;
  warnings: string[];
} => {
  const riskFactors = {
    // Gas and competition risks
    aggressiveGas: config.gasBidStrategy === 'aggressive',
    veryHighMaxGas: config.maxGasBid > 300,
    highMaxGas: config.maxGasBid > 200,
    
    // Profit and slippage risks
    lowProfitThreshold: config.profitThreshold < 0.5,
    veryLowProfitThreshold: config.profitThreshold < 0.3,
    highSlippage: config.maxSlippage > 3,
    veryHighSlippage: config.maxSlippage > 5,
    
    // Protection and strategy risks
    noMevProtection: !Object.values(config.mevProtection).some(Boolean),
    singleMevProtection: Object.values(config.mevProtection).filter(Boolean).length === 1,
    noCompetitionAnalysis: !config.competitionAnalysis,
    highBlockDelay: config.maxBlockDelay > 3,
    veryHighBlockDelay: config.maxBlockDelay > 5,
    
    // DEX selection risks
    extremeCompetitionDexes: config.targetDexes.some(dexId => {
      const dex = TARGET_DEXES.find(d => d.id === dexId);
      return dex && dex.competition === 'Extreme';
    }),
    noDexes: config.targetDexes.length === 0,
    singleDex: config.targetDexes.length === 1
  };

  const weights = {
    veryHighMaxGas: 4,
    veryLowProfitThreshold: 4,
    veryHighSlippage: 3,
    noMevProtection: 3,
    veryHighBlockDelay: 3,
    aggressiveGas: 2,
    highMaxGas: 2,
    lowProfitThreshold: 2,
    highSlippage: 2,
    extremeCompetitionDexes: 2,
    noCompetitionAnalysis: 2,
    singleMevProtection: 1.5,
    highBlockDelay: 1.5,
    noDexes: 5, // Critical
    singleDex: 1
  };

  const score = Object.entries(riskFactors)
    .filter(([_, value]) => value)
    .reduce((sum, [key, _]) => sum + (weights[key as keyof typeof weights] || 1), 0);

  const warnings: string[] = [];
  if (riskFactors.noMevProtection) warnings.push('No MEV protection enabled - high front-running risk');
  if (riskFactors.veryLowProfitThreshold) warnings.push('Very low profit threshold - may execute unprofitable trades');
  if (riskFactors.aggressiveGas) warnings.push('Aggressive gas strategy - high cost and competition risk');
  if (riskFactors.extremeCompetitionDexes) warnings.push('Targeting high-competition DEXes - low success probability');
  if (riskFactors.veryHighSlippage) warnings.push('Very high slippage tolerance - significant loss risk');

  if (score >= 12) return { level: 'extreme', color: 'text-red-700', score, warnings };
  if (score >= 8) return { level: 'high', color: 'text-red-600', score, warnings };
  if (score >= 5) return { level: 'medium', color: 'text-yellow-600', score, warnings };
  return { level: 'low', color: 'text-green-600', score, warnings };
};

// Detect user's location for legal compliance (mock implementation)
const detectUserJurisdiction = (): string => {
  // In production, this would use actual geolocation or user settings
  return 'US'; // Mock jurisdiction
};

export function SandwichConfig({ config, onChange }: SandwichConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userJurisdiction] = useState(detectUserJurisdiction());
  
  const sandwichConfig = config.configuration as SandwichConfiguration;

  // Memoized calculations for performance
  const profitAnalysis = useMemo(() => calculateSophisticatedProfit(sandwichConfig), [sandwichConfig]);
  const riskAssessment = useMemo(() => calculateMevRisk(sandwichConfig), [sandwichConfig]);
  const legalStatus = LEGAL_JURISDICTIONS[userJurisdiction as keyof typeof LEGAL_JURISDICTIONS];

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

  return (
    <div className="space-y-6">
      {/* Legal Compliance Warning */}
      {legalStatus && legalStatus.status !== 'allowed' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Globe className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium text-red-800 mb-1">
                  Legal Compliance Warning - {userJurisdiction}
                </div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>
                    Sandwich attacks are <span className="font-semibold">{legalStatus.status}</span> in your jurisdiction.
                  </p>
                  <p>Reason: {legalStatus.reason}</p>
                  <p className="font-medium">
                    ⚠️ Consult legal counsel before proceeding. Use only on testnets or where legally permitted.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* High Risk Strategy Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="font-medium text-yellow-800">High-Risk Strategy</div>
              <div className="text-sm text-yellow-700">
                Sandwich attacks are complex MEV strategies with significant legal and technical risks. 
                <strong> Estimated success rate: {profitAnalysis.confidence.toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Configuration Overview */}
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
              <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                profitAnalysis.estimatedProfit > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <DollarSign className="h-6 w-6" />
                ${profitAnalysis.estimatedProfit.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Est. Profit/Trade</div>
              <div className="text-xs text-muted-foreground">
                {profitAnalysis.confidence.toFixed(1)}% confidence
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {sandwichConfig.targetDexes.length}
              </div>
              <div className="text-sm text-muted-foreground">Target DEXes</div>
              <div className="text-xs text-muted-foreground">
                {TARGET_DEXES.filter(dex => sandwichConfig.targetDexes.includes(dex.id))
                  .reduce((sum, dex) => sum + dex.mevBots, 0)} competing bots
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600 flex items-center justify-center gap-1">
                <Timer className="h-6 w-6" />
                {sandwichConfig.maxBlockDelay}
              </div>
              <div className="text-sm text-muted-foreground">Max Block Delay</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${riskAssessment.color} flex items-center justify-center gap-1`}>
                {riskAssessment.level === 'extreme' && <AlertTriangle className="h-6 w-6" />}
                {riskAssessment.level === 'high' && <AlertTriangle className="h-6 w-6" />}
                {riskAssessment.level === 'medium' && <Activity className="h-6 w-6" />}
                {riskAssessment.level === 'low' && <Shield className="h-6 w-6" />}
                {riskAssessment.level.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
              <div className="text-xs text-muted-foreground">
                Score: {riskAssessment.score}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Warnings */}
      {riskAssessment.warnings.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Risk Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {riskAssessment.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-orange-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
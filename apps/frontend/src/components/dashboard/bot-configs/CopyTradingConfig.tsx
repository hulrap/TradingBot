'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  Settings2,
  Target,
  AlertCircle,
  CheckCircle,
  Filter,
  DollarSign,
  Clock,
  Shield,
  TrendingUp,
  Activity,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { BotConfiguration, CopyTradingConfiguration, TradeFilter } from '../BotConfigurationDashboard';

interface CopyTradingConfigProps {
  config: BotConfiguration;
  onChange: (config: BotConfiguration) => void;
}

// Enhanced wallet validation
const validateWalletAddress = (address: string): { isValid: boolean; error?: string } => {
  if (!address) return { isValid: false, error: 'Address is required' };
  
  // Basic Ethereum address validation
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(address)) {
    return { isValid: false, error: 'Invalid Ethereum address format' };
  }
  
  // Basic checksum validation (simplified)
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    // Mixed case - should validate checksum in production
    console.warn('Mixed case address detected - checksum validation needed');
  }
  
  return { isValid: true };
};

// Enhanced risk assessment with more sophisticated modeling
const calculateAdvancedRisk = (config: CopyTradingConfiguration): {
  level: 'low' | 'medium' | 'high' | 'extreme';
  color: string;
  factors: Record<string, boolean>;
  score: number;
} => {
  const riskFactors = {
    // Financial risk factors
    highCopyAmount: getEstimatedCopyAmount(config) > 500,
    veryHighCopyAmount: getEstimatedCopyAmount(config) > 2000,
    noStopLoss: !config.stopLoss || config.stopLoss > 15,
    extremeStopLoss: !config.stopLoss || config.stopLoss > 25,
    
    // Timing and execution risks
    shortDelay: config.delayMs < 1000,
    veryShortDelay: config.delayMs < 500,
    
    // Filter and protection risks
    noFilters: config.tradeFilters.filter(f => f.enabled).length === 0,
    fewFilters: config.tradeFilters.filter(f => f.enabled).length < 2,
    
    // MEV and competition risks
    noTakeProfit: !config.takeProfit,
    aggressiveTakeProfit: Boolean(config.takeProfit && config.takeProfit > 50),
    
    // Token list risks
    noTokenLimits: config.whitelistedTokens.length === 0 && config.blacklistedTokens.length === 0,
    largeBlacklist: config.blacklistedTokens.length > 10
  };

  // Calculate weighted risk score
  const weights = {
    veryHighCopyAmount: 3,
    extremeStopLoss: 3,
    veryShortDelay: 2,
    highCopyAmount: 2,
    noStopLoss: 2,
    shortDelay: 1.5,
    noFilters: 1.5,
    noTakeProfit: 1,
    fewFilters: 1,
    noTokenLimits: 1,
    aggressiveTakeProfit: 0.5,
    largeBlacklist: 0.5
  };

  const score = Object.entries(riskFactors)
    .filter(([_, value]) => value)
    .reduce((sum, [key, _]) => sum + (weights[key as keyof typeof weights] || 1), 0);

  if (score >= 8) return { level: 'extreme', color: 'text-red-700', factors: riskFactors, score };
  if (score >= 5) return { level: 'high', color: 'text-red-600', factors: riskFactors, score };
  if (score >= 3) return { level: 'medium', color: 'text-yellow-600', factors: riskFactors, score };
  return { level: 'low', color: 'text-green-600', factors: riskFactors, score };
};

const getEstimatedCopyAmount = (config: CopyTradingConfiguration): number => {
  const sampleTradeSize = 1000; // USD
  switch (config.copyMode) {
    case 'fixed_amount':
      return config.fixedAmount || 0;
    case 'percentage':
      return sampleTradeSize * (config.copyPercentage || 0) / 100;
    case 'proportional':
      return sampleTradeSize * 0.1; // Assume 10% of portfolio
    default:
      return 0;
  }
};

// Sample wallets with enhanced data structure
const POPULAR_WALLETS = [
  {
    address: '0x8ba1f109551bD432803012645Hac136c22C08',
    name: 'DeFi Whale #1',
    description: 'Large DeFi positions, conservative strategy',
    winRate: 89.2,
    avgReturn: 12.4,
    trades: 342,
    verified: true,
    riskLevel: 'low' as const,
    avgTradeSize: 2500,
    lastActive: '2 hours ago',
    tags: ['defi', 'conservative', 'large-cap']
  },
  {
    address: '0x742d35Cc6634C0532925a3b8D62103Ae4E168681',
    name: 'Arbitrage Expert',
    description: 'Focused on arbitrage opportunities',
    winRate: 94.1,
    avgReturn: 8.7,
    trades: 1247,
    verified: true,
    riskLevel: 'medium' as const,
    avgTradeSize: 1200,
    lastActive: '30 minutes ago',
    tags: ['arbitrage', 'mev', 'high-frequency']
  },
  {
    address: '0x45f783CCE6B7FF23B2ab2D70e416cdb7D6055f51',
    name: 'MEV Bot Alpha',
    description: 'Advanced MEV strategies',
    winRate: 76.8,
    avgReturn: 24.6,
    trades: 892,
    verified: false,
    riskLevel: 'high' as const,
    avgTradeSize: 5000,
    lastActive: '1 hour ago',
    tags: ['mev', 'sandwich', 'high-risk']
  }
];

// Available filter types with enhanced options
const FILTER_TYPES = [
  { value: 'token', label: 'Token', description: 'Filter by specific token symbol' },
  { value: 'amount', label: 'Amount', description: 'Filter by trade amount (USD)' },
  { value: 'gas', label: 'Gas Price', description: 'Filter by gas price (Gwei)' },
  { value: 'time', label: 'Time', description: 'Filter by time of day' },
  { value: 'volatility', label: 'Volatility', description: 'Filter by token volatility' },
  { value: 'market_cap', label: 'Market Cap', description: 'Filter by token market cap' }
];

const FILTER_CONDITIONS = [
  { value: 'equals', label: 'Equals', types: ['token', 'amount', 'gas', 'time'] },
  { value: 'greater_than', label: 'Greater than', types: ['amount', 'gas', 'time', 'volatility', 'market_cap'] },
  { value: 'less_than', label: 'Less than', types: ['amount', 'gas', 'time', 'volatility', 'market_cap'] },
  { value: 'contains', label: 'Contains', types: ['token'] },
  { value: 'between', label: 'Between', types: ['amount', 'gas', 'volatility', 'market_cap'] }
];

export function CopyTradingConfig({ config, onChange }: CopyTradingConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [walletValidation, setWalletValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true });
  
  const copyConfig = config.configuration as CopyTradingConfiguration;

  // Memoized calculations for performance
  const riskAssessment = useMemo(() => calculateAdvancedRisk(copyConfig), [copyConfig]);
  const estimatedCopyAmount = useMemo(() => getEstimatedCopyAmount(copyConfig), [copyConfig]);

  const updateConfig = (updates: Partial<CopyTradingConfiguration>) => {
    onChange({
      ...config,
      configuration: { ...copyConfig, ...updates }
    });
  };

  // Enhanced wallet validation with real-time feedback
  const handleWalletChange = (address: string) => {
    const validation = validateWalletAddress(address);
    setWalletValidation(validation);
    updateConfig({ targetWallet: address });
  };

  const addFilter = () => {
    const newFilter: TradeFilter = {
      type: 'amount',
      condition: 'greater_than',
      value: 100,
      enabled: true
    };
    updateConfig({
      tradeFilters: [...copyConfig.tradeFilters, newFilter]
    });
  };

  const updateFilter = (index: number, updates: Partial<TradeFilter>) => {
    const updatedFilters = copyConfig.tradeFilters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    );
    updateConfig({ tradeFilters: updatedFilters });
  };

  const removeFilter = (index: number) => {
    const updatedFilters = copyConfig.tradeFilters.filter((_, i) => i !== index);
    updateConfig({ tradeFilters: updatedFilters });
  };

  const addBlacklistedToken = (token: string) => {
    if (token && !copyConfig.blacklistedTokens.includes(token)) {
      updateConfig({
        blacklistedTokens: [...copyConfig.blacklistedTokens, token.toUpperCase()]
      });
    }
  };

  const removeBlacklistedToken = (token: string) => {
    updateConfig({
      blacklistedTokens: copyConfig.blacklistedTokens.filter(t => t !== token)
    });
  };

  const addWhitelistedToken = (token: string) => {
    if (token && !copyConfig.whitelistedTokens.includes(token)) {
      updateConfig({
        whitelistedTokens: [...copyConfig.whitelistedTokens, token.toUpperCase()]
      });
    }
  };

  const removeWhitelistedToken = (token: string) => {
    updateConfig({
      whitelistedTokens: copyConfig.whitelistedTokens.filter(t => t !== token)
    });
  };

  const selectedWallet = POPULAR_WALLETS.find(w => w.address === copyConfig.targetWallet);

  return (
    <div className="space-y-6">
      {/* MEV Protection Warning */}
      {riskAssessment.level === 'high' || riskAssessment.level === 'extreme' ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium text-red-800 mb-1">High Risk Configuration Detected</div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>Your copy trading configuration has a high risk level (Score: {riskAssessment.score}). Consider:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Implementing MEV protection to avoid front-running</li>
                    <li>Using longer delays to reduce competition</li>
                    <li>Adding more trade filters for safety</li>
                    <li>Setting appropriate stop-loss limits</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-green-500" />
            Copy Trading Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                <DollarSign className="h-6 w-6" />
                {estimatedCopyAmount.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Est. Copy Amount (USD)</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {copyConfig.tradeFilters.filter(f => f.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Filters</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${riskAssessment.color} flex items-center justify-center gap-1`}>
                {riskAssessment.level === 'extreme' && <AlertCircle className="h-6 w-6" />}
                {riskAssessment.level === 'high' && <AlertCircle className="h-6 w-6" />}
                {riskAssessment.level === 'medium' && <Activity className="h-6 w-6" />}
                {riskAssessment.level === 'low' && <Shield className="h-6 w-6" />}
                {riskAssessment.level.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {copyConfig.delayMs / 1000}s
              </div>
              <div className="text-sm text-muted-foreground">Copy Delay</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Wallet Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target Wallet
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowWalletSelector(!showWalletSelector)}
            >
              {showWalletSelector ? 'Hide' : 'Browse'} Wallets
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet Address</label>
            <input
              type="text"
              value={copyConfig.targetWallet}
              onChange={(e) => handleWalletChange(e.target.value)}
              className={`w-full p-3 border rounded-md font-mono text-sm ${
                !walletValidation.isValid ? 'border-red-500 bg-red-50' : 'border-border'
              }`}
              placeholder="0x..."
            />
            {!walletValidation.isValid && walletValidation.error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {walletValidation.error}
              </p>
            )}
            {walletValidation.isValid && copyConfig.targetWallet && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Valid Ethereum address
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://etherscan.io/address/${copyConfig.targetWallet}`, '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View on Etherscan
                </Button>
              </div>
            )}
            
            {selectedWallet && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {selectedWallet.name}
                      <Badge variant="outline" className={`text-xs ${
                        selectedWallet.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                        selectedWallet.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedWallet.riskLevel} risk
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{selectedWallet.description}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedWallet.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {selectedWallet.verified && (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Win Rate
                    </div>
                    <div className="font-medium">{selectedWallet.winRate}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Avg Return
                    </div>
                    <div className="font-medium text-green-600">{selectedWallet.avgReturn}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Trades
                    </div>
                    <div className="font-medium">{selectedWallet.trades}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last Active
                    </div>
                    <div className="font-medium text-green-600">{selectedWallet.lastActive}</div>
                  </div>
                </div>
                
                {/* Wallet verification and external links */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Wallet Verification & Analysis
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://etherscan.io/address/${selectedWallet.address}`, '_blank')}
                      className="text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Etherscan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://debank.com/profile/${selectedWallet.address}`, '_blank')}
                      className="text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      DeBank
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {showWalletSelector && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Popular Wallets</h4>
              <div className="space-y-2">
                {POPULAR_WALLETS.map((wallet) => (
                  <div
                    key={wallet.address}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                      copyConfig.targetWallet === wallet.address ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleWalletChange(wallet.address)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{wallet.name}</div>
                        <Badge variant="outline" className={`text-xs ${
                          wallet.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                          wallet.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {wallet.riskLevel} risk
                        </Badge>
                        {wallet.verified && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{wallet.description}</div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {wallet.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Win Rate</div>
                        <div className="font-medium text-green-600">{wallet.winRate}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Return</div>
                        <div className="font-medium text-blue-600">{wallet.avgReturn}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Trades</div>
                        <div className="font-medium">{wallet.trades}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Size</div>
                        <div className="font-medium">${wallet.avgTradeSize}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Copy Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Copy Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Copy Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Copy Mode</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'fixed_amount', label: 'Fixed Amount', desc: 'Copy exact USD amount' },
                { value: 'percentage', label: 'Percentage', desc: 'Copy % of target trade' },
                { value: 'proportional', label: 'Proportional', desc: 'Copy based on portfolio size' }
              ].map((mode) => (
                <div
                  key={mode.value}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    copyConfig.copyMode === mode.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => updateConfig({ copyMode: mode.value as any })}
                >
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">{mode.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Copy Amount Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {copyConfig.copyMode === 'fixed_amount' && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Fixed Amount (USD)
                </label>
                <input
                  type="number"
                  value={copyConfig.fixedAmount || 0}
                  onChange={(e) => updateConfig({ fixedAmount: Number(e.target.value) })}
                  className="w-full p-3 border rounded-md"
                  placeholder="100"
                />
              </div>
            )}
            
            {copyConfig.copyMode === 'percentage' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Copy Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={copyConfig.copyPercentage || 0}
                  onChange={(e) => updateConfig({ copyPercentage: Number(e.target.value) })}
                  className="w-full p-3 border rounded-md"
                  placeholder="5"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Min Copy Amount (USD)</label>
              <input
                type="number"
                value={copyConfig.minCopyAmount}
                onChange={(e) => updateConfig({ minCopyAmount: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="25"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Copy Amount (USD)</label>
              <input
                type="number"
                value={copyConfig.maxCopyAmount}
                onChange={(e) => updateConfig({ maxCopyAmount: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="500"
              />
            </div>
          </div>

          {/* Timing and Risk */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Copy Delay (ms)
              </label>
              <input
                type="number"
                value={copyConfig.delayMs}
                onChange={(e) => updateConfig({ delayMs: Number(e.target.value) })}
                className="w-full p-3 border rounded-md"
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">Delay before copying trade</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Stop Loss (%)</label>
              <input
                type="number"
                step="0.1"
                value={copyConfig.stopLoss || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    const { stopLoss, ...rest } = copyConfig;
                    updateConfig(rest);
                  } else {
                    updateConfig({ stopLoss: Number(value) });
                  }
                }}
                className="w-full p-3 border rounded-md"
                placeholder="5"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Take Profit (%)</label>
              <input
                type="number"
                step="0.1"
                value={copyConfig.takeProfit || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    const { takeProfit, ...rest } = copyConfig;
                    updateConfig(rest);
                  } else {
                    updateConfig({ takeProfit: Number(value) });
                  }
                }}
                className="w-full p-3 border rounded-md"
                placeholder="15"
              />
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Advanced Settings</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>

          {/* Advanced Settings Panel */}
          {showAdvanced && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Advanced Configuration</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Trades per Hour</label>
                  <input
                    type="number"
                    defaultValue={10}
                    className="w-full p-2 border rounded-md text-sm"
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">Limit copy frequency</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slippage Tolerance (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={1.0}
                    className="w-full p-2 border rounded-md text-sm"
                    placeholder="1.0"
                  />
                  <p className="text-xs text-muted-foreground">Max acceptable slippage</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gas Price Limit (Gwei)</label>
                  <input
                    type="number"
                    defaultValue={50}
                    className="w-full p-2 border rounded-md text-sm"
                    placeholder="50"
                  />
                  <p className="text-xs text-muted-foreground">Skip trades with high gas</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="rounded"
                  />
                  <label className="text-sm">Enable MEV Protection</label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Trade Filters
            </CardTitle>
            <Button onClick={addFilter} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {copyConfig.tradeFilters.map((filter, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Filter Type</label>
                    <select
                      value={filter.type}
                      onChange={(e) => updateFilter(index, { type: e.target.value as any })}
                      className="w-full p-2 border rounded text-sm"
                    >
                      {FILTER_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Condition</label>
                    <select
                      value={filter.condition}
                      onChange={(e) => updateFilter(index, { condition: e.target.value as any })}
                      className="w-full p-2 border rounded text-sm"
                    >
                      {FILTER_CONDITIONS.filter(cond => cond.types.includes(filter.type)).map(condition => (
                        <option key={condition.value} value={condition.value}>{condition.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Value</label>
                    <input
                      type={filter.type === 'amount' || filter.type === 'gas' ? 'number' : 'text'}
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { 
                        value: filter.type === 'amount' || filter.type === 'gas' 
                          ? Number(e.target.value) 
                          : e.target.value 
                      })}
                      className="w-full p-2 border rounded text-sm"
                      placeholder={filter.type === 'token' ? 'ETH' : '100'}
                    />
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filter.enabled}
                        onChange={(e) => updateFilter(index, { enabled: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs">Enabled</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFilter(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {copyConfig.tradeFilters.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No filters configured</p>
              <p className="text-sm">Add filters to control which trades to copy</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Lists */}
      <Card>
        <CardHeader>
          <CardTitle>Token Allow/Block Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Whitelisted Tokens */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Whitelisted Tokens (Optional)</label>
            <p className="text-xs text-muted-foreground">Only copy trades for these tokens. Leave empty to allow all tokens.</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {copyConfig.whitelistedTokens.map((token, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-green-50 text-green-800"
                >
                  {token}
                  <button
                    onClick={() => removeWhitelistedToken(token)}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter token symbol (e.g., ETH)"
                className="flex-1 p-2 border rounded text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addWhitelistedToken((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button
                size="sm"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                  if (input) {
                    addWhitelistedToken(input.value);
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Blacklisted Tokens */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Blacklisted Tokens</label>
            <p className="text-xs text-muted-foreground">Never copy trades for these tokens.</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {copyConfig.blacklistedTokens.map((token, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-red-50 text-red-800"
                >
                  {token}
                  <button
                    onClick={() => removeBlacklistedToken(token)}
                    className="ml-1 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter token symbol (e.g., SHIB)"
                className="flex-1 p-2 border rounded text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addBlacklistedToken((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button
                size="sm"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                  if (input) {
                    addBlacklistedToken(input.value);
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
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
              {copyConfig.targetWallet ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Target wallet: {copyConfig.targetWallet ? 'Configured' : 'Required'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {copyConfig.maxCopyAmount > copyConfig.minCopyAmount ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Copy amounts: {copyConfig.maxCopyAmount > copyConfig.minCopyAmount ? 'Valid' : 'Max must be greater than min'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.wallet ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                Your wallet: {config.wallet ? 'Configured' : 'Recommended'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
'use client';

import { useState, useMemo, useCallback } from 'react';
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
  BarChart3,
  Users,
  Zap
} from 'lucide-react';

// Import proper types from packages folder
import { CopyTradingBotConfig, TRADE_SIZE_TYPES } from '@trading-bot/types/src/bot';
import { isValidEthereumAddress } from '@trading-bot/types';

interface CopyTradingConfigProps {
  config: CopyTradingBotConfig;
  onChange: (config: CopyTradingBotConfig) => void;
}

// Enhanced wallet validation using the packages validation
const validateWalletAddress = (address: string): { isValid: boolean; error?: string } => {
  if (!address) return { isValid: false, error: 'Address is required' };
  
  if (!isValidEthereumAddress(address)) {
    return { isValid: false, error: 'Invalid Ethereum address format' };
  }
  
  return { isValid: true };
};

// Enhanced risk assessment aligned with CopyTradingBotConfig schema
const calculateAdvancedRisk = (config: CopyTradingBotConfig): {
  level: 'low' | 'medium' | 'high' | 'extreme';
  color: string;
  factors: Record<string, boolean>;
  score: number;
} => {
  const riskFactors = {
    // Financial risk factors based on actual schema
    highTradeSize: config.copySettings.tradeSize.value > 500,
    veryHighTradeSize: config.copySettings.tradeSize.value > 2000,
    noStopLoss: !config.riskManagement.stopLoss.enabled,
    highStopLoss: config.riskManagement.stopLoss.percentage > 20,
    
    // Timing and execution risks
    shortDelay: config.copySettings.copyDelay < 1000,
    veryShortDelay: config.copySettings.copyDelay < 500,
    
    // Filter and protection risks
    noTokenFilters: !config.filters.tokenWhitelist?.length && !config.filters.tokenBlacklist?.length,
    noGasLimit: !config.filters.maxGasPrice || config.filters.maxGasPrice > 100,
    
    // Take profit risks
    noTakeProfit: !config.riskManagement.takeProfit.enabled,
    aggressiveTakeProfit: config.riskManagement.takeProfit.enabled && config.riskManagement.takeProfit.percentage > 100,
    
    // Size and exposure risks
    highMaxTrades: config.riskManagement.maxConcurrentTrades > 10,
    highDailyLoss: config.riskManagement.maxDailyLoss > 1000
  };

  // Calculate weighted risk score
  const weights = {
    veryHighTradeSize: 3,
    highStopLoss: 3,
    veryShortDelay: 2,
    highTradeSize: 2,
    noStopLoss: 2,
    shortDelay: 1.5,
    noTokenFilters: 1.5,
    noTakeProfit: 1,
    noGasLimit: 1,
    aggressiveTakeProfit: 1,
    highMaxTrades: 0.5,
    highDailyLoss: 1
  };

  const score = Object.entries(riskFactors)
    .filter(([_, value]) => value)
    .reduce((sum, [key, _]) => sum + (weights[key as keyof typeof weights] || 1), 0);

  if (score >= 8) return { level: 'extreme', color: 'text-red-700', factors: riskFactors, score };
  if (score >= 5) return { level: 'high', color: 'text-red-600', factors: riskFactors, score };
  if (score >= 3) return { level: 'medium', color: 'text-yellow-600', factors: riskFactors, score };
  return { level: 'low', color: 'text-green-600', factors: riskFactors, score };
};

// Sample verified wallets with enhanced data structure
const VERIFIED_TRADERS = [
  {
    address: '0x8ba1f109551bD432803012645Hac136c22C08',
    label: 'DeFi Whale #1',
    description: 'Large DeFi positions, conservative strategy',
    winRate: 89.2,
    avgReturn: 12.4,
    totalTrades: 342,
    verified: true,
    riskLevel: 'low' as const,
    avgTradeSize: 2500,
    lastActive: '2 hours ago',
    tags: ['defi', 'conservative', 'large-cap'],
    followers: 1247,
    aum: 2500000
  },
  {
    address: '0x742d35Cc6634C0532925a3b8D62103Ae4E168681',
    label: 'Arbitrage Expert',
    description: 'Focused on arbitrage opportunities across DEXes',
    winRate: 94.1,
    avgReturn: 8.7,
    totalTrades: 1247,
    verified: true,
    riskLevel: 'medium' as const,
    avgTradeSize: 1200,
    lastActive: '30 minutes ago',
    tags: ['arbitrage', 'mev', 'high-frequency'],
    followers: 892,
    aum: 850000
  },
  {
    address: '0x45f783CCE6B7FF23B2ab2D70e416cdb7D6055f51',
    label: 'Yield Farmer Pro',
    description: 'Advanced yield farming and liquidity strategies',
    winRate: 76.8,
    avgReturn: 24.6,
    totalTrades: 892,
    verified: false,
    riskLevel: 'high' as const,
    avgTradeSize: 5000,
    lastActive: '1 hour ago',
    tags: ['yield-farming', 'defi', 'high-return'],
    followers: 534,
    aum: 1200000
  }
];

export function CopyTradingConfig({ config, onChange }: CopyTradingConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTraderSelector, setShowTraderSelector] = useState(false);
  const [walletValidation, setWalletValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true });
  
  // Memoized calculations for performance
  const riskAssessment = useMemo(() => calculateAdvancedRisk(config), [config]);
  
  const estimatedTradeSize = useMemo(() => {
    const baseAmount = 1000; // Sample base trade amount
    switch (config.copySettings.tradeSize.type) {
      case 'FIXED':
        return config.copySettings.tradeSize.value;
      case 'PERCENTAGE':
        return baseAmount * (config.copySettings.tradeSize.value / 100);
      case 'RATIO':
        return baseAmount * config.copySettings.tradeSize.value;
      default:
        return 0;
    }
  }, [config.copySettings.tradeSize]);

  const updateConfig = useCallback((updates: Partial<CopyTradingBotConfig>) => {
    onChange({
      ...config,
      ...updates
    });
  }, [config, onChange]);

  // Enhanced wallet validation with real-time feedback
  const handleWalletChange = useCallback((address: string) => {
    const validation = validateWalletAddress(address);
    setWalletValidation(validation);
    updateConfig({ 
      targetWallet: { 
        ...config.targetWallet, 
        address: address,
        verified: VERIFIED_TRADERS.some(t => t.address === address)
      }
    });
  }, [config.targetWallet, updateConfig]);

  const addTokenToWhitelist = useCallback((token: string) => {
    if (token && !config.filters.tokenWhitelist?.includes(token)) {
      updateConfig({
        filters: {
          ...config.filters,
          tokenWhitelist: [...(config.filters.tokenWhitelist || []), token.toUpperCase()]
        }
      });
    }
  }, [config.filters, updateConfig]);

  const removeTokenFromWhitelist = useCallback((token: string) => {
    updateConfig({
      filters: {
        ...config.filters,
        tokenWhitelist: config.filters.tokenWhitelist?.filter(t => t !== token) || []
      }
    });
  }, [config.filters, updateConfig]);

  const addTokenToBlacklist = useCallback((token: string) => {
    if (token && !config.filters.tokenBlacklist?.includes(token)) {
      updateConfig({
        filters: {
          ...config.filters,
          tokenBlacklist: [...(config.filters.tokenBlacklist || []), token.toUpperCase()]
        }
      });
    }
  }, [config.filters, updateConfig]);

  const removeTokenFromBlacklist = useCallback((token: string) => {
    updateConfig({
      filters: {
        ...config.filters,
        tokenBlacklist: config.filters.tokenBlacklist?.filter(t => t !== token) || []
      }
    });
  }, [config.filters, updateConfig]);

  const selectedTrader = VERIFIED_TRADERS.find(t => t.address === config.targetWallet.address);

  return (
    <div className="space-y-6">
      {/* Risk Warning */}
      {riskAssessment.level === 'high' || riskAssessment.level === 'extreme' ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium text-red-800 mb-1">High Risk Configuration Detected</div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>Risk Score: {riskAssessment.score}/10 - Consider the following improvements:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    {riskAssessment.factors['veryShortDelay'] && <li>Increase copy delay to avoid MEV front-running</li>}
                    {riskAssessment.factors['noStopLoss'] && <li>Enable stop-loss protection for downside risk</li>}
                    {riskAssessment.factors['noTokenFilters'] && <li>Add token filters to avoid risky assets</li>}
                    {riskAssessment.factors['veryHighTradeSize'] && <li>Reduce trade size to manage exposure</li>}
                    {riskAssessment.factors['noGasLimit'] && <li>Set gas price limits to control costs</li>}
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
            <Copy className="h-5 w-5 text-blue-500" />
            Copy Trading Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                <DollarSign className="h-6 w-6" />
                {estimatedTradeSize.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Est. Trade Size (USD)</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {config.copySettings.copyDelay / 1000}s
              </div>
              <div className="text-sm text-muted-foreground">Copy Delay</div>
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
                {config.riskManagement.maxConcurrentTrades}
              </div>
              <div className="text-sm text-muted-foreground">Max Concurrent</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Trader Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target Trader
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowTraderSelector(!showTraderSelector)}
            >
              <Users className="h-4 w-4 mr-2" />
              {showTraderSelector ? 'Hide' : 'Browse'} Verified Traders
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Trader Wallet Address</label>
            <input
              type="text"
              value={config.targetWallet.address}
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
            {walletValidation.isValid && config.targetWallet.address && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Valid Ethereum address
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://etherscan.io/address/${config.targetWallet.address}`, '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View on Etherscan
                </Button>
              </div>
            )}

            {/* Trader Label */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Trader Label (Optional)</label>
              <input
                type="text"
                value={config.targetWallet.label || ''}
                onChange={(e) => updateConfig({ 
                  targetWallet: { ...config.targetWallet, label: e.target.value }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="e.g., DeFi Whale #1"
              />
            </div>
            
            {selectedTrader && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {selectedTrader.label}
                      <Badge variant="outline" className={`text-xs ${
                        selectedTrader.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                        selectedTrader.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedTrader.riskLevel} risk
                      </Badge>
                      {selectedTrader.verified && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{selectedTrader.description}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedTrader.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Win Rate
                    </div>
                    <div className="font-medium text-green-600">{selectedTrader.winRate}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Avg Return
                    </div>
                    <div className="font-medium text-blue-600">{selectedTrader.avgReturn}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Total Trades
                    </div>
                    <div className="font-medium">{selectedTrader.totalTrades}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Followers
                    </div>
                    <div className="font-medium">{selectedTrader.followers}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {showTraderSelector && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Verified Traders
              </h4>
              <div className="space-y-3">
                {VERIFIED_TRADERS.map((trader) => (
                  <div
                    key={trader.address}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                      config.targetWallet.address === trader.address ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleWalletChange(trader.address)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{trader.label}</div>
                        <Badge variant="outline" className={`text-xs ${
                          trader.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                          trader.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {trader.riskLevel} risk
                        </Badge>
                        {trader.verified && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {trader.address.slice(0, 6)}...{trader.address.slice(-4)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{trader.description}</div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Win Rate</div>
                        <div className="font-medium text-green-600">{trader.winRate}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Return</div>
                        <div className="font-medium text-blue-600">{trader.avgReturn}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">AUM</div>
                        <div className="font-medium">${(trader.aum / 1000000).toFixed(1)}M</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Followers</div>
                        <div className="font-medium">{trader.followers}</div>
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
          {/* Trade Size Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Trade Size Type</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: 'FIXED', label: 'Fixed Amount', desc: 'Copy exact USD amount' },
                  { value: 'PERCENTAGE', label: 'Percentage', desc: 'Copy % of target trade' },
                  { value: 'RATIO', label: 'Ratio', desc: 'Copy based on ratio' }
                ].map((sizeType) => (
                  <div
                    key={sizeType.value}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      config.copySettings.tradeSize.type === sizeType.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => updateConfig({ 
                      copySettings: { 
                        ...config.copySettings, 
                        tradeSize: { 
                          ...config.copySettings.tradeSize, 
                          type: sizeType.value as any 
                        }
                      }
                    })}
                  >
                    <div className="font-medium">{sizeType.label}</div>
                    <div className="text-xs text-muted-foreground">{sizeType.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  {config.copySettings.tradeSize.type === 'FIXED' ? 'Fixed Amount (USD)' : 
                   config.copySettings.tradeSize.type === 'PERCENTAGE' ? 'Percentage (%)' : 'Ratio'}
                </label>
                <input
                  type="number"
                  step={config.copySettings.tradeSize.type === 'PERCENTAGE' ? '0.1' : '1'}
                  value={config.copySettings.tradeSize.value}
                  onChange={(e) => updateConfig({ 
                    copySettings: { 
                      ...config.copySettings, 
                      tradeSize: { 
                        ...config.copySettings.tradeSize, 
                        value: Number(e.target.value) 
                      }
                    }
                  })}
                  className="w-full p-3 border rounded-md"
                  placeholder={config.copySettings.tradeSize.type === 'FIXED' ? '100' : '5'}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Min Trade Value (USD)</label>
                <input
                  type="number"
                  value={config.copySettings.minTradeValue}
                  onChange={(e) => updateConfig({ 
                    copySettings: { 
                      ...config.copySettings, 
                      minTradeValue: Number(e.target.value) 
                    }
                  })}
                  className="w-full p-3 border rounded-md"
                  placeholder="10"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Trade Value (USD)</label>
                <input
                  type="number"
                  value={config.copySettings.maxTradeValue}
                  onChange={(e) => updateConfig({ 
                    copySettings: { 
                      ...config.copySettings, 
                      maxTradeValue: Number(e.target.value) 
                    }
                  })}
                  className="w-full p-3 border rounded-md"
                  placeholder="1000"
                />
              </div>
            </div>

            {/* Timing and Risk Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Copy Delay (ms)
                </label>
                <input
                  type="number"
                  value={config.copySettings.copyDelay}
                  onChange={(e) => updateConfig({ 
                    copySettings: { 
                      ...config.copySettings, 
                      copyDelay: Number(e.target.value) 
                    }
                  })}
                  className="w-full p-3 border rounded-md"
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">Delay before copying trade (min 100ms)</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Slippage Tolerance (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.copySettings.slippageTolerance}
                  onChange={(e) => updateConfig({ 
                    copySettings: { 
                      ...config.copySettings, 
                      slippageTolerance: Number(e.target.value) 
                    }
                  })}
                  className="w-full p-3 border rounded-md"
                  placeholder="0.5"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stop Loss */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.riskManagement.stopLoss.enabled}
                  onChange={(e) => updateConfig({
                    riskManagement: {
                      ...config.riskManagement,
                      stopLoss: {
                        ...config.riskManagement.stopLoss,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="rounded"
                />
                <label className="text-sm font-medium">Enable Stop Loss</label>
              </div>
              {config.riskManagement.stopLoss.enabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stop Loss Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.riskManagement.stopLoss.percentage}
                    onChange={(e) => updateConfig({
                      riskManagement: {
                        ...config.riskManagement,
                        stopLoss: {
                          ...config.riskManagement.stopLoss,
                          percentage: Number(e.target.value)
                        }
                      }
                    })}
                    className="w-full p-3 border rounded-md"
                    placeholder="5"
                  />
                </div>
              )}
            </div>

            {/* Take Profit */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.riskManagement.takeProfit.enabled}
                  onChange={(e) => updateConfig({
                    riskManagement: {
                      ...config.riskManagement,
                      takeProfit: {
                        ...config.riskManagement.takeProfit,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="rounded"
                />
                <label className="text-sm font-medium">Enable Take Profit</label>
              </div>
              {config.riskManagement.takeProfit.enabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Take Profit Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.riskManagement.takeProfit.percentage}
                    onChange={(e) => updateConfig({
                      riskManagement: {
                        ...config.riskManagement,
                        takeProfit: {
                          ...config.riskManagement.takeProfit,
                          percentage: Number(e.target.value)
                        }
                      }
                    })}
                    className="w-full p-3 border rounded-md"
                    placeholder="20"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Daily Loss (USD)</label>
              <input
                type="number"
                value={config.riskManagement.maxDailyLoss}
                onChange={(e) => updateConfig({
                  riskManagement: {
                    ...config.riskManagement,
                    maxDailyLoss: Number(e.target.value)
                  }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Concurrent Trades</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.riskManagement.maxConcurrentTrades}
                onChange={(e) => updateConfig({
                  riskManagement: {
                    ...config.riskManagement,
                    maxConcurrentTrades: Number(e.target.value)
                  }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Token Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Whitelisted Tokens */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Token Whitelist (Optional)</label>
              <p className="text-xs text-muted-foreground">Only copy trades for these tokens. Leave empty to allow all tokens.</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {config.filters.tokenWhitelist?.map((token, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-green-50 text-green-800"
                >
                  {token}
                  <button
                    onClick={() => removeTokenFromWhitelist(token)}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </Badge>
              )) || []}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter token symbol (e.g., ETH)"
                className="flex-1 p-2 border rounded text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addTokenToWhitelist((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button
                size="sm"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                  if (input) {
                    addTokenToWhitelist(input.value);
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Blacklisted Tokens */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Token Blacklist</label>
              <p className="text-xs text-muted-foreground">Never copy trades for these tokens.</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {config.filters.tokenBlacklist?.map((token, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-red-50 text-red-800"
                >
                  {token}
                  <button
                    onClick={() => removeTokenFromBlacklist(token)}
                    className="ml-1 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </Badge>
              )) || []}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter token symbol (e.g., SHIB)"
                className="flex-1 p-2 border rounded text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addTokenToBlacklist((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button
                size="sm"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                  if (input) {
                    addTokenToBlacklist(input.value);
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Other Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Liquidity (USD)</label>
              <input
                type="number"
                value={config.filters.minLiquidity}
                onChange={(e) => updateConfig({
                  filters: {
                    ...config.filters,
                    minLiquidity: Number(e.target.value)
                  }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Gas Price (Gwei)</label>
              <input
                type="number"
                value={config.filters.maxGasPrice}
                onChange={(e) => updateConfig({
                  filters: {
                    ...config.filters,
                    maxGasPrice: Number(e.target.value)
                  }
                })}
                className="w-full p-3 border rounded-md"
                placeholder="50"
              />
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
              {config.targetWallet.address && walletValidation.isValid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Target trader: {config.targetWallet.address && walletValidation.isValid ? 'Valid address' : 'Required'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.copySettings.maxTradeValue > config.copySettings.minTradeValue ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                Trade limits: {config.copySettings.maxTradeValue > config.copySettings.minTradeValue ? 'Valid range' : 'Max must be greater than min'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.walletId ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                Your wallet: {config.walletId ? 'Configured' : 'Recommended'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
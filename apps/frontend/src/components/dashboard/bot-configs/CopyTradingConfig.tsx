'use client';

import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';
import { BotConfiguration, CopyTradingConfiguration, TradeFilter } from '../BotConfigurationDashboard';

interface CopyTradingConfigProps {
  config: BotConfiguration;
  onChange: (config: BotConfiguration) => void;
}

// Sample popular wallets to copy (in real app, would be from API)
const POPULAR_WALLETS = [
  {
    address: '0x8ba1f109551bD432803012645Hac136c22C08',
    name: 'DeFi Whale #1',
    description: 'Large DeFi positions, conservative strategy',
    winRate: 89.2,
    avgReturn: 12.4,
    trades: 342,
    verified: true
  },
  {
    address: '0x742d35Cc6634C0532925a3b8D62103Ae4E168681',
    name: 'Arbitrage Expert',
    description: 'Focused on arbitrage opportunities',
    winRate: 94.1,
    avgReturn: 8.7,
    trades: 1247,
    verified: true
  },
  {
    address: '0x45f783CCE6B7FF23B2ab2D70e416cdb7D6055f51',
    name: 'MEV Bot Alpha',
    description: 'Advanced MEV strategies',
    winRate: 76.8,
    avgReturn: 24.6,
    trades: 892,
    verified: false
  }
];

// Available filter types
const FILTER_TYPES = [
  { value: 'token', label: 'Token', description: 'Filter by specific token' },
  { value: 'amount', label: 'Amount', description: 'Filter by trade amount' },
  { value: 'gas', label: 'Gas Price', description: 'Filter by gas price' },
  { value: 'time', label: 'Time', description: 'Filter by time of day' }
];

const FILTER_CONDITIONS = [
  { value: 'equals', label: 'Equals', types: ['token', 'amount', 'gas', 'time'] },
  { value: 'greater_than', label: 'Greater than', types: ['amount', 'gas', 'time'] },
  { value: 'less_than', label: 'Less than', types: ['amount', 'gas', 'time'] },
  { value: 'contains', label: 'Contains', types: ['token'] }
];

export function CopyTradingConfig({ config, onChange }: CopyTradingConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const copyConfig = config.configuration as CopyTradingConfiguration;

  const updateConfig = (updates: Partial<CopyTradingConfiguration>) => {
    onChange({
      ...config,
      configuration: { ...copyConfig, ...updates }
    });
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

  const getEstimatedCopyAmount = () => {
    const sampleTradeSize = 1000; // USD
    switch (copyConfig.copyMode) {
      case 'fixed_amount':
        return copyConfig.fixedAmount || 0;
      case 'percentage':
        return sampleTradeSize * (copyConfig.copyPercentage || 0) / 100;
      case 'proportional':
        return sampleTradeSize * 0.1; // Assume 10% of portfolio
      default:
        return 0;
    }
  };

  const getRiskLevel = () => {
    const riskFactors = {
      highCopyAmount: getEstimatedCopyAmount() > 500,
      noStopLoss: !copyConfig.stopLoss || copyConfig.stopLoss > 10,
      shortDelay: copyConfig.delayMs < 1000,
      noFilters: copyConfig.tradeFilters.filter(f => f.enabled).length === 0
    };

    const riskCount = Object.values(riskFactors).filter(Boolean).length;
    
    if (riskCount >= 3) return { level: 'high', color: 'text-red-600' };
    if (riskCount >= 2) return { level: 'medium', color: 'text-yellow-600' };
    return { level: 'low', color: 'text-green-600' };
  };

  const risk = getRiskLevel();
  const selectedWallet = POPULAR_WALLETS.find(w => w.address === copyConfig.targetWallet);

  return (
    <div className="space-y-6">
      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-green-500" />
            Copy Trading Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${getEstimatedCopyAmount().toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Est. Copy Amount</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {copyConfig.tradeFilters.filter(f => f.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Filters</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${risk.color}`}>{risk.level.toUpperCase()}</div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
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
              onChange={(e) => updateConfig({ targetWallet: e.target.value })}
              className="w-full p-3 border rounded-md font-mono text-sm"
              placeholder="0x..."
            />
            {selectedWallet && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedWallet.name}</div>
                    <div className="text-sm text-muted-foreground">{selectedWallet.description}</div>
                  </div>
                  {selectedWallet.verified && (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Win Rate</div>
                    <div className="font-medium">{selectedWallet.winRate}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Return</div>
                    <div className="font-medium">{selectedWallet.avgReturn}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Trades</div>
                    <div className="font-medium">{selectedWallet.trades}</div>
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
                    onClick={() => updateConfig({ targetWallet: wallet.address })}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{wallet.name}</div>
                        {wallet.verified && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{wallet.description}</div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
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
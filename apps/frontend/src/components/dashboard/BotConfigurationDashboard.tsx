'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArbitrageConfig } from './bot-configs/ArbitrageConfig';
import { CopyTradingConfig } from './bot-configs/CopyTradingConfig';
import { SandwichConfig } from './bot-configs/SandwichConfig';
import { BotTemplates } from './bot-configs/BotTemplates';
import { 
  Bot, 
  Settings, 
  Plus, 
  Save, 
  PlayCircle, 
  PauseCircle, 
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

export interface BotConfiguration {
  id?: string;
  name: string;
  type: 'arbitrage' | 'copy-trading' | 'sandwich';
  status: 'draft' | 'active' | 'paused' | 'stopped';
  isPaperTrading: boolean;
  chain: string[];
  wallet: string;
  configuration: ArbitrageConfiguration | CopyTradingConfiguration | SandwichConfiguration;
  riskParameters: RiskParameters;
  createdAt?: string;
  updatedAt?: string;
  lastActivity?: string;
  totalTrades?: number;
  dailyPnL?: number;
  winRate?: number;
  version?: number;
}

export interface ArbitrageConfiguration {
  tokenPairs: TokenPair[];
  profitThreshold: number; // Minimum profit percentage
  maxTradeSize: number; // Maximum trade size in USD
  minTradeSize: number; // Minimum trade size in USD
  gasLimit: number;
  slippageTolerance: number; // Percentage
  dexes: string[]; // Supported DEXes
  maxSimultaneousTrades: number;
  rebalanceThreshold: number; // When to rebalance positions
}

export interface CopyTradingConfiguration {
  targetWallet: string;
  copyMode: 'fixed_amount' | 'percentage' | 'proportional';
  fixedAmount?: number; // USD amount for fixed mode
  copyPercentage?: number; // Percentage for percentage mode
  maxCopyAmount: number; // Maximum amount to copy per trade
  minCopyAmount: number; // Minimum amount to copy per trade
  tradeFilters: TradeFilter[];
  delayMs: number; // Delay before copying trade
  stopLoss?: number; // Stop loss percentage
  takeProfit?: number; // Take profit percentage
  blacklistedTokens: string[];
  whitelistedTokens: string[];
}

export interface SandwichConfiguration {
  targetDexes: string[];
  minVictimTradeSize: number; // Minimum victim trade size in USD
  maxGasBid: number; // Maximum gas bid in Gwei
  gasBidStrategy: 'aggressive' | 'conservative' | 'adaptive';
  profitThreshold: number; // Minimum profit threshold
  maxSlippage: number; // Maximum acceptable slippage
  mevProtection: {
    flashbots: boolean;
    jito: boolean;
    bloxroute: boolean;
  };
  competitionAnalysis: boolean;
  maxBlockDelay: number; // Maximum blocks to wait
}

export interface TokenPair {
  baseToken: string;
  quoteToken: string;
  enabled: boolean;
  minProfitThreshold?: number;
  maxTradeSize?: number;
}

export interface TradeFilter {
  type: 'token' | 'amount' | 'gas' | 'time';
  condition: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: string | number;
  enabled: boolean;
}

export interface RiskParameters {
  maxDailyLoss: number; // USD
  maxPositionSize: number; // Percentage of portfolio
  emergencyStop: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  notificationsEnabled: boolean;
}

// Mock data for existing configurations
const mockBotConfigurations: BotConfiguration[] = [
  {
    id: '1',
    name: 'ETH-ARB-001',
    type: 'arbitrage',
    status: 'active',
    isPaperTrading: false,
    chain: ['ethereum', 'arbitrum'],
    wallet: '0x742d35Cc6634C0532925a3b8D62103Ae4E168681',
    configuration: {
      tokenPairs: [
        { baseToken: 'ETH', quoteToken: 'USDC', enabled: true, minProfitThreshold: 0.5 },
        { baseToken: 'WBTC', quoteToken: 'USDT', enabled: true, minProfitThreshold: 0.3 }
      ],
      profitThreshold: 0.2,
      maxTradeSize: 5000,
      minTradeSize: 100,
      gasLimit: 300000,
      slippageTolerance: 0.5,
      dexes: ['uniswap', 'sushiswap', '1inch'],
      maxSimultaneousTrades: 3,
      rebalanceThreshold: 10
    } as ArbitrageConfiguration,
    riskParameters: {
      maxDailyLoss: 500,
      maxPositionSize: 10,
      emergencyStop: true,
      riskLevel: 'medium',
      notificationsEnabled: true
    },
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
    lastActivity: '2 min ago',
    totalTrades: 324,
    dailyPnL: 89.45,
    winRate: 91.2
  },
  {
    id: '2',
    name: 'COPY-WHALE-01',
    type: 'copy-trading',
    status: 'active',
    isPaperTrading: false,
    chain: ['ethereum'],
    wallet: '0x742d35Cc6634C0532925a3b8D62103Ae4E168681',
    configuration: {
      targetWallet: '0x8ba1f109551bD432803012645Hac136c22C08',
      copyMode: 'percentage',
      copyPercentage: 5,
      maxCopyAmount: 1000,
      minCopyAmount: 50,
      tradeFilters: [
        { type: 'amount', condition: 'greater_than', value: 1000, enabled: true },
        { type: 'token', condition: 'contains', value: 'ETH', enabled: true }
      ],
      delayMs: 500,
      stopLoss: 5,
      takeProfit: 15,
      blacklistedTokens: ['SHIB', 'DOGE'],
      whitelistedTokens: ['ETH', 'WBTC', 'USDC']
    } as CopyTradingConfiguration,
    riskParameters: {
      maxDailyLoss: 300,
      maxPositionSize: 5,
      emergencyStop: true,
      riskLevel: 'low',
      notificationsEnabled: true
    },
    createdAt: '2024-01-12T15:20:00Z',
    updatedAt: '2024-01-15T16:45:00Z',
    lastActivity: '5 min ago',
    totalTrades: 156,
    dailyPnL: 67.89,
    winRate: 85.9
  }
];

export default function BotConfigurationDashboard() {
  const [configurations, setConfigurations] = useState<BotConfiguration[]>(mockBotConfigurations);
  const [selectedConfig, setSelectedConfig] = useState<BotConfiguration | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBotType, setSelectedBotType] = useState<'arbitrage' | 'copy-trading' | 'sandwich'>('arbitrage');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-save draft configurations and monitor for changes
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (isDirty && selectedConfig && isCreating) {
        // Auto-save draft configurations every 30 seconds
        const draftKey = `bot-draft-${selectedBotType}`;
        try {
          localStorage.setItem(draftKey, JSON.stringify(selectedConfig));
          console.debug('Draft configuration saved:', draftKey);
        } catch (error) {
          console.warn('Failed to save draft configuration:', error);
        }
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [isDirty, selectedConfig, isCreating, selectedBotType]);

  // Load draft configuration if available with error handling
  useEffect(() => {
    if (isCreating && selectedBotType) {
      const draftKey = `bot-draft-${selectedBotType}`;
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          const draftConfig = JSON.parse(savedDraft);
          
          // Validate draft configuration structure
          if (draftConfig && typeof draftConfig === 'object' && draftConfig.type === selectedBotType) {
            setSelectedConfig(draftConfig);
            setIsDirty(true);
            console.debug('Draft configuration loaded:', draftKey);
          } else {
            console.warn('Invalid draft configuration structure, clearing draft');
            localStorage.removeItem(draftKey);
          }
        }
      } catch (error) {
        console.error('Failed to load draft configuration:', error);
        // Clear corrupted draft
        try {
          localStorage.removeItem(draftKey);
        } catch (clearError) {
          console.error('Failed to clear corrupted draft:', clearError);
        }
      }
    }
  }, [isCreating, selectedBotType]);

  // Enhanced configuration validation
  const validateConfiguration = (config: BotConfiguration): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Basic validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Bot name is required');
    }

    if (!config.wallet || !/^0x[a-fA-F0-9]{40}$/.test(config.wallet)) {
      errors.push('Valid wallet address is required');
    }

    // Type-specific validation
    switch (config.type) {
      case 'arbitrage':
        const arbConfig = config.configuration as ArbitrageConfiguration;
        if (!arbConfig.tokenPairs || arbConfig.tokenPairs.length === 0) {
          errors.push('At least one token pair is required');
        }
        if (!arbConfig.dexes || arbConfig.dexes.length < 2) {
          errors.push('At least two DEXes are required for arbitrage');
        }
        if (arbConfig.profitThreshold <= 0 || arbConfig.profitThreshold > 100) {
          errors.push('Profit threshold must be between 0 and 100%');
        }
        break;

      case 'copy-trading':
        const copyConfig = config.configuration as CopyTradingConfiguration;
        if (!copyConfig.targetWallet || !/^0x[a-fA-F0-9]{40}$/.test(copyConfig.targetWallet)) {
          errors.push('Valid target wallet address is required');
        }
        if (copyConfig.maxCopyAmount <= copyConfig.minCopyAmount) {
          errors.push('Max copy amount must be greater than min copy amount');
        }
        break;

      case 'sandwich':
        const sandwichConfig = config.configuration as SandwichConfiguration;
        if (!sandwichConfig.targetDexes || sandwichConfig.targetDexes.length === 0) {
          errors.push('At least one target DEX is required');
        }
        if (sandwichConfig.profitThreshold <= 0) {
          errors.push('Profit threshold must be greater than 0');
        }
        break;
    }

    // Risk parameters validation
    if (config.riskParameters.maxDailyLoss <= 0) {
      errors.push('Max daily loss must be greater than 0');
    }

    if (config.riskParameters.maxPositionSize <= 0 || config.riskParameters.maxPositionSize > 100) {
      errors.push('Max position size must be between 0 and 100%');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleCreateNew = (type: 'arbitrage' | 'copy-trading' | 'sandwich') => {
    setSelectedBotType(type);
    const newConfig: BotConfiguration = {
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Bot`,
      type,
      status: 'draft',
      isPaperTrading: true,
      chain: ['ethereum'],
      wallet: '',
      configuration: getDefaultConfiguration(type),
      riskParameters: {
        maxDailyLoss: 200,
        maxPositionSize: 5,
        emergencyStop: true,
        riskLevel: 'low',
        notificationsEnabled: true
      }
    };
    setSelectedConfig(newConfig);
    setIsCreating(true);
    setIsDirty(false);
  };

  const getDefaultConfiguration = (type: string) => {
    switch (type) {
      case 'arbitrage':
        return {
          tokenPairs: [{ baseToken: 'ETH', quoteToken: 'USDC', enabled: true }],
          profitThreshold: 0.3,
          maxTradeSize: 1000,
          minTradeSize: 50,
          gasLimit: 300000,
          slippageTolerance: 0.5,
          dexes: ['uniswap'],
          maxSimultaneousTrades: 1,
          rebalanceThreshold: 10
        } as ArbitrageConfiguration;
      
      case 'copy-trading':
        return {
          targetWallet: '',
          copyMode: 'percentage',
          copyPercentage: 1,
          maxCopyAmount: 500,
          minCopyAmount: 25,
          tradeFilters: [],
          delayMs: 1000,
          blacklistedTokens: [],
          whitelistedTokens: []
        } as CopyTradingConfiguration;
      
      case 'sandwich':
        return {
          targetDexes: ['uniswap'],
          minVictimTradeSize: 1000,
          maxGasBid: 100,
          gasBidStrategy: 'conservative',
          profitThreshold: 0.5,
          maxSlippage: 2,
          mevProtection: {
            flashbots: true,
            jito: false,
            bloxroute: false
          },
          competitionAnalysis: true,
          maxBlockDelay: 2
        } as SandwichConfiguration;
      
      default:
        return {
          tokenPairs: [],
          profitThreshold: 0.3,
          maxTradeSize: 1000,
          minTradeSize: 50,
          gasLimit: 300000,
          slippageTolerance: 0.5,
          dexes: [],
          maxSimultaneousTrades: 1,
          rebalanceThreshold: 10
        } as ArbitrageConfiguration;
    }
  };

  const handleSave = async () => {
    if (!selectedConfig) return;

    // Validate configuration before saving
    const validation = validateConfiguration(selectedConfig);
    if (!validation.isValid) {
      console.warn('Configuration validation failed:', validation.errors);
      setSaveStatus('error');
      // Display validation errors to user
      alert(`Configuration validation failed:\n${validation.errors.join('\n')}`);
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }

    setSaveStatus('saving');

    try {
      // Simulate API delay with realistic backend processing
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

      if (isCreating) {
        // Create new configuration with enhanced metadata
        const newId = `${selectedConfig.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const configWithId = {
          ...selectedConfig,
          id: newId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          status: selectedConfig.isPaperTrading ? 'draft' as const : 'stopped' as const
        };
        
        setConfigurations(prev => [...prev, configWithId]);
        setSelectedConfig(configWithId);
        setIsCreating(false);
        
        // Clear draft from localStorage
        const draftKey = `bot-draft-${selectedBotType}`;
        try {
          localStorage.removeItem(draftKey);
          console.debug('Draft cleared after successful save:', draftKey);
        } catch (error) {
          console.warn('Failed to clear draft after save:', error);
        }
        
        console.info('Bot configuration created successfully:', newId);
      } else {
        // Update existing configuration with version tracking
        const updatedConfig = {
          ...selectedConfig,
          updatedAt: new Date().toISOString(),
          version: (selectedConfig.version || 1) + 1
        };
        
        setConfigurations(prev => 
          prev.map(config => config.id === selectedConfig.id ? updatedConfig : config)
        );
        setSelectedConfig(updatedConfig);
        
        console.info('Bot configuration updated successfully:', selectedConfig.id);
      }
      
      setIsDirty(false);
      setSaveStatus('saved');
      
      // Reset save status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving configuration:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleDelete = async (configId: string) => {
    if (window.confirm('Are you sure you want to delete this bot configuration?')) {
      setConfigurations(prev => prev.filter(config => config.id !== configId));
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }
    }
  };

  const handleDuplicate = (config: BotConfiguration) => {
    const { id, createdAt, updatedAt, lastActivity, totalTrades, dailyPnL, winRate, ...configWithoutMetadata } = config;
    const duplicatedConfig: BotConfiguration = {
      ...configWithoutMetadata,
      name: `${config.name} (Copy)`,
      status: 'draft',
      isPaperTrading: true
    };
    setSelectedConfig(duplicatedConfig);
    setIsCreating(true);
    setIsDirty(true);
  };

  const handleStartBot = async (configId: string) => {
    setConfigurations(prev =>
      prev.map(config =>
        config.id === configId
          ? { ...config, status: 'active' as const, lastActivity: 'Just started' }
          : config
      )
    );
  };

  const handleStopBot = async (configId: string) => {
    setConfigurations(prev =>
      prev.map(config =>
        config.id === configId
          ? { ...config, status: 'stopped' as const }
          : config
      )
    );
  };

  const getStatusColor = (status: BotConfiguration['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'stopped': return 'bg-red-500';
      case 'draft': return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: BotConfiguration['status']) => {
    switch (status) {
      case 'active': return <PlayCircle className="h-4 w-4" />;
      case 'paused': return <PauseCircle className="h-4 w-4" />;
      case 'stopped': return <Clock className="h-4 w-4" />;
      case 'draft': return <Settings className="h-4 w-4" />;
    }
  };

  const getBotTypeIcon = (type: BotConfiguration['type']) => {
    switch (type) {
      case 'arbitrage': return <Zap className="h-5 w-5 text-blue-500" />;
      case 'copy-trading': return <Copy className="h-5 w-5 text-green-500" />;
      case 'sandwich': return <Bot className="h-5 w-5 text-purple-500" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bot Configuration</h1>
          <p className="text-muted-foreground">
            Configure and manage your trading bots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleCreateNew('arbitrage')}>
            <Plus className="h-4 w-4 mr-2" />
            Arbitrage Bot
          </Button>
          <Button variant="outline" onClick={() => handleCreateNew('copy-trading')}>
            <Plus className="h-4 w-4 mr-2" />
            Copy Trading Bot
          </Button>
          <Button variant="outline" onClick={() => handleCreateNew('sandwich')}>
            <Plus className="h-4 w-4 mr-2" />
            Sandwich Bot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bot List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Your Bots ({configurations.length})
              </CardTitle>
              {isCreating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Creating:</span>
                  <Badge variant="outline" className="capitalize">
                    {selectedBotType.replace('-', ' ')}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {configurations.map((config) => (
                <div
                  key={config.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                    selectedConfig?.id === config.id ? 'border-primary bg-accent' : 'border-border'
                  }`}
                  onClick={() => {
                    setSelectedConfig(config);
                    setIsCreating(false);
                    setIsDirty(false);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getBotTypeIcon(config.type)}
                      <span className="font-medium">{config.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(config.status)}`} />
                      {getStatusIcon(config.status)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {config.type}
                    </Badge>
                    {config.isPaperTrading && (
                      <Badge variant="outline" className="text-xs">
                        Paper
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {config.status}
                    </Badge>
                  </div>

                  {config.totalTrades !== undefined && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Daily P&L:</span>
                        <span className={config.dailyPnL! >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(config.dailyPnL!)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trades:</span>
                        <span>{config.totalTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Win Rate:</span>
                        <span>{config.winRate?.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      {config.lastActivity || 'Never active'}
                    </span>
                    <div className="flex items-center gap-1">
                      {config.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStopBot(config.id!);
                          }}
                        >
                          Stop
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartBot(config.id!);
                          }}
                        >
                          Start
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(config);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(config.id!);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {configurations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bots configured yet</p>
                  <p className="text-sm">Create your first bot to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          {selectedConfig ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getBotTypeIcon(selectedConfig.type)}
                    {selectedConfig.name}
                    {isDirty && <span className="text-yellow-500">*</span>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {saveStatus === 'saved' && (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Saved successfully
                      </div>
                    )}
                    {saveStatus === 'error' && (
                      <div className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Save failed
                      </div>
                    )}
                    {isDirty && saveStatus === 'idle' && (
                      <div className="flex items-center gap-1 text-yellow-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Unsaved changes
                      </div>
                    )}
                    <Button onClick={handleSave} disabled={!isDirty || saveStatus === 'saving'}>
                      <Save className="h-4 w-4 mr-2" />
                      {saveStatus === 'saving' ? 'Saving...' : isCreating ? 'Create' : 'Save'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="configuration" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="configuration">Configuration</TabsTrigger>
                    <TabsTrigger value="risk">Risk Management</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                  </TabsList>

                  <TabsContent value="configuration" className="space-y-4">
                    {selectedConfig.type === 'arbitrage' && (
                      <ArbitrageConfig
                        config={selectedConfig}
                        onChange={(updatedConfig) => {
                          setSelectedConfig(updatedConfig);
                          setIsDirty(true);
                        }}
                      />
                    )}
                    {selectedConfig.type === 'copy-trading' && (
                      <CopyTradingConfig
                        config={selectedConfig}
                        onChange={(updatedConfig) => {
                          setSelectedConfig(updatedConfig);
                          setIsDirty(true);
                        }}
                      />
                    )}
                    {selectedConfig.type === 'sandwich' && (
                      <SandwichConfig
                        config={selectedConfig}
                        onChange={(updatedConfig) => {
                          setSelectedConfig(updatedConfig);
                          setIsDirty(true);
                        }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="risk" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Max Daily Loss (USD)</label>
                        <input
                          type="number"
                          value={selectedConfig.riskParameters.maxDailyLoss}
                          onChange={(e) => {
                            setSelectedConfig({
                              ...selectedConfig,
                              riskParameters: {
                                ...selectedConfig.riskParameters,
                                maxDailyLoss: Number(e.target.value)
                              }
                            });
                            setIsDirty(true);
                          }}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Max Position Size (%)</label>
                        <input
                          type="number"
                          value={selectedConfig.riskParameters.maxPositionSize}
                          onChange={(e) => {
                            setSelectedConfig({
                              ...selectedConfig,
                              riskParameters: {
                                ...selectedConfig.riskParameters,
                                maxPositionSize: Number(e.target.value)
                              }
                            });
                            setIsDirty(true);
                          }}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="templates" className="space-y-4">
                    <BotTemplates
                      botType={selectedConfig.type}
                      onApplyTemplate={(template) => {
                        setSelectedConfig({
                          ...selectedConfig,
                          configuration: template.configuration,
                          riskParameters: template.riskParameters
                        });
                        setIsDirty(true);
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-muted-foreground">
                  <Settings className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a Bot to Configure</h3>
                  <p>Choose a bot from the list or create a new one</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
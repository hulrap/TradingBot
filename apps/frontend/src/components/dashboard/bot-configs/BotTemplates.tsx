'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Copy, 
  Bot, 
  TrendingUp, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Star
} from 'lucide-react';
import { 
  ArbitrageConfiguration, 
  CopyTradingConfiguration, 
  SandwichConfiguration,
  RiskParameters
} from '../BotConfigurationDashboard';

interface BotTemplatesProps {
  botType: 'arbitrage' | 'copy-trading' | 'sandwich';
  onApplyTemplate: (template: {
    configuration: ArbitrageConfiguration | CopyTradingConfiguration | SandwichConfiguration;
    riskParameters: RiskParameters;
  }) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  profitPotential: 'low' | 'medium' | 'high';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  popular: boolean;
  configuration: ArbitrageConfiguration | CopyTradingConfiguration | SandwichConfiguration;
  riskParameters: RiskParameters;
}

// Arbitrage Templates
const ARBITRAGE_TEMPLATES: Template[] = [
  {
    id: 'arb-conservative',
    name: 'Conservative Arbitrage',
    description: 'Low-risk arbitrage between major DEXes with strict profit thresholds',
    riskLevel: 'low',
    profitPotential: 'low',
    complexity: 'beginner',
    popular: true,
    configuration: {
      tokenPairs: [
        { baseToken: 'ETH', quoteToken: 'USDC', enabled: true, minProfitThreshold: 0.5 },
        { baseToken: 'WBTC', quoteToken: 'USDC', enabled: true, minProfitThreshold: 0.4 }
      ],
      profitThreshold: 0.5,
      maxTradeSize: 1000,
      minTradeSize: 100,
      gasLimit: 300000,
      slippageTolerance: 0.3,
      dexes: ['uniswap', 'sushiswap'],
      maxSimultaneousTrades: 2,
      rebalanceThreshold: 15
    } as ArbitrageConfiguration,
    riskParameters: {
      maxDailyLoss: 200,
      maxPositionSize: 5,
      emergencyStop: true,
      riskLevel: 'low',
      notificationsEnabled: true
    }
  },
  {
    id: 'arb-aggressive',
    name: 'Aggressive Multi-DEX',
    description: 'High-frequency arbitrage across multiple DEXes with larger position sizes',
    riskLevel: 'high',
    profitPotential: 'high',
    complexity: 'advanced',
    popular: false,
    configuration: {
      tokenPairs: [
        { baseToken: 'ETH', quoteToken: 'USDC', enabled: true, minProfitThreshold: 0.2 },
        { baseToken: 'ETH', quoteToken: 'USDT', enabled: true, minProfitThreshold: 0.2 },
        { baseToken: 'WBTC', quoteToken: 'ETH', enabled: true, minProfitThreshold: 0.3 },
        { baseToken: 'LINK', quoteToken: 'ETH', enabled: true, minProfitThreshold: 0.4 }
      ],
      profitThreshold: 0.2,
      maxTradeSize: 5000,
      minTradeSize: 50,
      gasLimit: 350000,
      slippageTolerance: 0.8,
      dexes: ['uniswap', 'sushiswap', '1inch', 'curve'],
      maxSimultaneousTrades: 5,
      rebalanceThreshold: 10
    } as ArbitrageConfiguration,
    riskParameters: {
      maxDailyLoss: 1000,
      maxPositionSize: 15,
      emergencyStop: true,
      riskLevel: 'high',
      notificationsEnabled: true
    }
  },
  {
    id: 'arb-stablecoin',
    name: 'Stablecoin Focus',
    description: 'Focus on stablecoin arbitrage with lower volatility risk',
    riskLevel: 'low',
    profitPotential: 'medium',
    complexity: 'intermediate',
    popular: true,
    configuration: {
      tokenPairs: [
        { baseToken: 'USDC', quoteToken: 'USDT', enabled: true, minProfitThreshold: 0.1 },
        { baseToken: 'USDC', quoteToken: 'DAI', enabled: true, minProfitThreshold: 0.1 },
        { baseToken: 'USDT', quoteToken: 'DAI', enabled: true, minProfitThreshold: 0.1 }
      ],
      profitThreshold: 0.1,
      maxTradeSize: 10000,
      minTradeSize: 500,
      gasLimit: 250000,
      slippageTolerance: 0.2,
      dexes: ['uniswap', 'curve', 'balancer'],
      maxSimultaneousTrades: 3,
      rebalanceThreshold: 5
    } as ArbitrageConfiguration,
    riskParameters: {
      maxDailyLoss: 300,
      maxPositionSize: 8,
      emergencyStop: true,
      riskLevel: 'low',
      notificationsEnabled: true
    }
  }
];

// Copy Trading Templates
const COPY_TRADING_TEMPLATES: Template[] = [
  {
    id: 'copy-conservative',
    name: 'Conservative Copy',
    description: 'Copy verified whales with strict filters and risk management',
    riskLevel: 'low',
    profitPotential: 'medium',
    complexity: 'beginner',
    popular: true,
    configuration: {
      targetWallet: '0x8ba1f109551bD432803012645Hac136c22C08',
      copyMode: 'percentage',
      copyPercentage: 2,
      maxCopyAmount: 500,
      minCopyAmount: 50,
      tradeFilters: [
        { type: 'amount', condition: 'greater_than', value: 1000, enabled: true },
        { type: 'amount', condition: 'less_than', value: 50000, enabled: true }
      ],
      delayMs: 2000,
      stopLoss: 5,
      takeProfit: 15,
      blacklistedTokens: ['SHIB', 'DOGE', 'PEPE'],
      whitelistedTokens: ['ETH', 'WBTC', 'USDC', 'USDT']
    } as CopyTradingConfiguration,
    riskParameters: {
      maxDailyLoss: 250,
      maxPositionSize: 5,
      emergencyStop: true,
      riskLevel: 'low',
      notificationsEnabled: true
    }
  },
  {
    id: 'copy-aggressive',
    name: 'High-Volume Copy',
    description: 'Copy high-frequency traders with larger position sizes',
    riskLevel: 'high',
    profitPotential: 'high',
    complexity: 'advanced',
    popular: false,
    configuration: {
      targetWallet: '0x742d35Cc6634C0532925a3b8D62103Ae4E168681',
      copyMode: 'proportional',
      maxCopyAmount: 2000,
      minCopyAmount: 25,
      tradeFilters: [
        { type: 'amount', condition: 'greater_than', value: 500, enabled: true }
      ],
      delayMs: 500,
      stopLoss: 8,
      takeProfit: 25,
      blacklistedTokens: [],
      whitelistedTokens: []
    } as CopyTradingConfiguration,
    riskParameters: {
      maxDailyLoss: 800,
      maxPositionSize: 12,
      emergencyStop: true,
      riskLevel: 'high',
      notificationsEnabled: true
    }
  },
  {
    id: 'copy-fixed',
    name: 'Fixed Amount Copy',
    description: 'Copy with fixed dollar amounts for predictable risk',
    riskLevel: 'medium',
    profitPotential: 'medium',
    complexity: 'beginner',
    popular: true,
    configuration: {
      targetWallet: '',
      copyMode: 'fixed_amount',
      fixedAmount: 200,
      maxCopyAmount: 200,
      minCopyAmount: 200,
      tradeFilters: [
        { type: 'amount', condition: 'greater_than', value: 2000, enabled: true }
      ],
      delayMs: 1500,
      stopLoss: 6,
      takeProfit: 18,
      blacklistedTokens: ['SHIB', 'DOGE'],
      whitelistedTokens: []
    } as CopyTradingConfiguration,
    riskParameters: {
      maxDailyLoss: 400,
      maxPositionSize: 7,
      emergencyStop: true,
      riskLevel: 'medium',
      notificationsEnabled: true
    }
  }
];

// Sandwich Templates
const SANDWICH_TEMPLATES: Template[] = [
  {
    id: 'sandwich-conservative',
    name: 'Conservative MEV',
    description: 'Low-risk sandwich attacks with MEV protection and conservative gas bidding',
    riskLevel: 'medium',
    profitPotential: 'medium',
    complexity: 'intermediate',
    popular: true,
    configuration: {
      targetDexes: ['uniswap'],
      minVictimTradeSize: 5000,
      maxGasBid: 50,
      gasBidStrategy: 'conservative',
      profitThreshold: 1.0,
      maxSlippage: 1.5,
      mevProtection: {
        flashbots: true,
        jito: false,
        bloxroute: false
      },
      competitionAnalysis: true,
      maxBlockDelay: 2
    } as SandwichConfiguration,
    riskParameters: {
      maxDailyLoss: 300,
      maxPositionSize: 6,
      emergencyStop: true,
      riskLevel: 'medium',
      notificationsEnabled: true
    }
  },
  {
    id: 'sandwich-aggressive',
    name: 'Aggressive MEV',
    description: 'High-risk, high-reward sandwich strategy with aggressive gas bidding',
    riskLevel: 'high',
    profitPotential: 'high',
    complexity: 'advanced',
    popular: false,
    configuration: {
      targetDexes: ['uniswap', 'uniswap-v3', 'sushiswap'],
      minVictimTradeSize: 2000,
      maxGasBid: 200,
      gasBidStrategy: 'aggressive',
      profitThreshold: 0.5,
      maxSlippage: 3,
      mevProtection: {
        flashbots: true,
        jito: true,
        bloxroute: true
      },
      competitionAnalysis: true,
      maxBlockDelay: 3
    } as SandwichConfiguration,
    riskParameters: {
      maxDailyLoss: 1500,
      maxPositionSize: 20,
      emergencyStop: true,
      riskLevel: 'high',
      notificationsEnabled: true
    }
  }
];

export function BotTemplates({ botType, onApplyTemplate }: BotTemplatesProps) {
  const getTemplates = () => {
    switch (botType) {
      case 'arbitrage':
        return ARBITRAGE_TEMPLATES;
      case 'copy-trading':
        return COPY_TRADING_TEMPLATES;
      case 'sandwich':
        return SANDWICH_TEMPLATES;
      default:
        return [];
    }
  };

  const getBotIcon = (type: string) => {
    switch (type) {
      case 'arbitrage':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'copy-trading':
        return <Copy className="h-5 w-5 text-green-500" />;
      case 'sandwich':
        return <Bot className="h-5 w-5 text-purple-500" />;
      default:
        return <TrendingUp className="h-5 w-5" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProfitColor = (profit: string) => {
    switch (profit) {
      case 'low':
        return 'text-gray-600';
      case 'medium':
        return 'text-blue-600';
      case 'high':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner':
        return 'text-green-600';
      case 'intermediate':
        return 'text-yellow-600';
      case 'advanced':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const templates = getTemplates();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        {getBotIcon(botType)}
        <h3 className="text-lg font-medium">
          {botType.charAt(0).toUpperCase() + botType.slice(1).replace('-', ' ')} Templates
        </h3>
      </div>

      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id} className="transition-colors hover:bg-accent/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.popular && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      <Star className="h-3 w-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => onApplyTemplate(template)}
                  className="shrink-0"
                >
                  Apply Template
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Risk Level</div>
                  <Badge variant="outline" className={getRiskColor(template.riskLevel)}>
                    {template.riskLevel === 'high' && (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {template.riskLevel === 'low' && (
                      <Shield className="h-3 w-3 mr-1" />
                    )}
                    {template.riskLevel.charAt(0).toUpperCase() + template.riskLevel.slice(1)}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Profit Potential</div>
                  <div className={`text-sm font-medium ${getProfitColor(template.profitPotential)}`}>
                    {template.profitPotential.charAt(0).toUpperCase() + template.profitPotential.slice(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Complexity</div>
                  <div className={`text-sm font-medium ${getComplexityColor(template.complexity)}`}>
                    {template.complexity.charAt(0).toUpperCase() + template.complexity.slice(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Max Daily Loss</div>
                  <div className="text-sm font-medium">
                    ${template.riskParameters.maxDailyLoss}
                  </div>
                </div>
              </div>

              {/* Template-specific details */}
              {botType === 'arbitrage' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Token Pairs</div>
                    <div className="font-medium">
                      {(template.configuration as ArbitrageConfiguration).tokenPairs.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Profit Threshold</div>
                    <div className="font-medium">
                      {(template.configuration as ArbitrageConfiguration).profitThreshold}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Max Trade Size</div>
                    <div className="font-medium">
                      ${(template.configuration as ArbitrageConfiguration).maxTradeSize}
                    </div>
                  </div>
                </div>
              )}

              {botType === 'copy-trading' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Copy Mode</div>
                    <div className="font-medium">
                      {(template.configuration as CopyTradingConfiguration).copyMode.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Max Copy Amount</div>
                    <div className="font-medium">
                      ${(template.configuration as CopyTradingConfiguration).maxCopyAmount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Filters</div>
                    <div className="font-medium">
                      {(template.configuration as CopyTradingConfiguration).tradeFilters.length}
                    </div>
                  </div>
                </div>
              )}

              {botType === 'sandwich' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Min Victim Size</div>
                    <div className="font-medium">
                      ${(template.configuration as SandwichConfiguration).minVictimTradeSize}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Gas Strategy</div>
                    <div className="font-medium">
                      {(template.configuration as SandwichConfiguration).gasBidStrategy}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      MEV Protection
                    </div>
                    <div className="font-medium">
                      {Object.values((template.configuration as SandwichConfiguration).mevProtection).filter(Boolean).length > 0 ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No templates available for this bot type</p>
          <p className="text-sm">Templates will be added in future updates</p>
        </div>
      )}

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <div className="font-medium text-blue-800 mb-1">Template Benefits</div>
              <div className="text-sm text-blue-700">
                Templates provide tested configurations optimized for different risk levels and strategies. 
                You can apply a template and then customize it to fit your specific needs.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
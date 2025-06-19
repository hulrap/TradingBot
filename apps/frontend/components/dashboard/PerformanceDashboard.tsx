'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Target, 
  AlertCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Zap,
  Shield,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw
} from 'lucide-react';

interface PerformanceMetrics {
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalTrades: number;
  successfulTrades: number;
  winRate: number;
  avgTradeSize: number;
  avgProfitPerTrade: number;
  totalVolume: number;
  sharpeRatio: number;
  maxDrawdown: number;
  activeBots: number;
  paperTradingBots: number;
}

interface BotStatus {
  id: string;
  name: string;
  type: 'arbitrage' | 'copy-trading' | 'sandwich';
  status: 'active' | 'paused' | 'stopped' | 'error';
  isPaperTrading: boolean;
  dailyPnL: number;
  totalTrades: number;
  winRate: number;
  lastActivity: string;
  health: 'excellent' | 'good' | 'warning' | 'critical';
}

interface Trade {
  id: string;
  timestamp: string;
  botId: string;
  botName: string;
  type: 'buy' | 'sell';
  pair: string;
  amount: number;
  price: number;
  pnl: number;
  status: 'completed' | 'pending' | 'failed';
  gasUsed: number;
  chain: string;
}

interface PnLDataPoint {
  timestamp: string;
  cumulative: number;
  daily: number;
  trades: number;
}

// Mock data - in production this would come from API
const mockPerformanceMetrics: PerformanceMetrics = {
  totalPnL: 2456.78,
  dailyPnL: 156.34,
  weeklyPnL: 890.12,
  monthlyPnL: 2456.78,
  totalTrades: 1247,
  successfulTrades: 1089,
  winRate: 87.3,
  avgTradeSize: 250.50,
  avgProfitPerTrade: 2.15,
  totalVolume: 312450.75,
  sharpeRatio: 2.34,
  maxDrawdown: 8.5,
  activeBots: 3,
  paperTradingBots: 1
};

const mockBotStatuses: BotStatus[] = [
  {
    id: '1',
    name: 'ETH-ARB-001',
    type: 'arbitrage',
    status: 'active',
    isPaperTrading: false,
    dailyPnL: 89.45,
    totalTrades: 324,
    winRate: 91.2,
    lastActivity: '2 min ago',
    health: 'excellent'
  },
  {
    id: '2',
    name: 'COPY-WHALE-01',
    type: 'copy-trading',
    status: 'active',
    isPaperTrading: false,
    dailyPnL: 67.89,
    totalTrades: 156,
    winRate: 85.9,
    lastActivity: '5 min ago',
    health: 'good'
  },
  {
    id: '3',
    name: 'MEV-HUNTER-1',
    type: 'sandwich',
    status: 'paused',
    isPaperTrading: false,
    dailyPnL: -23.45,
    totalTrades: 89,
    winRate: 76.4,
    lastActivity: '1 hour ago',
    health: 'warning'
  },
  {
    id: '4',
    name: 'TEST-ARB-001',
    type: 'arbitrage',
    status: 'active',
    isPaperTrading: true,
    dailyPnL: 0,
    totalTrades: 45,
    winRate: 88.9,
    lastActivity: '30 sec ago',
    health: 'good'
  }
];

const mockRecentTrades: Trade[] = [
  {
    id: '1',
    timestamp: '2024-01-15T10:30:00Z',
    botId: '1',
    botName: 'ETH-ARB-001',
    type: 'buy',
    pair: 'ETH/USDC',
    amount: 1.5,
    price: 2456.78,
    pnl: 12.34,
    status: 'completed',
    gasUsed: 0.002,
    chain: 'Ethereum'
  },
  {
    id: '2',
    timestamp: '2024-01-15T10:25:00Z',
    botId: '2',
    botName: 'COPY-WHALE-01',
    type: 'sell',
    pair: 'BTC/USDT',
    amount: 0.05,
    price: 42150.00,
    pnl: 45.67,
    status: 'completed',
    gasUsed: 0.0015,
    chain: 'BSC'
  },
  {
    id: '3',
    timestamp: '2024-01-15T10:20:00Z',
    botId: '1',
    botName: 'ETH-ARB-001',
    type: 'buy',
    pair: 'LINK/ETH',
    amount: 100,
    price: 0.0058,
    pnl: -2.45,
    status: 'failed',
    gasUsed: 0.001,
    chain: 'Ethereum'
  }
];

// Generate mock P&L chart data
const generatePnLData = (): PnLDataPoint[] => {
  const data: PnLDataPoint[] = [];
  let cumulative = 0;
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const dailyPnL = (Math.random() - 0.3) * 100; // Slightly positive bias
    cumulative += dailyPnL;
    
    data.push({
      timestamp: date.toISOString().split('T')[0],
      cumulative: Math.round(cumulative * 100) / 100,
      daily: Math.round(dailyPnL * 100) / 100,
      trades: Math.floor(Math.random() * 50) + 10
    });
  }
  
  return data;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(mockPerformanceMetrics);
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>(mockBotStatuses);
  const [recentTrades, setRecentTrades] = useState<Trade[]>(mockRecentTrades);
  const [pnlData, setPnlData] = useState<PnLDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Generate P&L data on component mount
  useEffect(() => {
    setPnlData(generatePnLData());
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small random changes in metrics
      setMetrics(prev => ({
        ...prev,
        dailyPnL: prev.dailyPnL + (Math.random() - 0.5) * 10,
        totalPnL: prev.totalPnL + (Math.random() - 0.5) * 10
      }));
      
      setLastUpdate(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastUpdate(new Date());
    setIsLoading(false);
  };

  const getStatusIcon = (status: BotStatus['status']) => {
    switch (status) {
      case 'active':
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'stopped':
        return <StopCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getHealthColor = (health: BotStatus['health']) => {
    switch (health) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const performanceCards = [
    {
      title: 'Total P&L',
      value: formatCurrency(metrics.totalPnL),
      change: metrics.dailyPnL,
      icon: DollarSign,
      color: metrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
    },
    {
      title: 'Daily P&L',
      value: formatCurrency(metrics.dailyPnL),
      change: ((metrics.dailyPnL / Math.abs(metrics.weeklyPnL - metrics.dailyPnL)) * 100),
      icon: TrendingUp,
      color: metrics.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'
    },
    {
      title: 'Win Rate',
      value: formatPercentage(metrics.winRate),
      change: 2.3,
      icon: Target,
      color: 'text-blue-600'
    },
    {
      title: 'Total Trades',
      value: metrics.totalTrades.toLocaleString(),
      change: 45,
      icon: Activity,
      color: 'text-purple-600'
    }
  ];

  const botTypeDistribution = useMemo(() => {
    const distribution = botStatuses.reduce((acc, bot) => {
      acc[bot.type] = (acc[bot.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count
    }));
  }, [botStatuses]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time trading performance and bot monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className={card.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {card.change >= 0 ? '+' : ''}{card.change.toFixed(2)}
                  {card.title.includes('Rate') || card.title.includes('Trades') ? '' : '%'}
                </span>
                {' '}from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bots">Bot Status</TabsTrigger>
          <TabsTrigger value="trades">Recent Trades</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* P&L Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Cumulative P&L (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number, name: string) => [
                        `$${value.toFixed(2)}`, 
                        name === 'cumulative' ? 'Cumulative P&L' : 'Daily P&L'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Sharpe Ratio</span>
                  <span className="text-sm font-bold text-green-600">
                    {metrics.sharpeRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Max Drawdown</span>
                  <span className="text-sm font-bold text-red-600">
                    {formatPercentage(metrics.maxDrawdown)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Volume</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(metrics.totalVolume)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Avg Trade Size</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(metrics.avgTradeSize)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Bot Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Bot Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={botTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {botTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bot Status Tab */}
        <TabsContent value="bots" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {botStatuses.map((bot) => (
              <Card key={bot.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{bot.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(bot.status)}
                      <div className={`w-2 h-2 rounded-full ${getHealthColor(bot.health)}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{bot.type}</Badge>
                    {bot.isPaperTrading && (
                      <Badge variant="outline">Paper Trading</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Daily P&L:</span>
                    <span className={bot.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(bot.dailyPnL)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Win Rate:</span>
                    <span>{formatPercentage(bot.winRate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Trades:</span>
                    <span>{bot.totalTrades}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Last Activity:</span>
                    <span className="text-muted-foreground">{bot.lastActivity}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Recent Trades Tab */}
        <TabsContent value="trades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTrades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{trade.pair}</span>
                        <span className="text-sm text-muted-foreground">{trade.botName}</span>
                      </div>
                      <Badge variant={trade.type === 'buy' ? 'default' : 'secondary'}>
                        {trade.type.toUpperCase()}
                      </Badge>
                      <Badge 
                        variant={
                          trade.status === 'completed' ? 'default' : 
                          trade.status === 'pending' ? 'secondary' : 'destructive'
                        }
                      >
                        {trade.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="font-medium">{trade.amount}</div>
                        <div className="text-sm text-muted-foreground">
                          @ {formatCurrency(trade.price)}
                        </div>
                      </div>
                      <div className={`font-bold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(trade.pnl)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily P&L Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily P&L Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Daily P&L']}
                    />
                    <Bar 
                      dataKey="daily" 
                      fill={(dataIndex: any) => dataIndex >= 0 ? '#22c55e' : '#ef4444'}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Trade Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Trade Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [value, 'Trades']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="trades" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={{ fill: '#8884d8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
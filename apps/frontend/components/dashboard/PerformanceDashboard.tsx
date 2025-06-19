'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Trade {
  id: string;
  timestamp: number;
  botType: 'arbitrage' | 'copy-trading' | 'sandwich';
  pair: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  profit: number;
  status: 'pending' | 'completed' | 'failed';
  gasUsed: number;
  gasPrice: number;
  chain: string;
}

interface BotStatus {
  id: string;
  name: string;
  type: 'arbitrage' | 'copy-trading' | 'sandwich';
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  tradesCount: number;
  profit: number;
  lastActivity: number;
  health: number; // 0-100
}

interface PerformanceMetrics {
  totalProfit: number;
  totalVolume: number;
  successRate: number;
  avgProfitPerTrade: number;
  totalTrades: number;
  activeBots: number;
  topPair: string;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
}

interface ChartData {
  timestamp: number;
  profit: number;
  volume: number;
  trades: number;
  gasUsed: number;
}

export default function PerformanceDashboard() {
  const [performanceData, setPerformanceData] = useState<ChartData[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalProfit: 0,
    totalVolume: 0,
    successRate: 0,
    avgProfitPerTrade: 0,
    totalTrades: 0,
    activeBots: 0,
    topPair: '',
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, [selectedTimeframe]);

  const connectWebSocket = () => {
    try {
      // In production, replace with actual WebSocket URL
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? 'wss://your-api.com/ws/performance' 
        : 'ws://localhost:3001/ws/performance';
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      // Use mock data if WebSocket fails
      useMockData();
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'trade_update':
        handleTradeUpdate(data.payload);
        break;
      case 'bot_status_update':
        handleBotStatusUpdate(data.payload);
        break;
      case 'performance_update':
        handlePerformanceUpdate(data.payload);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleTradeUpdate = (trade: Trade) => {
    setRecentTrades(prev => [trade, ...prev.slice(0, 19)]); // Keep last 20 trades
    
    // Update performance data
    const now = Date.now();
    setPerformanceData(prev => {
      const newDataPoint: ChartData = {
        timestamp: now,
        profit: trade.profit,
        volume: trade.amount * trade.price,
        trades: 1,
        gasUsed: trade.gasUsed
      };
      
      // Keep last 100 data points
      return [...prev.slice(-99), newDataPoint];
    });
  };

  const handleBotStatusUpdate = (botStatus: BotStatus) => {
    setBotStatuses(prev => 
      prev.map(bot => bot.id === botStatus.id ? botStatus : bot)
    );
  };

  const handlePerformanceUpdate = (newMetrics: Partial<PerformanceMetrics>) => {
    setMetrics(prev => ({ ...prev, ...newMetrics }));
  };

  const fetchInitialData = async () => {
    try {
      // Mock initial data - in production, fetch from API
      const mockTrades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade-${i}`,
        timestamp: Date.now() - (i * 60000),
        botType: ['arbitrage', 'copy-trading', 'sandwich'][i % 3] as any,
        pair: ['ETH/USDT', 'BTC/USDT', 'SOL/USDT'][i % 3],
        type: i % 2 === 0 ? 'buy' : 'sell',
        amount: Math.random() * 10,
        price: 2000 + Math.random() * 1000,
        profit: (Math.random() - 0.3) * 100,
        status: ['completed', 'pending', 'failed'][i % 3] as any,
        gasUsed: 21000 + Math.random() * 100000,
        gasPrice: 20 + Math.random() * 50,
        chain: ['ethereum', 'bsc', 'polygon'][i % 3]
      }));

      const mockBots: BotStatus[] = [
        {
          id: 'arb-1',
          name: 'ETH Arbitrage Bot',
          type: 'arbitrage',
          status: 'running',
          uptime: 86400000,
          tradesCount: 45,
          profit: 234.56,
          lastActivity: Date.now() - 30000,
          health: 95
        },
        {
          id: 'copy-1',
          name: 'Whale Tracker Bot',
          type: 'copy-trading',
          status: 'running',
          uptime: 172800000,
          tradesCount: 23,
          profit: 156.78,
          lastActivity: Date.now() - 120000,
          health: 88
        },
        {
          id: 'sandwich-1',
          name: 'MEV Hunter Bot',
          type: 'sandwich',
          status: 'stopped',
          uptime: 0,
          tradesCount: 0,
          profit: 0,
          lastActivity: Date.now() - 3600000,
          health: 0
        }
      ];

      const mockPerformanceData: ChartData[] = Array.from({ length: 24 }, (_, i) => ({
        timestamp: Date.now() - (i * 3600000),
        profit: Math.random() * 50 - 10,
        volume: Math.random() * 10000,
        trades: Math.floor(Math.random() * 20),
        gasUsed: Math.random() * 500000
      })).reverse();

      const mockMetrics: PerformanceMetrics = {
        totalProfit: 391.34,
        totalVolume: 125000,
        successRate: 87.5,
        avgProfitPerTrade: 5.73,
        totalTrades: 68,
        activeBots: 2,
        topPair: 'ETH/USDT',
        maxDrawdown: -12.5,
        sharpeRatio: 1.25,
        winRate: 72.1
      };

      setRecentTrades(mockTrades);
      setBotStatuses(mockBots);
      setPerformanceData(mockPerformanceData);
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const useMockData = () => {
    // Simulate real-time updates with mock data
    const interval = setInterval(() => {
      const mockTrade: Trade = {
        id: `trade-${Date.now()}`,
        timestamp: Date.now(),
        botType: ['arbitrage', 'copy-trading', 'sandwich'][Math.floor(Math.random() * 3)] as any,
        pair: ['ETH/USDT', 'BTC/USDT', 'SOL/USDT'][Math.floor(Math.random() * 3)],
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        amount: Math.random() * 10,
        price: 2000 + Math.random() * 1000,
        profit: (Math.random() - 0.3) * 100,
        status: 'completed',
        gasUsed: 21000 + Math.random() * 100000,
        gasPrice: 20 + Math.random() * 50,
        chain: ['ethereum', 'bsc', 'polygon'][Math.floor(Math.random() * 3)]
      };

      if (Math.random() > 0.7) { // 30% chance of new trade
        handleTradeUpdate(mockTrade);
      }
    }, 3000);

    return () => clearInterval(interval);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'stopped': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Performance Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time trading performance and analytics</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
            
            {/* Timeframe Selector */}
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Profit</p>
                <p className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(metrics.totalProfit)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${metrics.totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <svg className={`w-6 h-6 ${metrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metrics.totalProfit >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-blue-600">{formatPercentage(metrics.successRate)}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Trades</p>
                <p className="text-2xl font-bold text-purple-600">{metrics.totalTrades}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Bots</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.activeBots}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profit Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                  formatter={(value: any) => [`$${value.toFixed(2)}`, 'Profit']}
                />
                <Area type="monotone" dataKey="profit" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Volume Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trading Volume</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip 
                  labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Volume']}
                />
                <Bar dataKey="volume" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bot Status and Recent Trades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bot Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bot Status</h3>
            <div className="space-y-4">
              {botStatuses.map((bot) => (
                <div key={bot.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      bot.status === 'running' ? 'bg-green-500' :
                      bot.status === 'stopped' ? 'bg-gray-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{bot.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {bot.tradesCount} trades • {formatCurrency(bot.profit)} profit
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(bot.status)}`}>
                      {bot.status}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Health: {bot.health}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Trades</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 text-xs rounded ${
                      trade.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {trade.type.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{trade.pair}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {trade.amount.toFixed(4)} @ {formatCurrency(trade.price)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${trade.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(trade.profit)}
                    </p>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(trade.status)}`}>
                      {trade.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advanced Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
              <p className="text-2xl font-bold text-blue-600">{metrics.sharpeRatio.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Drawdown</p>
              <p className="text-2xl font-bold text-red-600">{formatPercentage(metrics.maxDrawdown)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Win Rate</p>
              <p className="text-2xl font-bold text-green-600">{formatPercentage(metrics.winRate)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Profit/Trade</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(metrics.avgProfitPerTrade)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
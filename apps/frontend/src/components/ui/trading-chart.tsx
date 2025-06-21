'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  Maximize2, 
  Settings,
  Pause,
  Play,
  RefreshCw
} from 'lucide-react';

interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

interface TechnicalIndicator {
  id: string;
  name: string;
  enabled: boolean;
  color: string;
  data: { timestamp: number; value: number }[];
}

interface TradingChartProps {
  symbol: string;
  chain: string;
  dex?: string;
  height?: number;
  showVolume?: boolean;
  showIndicators?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onPriceUpdate?: (price: number, change: number) => void;
}

const TIME_FRAMES = [
  { label: '1m', value: '1m', duration: 60000 },
  { label: '5m', value: '5m', duration: 300000 },
  { label: '15m', value: '15m', duration: 900000 },
  { label: '1h', value: '1h', duration: 3600000 },
  { label: '4h', value: '4h', duration: 14400000 },
  { label: '1d', value: '1d', duration: 86400000 }
];

const CHART_TYPES = [
  { label: 'Line', value: 'line', icon: Activity },
  { label: 'Candlestick', value: 'candlestick', icon: BarChart3 },
  { label: 'Area', value: 'area', icon: TrendingUp }
];

const DEFAULT_INDICATORS = [
  { id: 'sma_20', name: 'SMA (20)', enabled: false, color: '#ff6b6b' },
  { id: 'sma_50', name: 'SMA (50)', enabled: false, color: '#4ecdc4' },
  { id: 'ema_12', name: 'EMA (12)', enabled: false, color: '#45b7d1' },
  { id: 'rsi', name: 'RSI', enabled: false, color: '#96ceb4' },
  { id: 'macd', name: 'MACD', enabled: false, color: '#feca57' }
];

export function TradingChart({
  symbol,
  chain,
  dex,
  height = 400,
  showVolume = true,
  showIndicators = true,
  autoRefresh = true,
  refreshInterval = 30000,
  onPriceUpdate
}: TradingChartProps) {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [timeFrame, setTimeFrame] = useState('15m');
  const [chartType, setChartType] = useState('candlestick');
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>(
    DEFAULT_INDICATORS.map(ind => ({ ...ind, data: [] }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRealTime, setIsRealTime] = useState(autoRefresh);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Simulated price data generation
  const generateMockData = (count: number = 100): PriceData[] => {
    const data: PriceData[] = [];
    const now = Date.now();
    const interval = TIME_FRAMES.find(tf => tf.value === timeFrame)?.duration || 900000;
    let basePrice = 2000 + Math.random() * 1000;

    for (let i = count; i >= 0; i--) {
      const timestamp = now - (i * interval);
      const volatility = 0.02; // 2% volatility
      const change = (Math.random() - 0.5) * basePrice * volatility;
      
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * Math.abs(change);
      const low = Math.min(open, close) - Math.random() * Math.abs(change);
      const volume = 1000000 + Math.random() * 5000000;

      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        date: new Date(timestamp).toISOString()
      });

      basePrice = close;
    }

    return data.sort((a, b) => a.timestamp - b.timestamp);
  };

  // Calculate technical indicators
  const calculateSMA = (data: PriceData[], period: number): { timestamp: number; value: number }[] => {
    return data.map((item, index) => {
      if (index < period - 1) {
        return { timestamp: item.timestamp, value: 0 };
      }
      
      const slice = data.slice(index - period + 1, index + 1);
      const sum = slice.reduce((acc, d) => acc + d.close, 0);
      
      return {
        timestamp: item.timestamp,
        value: sum / period
      };
    }).filter(item => item.value > 0);
  };

  const calculateEMA = (data: PriceData[], period: number): { timestamp: number; value: number }[] => {
    const multiplier = 2 / (period + 1);
    const emaData: { timestamp: number; value: number }[] = [];
    
    data.forEach((item, index) => {
      if (index === 0) {
        emaData.push({ timestamp: item.timestamp, value: item.close });
      } else {
        const prevEma = emaData[index - 1];
        if (prevEma) {
          const emaValue = (item.close * multiplier) + (prevEma.value * (1 - multiplier));
          emaData.push({ timestamp: item.timestamp, value: emaValue });
        }
      }
    });
    
    return emaData;
  };

  // Memoize expensive calculations for performance
  const memoizedIndicators = useMemo(() => {
    return indicators.map(indicator => {
      let calculatedData: { timestamp: number; value: number }[] = [];
      
      switch (indicator.id) {
        case 'sma_20':
          calculatedData = calculateSMA(priceData, 20);
          break;
        case 'sma_50':
          calculatedData = calculateSMA(priceData, 50);
          break;
        case 'ema_12':
          calculatedData = calculateEMA(priceData, 12);
          break;
        case 'rsi':
          // Simplified RSI calculation
          calculatedData = priceData.map((item) => ({
            timestamp: item.timestamp,
            value: 50 + (Math.random() - 0.5) * 40 // Mock RSI
          }));
          break;
        case 'macd':
          // Simplified MACD calculation
          calculatedData = priceData.map((item) => ({
            timestamp: item.timestamp,
            value: (Math.random() - 0.5) * 10 // Mock MACD
          }));
          break;
        default:
          calculatedData = [];
      }
      
      return { ...indicator, data: calculatedData };
    });
  }, [priceData, indicators]);

  // Update indicators based on price data
  const updateIndicators = (data: PriceData[]) => {
    setIndicators(prev => prev.map(indicator => {
      let calculatedData: { timestamp: number; value: number }[] = [];
      
      switch (indicator.id) {
        case 'sma_20':
          calculatedData = calculateSMA(data, 20);
          break;
        case 'sma_50':
          calculatedData = calculateSMA(data, 50);
          break;
        case 'ema_12':
          calculatedData = calculateEMA(data, 12);
          break;
        case 'rsi':
          // Simplified RSI calculation
          calculatedData = data.map((item) => ({
            timestamp: item.timestamp,
            value: 50 + (Math.random() - 0.5) * 40 // Mock RSI
          }));
          break;
        case 'macd':
          // Simplified MACD calculation
          calculatedData = data.map((item) => ({
            timestamp: item.timestamp,
            value: (Math.random() - 0.5) * 10 // Mock MACD
          }));
          break;
        default:
          calculatedData = [];
      }
      
      return { ...indicator, data: calculatedData };
    }));
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockData = generateMockData(100);
        setPriceData(mockData);
        
        if (mockData.length > 1) {
          const latest = mockData[mockData.length - 1];
          const previous = mockData[mockData.length - 2];
          
          if (latest && previous) {
            setCurrentPrice(latest.close);
            const change = latest.close - previous.close;
            const changePercent = (change / previous.close) * 100;
            
            setPriceChange(change);
            setPriceChangePercent(changePercent);
            
            onPriceUpdate?.(latest.close, changePercent);
          }
        }
        
        updateIndicators(mockData);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to load price data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [symbol, chain, dex, timeFrame]);

  // WebSocket connection for real-time data
  useEffect(() => {
    if (!isRealTime) return;

    // Try WebSocket connection first, fallback to polling
    try {
      const wsUrl = `wss://api.example.com/ws/${chain}/${symbol}`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.price) {
          setCurrentPrice(data.price);
          const change = data.change || 0;
          const changePercent = data.changePercent || 0;
          setPriceChange(change);
          setPriceChangePercent(changePercent);
          setLastUpdate(new Date());
          onPriceUpdate?.(data.price, changePercent);
        }
      };

      wsRef.current.onerror = () => {
        // Fallback to polling if WebSocket fails
        console.log('WebSocket failed, falling back to polling');
      };

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    } catch (error) {
      console.log('WebSocket not available, using polling');
    }

    // Fallback polling mechanism
    const interval = setInterval(() => {
      if (priceData.length === 0) return;

      const lastPrice = priceData[priceData.length - 1];
      if (!lastPrice) return;
      
      const volatility = 0.001; // 0.1% volatility for real-time updates
      const change = (Math.random() - 0.5) * lastPrice.close * volatility;
      const newPrice = lastPrice.close + change;

      // Update current price
      setCurrentPrice(newPrice);
      const priceChange = newPrice - lastPrice.close;
      const changePercent = (priceChange / lastPrice.close) * 100;
      
      setPriceChange(priceChange);
      setPriceChangePercent(changePercent);
      setLastUpdate(new Date());
      
      onPriceUpdate?.(newPrice, changePercent);

      // Update the last data point for smooth real-time updates
      setPriceData(prev => {
        const updated = [...prev];
        const lastItem = updated[updated.length - 1];
        if (lastItem) {
          updated[updated.length - 1] = {
            ...lastItem,
            close: newPrice,
            high: Math.max(lastItem.high, newPrice),
            low: Math.min(lastItem.low, newPrice)
          };
        }
        return updated;
      });
    }, refreshInterval || 2000); // Use refreshInterval prop

    return () => clearInterval(interval);
  }, [isRealTime, priceData, onPriceUpdate]);

  // Format price for display
  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }
    return price.toFixed(6);
  };

  // Format volume
  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const displayTime = label ? new Date(label).toLocaleString() : new Date(data.timestamp).toLocaleString();
    
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm mb-2">
          {displayTime}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Open:</span>
            <span className="text-white">${formatPrice(data.open)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">High:</span>
            <span className="text-green-400">${formatPrice(data.high)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Low:</span>
            <span className="text-red-400">${formatPrice(data.low)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Close:</span>
            <span className="text-white">${formatPrice(data.close)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Volume:</span>
            <span className="text-blue-400">{formatVolume(data.volume)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Render different chart types
  const renderChart = () => {
    const commonProps = {
      data: priceData,
      margin: { top: 5, right: 5, left: 5, bottom: 5 }
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              stroke="#9CA3AF"
            />
            <YAxis 
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatPrice}
              stroke="#9CA3AF"
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={currentPrice} stroke="#F59E0B" strokeDasharray="3 3" label="Current Price" />
            <Line 
              type="monotone" 
              dataKey="close" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={false}
            />
            {memoizedIndicators.filter(ind => ind.enabled).map(indicator => (
              <Line
                key={indicator.id}
                type="monotone"
                dataKey="close"
                data={indicator.data}
                stroke={indicator.color}
                strokeWidth={1}
                dot={false}
                strokeDasharray="5 5"
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              stroke="#9CA3AF"
            />
            <YAxis 
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatPrice}
              stroke="#9CA3AF"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#10B981"
              fill="url(#colorGradient)"
              strokeWidth={2}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
          </AreaChart>
        );

      default: // candlestick (simplified as high-low with close)
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              stroke="#9CA3AF"
            />
            <YAxis 
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatPrice}
              stroke="#9CA3AF"
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="high" 
              stroke="#10B981" 
              strokeWidth={1}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="low" 
              stroke="#EF4444" 
              strokeWidth={1}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="close" 
              stroke="#F59E0B" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        );
    }
  };

  const toggleIndicator = (indicatorId: string) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === indicatorId ? { ...ind, enabled: !ind.enabled } : ind
    ));
  };

  return (
    <div 
      ref={chartContainerRef}
      className={`bg-gray-800 rounded-lg border border-gray-700 ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {symbol.toUpperCase()}
            </h3>
            <p className="text-sm text-gray-400">
              {chain.charAt(0).toUpperCase() + chain.slice(1)}
              {dex && ` • ${dex}`}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">
              ${formatPrice(currentPrice)}
            </span>
            <div className={`flex items-center space-x-1 ${
              priceChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceChange >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-medium">
                {priceChange >= 0 ? '+' : ''}
                {formatPrice(Math.abs(priceChange))}
              </span>
              <span className="text-sm">
                ({priceChangePercent >= 0 ? '+' : ''}
                {priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Time Frame Selector */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeFrame(tf.value)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  timeFrame === tf.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            {CHART_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => setChartType(type.value)}
                  className={`p-2 rounded transition-colors ${
                    chartType === type.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                  title={type.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <button
            onClick={() => setIsRealTime(!isRealTime)}
            className={`p-2 rounded transition-colors ${
              isRealTime
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:text-white'
            }`}
            title={isRealTime ? 'Pause Updates' : 'Resume Updates'}
          >
            {isRealTime ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {showIndicators && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded bg-gray-700 text-gray-300 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && showIndicators && (
        <div className="border-b border-gray-700 p-4">
          <h4 className="text-sm font-medium text-white mb-3">Technical Indicators</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {indicators.map((indicator) => (
              <label
                key={indicator.id}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={indicator.enabled}
                  onChange={() => toggleIndicator(indicator.id)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">{indicator.name}</span>
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: indicator.color }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={height}>
              {renderChart()}
            </ResponsiveContainer>
            
            {/* Volume Chart */}
            {showVolume && (
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={priceData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    stroke="#9CA3AF"
                  />
                  <YAxis 
                    tickFormatter={formatVolume}
                    stroke="#9CA3AF"
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: any) => [formatVolume(value), 'Volume']}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#6366F1"
                    fill="#6366F1"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
        <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        <span>{priceData.length} data points</span>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Layers, Settings } from 'lucide-react';

interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  count?: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercent: number;
  lastUpdate: number;
  sequence?: number;
}

interface OrderBookProps {
  symbol: string;
  chain: string;
  dex?: string;
  precision?: number;
  grouping?: number;
  maxLevels?: number;
  autoRefresh?: boolean;
  showSpread?: boolean;
  showDepth?: boolean;
  compact?: boolean;
  height?: number;
  onOrderClick?: (price: number, side: 'bid' | 'ask') => void;
}

const PRECISION_OPTIONS = [0.1, 0.01, 0.001, 0.0001, 0.00001];
const GROUPING_OPTIONS = [0.1, 0.5, 1, 5, 10, 50, 100];

export function OrderBook({
  symbol,
  chain,
  dex,
  precision = 0.01,
  grouping = 1,
  maxLevels = 20,
  autoRefresh = true,
  showSpread = true,
  showDepth = true,
  compact = false,
  height = 500,
  onOrderClick
}: OrderBookProps) {
  const [orderBookData, setOrderBookData] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: 0,
    spreadPercent: 0,
    lastUpdate: Date.now()
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGrouping, setSelectedGrouping] = useState(grouping);
  const [selectedPrecision, setSelectedPrecision] = useState(precision);
  const [selectedMaxLevels, setSelectedMaxLevels] = useState(maxLevels);
  const [showSettings, setShowSettings] = useState(false);
  const [highlightedLevel, setHighlightedLevel] = useState<{ side: 'bid' | 'ask'; price: number } | null>(null);
  const [depthView, setDepthView] = useState(showDepth);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Generate mock order book data
  const generateMockOrderBook = (): OrderBookData => {
    const basePrice = 2500 + Math.random() * 500;
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];
    
    // Generate bids (below market price)
    let bidTotal = 0;
    for (let i = 0; i < selectedMaxLevels; i++) {
      const priceOffset = (i + 1) * selectedGrouping;
      const price = basePrice - priceOffset;
      const quantity = Math.random() * 10 + 1;
      bidTotal += quantity;
      
      bids.push({
        price: Number(price.toFixed(8)),
        quantity: Number(quantity.toFixed(4)),
        total: Number(bidTotal.toFixed(4)),
        count: Math.floor(Math.random() * 10) + 1
      });
    }
    
    // Generate asks (above market price)
    let askTotal = 0;
    for (let i = 0; i < selectedMaxLevels; i++) {
      const priceOffset = (i + 1) * selectedGrouping;
      const price = basePrice + priceOffset;
      const quantity = Math.random() * 10 + 1;
      askTotal += quantity;
      
      asks.push({
        price: Number(price.toFixed(8)),
        quantity: Number(quantity.toFixed(4)),
        total: Number(askTotal.toFixed(4)),
        count: Math.floor(Math.random() * 10) + 1
      });
    }
    
    const spread = (asks[0]?.price && bids[0]?.price) ? asks[0].price - bids[0].price : 0;
    const spreadPercent = bids[0]?.price ? (spread / bids[0].price) * 100 : 0;
    
    return {
      bids: bids.reverse(), // Highest bids first
      asks: asks, // Lowest asks first
      spread,
      spreadPercent,
      lastUpdate: Date.now()
    };
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockData = generateMockOrderBook();
        setOrderBookData(mockData);
      } catch (error) {
        console.error('Failed to load order book:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [symbol, chain, dex, selectedGrouping, selectedMaxLevels]);

  // WebSocket connection for real-time order book data
  useEffect(() => {
    if (!autoRefresh) return;

    // Try WebSocket connection first, fallback to polling
    try {
      const wsUrl = `wss://api.example.com/orderbook/${chain}/${symbol}`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.bids && data.asks) {
          setOrderBookData({
            bids: data.bids,
            asks: data.asks,
            spread: data.spread || 0,
            spreadPercent: data.spreadPercent || 0,
            lastUpdate: Date.now(),
            sequence: data.sequence
          });
        }
      };

      wsRef.current.onerror = () => {
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
      // Simulate real-time updates by slightly modifying existing data
      setOrderBookData(prev => {
        const updatedBids = prev.bids.map(bid => ({
          ...bid,
          quantity: Math.max(0.1, bid.quantity + (Math.random() - 0.5) * 2),
        }));
        
        const updatedAsks = prev.asks.map(ask => ({
          ...ask,
          quantity: Math.max(0.1, ask.quantity + (Math.random() - 0.5) * 2),
        }));

        // Recalculate totals
        let bidTotal = 0;
        updatedBids.forEach(bid => {
          bidTotal += bid.quantity;
          bid.total = Number(bidTotal.toFixed(4));
        });

        let askTotal = 0;
        updatedAsks.forEach(ask => {
          askTotal += ask.quantity;
          ask.total = Number(askTotal.toFixed(4));
        });

        const spread = (updatedAsks[0]?.price && updatedBids[0]?.price) ? updatedAsks[0].price - updatedBids[0].price : 0;
        const spreadPercent = updatedBids[0]?.price ? (spread / updatedBids[0].price) * 100 : 0;

        return {
          bids: updatedBids,
          asks: updatedAsks,
          spread,
          spreadPercent,
          lastUpdate: Date.now()
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Calculate depth percentages for visualization
  const calculateDepthPercentages = (orders: OrderBookEntry[], side: 'bid' | 'ask') => {
    if (orders.length === 0) return [];
    
    const maxTotal = Math.max(...orders.map(o => o.total));
    
    // Apply side-specific depth calculation logic
    const sideMultiplier = side === 'bid' ? 1.1 : 1.0; // Bids get slightly more visual weight
    
    return orders.map(order => ({
      ...order,
      depthPercent: (order.total / maxTotal) * 100 * sideMultiplier
    }));
  };

  const bidsWithDepth = useMemo(() => 
    calculateDepthPercentages(orderBookData.bids, 'bid'), 
    [orderBookData.bids]
  );
  
  const asksWithDepth = useMemo(() => 
    calculateDepthPercentages(orderBookData.asks, 'ask'), 
    [orderBookData.asks]
  );

  // Format price based on precision
  const formatPrice = (price: number): string => {
    const decimals = Math.max(0, -Math.log10(selectedPrecision));
    return price.toFixed(decimals);
  };

  // Format quantity
  const formatQuantity = (quantity: number): string => {
    if (quantity >= 1000) {
      return `${(quantity / 1000).toFixed(2)}K`;
    }
    return quantity.toFixed(4);
  };

  // Handle order level click
  const handleOrderClick = (price: number, side: 'bid' | 'ask') => {
    setHighlightedLevel({ side, price });
    onOrderClick?.(price, side);
    
    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedLevel(null);
    }, 3000);
  };

  // Order book row component
  const OrderRow = ({ 
    order, 
    side, 
    isHighlighted 
  }: { 
    order: OrderBookEntry & { depthPercent?: number }; 
    side: 'bid' | 'ask';
    isHighlighted: boolean;
  }) => {
    const depthColor = side === 'bid' ? 'bg-green-500' : 'bg-red-500';
    const textColor = side === 'bid' ? 'text-green-400' : 'text-red-400';
    
    return (
      <div
        className={`
          relative grid grid-cols-3 gap-2 px-3 py-1 text-sm cursor-pointer transition-colors
          ${compact ? 'py-0.5' : 'py-1'}
          ${isHighlighted ? 'bg-blue-900/50' : 'hover:bg-gray-700/50'}
        `}
        onClick={() => handleOrderClick(order.price, side)}
      >
        {/* Depth visualization background */}
        {depthView && order.depthPercent && (
          <div
            className={`absolute inset-0 ${depthColor} opacity-10`}
            style={{ 
              width: `${order.depthPercent}%`,
              right: side === 'ask' ? 0 : 'auto',
              left: side === 'bid' ? 0 : 'auto'
            }}
          />
        )}
        
        <div className={`text-right ${textColor} font-mono`}>
          {formatPrice(order.price)}
        </div>
        <div className="text-right text-gray-300 font-mono">
          {formatQuantity(order.quantity)}
        </div>
        <div className="text-right text-gray-400 font-mono text-xs">
          {formatQuantity(order.total)}
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="bg-gray-800 rounded-lg border border-gray-700"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Order Book</h3>
            <p className="text-sm text-gray-400">
              {symbol.toUpperCase()} • {chain.charAt(0).toUpperCase() + chain.slice(1)}
              {dex && ` • ${dex}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Grouping selector */}
          <select
            value={selectedGrouping}
            onChange={(e) => setSelectedGrouping(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded text-white text-sm px-2 py-1"
          >
            {GROUPING_OPTIONS.map(group => (
              <option key={group} value={group}>
                {group >= 1 ? group.toString() : group.toFixed(3)}
              </option>
            ))}
          </select>

          <button
            onClick={() => setDepthView(!depthView)}
            className={`p-2 rounded transition-colors ${
              depthView ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'
            }`}
            title="Toggle Depth View"
          >
            <Activity className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-gray-700 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Price Precision
              </label>
              <select
                value={selectedPrecision}
                onChange={(e) => setSelectedPrecision(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded text-white text-sm p-2"
              >
                {PRECISION_OPTIONS.map(prec => (
                  <option key={prec} value={prec}>
                    {prec.toString()}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Max Levels
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={selectedMaxLevels}
                onChange={(e) => setSelectedMaxLevels(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-400 mt-1">{selectedMaxLevels} levels</div>
            </div>
          </div>
        </div>
      )}

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-gray-700 text-xs font-medium text-gray-400">
        <div className="text-right">Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      {/* Order Book Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Asks (sell orders) - displayed in reverse order */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-0">
                {asksWithDepth.slice().reverse().map((ask, index) => (
                  <OrderRow
                    key={`ask-${ask.price}-${index}`}
                    order={ask}
                    side="ask"
                    isHighlighted={
                      highlightedLevel?.side === 'ask' && 
                      highlightedLevel.price === ask.price
                    }
                  />
                ))}
              </div>
            </div>

            {/* Spread */}
            {showSpread && (
              <div className="py-3 px-3 border-y border-gray-700 bg-gray-750">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Spread:</span>
                    <span className="text-sm font-mono text-white">
                      {formatPrice(orderBookData.spread)}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({orderBookData.spreadPercent.toFixed(3)}%)
                    </span>
                    {/* Trending indicators */}
                    {orderBookData.spreadPercent > 0.1 ? (
                      <div title="Spread increasing">
                        <TrendingUp className="w-3 h-3 text-red-400" />
                      </div>
                    ) : (
                      <div title="Spread tightening">
                        <TrendingDown className="w-3 h-3 text-green-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Activity className="w-3 h-3" />
                    <span>
                      Updated {new Date(orderBookData.lastUpdate).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bids (buy orders) */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-0">
                {bidsWithDepth.map((bid, index) => (
                  <OrderRow
                    key={`bid-${bid.price}-${index}`}
                    order={bid}
                    side="bid"
                    isHighlighted={
                      highlightedLevel?.side === 'bid' && 
                      highlightedLevel.price === bid.price
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with summary */}
      <div className="p-3 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-400">Total Bids:</span>
            <span className="text-green-400 font-mono">
              {formatQuantity(orderBookData.bids.reduce((sum, bid) => sum + bid.quantity, 0))}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-400">Total Asks:</span>
            <span className="text-red-400 font-mono">
              {formatQuantity(orderBookData.asks.reduce((sum, ask) => sum + ask.quantity, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
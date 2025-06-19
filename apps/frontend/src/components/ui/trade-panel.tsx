'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowUpDown, 
  Settings, 
  Zap, 
  Shield, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Sliders
} from 'lucide-react';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  price?: number;
}

interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  totalCost: string;
  totalCostFormatted: string;
}

interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  minimumReceived: string;
  priceImpact: string;
  route: string[];
  gasEstimate: GasEstimate;
  dex: string;
  confidence: number;
}

interface TradePanelProps {
  defaultInputToken?: Token;
  defaultOutputToken?: Token;
  availableTokens?: Token[];
  chain: string;
  walletConnected?: boolean;
  onTrade?: (tradeData: any) => void;
  onTokenSelect?: (token: Token, isInput: boolean) => void;
}

export function TradePanel({
  defaultInputToken,
  defaultOutputToken,
  availableTokens = [],
  chain,
  walletConnected = false,
  onTrade,
  onTokenSelect
}: TradePanelProps) {
  const [inputToken, setInputToken] = useState<Token | null>(defaultInputToken || null);
  const [outputToken, setOutputToken] = useState<Token | null>(defaultOutputToken || null);
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [deadline, setDeadline] = useState<number>(20); // minutes
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [priceInverted, setPriceInverted] = useState(false);
  const [autoSlippage, setAutoSlippage] = useState(true);
  const [expertMode, setExpertMode] = useState(false);
  const [multihop, setMultihop] = useState(true);

  // Mock token list
  const defaultTokens: Token[] = [
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      balance: '2.5847',
      price: 2300
    },
    {
      address: '0xA0b86a33E6441e27a4E54E7cb03FA3a84F8C0F4F',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      balance: '5000.00',
      price: 1
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      balance: '1250.50',
      price: 1
    }
  ];

  const tokenList = useMemo(() => 
    availableTokens.length > 0 ? availableTokens : defaultTokens, 
    [availableTokens]
  );

  // Calculate output amount based on input
  useEffect(() => {
    if (!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setSwapQuote(null);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock swap quote calculation
        const inputValue = parseFloat(inputAmount) * (inputToken.price || 1);
        const outputValue = inputValue * 0.997; // 0.3% fee
        const outputAmountCalc = outputValue / (outputToken.price || 1);
        const minimumReceived = outputAmountCalc * (1 - slippage / 100);
        
        const mockQuote: SwapQuote = {
          inputAmount,
          outputAmount: outputAmountCalc.toFixed(6),
          minimumReceived: minimumReceived.toFixed(6),
          priceImpact: '0.12',
          route: ['Uniswap V3', 'SushiSwap'],
          gasEstimate: {
            gasLimit: '150000',
            gasPrice: '20000000000',
            totalCost: '3000000000000000',
            totalCostFormatted: '0.003 ETH'
          },
          dex: 'Uniswap V3',
          confidence: 95
        };

        setSwapQuote(mockQuote);
        setOutputAmount(mockQuote.outputAmount);
        
        // Auto-adjust slippage if enabled
        if (autoSlippage) {
          const suggestedSlippage = Math.max(0.1, parseFloat(mockQuote.priceImpact) * 2);
          setSlippage(Math.min(suggestedSlippage, 5));
        }
      } catch (error) {
        console.error('Failed to fetch quote:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [inputAmount, inputToken, outputToken, slippage, autoSlippage]);

  // Swap input and output tokens
  const handleSwapTokens = () => {
    const tempToken = inputToken;
    setInputToken(outputToken);
    setOutputToken(tempToken);
    setInputAmount(outputAmount);
    setOutputAmount('');
    setPriceInverted(!priceInverted);
  };

  // Handle max button click
  const handleMaxClick = () => {
    if (inputToken?.balance) {
      const maxAmount = parseFloat(inputToken.balance);
      // Reserve some ETH for gas if it's the native token
      const reserveAmount = inputToken.symbol === 'ETH' ? 0.01 : 0;
      setInputAmount(Math.max(0, maxAmount - reserveAmount).toString());
    }
  };

  // Calculate price per token
  const calculatePrice = () => {
    if (!inputAmount || !outputAmount || parseFloat(inputAmount) === 0) return null;
    
    const inputValue = parseFloat(inputAmount);
    const outputValue = parseFloat(outputAmount);
    
    if (priceInverted) {
      return {
        price: (inputValue / outputValue).toFixed(6),
        inputSymbol: inputToken?.symbol || '',
        outputSymbol: outputToken?.symbol || ''
      };
    } else {
      return {
        price: (outputValue / inputValue).toFixed(6),
        inputSymbol: outputToken?.symbol || '',
        outputSymbol: inputToken?.symbol || ''
      };
    }
  };

  // Validate trade
  const validateTrade = () => {
    if (!walletConnected) return { isValid: false, error: 'Wallet not connected' };
    if (!inputToken || !outputToken) return { isValid: false, error: 'Select tokens' };
    if (!inputAmount || parseFloat(inputAmount) <= 0) return { isValid: false, error: 'Enter amount' };
    if (inputToken.balance && parseFloat(inputAmount) > parseFloat(inputToken.balance)) {
      return { isValid: false, error: 'Insufficient balance' };
    }
    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      return { isValid: false, error: 'Enter limit price' };
    }
    return { isValid: true, error: null };
  };

  const validation = validateTrade();
  const price = calculatePrice();

  // Handle trade execution
  const handleTrade = async () => {
    if (!validation.isValid) return;

    setIsLoading(true);
    try {
      const tradeData = {
        inputToken,
        outputToken,
        inputAmount,
        outputAmount,
        orderType,
        limitPrice: orderType === 'limit' ? limitPrice : null,
        slippage,
        deadline,
        swapQuote,
        chain
      };

      await onTrade?.(tradeData);
    } catch (error) {
      console.error('Trade failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Token selector component
  const TokenSelector = ({ 
    token, 
    onSelect, 
    label,
    isInput = true 
  }: { 
    token: Token | null; 
    onSelect: () => void; 
    label: string;
    isInput?: boolean;
  }) => (
    <div className="space-y-2">
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
        {isInput ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
        <span>{label}</span>
        {isInput && <div title="Protected by slippage"><Shield className="w-4 h-4 text-green-400" /></div>}
      </label>
      <button
        onClick={onSelect}
        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors"
      >
        {token ? (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {token.symbol.charAt(0)}
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-white">{token.symbol}</span>
                                 {isInput && <div title="Input token"><Zap className="w-3 h-3 text-yellow-400" /></div>}
              </div>
              <div className="text-sm text-gray-400">{token.name}</div>
            </div>
            {token.balance && isInput && (
              <div className="ml-auto text-right">
                <div className="text-sm text-gray-300">
                  Balance: {parseFloat(token.balance).toFixed(4)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <span>Select from {tokenList.length} tokens</span>
          </div>
        )}
      </button>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Trade</h2>
        <div className="flex items-center space-x-2">
          {/* Order Type Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setOrderType('market')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                orderType === 'market'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType('limit')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                orderType === 'limit'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Limit
            </button>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-750 rounded-lg border border-gray-600 space-y-4">
          <h3 className="text-lg font-semibold text-white">Trade Settings</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                <Sliders className="w-4 h-4" />
                <span>Slippage Tolerance</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                  step="0.1"
                  min="0.1"
                  max="50"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
                <span className="text-gray-400">%</span>
              </div>
              <label className="flex items-center mt-2">
                <input
                  type="checkbox"
                  checked={autoSlippage}
                  onChange={(e) => setAutoSlippage(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-300">Auto</span>
              </label>
            </div>

            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                <Clock className="w-4 h-4" />
                <span>Transaction Deadline</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={deadline}
                  onChange={(e) => setDeadline(parseInt(e.target.value) || 20)}
                  min="1"
                  max="180"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
                <span className="text-gray-400">min</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Enable Multihop</span>
              <input
                type="checkbox"
                checked={multihop}
                onChange={(e) => setMultihop(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-blue-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Expert Mode</span>
              <input
                type="checkbox"
                checked={expertMode}
                onChange={(e) => setExpertMode(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-blue-600"
              />
            </label>
          </div>
        </div>
      )}

      {/* Token Selection */}
      <div className="space-y-4">
        <TokenSelector
          token={inputToken}
          onSelect={() => onTokenSelect?.(inputToken!, true)}
          label="From"
          isInput={true}
        />

        <div className="flex justify-center">
          <button
            onClick={handleSwapTokens}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <ArrowUpDown className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <TokenSelector
          token={outputToken}
          onSelect={() => onTokenSelect?.(outputToken!, false)}
          label="To"
          isInput={false}
        />
      </div>

      {/* Amount Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-white text-lg font-mono pr-16"
            />
            {inputToken?.balance && (
              <button
                onClick={handleMaxClick}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                MAX
              </button>
            )}
          </div>
        </div>

        {/* Limit Price (for limit orders) */}
        {orderType === 'limit' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Limit Price
            </label>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.0"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-white text-lg font-mono"
            />
          </div>
        )}

        {/* Output Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            You receive (estimated)
          </label>
          <div className="relative">
            <input
              type="text"
              value={outputAmount}
              readOnly
              placeholder="0.0"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-white text-lg font-mono"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price Information */}
      {price && (
        <div className="bg-gray-750 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Price</span>
            <button
              onClick={() => setPriceInverted(!priceInverted)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
          <div className="text-white font-mono">
            1 {price.outputSymbol} = {price.price} {price.inputSymbol}
          </div>
        </div>
      )}

      {/* Swap Details */}
      {swapQuote && (
        <div className="bg-gray-750 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-white">Swap Details</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Minimum received</span>
              <span className="text-white font-mono">
                {swapQuote.minimumReceived} {outputToken?.symbol}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Price Impact</span>
              <span className={`font-mono ${
                parseFloat(swapQuote.priceImpact) > 3 
                  ? 'text-red-400' 
                  : parseFloat(swapQuote.priceImpact) > 1 
                  ? 'text-yellow-400' 
                  : 'text-green-400'
              }`}>
                {swapQuote.priceImpact}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Liquidity Source</span>
              <span className="text-white">{swapQuote.dex}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Network fee</span>
              <span className="text-white font-mono">
                {swapQuote.gasEstimate.totalCostFormatted}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Route</span>
              <span className="text-white text-right">
                {swapQuote.route.join(' → ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {swapQuote && parseFloat(swapQuote.priceImpact) > 3 && (
        <div className="flex items-center space-x-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div className="text-sm text-yellow-200">
            High price impact. Consider reducing trade size.
          </div>
        </div>
      )}

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={!validation.isValid || isLoading}
        className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors ${
          validation.isValid && !isLoading
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </div>
        ) : validation.error ? (
          validation.error
        ) : orderType === 'limit' ? (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Place Limit Order</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Swap</span>
          </div>
        )}
      </button>

      {/* Additional Info */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>
          By trading, you agree to our terms of service and acknowledge the risks involved.
        </p>
        {expertMode && (
          <p className="text-yellow-400">
            ⚠️ Expert mode enabled - additional features unlocked
          </p>
        )}
      </div>
    </div>
  );
}
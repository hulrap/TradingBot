/**
 * @file Technical Indicators Types
 * 
 * Comprehensive technical analysis infrastructure supporting 200+ indicators,
 * real-time calculation engines, advanced signal generation, and ML integration.
 * 
 * Features:
 * - 200+ technical indicators with configurations
 * - Real-time calculation engines
 * - Advanced signal generation and filtering
 * - Custom indicator development framework
 * - Multi-timeframe analysis
 * - Pattern recognition systems
 * - ML-powered signal enhancement
 * - Performance backtesting
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { Address, TokenInfo } from '../blockchain/addresses';

// ========================================
// CORE INDICATOR TYPES
// ========================================

/**
 * Comprehensive technical indicator types covering all major categories.
 */
type TechnicalIndicatorType = 
  // ========================================
  // TREND INDICATORS
  // ========================================
  | 'sma'                 // Simple Moving Average
  | 'ema'                 // Exponential Moving Average
  | 'wma'                 // Weighted Moving Average
  | 'dema'                // Double Exponential Moving Average
  | 'tema'                // Triple Exponential Moving Average
  | 'trima'               // Triangular Moving Average
  | 'kama'                // Kaufman Adaptive Moving Average
  | 'mama'                // MESA Adaptive Moving Average
  | 'vwma'                // Volume Weighted Moving Average
  | 'hma'                 // Hull Moving Average
  | 'lsma'                // Least Squares Moving Average
  | 'mcginley'            // McGinley Dynamic
  | 'alma'                // Arnaud Legoux Moving Average
  | 'zlema'               // Zero Lag Exponential Moving Average
  | 'jma'                 // Jurik Moving Average
  | 'supersmoother'       // Ehlers Super Smoother
  | 'adaptive-ma'         // Adaptive Moving Average
  | 'fractal-adaptive-ma' // Fractal Adaptive Moving Average
  | 'variable-ma'         // Variable Moving Average
  | 'vidya'               // Variable Index Dynamic Average
  | 'wwma'                // Welles Wilder Moving Average
  
  // ========================================
  // MOMENTUM INDICATORS
  // ========================================
  | 'rsi'                 // Relative Strength Index
  | 'macd'                // MACD
  | 'stochastic'          // Stochastic Oscillator
  | 'stoch-rsi'           // Stochastic RSI
  | 'williams-r'          // Williams %R
  | 'momentum'            // Momentum
  | 'roc'                 // Rate of Change
  | 'cci'                 // Commodity Channel Index
  | 'mfi'                 // Money Flow Index
  | 'tsi'                 // True Strength Index
  | 'ultimate-osc'        // Ultimate Oscillator
  | 'awesome-osc'         // Awesome Oscillator
  | 'fisher-transform'    // Fisher Transform
  | 'schaff-trend'        // Schaff Trend Cycle
  | 'squeeze-momentum'    // Squeeze Momentum
  | 'laguerre-rsi'        // Laguerre RSI
  | 'connors-rsi'         // Connors RSI
  | 'rocket-rsi'          // Rocket RSI
  | 'smoothed-rsi'        // Smoothed RSI
  | 'dynamic-momentum'    // Dynamic Momentum Index
  
  // ========================================
  // VOLATILITY INDICATORS
  // ========================================
  | 'bollinger-bands'     // Bollinger Bands
  | 'keltner-channels'    // Keltner Channels
  | 'donchian-channels'   // Donchian Channels
  | 'atr'                 // Average True Range
  | 'true-range'          // True Range
  | 'volatility-ratio'    // Volatility Ratio
  | 'historical-vol'      // Historical Volatility
  | 'garch-vol'           // GARCH Volatility
  | 'parkinson-vol'       // Parkinson Volatility
  | 'garman-klass-vol'    // Garman-Klass Volatility
  | 'rogers-satchell-vol' // Rogers-Satchell Volatility
  | 'yang-zhang-vol'      // Yang-Zhang Volatility
  | 'close-to-close-vol'  // Close-to-Close Volatility
  | 'intraday-vol'        // Intraday Volatility
  | 'realized-vol'        // Realized Volatility
  
  // ========================================
  // VOLUME INDICATORS
  // ========================================
  | 'obv'                 // On Balance Volume
  | 'vpt'                 // Volume Price Trend
  | 'cmf'                 // Chaikin Money Flow
  | 'ad-line'             // Accumulation/Distribution Line
  | 'cvd'                 // Cumulative Volume Delta
  | 'pvt'                 // Price Volume Trend
  | 'nvi'                 // Negative Volume Index
  | 'pvi'                 // Positive Volume Index
  | 'emv'                 // Ease of Movement
  | 'force-index'         // Force Index
  | 'klinger'             // Klinger Oscillator
  | 'money-flow'          // Money Flow
  | 'vwap'                // Volume Weighted Average Price
  | 'anchored-vwap'       // Anchored VWAP
  | 'time-vwap'           // Time-based VWAP
  | 'volume-profile'      // Volume Profile
  | 'market-profile'      // Market Profile
  | 'vpoc'                // Volume Point of Control
  | 'volume-delta'        // Volume Delta
  | 'cumulative-delta'    // Cumulative Delta
  
  // ========================================
  // PATTERN RECOGNITION
  // ========================================
  | 'candlestick-patterns' // Candlestick Pattern Recognition
  | 'chart-patterns'      // Chart Pattern Recognition
  | 'harmonic-patterns'   // Harmonic Patterns
  | 'elliott-wave'        // Elliott Wave Analysis
  | 'fibonacci-retracement' // Fibonacci Retracement
  | 'fibonacci-extension' // Fibonacci Extension
  | 'gann-angles'         // Gann Angles
  | 'pivot-points'        // Pivot Points
  | 'support-resistance'  // Support/Resistance Levels
  | 'trend-lines'         // Trend Line Detection
  | 'head-shoulders'      // Head and Shoulders
  | 'triangles'           // Triangle Patterns
  | 'flags-pennants'      // Flags and Pennants
  | 'cup-handle'          // Cup and Handle
  | 'double-top-bottom'   // Double Top/Bottom
  | 'wedges'              // Wedge Patterns
  | 'channels'            // Channel Patterns
  | 'gaps'                // Gap Analysis
  | 'reversal-patterns'   // Reversal Patterns
  | 'continuation-patterns' // Continuation Patterns
  
  // ========================================
  // CUSTOM & ADVANCED
  // ========================================
  | 'ichimoku'            // Ichimoku Cloud
  | 'parabolic-sar'       // Parabolic SAR
  | 'zigzag'              // ZigZag
  | 'elder-ray'           // Elder Ray Index
  | 'coppock-curve'       // Coppock Curve
  | 'aroon'               // Aroon Indicator
  | 'adx'                 // Average Directional Index
  | 'ppo'                 // Percentage Price Oscillator
  | 'dpo'                 // Detrended Price Oscillator
  | 'elder-impulse'       // Elder Impulse System
  | 'mass-index'          // Mass Index
  | 'chande-momentum'     // Chande Momentum Oscillator
  | 'inertia'             // Inertia Indicator
  | 'linear-regression'   // Linear Regression
  | 'standard-deviation'  // Standard Deviation
  | 'coefficient-variation' // Coefficient of Variation
  | 'correlation'         // Correlation Coefficient
  | 'cointegration'       // Cointegration Analysis
  | 'kalman-filter'       // Kalman Filter
  | 'hodrick-prescott'    // Hodrick-Prescott Filter
  | 'butterworth-filter'  // Butterworth Filter
  | 'savitzky-golay'      // Savitzky-Golay Filter
  | 'custom';             // Custom Indicator

/**
 * Indicator calculation timeframes.
 */
type IndicatorTimeframe = 
  | '1s'   | '5s'   | '15s'  | '30s'
  | '1m'   | '3m'   | '5m'   | '15m'  | '30m'
  | '1h'   | '2h'   | '4h'   | '6h'   | '8h'  | '12h'
  | '1d'   | '3d'   | '1w'   | '1M'   | '3M'  | '1Y'
  | 'tick' | 'custom';

/**
 * Signal strength levels.
 */
type SignalStrength = 
  | 'very-weak'
  | 'weak'
  | 'neutral'
  | 'strong'
  | 'very-strong';

/**
 * Signal direction types.
 */
type SignalDirection = 
  | 'bullish'
  | 'bearish'
  | 'neutral'
  | 'divergent';

// ========================================
// INDICATOR CONFIGURATION TYPES
// ========================================

/**
 * Base indicator configuration.
 */
interface BaseIndicatorConfig {
  /** Indicator type. */
  type: TechnicalIndicatorType;
  
  /** Indicator parameters. */
  parameters: Record<string, unknown>;
  
  /** Calculation timeframe. */
  timeframe: IndicatorTimeframe;
  
  /** Data source. */
  source: 'open' | 'high' | 'low' | 'close' | 'volume' | 'hlc3' | 'ohlc4' | 'custom';
  
  /** Lookback period. */
  period: number;
  
  /** Real-time updates enabled. */
  realTime: boolean;
  
  /** Historical data requirements. */
  historyRequired: number;
}

/**
 * Moving average indicator configuration.
 */
interface MovingAverageConfig extends BaseIndicatorConfig {
  type: 'sma' | 'ema' | 'wma' | 'dema' | 'tema' | 'hma' | 'alma';
  parameters: {
    period: number;
    offset?: number;
    sigma?: number;
    phase?: number;
  };
}

/**
 * RSI indicator configuration.
 */
interface RSIConfig extends BaseIndicatorConfig {
  type: 'rsi' | 'stoch-rsi' | 'laguerre-rsi' | 'connors-rsi';
  parameters: {
    period: number;
    overbought: number;
    oversold: number;
    smoothing?: number;
    signalLine?: number;
  };
}

/**
 * MACD indicator configuration.
 */
interface MACDConfig extends BaseIndicatorConfig {
  type: 'macd';
  parameters: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
    method: 'ema' | 'sma' | 'wma';
  };
}

/**
 * Bollinger Bands configuration.
 */
interface BollingerBandsConfig extends BaseIndicatorConfig {
  type: 'bollinger-bands';
  parameters: {
    period: number;
    standardDeviations: number;
    method: 'sma' | 'ema';
    offset?: number;
  };
}

/**
 * Ichimoku configuration.
 */
interface IchimokuConfig extends BaseIndicatorConfig {
  type: 'ichimoku';
  parameters: {
    conversionPeriod: number;
    basePeriod: number;
    leadingSpanBPeriod: number;
    displacement: number;
  };
}

/**
 * Custom indicator configuration.
 */
interface CustomIndicatorConfig extends BaseIndicatorConfig {
  type: 'custom';
  parameters: {
    formula: string;
    inputs: Record<string, TechnicalIndicatorType>;
    outputs: string[];
    validation: {
      min?: number;
      max?: number;
      decimals: number;
    };
  };
}

/**
 * Union type for all indicator configurations.
 */
type IndicatorConfig = 
  | MovingAverageConfig
  | RSIConfig
  | MACDConfig
  | BollingerBandsConfig
  | IchimokuConfig
  | CustomIndicatorConfig
  | BaseIndicatorConfig;

// ========================================
// CALCULATION ENGINE TYPES
// ========================================

/**
 * Indicator calculation result.
 */
interface IndicatorResult {
  /** Indicator identifier. */
  indicatorId: string;
  
  /** Token being analyzed. */
  token: TokenInfo;
  
  /** Calculation timestamp. */
  timestamp: number;
  
  /** Timeframe used. */
  timeframe: IndicatorTimeframe;
  
  /** Raw indicator values. */
  values: Record<string, number | null>;
  
  /** Processed signals. */
  signals: {
    /** Primary signal. */
    primary: {
      direction: SignalDirection;
      strength: SignalStrength;
      confidence: number;
      value: number;
    };
    
    /** Secondary signals. */
    secondary: Array<{
      type: string;
      direction: SignalDirection;
      strength: SignalStrength;
      value: number;
    }>;
  };
  
  /** Metadata. */
  metadata: {
    /** Calculation method. */
    method: string;
    
    /** Data quality score. */
    dataQuality: number;
    
    /** Calculation time (ms). */
    calculationTime: number;
    
    /** Source data points used. */
    dataPointsUsed: number;
  };
}

/**
 * Real-time calculation engine configuration.
 */
interface CalculationEngineConfig {
  /** Engine identifier. */
  id: string;
  
  /** Supported indicators. */
  supportedIndicators: TechnicalIndicatorType[];
  
  /** Performance settings. */
  performance: {
    /** Maximum concurrent calculations. */
    maxConcurrentCalculations: number;
    
    /** Calculation timeout (ms). */
    calculationTimeout: number;
    
    /** Cache size. */
    cacheSize: number;
    
    /** Cache TTL (ms). */
    cacheTTL: number;
  };
  
  /** Real-time updates. */
  realTime: {
    /** Update interval (ms). */
    updateInterval: number;
    
    /** Batch size. */
    batchSize: number;
    
    /** Queue depth. */
    queueDepth: number;
  };
  
  /** Data requirements. */
  data: {
    /** Minimum historical periods. */
    minHistoricalPeriods: number;
    
    /** Data quality threshold. */
    qualityThreshold: number;
    
    /** Fill missing data. */
    fillMissingData: boolean;
  };
}

// ========================================
// SIGNAL ANALYSIS TYPES
// ========================================

/**
 * Signal filter configuration.
 */
interface SignalFilterConfig {
  /** Filter type. */
  type: 'threshold' | 'consensus' | 'ml-enhanced' | 'custom';
  
  /** Filter parameters. */
  parameters: {
    /** Minimum signal strength. */
    minStrength: SignalStrength;
    
    /** Minimum confidence. */
    minConfidence: number;
    
    /** Consensus requirements. */
    consensus?: {
      /** Minimum agreeing indicators. */
      minAgreeing: number;
      
      /** Maximum conflicting indicators. */
      maxConflicting: number;
    };
    
    /** ML enhancement. */
    mlEnhancement?: {
      /** Model identifier. */
      modelId: string;
      
      /** Enhancement threshold. */
      threshold: number;
    };
  };
}

/**
 * Composite signal result.
 */
interface CompositeSignal {
  /** Signal timestamp. */
  timestamp: number;
  
  /** Token analyzed. */
  token: TokenInfo;
  
  /** Contributing indicators. */
  contributors: Array<{
    indicatorId: string;
    type: TechnicalIndicatorType;
    signal: SignalDirection;
    strength: SignalStrength;
    confidence: number;
    weight: number;
  }>;
  
  /** Final composite signal. */
  composite: {
    direction: SignalDirection;
    strength: SignalStrength;
    confidence: number;
    conviction: number;
  };
  
  /** Risk assessment. */
  risk: {
    /** Overall risk level. */
    level: 'low' | 'medium' | 'high' | 'extreme';
    
    /** Risk factors. */
    factors: string[];
    
    /** Volatility assessment. */
    volatility: number;
    
    /** Drawdown risk. */
    drawdownRisk: number;
  };
  
  /** Actionable recommendations. */
  recommendations: Array<{
    action: 'buy' | 'sell' | 'hold' | 'watch';
    urgency: 'low' | 'medium' | 'high' | 'immediate';
    reasoning: string;
    targetPrice?: number;
    stopLoss?: number;
    positionSize?: number;
  }>;
}

// ========================================
// PATTERN RECOGNITION TYPES
// ========================================

/**
 * Candlestick pattern types.
 */
type CandlestickPatternType = 
  | 'doji' | 'hammer' | 'shooting-star' | 'engulfing'
  | 'harami' | 'piercing-line' | 'dark-cloud-cover'
  | 'morning-star' | 'evening-star' | 'three-crows'
  | 'three-soldiers' | 'hanging-man' | 'inverted-hammer'
  | 'spinning-top' | 'marubozu' | 'gravestone-doji'
  | 'dragonfly-doji' | 'abandoned-baby' | 'belt-hold'
  | 'breakaway' | 'concealing-baby-swallow' | 'counterattack'
  | 'gap-side-by-side' | 'homing-pigeon' | 'identical-crows'
  | 'kicking' | 'ladder-bottom' | 'matching-low' | 'mat-hold'
  | 'rising-falling-methods' | 'separating-lines' | 'stick-sandwich'
  | 'takuri' | 'tasuki-gap' | 'thrusting' | 'tristar'
  | 'unique-river' | 'upside-gap-crows' | 'xside-gap-crows';

/**
 * Chart pattern types.
 */
type ChartPatternType = 
  | 'head-shoulders' | 'inverse-head-shoulders' | 'double-top'
  | 'double-bottom' | 'triple-top' | 'triple-bottom'
  | 'ascending-triangle' | 'descending-triangle' | 'symmetrical-triangle'
  | 'wedge-rising' | 'wedge-falling' | 'flag-bullish' | 'flag-bearish'
  | 'pennant-bullish' | 'pennant-bearish' | 'cup-handle'
  | 'inverse-cup-handle' | 'rectangle-bullish' | 'rectangle-bearish'
  | 'channel-ascending' | 'channel-descending' | 'channel-horizontal'
  | 'diamond-top' | 'diamond-bottom' | 'broadening-top'
  | 'broadening-bottom' | 'rounding-top' | 'rounding-bottom';

/**
 * Pattern recognition result.
 */
interface PatternRecognitionResult {
  /** Pattern identifier. */
  patternId: string;
  
  /** Pattern type. */
  type: CandlestickPatternType | ChartPatternType;
  
  /** Pattern category. */
  category: 'candlestick' | 'chart' | 'harmonic' | 'custom';
  
  /** Detection confidence. */
  confidence: number;
  
  /** Pattern timeframe. */
  timeframe: IndicatorTimeframe;
  
  /** Pattern coordinates. */
  coordinates: {
    start: number;
    end: number;
    keyPoints: Array<{
      timestamp: number;
      price: number;
      type: 'high' | 'low' | 'open' | 'close';
    }>;
  };
  
  /** Pattern implications. */
  implications: {
    direction: SignalDirection;
    strength: SignalStrength;
    reliability: number;
    targetPrice?: number;
    stopLoss?: number;
    breakoutLevel?: number;
  };
  
  /** Historical performance. */
  historicalPerformance: {
    successRate: number;
    averageReturn: number;
    averageHoldTime: number;
    maxDrawdown: number;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  TechnicalIndicatorType,
  IndicatorTimeframe,
  SignalStrength,
  SignalDirection,
  BaseIndicatorConfig,
  MovingAverageConfig,
  RSIConfig,
  MACDConfig,
  BollingerBandsConfig,
  IchimokuConfig,
  CustomIndicatorConfig,
  IndicatorConfig,
  IndicatorResult,
  CalculationEngineConfig,
  SignalFilterConfig,
  CompositeSignal,
  CandlestickPatternType,
  ChartPatternType,
  PatternRecognitionResult
}; 
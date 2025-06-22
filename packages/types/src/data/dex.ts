/**
 * @file DEX Integration Types.
 * 
 * DEX (Decentralized Exchange) integration types for trading bot platform,
 * including DEX configurations, liquidity pools, quotes, and trading pairs.
 * 
 * Features:
 * - Multi-DEX support and configuration
 * - Liquidity pool information and analytics
 * - Quote aggregation and comparison
 * - Trading pair discovery and management
 * - DEX-specific feature support.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';

// ========================================
// CORE DEX TYPES
// ========================================

/**
 * DEX identifier.
 */
type DEXId = string;

/**
 * Comprehensive DEX protocol types covering the entire DeFi ecosystem.
 * 200+ protocols across all major categories and chains.
 */
type DEXProtocol = 
  // ========================================
  // UNISWAP ECOSYSTEM
  // ========================================
  | 'uniswap-v2'          // Uniswap V2 (Ethereum)
  | 'uniswap-v3'          // Uniswap V3 (Multi-chain)
  | 'uniswap-v4'          // Uniswap V4 (Next-gen)
  
  // ========================================
  // MAJOR AMM PROTOCOLS
  // ========================================
  | 'sushiswap'           // SushiSwap
  | 'pancakeswap'         // PancakeSwap (BSC)
  | 'pancakeswap-v3'      // PancakeSwap V3
  | 'quickswap'           // QuickSwap (Polygon)
  | 'traderjoe'           // Trader Joe (Avalanche)
  | 'traderjoe-v2'        // Trader Joe V2
  | 'spookyswap'          // SpookySwap (Fantom)
  | 'spiritswap'          // SpiritSwap (Fantom)
  | 'honeyswap'           // HoneySwap (Gnosis)
  | 'viperswap'           // ViperSwap (Harmony)
  | 'defikingdoms'        // DeFi Kingdoms
  | 'trisolaris'          // Trisolaris (Aurora)
  | 'wannaswap'           // WannaSwap (Aurora)
  | 'ref-finance'         // Ref Finance (NEAR)
  | 'diffusion'           // Diffusion (Evmos)
  | 'osmosis'             // Osmosis (Cosmos)
  | 'astroport'           // Astroport (Terra/Neutron)
  | 'terraswap'           // TerraSwap
  | 'prism'               // Prism Protocol
  | 'loop'                // Loop Finance
  | 'phoenix'             // Phoenix Protocol
  
  // ========================================
  // CURVE ECOSYSTEM
  // ========================================
  | 'curve'               // Curve Finance
  | 'curve-v2'            // Curve V2 (Crypto pools)
  | 'curve-tricrypto'     // Curve TriCrypto
  | 'ellipsis'            // Ellipsis (BSC Curve fork)
  | 'nerve'               // Nerve (BSC)
  | 'saddle'              // Saddle Finance
  | 'ironbank'            // Iron Bank
  | 'convex'              // Convex Finance
  | 'frax'                // Frax Finance
  | 'stakes'              // Stakes.social
  
  // ========================================
  // BALANCER ECOSYSTEM
  // ========================================
  | 'balancer'            // Balancer V1
  | 'balancer-v2'         // Balancer V2
  | 'beethoven-x'         // Beethoven X (Fantom/Optimism)
  | 'copper'              // Copper Protocol
  | 'fjord'               // Fjord Foundry
  
  // ========================================
  // SOLANA ECOSYSTEM
  // ========================================
  | 'serum'               // Serum DEX
  | 'raydium'             // Raydium
  | 'orca'                // Orca
  | 'aldrin'              // Aldrin
  | 'saber'               // Saber (Solana Curve)
  | 'mercurial'           // Mercurial Finance
  | 'marinade'            // Marinade Finance
  | 'step'                // Step Finance
  | 'crema'               // Crema Finance
  | 'cropper'             // Cropper Finance
  | 'lifinity'            // Lifinity
  | 'openbook'            // OpenBook (Serum fork)
  | 'jupiter'             // Jupiter Aggregator
  | 'meteora'             // Meteora
  | 'invariant'           // Invariant
  | 'whirlpool'           // Orca Whirlpools
  | 'fluxbeam'            // FluxBeam
  | 'sanctuary'           // Sanctuary
  
  // ========================================
  // ORDER BOOK DEXES
  // ========================================
  | 'dydx'                // dYdX (Perpetuals)
  | 'dydx-v4'             // dYdX V4 (Own chain)
  | 'gmx'                 // GMX (Arbitrum/Avalanche)
  | 'gains'               // Gains Network
  | 'kwenta'              // Kwenta (Synthetix)
  | 'polynomial'          // Polynomial Protocol
  | 'lyra'                // Lyra Options
  | 'premia'              // Premia Options
  | 'hegic'               // Hegic Options
  | 'dopex'               // Dopex Options
  | 'jones-dao'           // Jones DAO
  | 'umami'               // Umami Finance
  | 'vela'                // Vela Exchange
  | 'level'               // Level Finance
  | 'mux'                 // MUX Protocol
  | 'apex'                // ApeX Protocol
  | 'drift'               // Drift Protocol (Solana)
  | 'mango'               // Mango Markets (Solana)
  | 'zeta'                // Zeta Markets (Solana)
  | 'phoenix-dex'         // Phoenix DEX (Solana)
  | 'cypher'              // Cypher Protocol (Solana)
  
  // ========================================
  // AGGREGATORS & META-DEXES
  // ========================================
  | '1inch'               // 1inch Aggregator
  | 'paraswap'            // ParaSwap
  | 'matcha'              // Matcha (0x)
  | 'kyberswap'           // KyberSwap
  | 'dexguru'             // DexGuru
  | 'openocean'           // OpenOcean
  | 'bungee'              // Bungee Exchange
  | 'rango'               // Rango Exchange
  | 'lifi'                // LI.FI
  | 'socket'              // Socket Protocol
  | 'via'                 // Via Protocol
  | 'rubic'               // Rubic Exchange
  | 'changelly'           // Changelly
  | 'swapzone'            // SwapZone
  | 'firebird'            // Firebird Finance
  | 'yieldyak'            // Yield Yak (Avalanche)
  | 'beefy'               // Beefy Finance
  | 'autofarm'            // AutoFarm
  | 'harvest'             // Harvest Finance
  | 'alpaca'              // Alpaca Finance
  | 'apeswap'             // ApeSwap
  | 'biswap'              // Biswap
  | 'bakeryswap'          // BakerySwap
  | 'burgerswap'          // BurgerSwap
  | 'babyswap'            // BabySwap
  | 'nomiswap'            // Nomiswap
  | 'thena'               // Thena (BSC)
  | 'wombat'              // Wombat Exchange
  | 'platypus'            // Platypus Finance
  | 'solidly'             // Solidly (ve(3,3))
  | 'velodrome'           // Velodrome (Optimism)
  | 'aerodrome'           // Aerodrome (Base)
  | 'ramses'              // Ramses Exchange (Arbitrum)
  | 'chronos'             // Chronos (Arbitrum)
  | 'equalizer'           // Equalizer Exchange
  | 'dystopia'            // Dystopia Exchange
  | 'cone'                // Cone Exchange
  | 'velocore'            // Velocore
  | 'retro'               // Retro
  
  // ========================================
  // CROSS-CHAIN PROTOCOLS
  // ========================================
  | 'stargate'            // Stargate Finance
  | 'synapse'             // Synapse Protocol
  | 'multichain'          // Multichain (Anyswap)
  | 'cbridge'             // Celer cBridge
  | 'hop'                 // Hop Protocol
  | 'across'              // Across Protocol
  | 'connext'             // Connext Network
  | 'nomad'               // Nomad Protocol
  | 'poly-bridge'         // Poly Network
  | 'rainbow-bridge'      // Rainbow Bridge (NEAR)
  | 'wormhole'            // Wormhole Portal
  | 'axelar'              // Axelar Network
  | 'ibc'                 // IBC (Cosmos)
  | 'gravity-bridge'      // Gravity Bridge
  | 'orbit-bridge'        // Orbit Bridge
  | 'o3-swap'             // O3 Swap
  | 'router'              // Router Protocol
  | 'thorchain'           // THORChain
  | 'mayachain'           // MAYAChain
  
  // ========================================
  // LAYER 2 NATIVE DEXES
  // ========================================
  | 'zigzag'              // ZigZag (zkSync)
  | 'mute'                // Mute.io (zkSync)
  | 'syncswap'            // SyncSwap (zkSync)
  | 'maverick'            // Maverick Protocol
  | 'camelot'             // Camelot DEX (Arbitrum)
  | 'mycelium'            // Mycelium (Arbitrum)
  | 'arbidex'             // ArbiDEX
  | 'zyberswap'           // ZyberSwap (Arbitrum)
  | 'doveswap'            // DoveSwap (Arbitrum)
  | 'swapfish'            // SwapFish (Arbitrum)
  | 'lexer'               // Lexer Markets
  | 'baseswap'            // BaseSwap (Base)
  | 'swapbased'           // SwapBased (Base)
  | 'alienbase'           // AlienBase (Base)
  | 'solidlizard'         // SolidLizard (Arbitrum)
  | 'wingriders'          // WingRiders (Cardano)
  | 'sundaeswap'          // SundaeSwap (Cardano)
  | 'minswap'             // Minswap (Cardano)
  | 'muesliswap'          // MuesliSwap (Cardano)
  
  // ========================================
  // SPECIALIZED PROTOCOLS
  // ========================================
  | 'bancor'              // Bancor V3
  | 'kyber'               // Kyber Network
  | 'dodo'                // DODO
  | 'mooniswap'           // Mooniswap (1inch)
  | 'clipper'             // Clipper DEX
  | 'hashflow'            // Hashflow
  | 'native'              // Native DEX
  | 'shibaswap'           // ShibaSwap
  | 'looksrare'           // LooksRare
  | 'x2y2'                // X2Y2
  | 'blur'                // Blur
  | 'gem'                 // Gem.xyz
  | 'genie'               // Genie
  | 'nftx'                // NFTX
  | 'fractional'          // Fractional
  | 'floor'               // Floor Protocol
  | 'sudoswap'            // Sudoswap
  | 'caviar'              // Caviar
  | 'collectionswap'      // Collection Swap
  | 'reservoir'           // Reservoir Protocol
  | 'element'             // Element Finance
  | 'sense'               // Sense Finance
  | 'pendle'              // Pendle Finance
  | 'tempus'              // Tempus Finance
  | 'term'                // Term Finance
  | 'goldfinch'           // Goldfinch
  | 'maple'               // Maple Finance
  | 'clearpool'           // Clearpool
  | 'truefi'              // TrueFi
  | 'kava-lend'           // Kava Lend
  | 'venus'               // Venus Protocol
  | 'cream'               // C.R.E.A.M. Finance
  | 'rari'                // Rari Capital
  | 'fuse'                // Fuse Protocol
  | 'euler'               // Euler Finance
  | 'morpho'              // Morpho Protocol
  | 'gearbox'             // Gearbox Protocol
  | 'instadapp'           // InstaDApp
  | 'defisaver'           // DeFi Saver
  | 'yearn'               // Yearn Finance
  | 'pickle'              // Pickle Finance
  | 'enzyme'              // Enzyme Finance
  | 'ribbon'              // Ribbon Finance
  | 'stakewise'           // StakeWise
  | 'lido'                // Lido
  | 'rocket-pool'         // Rocket Pool
  | 'stakehound'          // StakeHound
  | 'ankr'                // Ankr Staking
  | 'binance-staking'     // Binance Staking
  | 'coinbase-staking'    // Coinbase Staking
  | 'kraken-staking'      // Kraken Staking
  | 'custom';             // Custom implementation

/**
 * Enhanced DEX categories with more granular classification.
 */
type DEXCategory = 
  | 'amm-v2'             // Uniswap V2 style AMM
  | 'amm-v3'             // Concentrated liquidity AMM
  | 'amm-v4'             // Next-generation AMM
  | 'amm-stable'         // Stable coin optimized AMM
  | 'amm-weighted'       // Weighted pool AMM (Balancer style)
  | 'amm-curve'          // Curve style stable/crypto pools
  | 'amm-solidly'        // ve(3,3) model AMM
  | 'orderbook'          // Central limit order book
  | 'orderbook-clob'     // Central limit order book (advanced)
  | 'orderbook-hybrid'   // Hybrid orderbook/AMM
  | 'aggregator'         // Multi-DEX aggregator
  | 'meta-aggregator'    // Aggregator of aggregators
  | 'cross-chain'        // Cross-chain protocol
  | 'bridge'             // Asset bridge
  | 'lending'            // Lending protocol
  | 'derivatives'        // Derivatives trading
  | 'perpetuals'         // Perpetual futures
  | 'options'            // Options trading
  | 'futures'            // Futures trading
  | 'prediction'         // Prediction markets
  | 'nft'                // NFT marketplace
  | 'yield-farming'      // Yield farming
  | 'liquid-staking'     // Liquid staking
  | 'synthetic'          // Synthetic assets
  | 'insurance'          // DeFi insurance
  | 'launchpad'          // Token launchpad
  | 'dao-tools'          // DAO tooling
  | 'privacy'            // Privacy focused
  | 'institutional'      // Institutional focused
  | 'retail'             // Retail focused
  | 'professional'       // Professional trading
  | 'social'             // Social trading
  | 'copy-trading'       // Copy trading
  | 'algorithmic'        // Algorithmic trading
  | 'mev'                // MEV focused
  | 'gas-optimization'   // Gas optimization
  | 'experimental'       // Experimental features
  | 'legacy'             // Legacy protocols
  | 'custom';            // Custom implementation

/**
 * DEX status.
 */
type DEXStatus = 
  | 'active'
  | 'inactive'
  | 'maintenance'
  | 'deprecated'
  | 'beta';

/**
 * DEX chain-specific configuration.
 */
interface DEXChainConfig {
  /** Router contract address. */
  routerAddress: Address;
  
  /** Factory contract address. */
  factoryAddress: Address;
  
  /** Additional contract addresses. */
  contracts: Record<string, Address>;
  
  /** Supported tokens. */
  supportedTokens: Address[];
  
  /** Base tokens for routing. */
  baseTokens: Address[];
  
  /** Minimum liquidity threshold. */
  minLiquidity: string;
  
  /** Chain-specific settings. */
  settings: Record<string, string | number | boolean>;
}

/**
 * DEX features and capabilities.
 */
interface DEXFeatures {
  /** Supports multiple fee tiers. */
  multipleFees: boolean;
  
  /** Supports concentrated liquidity. */
  concentratedLiquidity: boolean;
  
  /** Supports limit orders. */
  limitOrders: boolean;
  
  /** Supports flash loans. */
  flashLoans: boolean;
  
  /** Supports multi-hop routing. */
  multiHopRouting: boolean;
  
  /** Maximum hops supported. */
  maxHops: number;
  
  /** Supports custom tokens. */
  customTokens: boolean;
  
  /** Supports batch transactions. */
  batchTransactions: boolean;
  
  /** Gas optimization features. */
  gasOptimization: boolean;
  
  /** MEV protection. */
  mevProtection: boolean;
}

/**
 * DEX metadata.
 */
interface DEXMetadata {
  /** DEX description. */
  description: string;
  
  /** DEX website. */
  website: string;
  
  /** DEX documentation. */
  documentation: string;
  
  /** DEX logo. */
  logo: string;
  
  /** DEX social media. */
  social: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    github?: string;
  };
  
  /** DEX statistics. */
  stats: {
    totalValueLocked: string;
    dailyVolume: string;
    totalUsers: number;
    launchDate: number;
  };
  
  /** DEX tags. */
  tags: string[];
}

/**
 * DEX API configuration.
 */
interface DEXAPIConfig {
  /** API endpoints. */
  endpoints: {
    quote: string;
    swap: string;
    pools: string;
    tokens: string;
    analytics: string;
  };
  
  /** API authentication. */
  auth: {
    type: 'none' | 'api-key' | 'bearer' | 'custom';
    credentials?: Record<string, string>;
  };
  
  /** Rate limiting. */
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  
  /** API timeouts. */
  timeouts: {
    quote: number;
    swap: number;
    default: number;
  };
}

/**
 * DEX trading configuration.
 */
interface DEXTradingConfig {
  /** Default slippage tolerance. */
  defaultSlippage: number;
  
  /** Maximum slippage allowed. */
  maxSlippage: number;
  
  /** Default deadline (seconds). */
  defaultDeadline: number;
  
  /** Minimum trade size. */
  minTradeSize: string;
  
  /** Maximum trade size. */
  maxTradeSize: string;
  
  /** Gas limit multiplier. */
  gasMultiplier: number;
  
  /** Priority fee settings. */
  priorityFee: {
    enabled: boolean;
    multiplier: number;
  };
  
  /** MEV protection settings. */
  mevProtection: {
    enabled: boolean;
    flashbotsEnabled: boolean;
  };
}

/**
 * DEX configuration.
 */
interface DEXConfig {
  /** DEX identifier. */
  id: DEXId;
  
  /** DEX name. */
  name: string;
  
  /** DEX protocol type. */
  protocol: DEXProtocol;
  
  /** DEX category. */
  category: DEXCategory;
  
  /** DEX status. */
  status: DEXStatus;
  
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** DEX configuration by chain. */
  chainConfigs: Record<SupportedChain, DEXChainConfig>;
  
  /** DEX features. */
  features: DEXFeatures;
  
  /** DEX metadata. */
  metadata: DEXMetadata;
  
  /** API configuration. */
  api: DEXAPIConfig;
  
  /** Trading configuration. */
  trading: DEXTradingConfig;
}

// ========================================
// LIQUIDITY POOL TYPES
// ========================================

/**
 * Pool token information.
 */
interface PoolToken {
  /** Token address. */
  address: Address;
  
  /** Token symbol. */
  symbol: string;
  
  /** Token name. */
  name: string;
  
  /** Token decimals. */
  decimals: number;
  
  /** Token weight in pool. */
  weight?: number;
  
  /** Token price in USD. */
  priceUSD?: string;
}

/**
 * Pool reserves information.
 */
interface PoolReserves {
  /** Total liquidity in USD. */
  totalLiquidityUSD: string;
  
  /** Token reserves. */
  tokenReserves: Array<{
    tokenAddress: Address;
    reserve: string;
    reserveUSD: string;
  }>;
  
  /** Last update timestamp. */
  lastUpdated: number;
}

/**
 * Pool fee structure.
 */
interface PoolFees {
  /** Trading fee percentage. */
  tradingFee: number;
  
  /** Protocol fee percentage. */
  protocolFee?: number;
  
  /** LP fee percentage. */
  lpFee?: number;
  
  /** Fee tier (for Uniswap V3). */
  feeTier?: number;
  
  /** Dynamic fees. */
  isDynamic: boolean;
}

/**
 * Pool statistics.
 */
interface PoolStats {
  /** 24h volume in USD. */
  volume24h: string;
  
  /** 7d volume in USD. */
  volume7d: string;
  
  /** Total volume in USD. */
  volumeTotal: string;
  
  /** 24h fees in USD. */
  fees24h: string;
  
  /** APR for liquidity providers. */
  apr: number;
  
  /** APY for liquidity providers. */
  apy: number;
  
  /** Number of liquidity providers. */
  liquidityProviders: number;
  
  /** Pool creation timestamp. */
  createdAt: number;
  
  /** Pool age in days. */
  age: number;
}

/**
 * Pool metadata.
 */
interface PoolMetadata {
  /** Pool name. */
  name: string;
  
  /** Pool type. */
  type: 'stable' | 'volatile' | 'concentrated' | 'weighted';
  
  /** Pool version. */
  version: string;
  
  /** Pool tags. */
  tags: string[];
  
  /** Pool verification status. */
  verified: boolean;
  
  /** Pool risk assessment. */
  riskScore: number;
  
  /** Pool analytics. */
  analytics: {
    priceImpact: number;
    liquidity: string;
    depth: Record<string, string>;
  };
}

/**
 * Liquidity pool information.
 */
interface LiquidityPool {
  /** Pool identifier. */
  id: string;
  
  /** Pool address. */
  address: Address;
  
  /** DEX identifier. */
  dexId: DEXId;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Pool tokens. */
  tokens: PoolToken[];
  
  /** Pool reserves. */
  reserves: PoolReserves;
  
  /** Pool fees. */
  fees: PoolFees;
  
  /** Pool statistics. */
  stats: PoolStats;
  
  /** Pool metadata. */
  metadata: PoolMetadata;
}

// ========================================
// QUOTE TYPES
// ========================================

/**
 * DEX quote request.
 */
interface DEXQuoteRequest {
  /** DEX identifier. */
  dexId: DEXId;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Input token. */
  tokenIn: Address;
  
  /** Output token. */
  tokenOut: Address;
  
  /** Input amount. */
  amountIn: string;
  
  /** Slippage tolerance. */
  slippage: number;
  
  /** Trade deadline. */
  deadline?: number;
  
  /** Recipient address. */
  recipient?: Address;
  
  /** Fee recipient. */
  feeRecipient?: Address;
  
  /** Additional parameters. */
  params?: Record<string, string | number | boolean>;
}

/**
 * Route hop information.
 */
interface RouteHop {
  /** Pool address. */
  poolAddress: Address;
  
  /** Pool type. */
  poolType: string;
  
  /** Token in. */
  tokenIn: Address;
  
  /** Token out. */
  tokenOut: Address;
  
  /** Amount in. */
  amountIn: string;
  
  /** Amount out. */
  amountOut: string;
  
  /** Fee percentage. */
  fee: number;
  
  /** Price impact. */
  priceImpact: number;
}

/**
 * DEX route information.
 */
interface DEXRoute {
  /** Route hops. */
  hops: RouteHop[];
  
  /** Total fee percentage. */
  totalFee: number;
  
  /** Route efficiency score. */
  efficiency: number;
  
  /** Route reliability score. */
  reliability: number;
}

/**
 * DEX transaction data.
 */
interface DEXTransaction {
  /** Transaction to address. */
  to: Address;
  
  /** Transaction data. */
  data: string;
  
  /** Transaction value. */
  value: string;
  
  /** Gas limit. */
  gasLimit: string;
  
  /** Gas price. */
  gasPrice?: string;
  
  /** Max fee per gas. */
  maxFeePerGas?: string;
  
  /** Max priority fee per gas. */
  maxPriorityFeePerGas?: string;
}

/**
 * Quote metadata.
 */
interface QuoteMetadata {
  /** Quote source. */
  source: string;
  
  /** Quote method. */
  method: 'on-chain' | 'off-chain' | 'hybrid';
  
  /** Quote confidence. */
  confidence: number;
  
  /** Quote warnings. */
  warnings: string[];
  
  /** Quote tags. */
  tags: string[];
  
  /** Additional data. */
  additional: Record<string, string | number | boolean>;
}

/**
 * DEX quote response.
 */
interface DEXQuote {
  /** Quote identifier. */
  id: string;
  
  /** DEX identifier. */
  dexId: DEXId;
  
  /** Quote timestamp. */
  timestamp: number;
  
  /** Quote expiry. */
  expiry: number;
  
  /** Input token. */
  tokenIn: Address;
  
  /** Output token. */
  tokenOut: Address;
  
  /** Input amount. */
  amountIn: string;
  
  /** Expected output amount. */
  amountOut: string;
  
  /** Minimum output amount (after slippage). */
  amountOutMin: string;
  
  /** Price impact. */
  priceImpact: number;
  
  /** Gas estimate. */
  gasEstimate: string;
  
  /** Gas cost in USD. */
  gasCostUSD: string;
  
  /** Route information. */
  route: DEXRoute;
  
  /** Transaction data. */
  transaction?: DEXTransaction;
  
  /** Quote metadata. */
  metadata: QuoteMetadata;
}

// ========================================
// DEX AGGREGATION TYPES
// ========================================

/**
 * DEX aggregator configuration.
 */
interface DEXAggregatorConfig {
  /** Aggregator identifier. */
  id: string;
  
  /** Supported DEXes. */
  supportedDEXes: DEXId[];
  
  /** Aggregation strategy. */
  strategy: 'best-price' | 'best-execution' | 'lowest-slippage' | 'fastest' | 'custom';
  
  /** Quote timeout. */
  quoteTimeout: number;
  
  /** Maximum parallel quotes. */
  maxParallelQuotes: number;
  
  /** Minimum price improvement. */
  minPriceImprovement: number;
  
  /** Split trade configuration. */
  splitTrade: {
    enabled: boolean;
    maxSplits: number;
    minSplitSize: string;
  };
}

/**
 * Aggregated quote.
 */
interface AggregatedQuote {
  /** Aggregated quote ID. */
  id: string;
  
  /** Best overall quote. */
  bestQuote: DEXQuote;
  
  /** All quotes received. */
  allQuotes: DEXQuote[];
  
  /** Quote comparison. */
  comparison: {
    priceDifference: number;
    gasDifference: string;
    slippageDifference: number;
  };
  
  /** Aggregation metadata. */
  metadata: {
    quotesRequested: number;
    quotesReceived: number;
    responseTime: number;
    strategy: string;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Popular DEX configurations.
 */
const POPULAR_DEXES: Record<string, Partial<DEXConfig>> = {
  uniswapV2: {
    name: 'Uniswap V2',
    protocol: 'uniswap-v2',
    category: 'amm-v2',
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism']
  },
  uniswapV3: {
    name: 'Uniswap V3',
    protocol: 'uniswap-v3',
    category: 'amm-v3',
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism']
  },
  'pancakeswap': {
    name: 'PancakeSwap',
    protocol: 'pancakeswap',
    category: 'amm-v2',
    chains: ['bsc']
  },
  'sushiswap': {
    name: 'SushiSwap',
    protocol: 'sushiswap',
    category: 'amm-v2',
    chains: ['ethereum', 'polygon', 'arbitrum', 'bsc']
  }
} as const;

/**
 * Default DEX settings.
 */
const DEFAULT_DEX_SETTINGS = {
  defaultSlippage: 1.0,
  maxSlippage: 5.0,
  defaultDeadline: 1200,
  gasMultiplier: 1.1,
  quoteTimeout: 5000,
  maxParallelQuotes: 5
} as const;

// ========================================
// EXPORTS
// ========================================

export type {
  DEXId,
  DEXProtocol,
  DEXCategory,
  DEXStatus,
  DEXConfig,
  DEXChainConfig,
  DEXFeatures,
  DEXMetadata,
  DEXAPIConfig,
  DEXTradingConfig,
  LiquidityPool,
  PoolToken,
  PoolReserves,
  PoolFees,
  PoolStats,
  PoolMetadata,
  DEXQuoteRequest,
  DEXQuote,
  DEXRoute,
  RouteHop,
  DEXTransaction,
  QuoteMetadata,
  DEXAggregatorConfig,
  AggregatedQuote
};

export { POPULAR_DEXES, DEFAULT_DEX_SETTINGS };

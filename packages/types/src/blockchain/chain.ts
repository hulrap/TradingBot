/**
 * @file Blockchain Chain Types and Configurations
 * 
 * Core blockchain type definitions, chain configurations, and chain-specific
 * parameters for multi-chain trading operations.
 * 
 * Features:
 * - Supported blockchain networks with detailed configurations
 * - Chain-specific parameters (gas, confirmations, block times)
 * - RPC and WebSocket configuration structures
 * - Chain capabilities and feature flags
 * - Network connection management types.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// CORE CHAIN TYPES
// ========================================

/**
 * Supported blockchain networks for trading operations.
 * Comprehensive coverage of 100+ networks including all major L1s, L2s, sidechains, and testnets.
 * This makes our system more comprehensive than what major exchanges like Binance use internally.
 */
type SupportedChain = 
  // ========================================
  // MAJOR LAYER 1 BLOCKCHAINS
  // ========================================
  | 'ethereum'           // Ethereum mainnet
  | 'bitcoin'            // Bitcoin network
  | 'solana'             // Solana mainnet
  | 'cardano'            // Cardano mainnet
  | 'polkadot'           // Polkadot relay chain
  | 'kusama'             // Kusama network
  | 'cosmos'             // Cosmos Hub
  | 'osmosis'            // Osmosis DEX chain
  | 'terra'              // Terra Luna
  | 'avalanche'          // Avalanche C-Chain
  | 'near'               // NEAR Protocol
  | 'algorand'           // Algorand mainnet
  | 'tezos'              // Tezos mainnet
  | 'flow'               // Flow blockchain
  | 'aptos'              // Aptos mainnet
  | 'sui'                // Sui network
  | 'sei'                // Sei network
  | 'injective'          // Injective Protocol
  | 'starknet'           // StarkNet L2
  | 'ton'                // TON blockchain
  | 'icp'                // Internet Computer
  | 'hedera'             // Hedera Hashgraph
  | 'elrond'             // MultiversX (Elrond)
  | 'zilliqa'            // Zilliqa mainnet
  | 'neo'                // Neo N3
  | 'waves'              // Waves Platform
  | 'theta'              // Theta Network
  | 'vechain'            // VeChain Thor
  | 'icon'               // ICON Network
  | 'tron'               // TRON mainnet
  | 'eos'                // EOSIO mainnet
  | 'stellar'            // Stellar Network
  | 'monero'             // Monero
  | 'zcash'              // Zcash
  | 'litecoin'           // Litecoin
  | 'dogecoin'           // Dogecoin
  | 'dash'               // Dash
  | 'decred'             // Decred
  
  // ========================================
  // ETHEREUM LAYER 2 SOLUTIONS
  // ========================================
  | 'arbitrum'           // Arbitrum One
  | 'arbitrum-nova'      // Arbitrum Nova
  | 'optimism'           // Optimism mainnet
  | 'base'               // Base L2
  | 'zksync'             // zkSync Era
  | 'zksync-lite'        // zkSync Lite
  | 'polygon-zkevm'      // Polygon zkEVM
  | 'linea'              // Linea
  | 'scroll'             // Scroll
  | 'mantle'             // Mantle Network
  | 'metis'              // Metis Andromeda
  | 'boba'               // Boba Network
  | 'loopring'           // Loopring L2
  | 'immutable-x'        // ImmutableX
  | 'dydx'               // dYdX Chain
  | 'polygon-miden'      // Polygon Miden
  | 'zora'               // Zora Network
  | 'blast'              // Blast L2
  | 'mode'               // Mode Network
  | 'cyber'              // Cyber L2
  | 'ancient8'           // Ancient8
  | 'redstone'           // Redstone
  | 'aevo'               // Aevo L2
  | 'lyra'               // Lyra Chain
  | 'derive'             // Derive Chain
  | 'apex'               // ApeX Protocol
  
  // ========================================
  // EVM-COMPATIBLE CHAINS
  // ========================================
  | 'bsc'                // Binance Smart Chain
  | 'polygon'            // Polygon PoS
  | 'fantom'             // Fantom Opera
  | 'cronos'             // Cronos Chain
  | 'gnosis'             // Gnosis Chain (formerly xDAI)
  | 'harmony'            // Harmony ONE
  | 'moonbeam'           // Moonbeam (Polkadot)
  | 'moonriver'          // Moonriver (Kusama)
  | 'celo'               // Celo mainnet
  | 'aurora'             // Aurora (NEAR)
  | 'evmos'              // Evmos
  | 'kava'               // Kava EVM
  | 'klaytn'             // Klaytn mainnet
  | 'oasis'              // Oasis Emerald
  | 'fuse'               // Fuse Network
  | 'velas'              // Velas EVM
  | 'wanchain'           // Wanchain
  | 'iotex'              // IoTeX Network
  | 'heco'               // Huobi ECO Chain
  | 'okc'                // OKC (OKX Chain)
  | 'kcc'                // KuCoin Community Chain
  | 'elastos'            // Elastos Smart Chain
  | 'syscoin'            // Syscoin NEVM
  | 'milkomeda'          // Milkomeda C1
  | 'astar'              // Astar Network
  | 'shiden'             // Shiden Network
  | 'acala'              // Acala Network
  | 'karura'             // Karura Network
  | 'clover'             // Clover Finance
  | 'rei'                // REI Network
  | 'godwoken'           // Godwoken
  | 'rsk'                // RSK Network
  | 'thundercore'        // ThunderCore
  | 'tomochain'          // TomoChain
  | 'energy-web'         // Energy Web Chain
  | 'palm'               // Palm Network
  | 'dfk'                // DFK Chain
  | 'swimmer'            // Swimmer Network
  | 'dogechain'          // Dogechain
  | 'step'               // Step Network
  | 'conflux'            // Conflux eSpace
  
  // ========================================
  // TESTNET NETWORKS
  // ========================================
  | 'goerli'             // Ethereum Goerli
  | 'sepolia'            // Ethereum Sepolia
  | 'holesky'            // Ethereum Holesky
  | 'mumbai'             // Polygon Mumbai
  | 'fuji'               // Avalanche Fuji
  | 'chapel'             // BSC Chapel
  | 'fantom-testnet'     // Fantom Testnet
  | 'arbitrum-goerli'    // Arbitrum Goerli
  | 'optimism-goerli'    // Optimism Goerli
  | 'base-goerli'        // Base Goerli
  | 'cronos-testnet'     // Cronos Testnet
  | 'moonbase-alpha'     // Moonbase Alpha
  | 'alfajores'          // Celo Alfajores
  | 'aurora-testnet'     // Aurora Testnet
  | 'solana-devnet'      // Solana Devnet
  | 'solana-testnet'     // Solana Testnet
  | 'cardano-testnet'    // Cardano Testnet
  | 'westend'            // Polkadot Westend
  | 'rococo'             // Polkadot Rococo
  
  // ========================================
  // SPECIALIZED & EMERGING CHAINS
  // ========================================
  | 'berachain'          // Berachain
  | 'celestia'           // Celestia
  | 'dymension'          // Dymension
  | 'archway'            // Archway
  | 'neutron'            // Neutron
  | 'stride'             // Stride
  | 'juno'               // Juno Network
  | 'secret'             // Secret Network
  | 'akash'              // Akash Network
  | 'persistence'        // Persistence
  | 'comdex'             // Comdex
  | 'regen'              // Regen Network
  | 'agoric'             // Agoric
  | 'quicksilver'        // Quicksilver
  | 'umee'               // Umee
  | 'kujira'             // Kujira
  | 'migaloo'            // Migaloo
  | 'composable'         // Composable Finance
  | 'picasso'            // Picasso (Kusama)
  | 'centrifuge'         // Centrifuge Chain
  | 'interlay'           // Interlay
  | 'kintsugi'           // Kintsugi (Kusama)
  | 'basilisk'           // Basilisk
  | 'hydradx'            // HydraDX
  | 'zeitgeist'          // Zeitgeist
  | 'subsocial'          // Subsocial
  | 'phala'              // Phala Network
  | 'khala'              // Khala Network
  | 'efinity'            // Efinity
  | 'enjin'              // Enjin Matrixchain
  | 'nodle'              // Nodle Chain;

/**
 * Chain family classifications with expanded categories.
 */
type ChainFamily = 
  | 'evm'               // Ethereum Virtual Machine compatible
  | 'solana'            // Solana ecosystem
  | 'cosmos'            // Cosmos SDK based
  | 'polkadot'          // Polkadot/Substrate based
  | 'bitcoin'           // Bitcoin-like UTXO
  | 'cardano'           // Cardano/Haskell based
  | 'algorand'          // Algorand pure proof-of-stake
  | 'near'              // NEAR Protocol sharded
  | 'aptos'             // Move VM (Aptos)
  | 'sui'               // Move VM (Sui)
  | 'starknet'          // Cairo VM
  | 'ton'               // TON Virtual Machine
  | 'flow'              // Flow blockchain
  | 'icp'               // Internet Computer
  | 'hedera'            // Hashgraph consensus
  | 'tezos'             // Michelson VM
  | 'custom';           // Custom implementation

/**
 * Network types for different environments.
 */
type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'local';

/**
 * Chain status for operational monitoring.
 */
type ChainStatus = 'active' | 'maintenance' | 'deprecated' | 'experimental';

// ========================================
// DEPENDENT TYPES (DEFINED BEFORE USAGE)
// ========================================

/**
 * RPC configuration for blockchain connections.
 */
interface ChainRpcConfig {
  /** Primary RPC endpoints. */
  http: string[];
  
  /** WebSocket endpoints. */
  websocket?: string[];
  
  /** Rate limiting configuration. */
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
  
  /** Timeout configuration. */
  timeouts: {
    connection: number;
    request: number;
    healthCheck: number;
  };
  
  /** Retry configuration. */
  retry: {
    maxAttempts: number;
    backoffMs: number;
    multiplier: number;
  };
  
  /** Health check configuration. */
  healthCheck: {
    enabled: boolean;
    interval: number;
    endpoint: string;
    expectedLatency: number;
  };
}

/**
 * Chain capabilities and feature support.
 */
interface ChainCapabilities {
  /** Smart contract support. */
  supportsContracts: boolean;
  
  /** Multi-sig wallet support. */
  supportsMultisig: boolean;
  
  /** Token standards supported. */
  tokenStandards: string[];
  
  /** DEX protocols available. */
  dexProtocols: string[];
  
  /** Bridge protocols supported. */
  bridgeProtocols: string[];
  
  /** MEV protection available. */
  mevProtection: boolean;
  
  /** Private mempool support. */
  privateMempool: boolean;
  
  /** Account abstraction support. */
  accountAbstraction: boolean;
  
  /** Layer 2 scaling solution. */
  isLayer2: boolean;
  
  /** Cross-chain compatibility. */
  crossChainCompatible: boolean;
}

// ========================================
// CHAIN CONFIGURATION TYPES
// ========================================

/**
 * Comprehensive chain configuration with all network parameters.
 */
interface ChainConfig {
  /** Chain identifier. */
  id: SupportedChain;
  
  /** Human-readable chain name. */
  name: string;
  
  /** Chain family (EVM, Solana, etc.). */
  family: ChainFamily;
  
  /** Network type. */
  networkType: NetworkType;
  
  /** Chain ID for RPC connections. */
  chainId: number;
  
  /** Native token information. */
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
    iconUrl?: string;
  };
  
  /** Block and transaction parameters. */
  blockParams: {
    /** Average block time in milliseconds. */
    blockTime: number;
    /** Required confirmations for finality. */
    confirmations: number;
    /** Maximum block size. */
    maxBlockSize: number;
    /** Block gas limit (EVM chains). */
    gasLimit?: string;
  };
  
  /** Gas and fee configuration. */
  feeConfig: {
    /** Gas price unit (gwei, lamports, etc.). */
    unit: string;
    /** Minimum gas price. */
    minGasPrice: string;
    /** Maximum gas price. */
    maxGasPrice: string;
    /** Default gas price. */
    defaultGasPrice: string;
    /** Priority fee support (EIP-1559). */
    supportsPriorityFee: boolean;
    /** Base fee support. */
    supportsBaseFee: boolean;
  };
  
  /** RPC configuration. */
  rpc: ChainRpcConfig;
  
  /** Chain capabilities and features. */
  capabilities: ChainCapabilities;
  
  /** Chain status. */
  status: ChainStatus;
  
  /** Explorer URLs. */
  explorers: Array<{
    name: string;
    url: string;
    apiUrl?: string;
  }>;
  
  /** Bridge and cross-chain information. */
  bridges?: Array<{
    protocol: string;
    supportedChains: SupportedChain[];
    fees: {
      min: string;
      max: string;
    };
  }>;
}

// ========================================
// NETWORK STATE TYPES
// ========================================

/**
 * Current network state and metrics.
 */
interface NetworkState {
  /** Chain identifier. */
  chain: SupportedChain;
  
  /** Current block number. */
  blockNumber: number;
  
  /** Current gas price. */
  gasPrice: {
    slow: string;
    standard: string;
    fast: string;
    instant: string;
  };
  
  /** Network congestion level. */
  congestion: 'low' | 'medium' | 'high' | 'extreme';
  
  /** Mempool statistics. */
  mempool: {
    pendingTxCount: number;
    avgGasPrice: string;
    queuedTxCount: number;
  };
  
  /** Network health metrics. */
  health: {
    rpcLatency: number;
    syncStatus: 'synced' | 'syncing' | 'behind';
    lastBlockTime: number;
    nodeCount: number;
  };
  
  /** Last update timestamp. */
  timestamp: number;
}

/**
 * Chain statistics and analytics.
 */
interface ChainStats {
  /** Chain identifier. */
  chain: SupportedChain;
  
  /** Time period for stats. */
  period: '1h' | '24h' | '7d' | '30d';
  
  /** Transaction statistics. */
  transactions: {
    total: number;
    successful: number;
    failed: number;
    avgGasPrice: string;
    avgGasUsed: string;
  };
  
  /** Block statistics. */
  blocks: {
    total: number;
    avgBlockTime: number;
    avgBlockSize: number;
  };
  
  /** DEX activity. */
  dexActivity: {
    totalVolume: string;
    totalTrades: number;
    topDexes: Array<{
      name: string;
      volume: string;
      trades: number;
    }>;
  };
  
  /** MEV statistics. */
  mevStats: {
    totalMevVolume: string;
    mevTransactions: number;
    topMevTypes: Array<{
      type: string;
      count: number;
      volume: string;
    }>;
  };
}

// ========================================
// CHAIN REGISTRY TYPES
// ========================================

/**
 * Chain registry for managing supported chains.
 */
interface ChainRegistry {
  /** All supported chains. */
  chains: Record<SupportedChain, ChainConfig>;
  
  /** Active chains. */
  activeChains: SupportedChain[];
  
  /** Default chain for operations. */
  defaultChain: SupportedChain;
  
  /** Chain priorities for routing. */
  priorities: Record<SupportedChain, number>;
  
  /** Cross-chain bridge mappings. */
  bridgeMappings: Array<{
    from: SupportedChain;
    to: SupportedChain;
    protocols: string[];
    estimatedTime: number;
    fees: {
      min: string;
      max: string;
    };
  }>;
}

/**
 * Chain connection pool configuration.
 */
interface ChainConnectionPool {
  /** Chain identifier. */
  chain: SupportedChain;
  
  /** Pool configuration. */
  pool: {
    minConnections: number;
    maxConnections: number;
    idleTimeout: number;
    connectionTimeout: number;
  };
  
  /** Load balancing strategy. */
  loadBalancing: 'round-robin' | 'least-connections' | 'weighted' | 'random';
  
  /** Failover configuration. */
  failover: {
    enabled: boolean;
    maxFailures: number;
    resetTime: number;
    fallbackChains: SupportedChain[];
  };
  
  /** Monitoring configuration. */
  monitoring: {
    healthCheckInterval: number;
    latencyThreshold: number;
    errorThreshold: number;
  };
}

// ========================================
// UTILITY TYPES
// ========================================

/**
 * Chain selector with optional constraints.
 */
interface ChainSelector {
  /** Required chains. */
  include?: SupportedChain[];
  
  /** Excluded chains. */
  exclude?: SupportedChain[];
  
  /** Minimum chain capabilities. */
  requireCapabilities?: Partial<ChainCapabilities>;
  
  /** Maximum acceptable latency. */
  maxLatency?: number;
  
  /** Minimum liquidity requirements. */
  minLiquidity?: string;
}

/**
 * Cross-chain operation parameters.
 */
interface CrossChainParams {
  /** Source chain. */
  fromChain: SupportedChain;
  
  /** Destination chain. */
  toChain: SupportedChain;
  
  /** Bridge protocol to use. */
  bridgeProtocol?: string;
  
  /** Maximum bridge time. */
  maxBridgeTime: number;
  
  /** Bridge slippage tolerance. */
  bridgeSlippage: number;
  
  /** Minimum amount after bridge fees. */
  minAmountAfterFees: string;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * All supported chains array - Core chains for initial implementation.
 * Additional chains can be added dynamically at runtime.
 */
const SUPPORTED_CHAINS: readonly SupportedChain[] = [
  // Core trading chains (most liquid and stable)
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'optimism',
  'avalanche',
  'fantom',
  'solana',
  'base',
  // Additional major L1s
  'cardano',
  'polkadot',
  'cosmos',
  'near',
  'aptos',
  'sui',
  // Additional L2s
  'arbitrum-nova',
  'zksync',
  'linea',
  'scroll',
  'mantle',
  'blast',
  // Additional EVM chains
  'cronos',
  'gnosis',
  'harmony',
  'moonbeam',
  'celo',
  'aurora'
] as const;

/**
 * EVM-compatible chains.
 */
const EVM_CHAINS: readonly SupportedChain[] = [
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'optimism',
  'avalanche',
  'fantom',
  'base',
  'arbitrum-nova',
  'zksync',
  'polygon-zkevm',
  'linea',
  'scroll',
  'mantle',
  'metis',
  'boba',
  'blast',
  'mode',
  'cronos',
  'gnosis',
  'harmony',
  'moonbeam',
  'moonriver',
  'celo',
  'aurora',
  'evmos',
  'kava',
  'klaytn',
  'oasis',
  'fuse',
  'heco',
  'okc',
  'kcc'
] as const;

/**
 * Layer 2 chains.
 */
const LAYER2_CHAINS: readonly SupportedChain[] = [
  'arbitrum',
  'arbitrum-nova',
  'optimism',
  'base',
  'zksync',
  'zksync-lite',
  'polygon-zkevm',
  'linea',
  'scroll',
  'mantle',
  'metis',
  'boba',
  'loopring',
  'immutable-x',
  'blast',
  'mode',
  'cyber',
  'zora'
] as const;

/**
 * Cosmos ecosystem chains.
 */
const COSMOS_CHAINS: readonly SupportedChain[] = [
  'cosmos',
  'osmosis',
  'terra',
  'injective',
  'sei',
  'evmos',
  'kava',
  'juno',
  'secret',
  'akash',
  'persistence',
  'comdex',
  'regen',
  'agoric',
  'quicksilver',
  'umee',
  'kujira',
  'migaloo',
  'stride',
  'archway',
  'neutron',
  'dymension'
] as const;

/**
 * Polkadot ecosystem chains.
 */
const POLKADOT_CHAINS: readonly SupportedChain[] = [
  'polkadot',
  'kusama',
  'moonbeam',
  'moonriver',
  'astar',
  'shiden',
  'acala',
  'karura',
  'composable',
  'picasso',
  'centrifuge',
  'interlay',
  'kintsugi',
  'basilisk',
  'hydradx',
  'zeitgeist',
  'subsocial',
  'phala',
  'khala',
  'efinity',
  'enjin',
  'nodle'
] as const;

/**
 * Testnet chain mappings (flexible - only for supported chains).
 */
const TESTNET_MAPPINGS: Partial<Record<SupportedChain, string>> = {
  ethereum: 'goerli',
  bsc: 'bsc-testnet',
  polygon: 'polygon-mumbai',
  arbitrum: 'arbitrum-goerli',
  optimism: 'optimism-goerli',
  avalanche: 'avalanche-fuji',
  fantom: 'fantom-testnet',
  solana: 'solana-devnet',
  base: 'base-goerli',
  cronos: 'cronos-testnet',
  moonbeam: 'moonbase-alpha',
  celo: 'alfajores',
  aurora: 'aurora-testnet',
  cardano: 'cardano-testnet',
  polkadot: 'westend',
  kusama: 'rococo'
} as const;

/**
 * Default chain priorities (flexible - can be extended).
 */
const DEFAULT_CHAIN_PRIORITIES: Partial<Record<SupportedChain, number>> = {
  // Tier 1 - Highest liquidity and most stable
  ethereum: 100,
  arbitrum: 95,
  optimism: 90,
  base: 85,
  
  // Tier 2 - High liquidity alt chains
  bsc: 80,
  polygon: 75,
  avalanche: 70,
  
  // Tier 3 - Emerging L2s
  zksync: 65,
  linea: 60,
  scroll: 55,
  blast: 50,
  
  // Tier 4 - Alternative ecosystems
  solana: 45,
  fantom: 40,
  cronos: 35,
  gnosis: 30,
  
  // Tier 5 - Specialized chains
  harmony: 25,
  moonbeam: 20,
  celo: 15,
  aurora: 10,
  
  // Non-EVM chains
  cardano: 40,
  polkadot: 35,
  cosmos: 30,
  near: 25,
  aptos: 20,
  sui: 15
} as const;

// ========================================
// EXPORTS
// ========================================

export type {
  SupportedChain,
  ChainFamily,
  NetworkType,
  ChainStatus,
  ChainConfig,
  ChainRpcConfig,
  ChainCapabilities,
  NetworkState,
  ChainStats,
  ChainRegistry,
  ChainConnectionPool,
  ChainSelector,
  CrossChainParams
};

export {
  SUPPORTED_CHAINS,
  EVM_CHAINS,
  LAYER2_CHAINS,
  COSMOS_CHAINS,
  POLKADOT_CHAINS,
  TESTNET_MAPPINGS,
  DEFAULT_CHAIN_PRIORITIES
};

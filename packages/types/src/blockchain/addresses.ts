/**
 * @file Blockchain Address Types and Validation.
 * 
 * Address validation, token information, and address-related utilities
 * for multi-chain blockchain operations.
 * 
 * Features:
 * - Multi-chain address validation and formatting
 * - Token metadata and information structures
 * - Address book and labeling system
 * - Address risk assessment and security
 * - Batch address operations.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from './chain';

// ========================================
// CORE ADDRESS TYPES
// ========================================

/**
 * Generic address string with chain context.
 */
type Address = string;

/**
 * Address format types for different chains.
 */
type AddressFormat = 
  | 'evm-hex'        // 0x... (Ethereum, BSC, Polygon, etc.)
  | 'solana-base58'  // Base58 encoded (Solana)
  | 'bech32'         // Bech32 format (some chains)
  | 'legacy'         // Legacy format
  | 'compressed'     // Compressed public key
  | 'uncompressed';  // Uncompressed public key

/**
 * Chain-specific address with validation context.
 */
interface ChainAddress {
  /** The address string. */
  address: Address;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Whether address has been validated. */
  isValid: boolean;
  
  /** Address format type. */
  format: AddressFormat;
  
  /** Checksum validation (for EVM). */
  checksumValid?: boolean;
}

// ========================================
// TOKEN INFORMATION TYPES (DEFINED BEFORE USAGE)
// ========================================

/**
 * Token type classifications.
 */
type TokenType = 
  | 'native'          // Native chain token (ETH, BNB, etc.)
  | 'wrapped-native'  // Wrapped native token (WETH, WBNB)
  | 'stablecoin'      // Stablecoins (USDC, USDT, DAI)
  | 'governance'      // Governance tokens
  | 'utility'         // Utility tokens
  | 'security'        // Security tokens
  | 'nft'            // NFT tokens
  | 'synthetic'       // Synthetic assets
  | 'derivative'      // Derivative tokens
  | 'memecoin'        // Meme tokens
  | 'unknown';        // Unknown/unclassified

/**
 * Token metadata and additional information.
 */
interface TokenMetadata {
  /** Token description. */
  description?: string;
  
  /** Official website. */
  website?: string;
  
  /** Social media links. */
  social?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    github?: string;
  };
  
  /** Token categories/tags. */
  tags: string[];
  
  /** Token type classification. */
  type: TokenType;
  
  /** Creation date. */
  createdAt?: number;
  
  /** Total supply. */
  totalSupply?: string;
  
  /** Circulating supply. */
  circulatingSupply?: string;
  
  /** Max supply. */
  maxSupply?: string;
}

/**
 * Token market data.
 */
interface TokenMarketData {
  /** Current price in USD. */
  priceUsd: number;
  
  /** Market capitalization. */
  marketCap?: number;
  
  /** 24h trading volume. */
  volume24h?: number;
  
  /** Price change percentages. */
  priceChange: {
    '1h': number;
    '24h': number;
    '7d': number;
    '30d': number;
  };
  
  /** All-time high. */
  ath?: {
    price: number;
    date: number;
  };
  
  /** All-time low. */
  atl?: {
    price: number;
    date: number;
  };
  
  /** Liquidity information. */
  liquidity?: {
    total: number;
    dexes: Array<{
      name: string;
      liquidity: number;
    }>;
  };
}

/**
 * Security issue classifications.
 */
type SecurityIssueType =
  | 'honeypot'
  | 'rug-pull-risk'
  | 'high-slippage'
  | 'low-liquidity'
  | 'unverified-contract'
  | 'proxy-risk'
  | 'centralization-risk'
  | 'mint-risk'
  | 'pause-risk'
  | 'blacklist-risk'
  | 'flash-loan-attack'
  | 'governance-attack';

/**
 * Security issue types.
 */
interface SecurityIssue {
  /** Issue type. */
  type: SecurityIssueType;
  
  /** Issue severity. */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Issue description. */
  description: string;
  
  /** Detection timestamp. */
  detectedAt: number;
  
  /** Mitigation suggestions. */
  mitigation?: string;
}

/**
 * Token security assessment.
 */
interface TokenSecurity {
  /** Overall risk score (0-100, higher is riskier). */
  riskScore: number;
  
  /** Security flags. */
  flags: {
    /** Contract is verified. */
    verified: boolean;
    
    /** Has mint function. */
    canMint: boolean;
    
    /** Has burn function. */
    canBurn: boolean;
    
    /** Transfer can be paused. */
    canPause: boolean;
    
    /** Has blacklist functionality. */
    hasBlacklist: boolean;
    
    /** Has whitelist functionality. */
    hasWhitelist: boolean;
    
    /** Ownership can be renounced. */
    canRenounceOwnership: boolean;
    
    /** Is proxy contract. */
    isProxy: boolean;
    
    /** Has honeypot characteristics. */
    isHoneypot: boolean;
  };
  
  /** Security issues. */
  issues: SecurityIssue[];
  
  /** Audit information. */
  audits?: Array<{
    auditor: string;
    date: number;
    report: string;
    score?: number;
  }>;
  
  /** Last security check. */
  lastCheck: number;
}

/**
 * Comprehensive token information.
 */
interface TokenInfo {
  /** Token contract address. */
  address: Address;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Token symbol (e.g., 'USDC', 'WETH'). */
  symbol: string;
  
  /** Full token name. */
  name: string;
  
  /** Token decimals. */
  decimals: number;
  
  /** Token logo/icon URLs. */
  logos?: {
    small: string;
    medium: string;
    large: string;
  };
  
  /** Token verification status. */
  verified: boolean;
  
  /** Token metadata. */
  metadata: TokenMetadata;
  
  /** Market data. */
  market?: TokenMarketData;
  
  /** Security information. */
  security: TokenSecurity;
  
  /** Last update timestamp. */
  lastUpdated: number;
}

// ========================================
// ADDRESS BOOK TYPES
// ========================================

/**
 * Address categories for organization.
 */
type AddressCategory =
  | 'personal'        // Personal wallets
  | 'exchange'        // Exchange addresses
  | 'dex'            // DEX contracts
  | 'bridge'         // Bridge contracts
  | 'defi'           // DeFi protocol contracts
  | 'token'          // Token contracts
  | 'nft'            // NFT contracts
  | 'staking'        // Staking contracts
  | 'governance'     // Governance contracts
  | 'multisig'       // Multi-signature wallets
  | 'cold-storage'   // Cold storage wallets
  | 'hot-wallet'     // Hot wallets
  | 'trading-bot'    // Trading bot wallets
  | 'suspicious'     // Suspicious addresses
  | 'blacklisted'    // Blacklisted addresses
  | 'whitelisted'    // Whitelisted addresses
  | 'unknown';       // Unknown category

/**
 * Address book entry for labeling and organizing addresses.
 */
interface AddressBookEntry {
  /** Entry ID. */
  id: string;
  
  /** Address information. */
  address: ChainAddress;
  
  /** User-defined label. */
  label: string;
  
  /** Entry description. */
  description?: string;
  
  /** Entry category. */
  category: AddressCategory;
  
  /** Tags for organization. */
  tags: string[];
  
  /** Risk level assessment. */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /** Whether address is trusted. */
  trusted: boolean;
  
  /** Creation timestamp. */
  createdAt: number;
  
  /** Last used timestamp. */
  lastUsed?: number;
  
  /** Usage count. */
  usageCount: number;
  
  /** Additional metadata. */
  metadata: Record<string, string | number | boolean>;
}

// ========================================
// ADDRESS VALIDATION TYPES
// ========================================

/**
 * Address validation result.
 */
interface AddressValidationResult {
  /** Whether address is valid. */
  isValid: boolean;
  
  /** Address format detected. */
  format?: AddressFormat;
  
  /** Normalized address. */
  normalized?: Address;
  
  /** Checksum version (for EVM). */
  checksum?: Address;
  
  /** Validation errors. */
  errors: string[];
  
  /** Validation warnings. */
  warnings: string[];
  
  /** Additional validation metadata. */
  metadata: {
    chain: SupportedChain;
    isContract?: boolean;
    hasCode?: boolean;
    balance?: string;
  };
}

/**
 * Batch address validation request.
 */
interface BatchAddressValidation {
  /** Addresses to validate. */
  addresses: Array<{
    address: Address;
    chain: SupportedChain;
  }>;
  
  /** Validation options. */
  options: {
    /** Check if address is a contract. */
    checkContract: boolean;
    
    /** Check address balance. */
    checkBalance: boolean;
    
    /** Normalize addresses. */
    normalize: boolean;
    
    /** Generate checksums. */
    generateChecksum: boolean;
  };
}

/**
 * Batch validation results.
 */
interface BatchAddressValidationResult {
  /** Individual validation results. */
  results: Array<AddressValidationResult & { originalAddress: Address }>;
  
  /** Summary statistics. */
  summary: {
    total: number;
    valid: number;
    invalid: number;
    contracts: number;
    warnings: number;
  };
  
  /** Processing time in milliseconds. */
  processingTime: number;
}

// ========================================
// ADDRESS UTILITIES TYPES
// ========================================

/**
 * Address comparison result.
 */
interface AddressComparison {
  /** Whether addresses are the same. */
  isEqual: boolean;
  
  /** Normalized addresses. */
  normalized: {
    a: Address;
    b: Address;
  };
  
  /** Comparison method used. */
  method: 'case-insensitive' | 'checksum' | 'normalized';
}

/**
 * Address transformation options.
 */
interface AddressTransformOptions {
  /** Target format. */
  format: AddressFormat;
  
  /** Whether to validate after transformation. */
  validate: boolean;
  
  /** Whether to generate checksum. */
  checksum: boolean;
  
  /** Target chain for validation. */
  targetChain: SupportedChain;
}

/**
 * Address search filters.
 */
interface AddressSearchFilter {
  /** Search query. */
  query?: string;
  
  /** Chain filter. */
  chains?: SupportedChain[];
  
  /** Category filter. */
  categories?: AddressCategory[];
  
  /** Tag filter. */
  tags?: string[];
  
  /** Risk level filter. */
  riskLevels?: Array<'low' | 'medium' | 'high' | 'critical'>;
  
  /** Trusted status filter. */
  trusted?: boolean;
  
  /** Date range filter. */
  dateRange?: {
    from: number;
    to: number;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  Address,
  ChainAddress,
  AddressFormat,
  TokenInfo,
  TokenMetadata,
  TokenType,
  TokenMarketData,
  TokenSecurity,
  SecurityIssue,
  SecurityIssueType,
  AddressBookEntry,
  AddressCategory,
  AddressValidationResult,
  BatchAddressValidation,
  BatchAddressValidationResult,
  AddressComparison,
  AddressTransformOptions,
  AddressSearchFilter
};

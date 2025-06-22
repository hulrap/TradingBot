/**
 * @file Blockchain address validation utilities
 * @package @trading-bot/utilities
 * 
 * Validates addresses for different blockchain networks with comprehensive
 * format checking and checksum validation where applicable.
. */

import { keccak_256 } from '@noble/hashes/sha3';

import type { 
  UtilitySupportedChain as SupportedChain, 
  UtilityAddressValidationResult as AddressValidationResult,
  BatchAddressValidationResult
} from '@trading-bot/types/src/utilities/validation/validation';

/**
 * Address validation patterns with comprehensive regex patterns
. */
const ADDRESS_PATTERNS = {
  // EVM-compatible chains (Ethereum, BSC, Polygon, etc.)
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  bsc: /^0x[a-fA-F0-9]{40}$/,
  polygon: /^0x[a-fA-F0-9]{40}$/,
  arbitrum: /^0x[a-fA-F0-9]{40}$/,
  optimism: /^0x[a-fA-F0-9]{40}$/,
  avalanche: /^0x[a-fA-F0-9]{40}$/,
  fantom: /^0x[a-fA-F0-9]{40}$/,
  
  // Solana addresses (Base58 encoding, 32-44 characters)
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  
  // Bitcoin addresses
  bitcoin: {
    legacy: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    segwit: /^bc1[a-z0-9]{39,59}$/,
    taproot: /^bc1p[a-z0-9]{58}$/
  },
  
  // Litecoin addresses
  litecoin: {
    legacy: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
    segwit: /^ltc1[a-z0-9]{39,59}$/
  }
} as const;

/**
 * Chain-specific constants and configurations
. */
const CHAIN_CONFIGS = {
  ethereum: {
    name: 'Ethereum',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  bsc: {
    name: 'Binance Smart Chain',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  polygon: {
    name: 'Polygon',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  arbitrum: {
    name: 'Arbitrum',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  optimism: {
    name: 'Optimism',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  avalanche: {
    name: 'Avalanche',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  fantom: {
    name: 'Fantom',
    addressLength: 42,
    prefix: '0x',
    supportsChecksum: true,
    caseSensitive: false
  },
  solana: {
    name: 'Solana',
    addressLength: [32, 44],
    encoding: 'base58',
    caseSensitive: true
  },
  bitcoin: {
    name: 'Bitcoin',
    encoding: 'base58',
    caseSensitive: true
  },
  litecoin: {
    name: 'Litecoin',
    encoding: 'base58',
    caseSensitive: true
  }
} as const;

/**
 * Base58 character set (Bitcoin alphabet)
. */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Validate Ethereum address format and checksum
 * @param address
. */
export function validateEthereumAddress(address: string): AddressValidationResult {
  const baseValidation = validateBaseAddressFormat(address, 'ethereum');
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  // Check basic format
  if (!ADDRESS_PATTERNS.ethereum.test(address)) {
    return createErrorResult('Invalid Ethereum address format. Expected 0x followed by 40 hex characters');
  }

  // Check mixed case checksum if present
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    const checksumValid = isValidEthereumChecksum(address);
    if (!checksumValid) {
      return {
        isValid: false,
        chain: 'ethereum',
        format: 'hex',
        checksum: false,
        normalized: address.toLowerCase(),
        displayFormat: formatAddressForDisplay(address),
        error: 'Invalid EIP-55 checksum'
      };
    }
    
    return {
      isValid: true,
      chain: 'ethereum',
      format: 'hex',
      checksum: true,
      normalized: address.toLowerCase(),
      displayFormat: formatAddressForDisplay(address)
    };
  }

  return {
    isValid: true,
    chain: 'ethereum',
    format: 'hex',
    checksum: false,
    normalized: address.toLowerCase(),
    displayFormat: formatAddressForDisplay(address)
  };
}

/**
 * Validate EVM-compatible address (Ethereum, BSC, Polygon, etc.)
 * @param address
 * @param chain
. */
export function validateEVMAddress(address: string, chain: SupportedChain = 'ethereum'): AddressValidationResult {
  if (!isEVMChain(chain)) {
    return createErrorResult('Unsupported EVM chain');
  }

  const baseValidation = validateBaseAddressFormat(address, chain);
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const pattern = ADDRESS_PATTERNS[chain as keyof typeof ADDRESS_PATTERNS] as RegExp;
  if (!pattern.test(address)) {
    return createErrorResult(`Invalid ${CHAIN_CONFIGS[chain].name} address format`);
  }

  // Check checksum for EVM chains that support it
  let checksumValid = false;
  const chainConfig = CHAIN_CONFIGS[chain];
  if ('supportsChecksum' in chainConfig && chainConfig.supportsChecksum && address !== address.toLowerCase() && address !== address.toUpperCase()) {
    checksumValid = isValidEthereumChecksum(address);
    if (!checksumValid) {
      return {
        isValid: false,
        chain,
        format: 'hex',
        checksum: false,
        error: 'Invalid EIP-55 checksum'
      };
    }
  }

  return {
    isValid: true,
    chain,
    format: 'hex',
    checksum: checksumValid,
    normalized: address.toLowerCase(),
    displayFormat: formatAddressForDisplay(address)
  };
}

/**
 * Validate Solana address
 * @param address
. */
export function validateSolanaAddress(address: string): AddressValidationResult {
  const baseValidation = validateBaseAddressFormat(address, 'solana');
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  if (!ADDRESS_PATTERNS.solana.test(address)) {
    return createErrorResult('Invalid Solana address format. Expected 32-44 Base58 characters');
  }

  // Additional validation for Solana addresses
  if (!isValidBase58(address)) {
    return createErrorResult('Invalid Base58 characters in Solana address');
  }

  // Validate address length (Solana addresses are typically 32 bytes = 44 Base58 chars)
  if (address.length < 32 || address.length > 44) {
    return createErrorResult(`Invalid Solana address length: ${address.length}. Expected 32-44 characters`);
  }

  return {
    isValid: true,
    chain: 'solana',
    format: 'base58',
    normalized: address,
    displayFormat: formatAddressForDisplay(address)
  };
}

/**
 * Validate Bitcoin address
 * @param address
. */
export function validateBitcoinAddress(address: string): AddressValidationResult {
  const baseValidation = validateBaseAddressFormat(address, 'bitcoin');
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const { legacy, segwit, taproot } = ADDRESS_PATTERNS.bitcoin;

  if (legacy.test(address)) {
    if (!isValidBase58(address)) {
      return createErrorResult('Invalid Base58 characters in Bitcoin legacy address');
    }
    return {
      isValid: true,
      chain: 'bitcoin',
      format: 'legacy',
      normalized: address,
      displayFormat: formatAddressForDisplay(address)
    };
  }

  if (segwit.test(address)) {
    if (!isValidBech32(address, 'bc')) {
      return createErrorResult('Invalid Bech32 encoding in Bitcoin SegWit address');
    }
    return {
      isValid: true,
      chain: 'bitcoin',
      format: 'segwit',
      normalized: address.toLowerCase(),
      displayFormat: formatAddressForDisplay(address)
    };
  }

  if (taproot.test(address)) {
    if (!isValidBech32(address, 'bc')) {
      return createErrorResult('Invalid Bech32 encoding in Bitcoin Taproot address');
    }
    return {
      isValid: true,
      chain: 'bitcoin',
      format: 'taproot',
      normalized: address.toLowerCase(),
      displayFormat: formatAddressForDisplay(address)
    };
  }

  return createErrorResult('Invalid Bitcoin address format');
}

/**
 * Validate Litecoin address
 * @param address
. */
export function validateLitecoinAddress(address: string): AddressValidationResult {
  const baseValidation = validateBaseAddressFormat(address, 'litecoin');
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const { legacy, segwit } = ADDRESS_PATTERNS.litecoin;

  if (legacy.test(address)) {
    if (!isValidBase58(address)) {
      return createErrorResult('Invalid Base58 characters in Litecoin legacy address');
    }
    return {
      isValid: true,
      chain: 'litecoin',
      format: 'legacy',
      normalized: address,
      displayFormat: formatAddressForDisplay(address)
    };
  }

  if (segwit.test(address)) {
    if (!isValidBech32(address, 'ltc')) {
      return createErrorResult('Invalid Bech32 encoding in Litecoin SegWit address');
    }
    return {
      isValid: true,
      chain: 'litecoin',
      format: 'segwit',
      normalized: address.toLowerCase(),
      displayFormat: formatAddressForDisplay(address)
    };
  }

  return createErrorResult('Invalid Litecoin address format');
}

/**
 * Universal address validator that detects chain automatically
 * @param address
 * @param chain
. */
export function validateAddress(address: string, chain?: SupportedChain): AddressValidationResult {
  const baseValidation = validateBaseAddressFormat(address);
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  // If chain is specified, validate for that specific chain
  if (chain) {
    switch (chain) {
      case 'ethereum':
        return validateEthereumAddress(address);
      case 'bsc':
      case 'polygon':
      case 'arbitrum':
      case 'optimism':
      case 'avalanche':
      case 'fantom':
        return validateEVMAddress(address, chain);
      case 'solana':
        return validateSolanaAddress(address);
      case 'bitcoin':
        return validateBitcoinAddress(address);
      case 'litecoin':
        return validateLitecoinAddress(address);
      default:
        return createErrorResult('Unsupported blockchain');
    }
  }

  // Auto-detect chain based on address format
  const detectionResults = [
    validateEthereumAddress(address),
    validateSolanaAddress(address),
    validateBitcoinAddress(address),
    validateLitecoinAddress(address)
  ];

  const validResults = detectionResults.filter(result => result.isValid);

  if (validResults.length === 0) {
    return createErrorResult('Invalid address format for any supported blockchain');
  }

  if (validResults.length > 1) {
    return createErrorResult('Ambiguous address format - please specify blockchain');
  }

  return validResults[0] || createErrorResult('No valid chain detected');
}

/**
 * Batch validate multiple addresses
 * @param addresses
 * @param chain
. */
export function validateAddresses(
  addresses: string[], 
  chain?: SupportedChain
): BatchAddressValidationResult[] {
  if (!Array.isArray(addresses)) {
    throw new Error('Addresses must be an array');
  }

  return addresses.map(address => ({
    address,
    result: validateAddress(address, chain)
  }));
}

/**
 * Normalize address format (lowercase for EVM chains)
 * @param address
 * @param chain
. */
export function normalizeAddress(address: string, chain?: SupportedChain): string {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const validation = validateAddress(address, chain);
  if (!validation.isValid) {
    return address; // Return original if invalid
  }

  // Normalize based on chain type
  switch (validation.chain) {
    case 'ethereum':
    case 'bsc':
    case 'polygon':
    case 'arbitrum':
    case 'optimism':
    case 'avalanche':
    case 'fantom':
      return address.toLowerCase();
    case 'bitcoin':
      // Bitcoin SegWit and Taproot addresses should be lowercase
      if (validation.format === 'segwit' || validation.format === 'taproot') {
        return address.toLowerCase();
      }
      return address; // Keep original case for legacy addresses
    case 'litecoin':
      // Litecoin SegWit addresses should be lowercase
      if (validation.format === 'segwit') {
        return address.toLowerCase();
      }
      return address; // Keep original case for legacy addresses
    case 'solana':
      return address; // Keep original case
    default:
      return address;
  }
}

/**
 * Get address info including chain detection
 * @param address
. */
export function getAddressInfo(address: string): AddressValidationResult & {
  chainName?: string;
  addressType?: string;
} {
  const validation = validateAddress(address);
  
  if (!validation.isValid) {
    return validation;
  }

  const result: AddressValidationResult & {
    chainName?: string;
    addressType?: string;
  } = { ...validation };

  if (validation.chain && CHAIN_CONFIGS[validation.chain]) {
    result.chainName = CHAIN_CONFIGS[validation.chain].name;
  }

  if (validation.format) {
    result.addressType = validation.format;
  }

  return result;
}

/**
 * Format address for display (truncated with ellipsis)
 * @param address
 * @param chain
 * @param chars
. */
export function formatAddressForDisplay(address: string, chain?: SupportedChain, chars: number = 6): string {
  if (!address || address.length <= chars * 2) {
    return address;
  }

  // Chain-specific formatting adjustments
  let adjustedChars = chars;
  if (chain) {
    switch (chain) {
      case 'solana':
        // Solana addresses are longer, show more characters by default
        adjustedChars = Math.max(chars, 8);
        break;
      case 'bitcoin':
      case 'litecoin':
        // Bitcoin/Litecoin addresses vary in length, adjust accordingly
        adjustedChars = Math.max(chars, 6);
        break;
      default:
        // EVM addresses are consistent 0x + 40 chars
        adjustedChars = chars;
    }
  }

  return `${address.slice(0, adjustedChars)}...${address.slice(-adjustedChars)}`;
}

/**
 * Validate base address format (common validations)
 * @param address
 * @param chain
. */
function validateBaseAddressFormat(address: string, chain?: SupportedChain): AddressValidationResult {
  if (!address || typeof address !== 'string') {
    return createErrorResult('Address must be a non-empty string');
  }

  const trimmed = address.trim();
  if (trimmed !== address) {
    return createErrorResult('Address cannot have leading or trailing whitespace');
  }

  if (trimmed.length === 0) {
    return createErrorResult('Address cannot be empty');
  }

  // Check for common issues
  if (trimmed.includes(' ')) {
    return createErrorResult('Address cannot contain spaces');
  }

  if (trimmed.length > 100) { // Reasonable upper limit
    return createErrorResult('Address too long');
  }

  // Chain-specific basic validations
  if (chain && CHAIN_CONFIGS[chain]) {
    const config = CHAIN_CONFIGS[chain];
    
    if ('addressLength' in config && typeof config.addressLength === 'number') {
      if (trimmed.length !== config.addressLength) {
        return createErrorResult(`Invalid ${config.name} address length. Expected ${config.addressLength}, got ${trimmed.length}`);
      }
    }
    
    if ('prefix' in config && !trimmed.startsWith(config.prefix)) {
      return createErrorResult(`${config.name} address must start with ${config.prefix}`);
    }
  }

  return { isValid: true };
}

/**
 * Check if string contains valid Base58 characters
 * @param str
. */
function isValidBase58(str: string): boolean {
  return str.split('').every(char => BASE58_ALPHABET.includes(char));
}

/**
 * Basic Bech32 validation (simplified)
 * @param address
 * @param expectedPrefix
. */
function isValidBech32(address: string, expectedPrefix: string): boolean {
  if (!address.startsWith(`${expectedPrefix  }1`)) {
    return false;
  }
  
  // Bech32 uses charset: qpzry9x8gf2tvdw0s3jn54khce6mua7l
  const bech32Chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data = address.slice(expectedPrefix.length + 1);
  
  return data.split('').every(char => bech32Chars.includes(char));
}

/**
 * Validate Ethereum address checksum using EIP-55 standard
 * @param address
. */
function isValidEthereumChecksum(address: string): boolean {
  try {
    const addr = address.slice(2); // Remove 0x prefix
    const hash = keccak256(addr.toLowerCase());
    
    for (let i = 0; i < 40; i++) {
      const char = addr[i];
      const hashChar = hash[i];
      
      if (!char || !hashChar) continue;
      
      if (char >= '0' && char <= '9') {
        // Numbers don't have case, so continue
        continue;
      }
      
      const shouldBeUppercase = parseInt(hashChar, 16) >= 8;
      const isUppercase = char >= 'A' && char <= 'F';
      const isLowercase = char >= 'a' && char <= 'f';
      
      if (shouldBeUppercase && !isUppercase) return false;
      if (!shouldBeUppercase && !isLowercase) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Keccak-256 hash function implementation using @noble/hashes
 * @param message
. */
function keccak256(message: string): string {
  const msgBytes = new TextEncoder().encode(message);
  const hash = keccak_256(msgBytes);
  return Array.from(hash).map((b) => (b).toString(16).padStart(2, '0')).join('');
}

/**
 * Check if chain is EVM-compatible
 * @param chain
. */
function isEVMChain(chain: SupportedChain): boolean {
  return ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'fantom'].includes(chain);
}

/**
 * Create error result helper
 * @param message
. */
function createErrorResult(message: string): AddressValidationResult {
  return {
    isValid: false,
    error: message
  };
}

/**
 * Generate address checksum for EVM addresses
 * @param address
. */
export function generateEthereumChecksum(address: string): string {
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new Error('Invalid address format for checksum generation');
  }

  const addr = address.slice(2).toLowerCase();
  const hash = keccak256(addr);
  
  let checksummedAddress = '0x';
  
  for (let i = 0; i < 40; i++) {
    const char = addr[i];
    const hashChar = hash[i];
    
    if (!char || !hashChar) continue;
    
    if (char >= '0' && char <= '9') {
      checksummedAddress += char;
    } else {
      const shouldBeUppercase = parseInt(hashChar, 16) >= 8;
      checksummedAddress += shouldBeUppercase ? char.toUpperCase() : char.toLowerCase();
    }
  }
  
  return checksummedAddress;
}

/**
 * Address validation utilities
. */
export const addressValidationUtils = {
  validateEthereumAddress,
  validateEVMAddress,
  validateSolanaAddress,
  validateBitcoinAddress,
  validateLitecoinAddress,
  validateAddress,
  validateAddresses,
  normalizeAddress,
  getAddressInfo,
  formatAddressForDisplay,
  generateEthereumChecksum,
  
  // Utility functions
  isEVMAddress: (address: string) => ADDRESS_PATTERNS.ethereum.test(address),
  isSolanaAddress: (address: string) => ADDRESS_PATTERNS.solana.test(address),
  isBitcoinAddress: (address: string) => {
    const { legacy, segwit, taproot } = ADDRESS_PATTERNS.bitcoin;
    return legacy.test(address) || segwit.test(address) || taproot.test(address);
  },
  isLitecoinAddress: (address: string) => {
    const { legacy, segwit } = ADDRESS_PATTERNS.litecoin;
    return legacy.test(address) || segwit.test(address);
  },
  
  // Chain detection
  detectChain: (address: string): SupportedChain | null => {
    const result = validateAddress(address);
    return result.isValid ? result.chain || null : null;
  },
  
  // Constants
  ADDRESS_PATTERNS,
  CHAIN_CONFIGS,
  BASE58_ALPHABET
};

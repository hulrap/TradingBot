/**
 * @file Address utility functions
 * @package @trading-bot/utilities
 * 
 * Production-grade blockchain address utilities with checksum validation,
 * conversion functions, and multi-chain support for trading applications.
. */

import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

import type {
  AddressValidationResult
} from '../../../types/src/blockchain/addresses';
import type { 
  SupportedChain
} from '../../../types/src/blockchain/chain';


// ==========================================
// CORE ADDRESS OPERATIONS
// ==========================================

/**
 * Generate Ethereum checksum address using EIP-55
 * @param address
. */
export function toChecksumAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid address input');
  }

  // Remove 0x prefix and convert to lowercase
  const cleanAddress = address.toLowerCase().replace(/^0x/, '');
  
  // Validate hex format
  if (!/^[0-9a-f]{40}$/i.test(cleanAddress)) {
    throw new Error('Invalid Ethereum address format');
  }

  // Implement Keccak-256 hash for checksum
  const hash = keccak256(cleanAddress);
  let checksumAddress = '0x';

  for (let i = 0; i < cleanAddress.length; i++) {
    const char = cleanAddress[i];
    const hashChar = hash[i];
    
    if (!char || !hashChar) continue;
    
    // If hash character is >= 8, uppercase the address character
    if (parseInt(hashChar, 16) >= 8) {
      checksumAddress += char.toUpperCase();
    } else {
      checksumAddress += char;
    }
  }

  return checksumAddress;
}

/**
 * Validate Ethereum address checksum
 * @param address
. */
export function isValidChecksum(address: string): boolean {
  try {
    const checksummed = toChecksumAddress(address);
    return address === checksummed;
  } catch {
    return false;
  }
}

/**
 * Comprehensive address validation with detailed results
 * @param address
 * @param chain
. */
export function validateAddress(address: string, chain?: SupportedChain): AddressValidationResult {
  const cleanAddress = address.trim();
  
  if (!cleanAddress) {
    return {
      isValid: false,
      errors: ['Empty address provided'],
      warnings: [],
      metadata: {
        chain: 'ethereum' as SupportedChain
      }
    };
  }

  // Auto-detect chain if not provided
  if (!chain) {
    const detected = detectAddressChain(cleanAddress);
    if (!detected.isValid) {
      return {
        isValid: false,
        errors: ['Unrecognized address format'],
        warnings: [],
        metadata: {
          chain: 'ethereum' as SupportedChain
        }
      };
    }
    chain = detected.metadata.chain;
  }

  // Validate based on specific chain
  switch (chain) {
    case 'ethereum':
    case 'polygon':
    case 'bsc':
    case 'arbitrum':
    case 'optimism':
    case 'avalanche':
    case 'fantom':
    case 'base':
      return validateEVMAddress(cleanAddress, chain);
    
    case 'solana':
      return validateSolanaAddress(cleanAddress);
    
    default:
      return {
        isValid: false,
        errors: [`Unsupported chain: ${chain}`],
        warnings: [],
        metadata: {
          chain
        }
      };
  }
}

/**
 * Convert address between different blockchain formats
 * @param address
 * @param fromChain
 * @param toChain
 * @param options
 * @param options.validate
 * @param options.applyChecksum
. */
export function convertAddress(
  address: string,
  fromChain: SupportedChain,
  toChain: SupportedChain,
  options: {
    validate?: boolean;
    applyChecksum?: boolean;
  } = {}
): string {
  const { validate = true, applyChecksum = true } = options;

  // Validate input address if requested
  if (validate && !isValidAddressFormat(address, fromChain)) {
    throw new Error(`Invalid ${fromChain} address format`);
  }

  // Handle cross-chain conversion scenarios
  if (isEVMChain(fromChain) && isEVMChain(toChain)) {
    // EVM to EVM - same address format
    return applyChecksum ? toChecksumAddress(address) : address.toLowerCase();
  }

  if (fromChain === toChain) {
    return normalizeAddress(address, fromChain);
  }

  // Cross-ecosystem conversions are not supported
  throw new Error(`Cannot convert address from ${fromChain} to ${toChain}: cross-ecosystem conversion not supported`);
}

/**
 * Normalize address format for a specific chain
 * @param address
 * @param chain
. */
export function normalizeAddress(address: string, chain: SupportedChain): string {
  switch (chain) {
    case 'ethereum':
    case 'polygon':
    case 'bsc':
    case 'arbitrum':
    case 'optimism':
    case 'avalanche':
    case 'fantom':
    case 'base':
      return toChecksumAddress(address);
    
    case 'solana':
      // Solana addresses are case-sensitive, return as-is if valid
      if (isValidAddressFormat(address, chain)) {
        return address;
      }
      throw new Error(`Invalid ${chain} address format`);
    
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

/**
 * Enhanced address format validation for specific blockchain
 * @param address
 * @param chain
. */
export function isValidAddressFormat(address: string, chain: SupportedChain): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const result = validateAddress(address, chain);
  return result.isValid;
}

/**
 * Generate address from public key with enhanced options
 * @param publicKey
 * @param chain
 * @param _options
 * @param _options.compressed
 * @param _options.addressType
 * @param _options.network
. */
export function addressFromPublicKey(
  publicKey: string | Buffer,
  chain: SupportedChain,
  _options: { 
    compressed?: boolean;
    addressType?: 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh';
    network?: 'mainnet' | 'testnet';
  } = {}
): string {
  switch (chain) {
    case 'ethereum':
    case 'polygon':
    case 'bsc':
    case 'arbitrum':
    case 'optimism':
    case 'avalanche':
    case 'fantom':
    case 'base':
      return ethereumAddressFromPublicKey(publicKey);
    
    case 'solana':
      return solanaAddressFromPublicKey(publicKey);
    
    default:
      throw new Error(`Address generation not supported for chain: ${chain}`);
  }
}

// ==========================================
// CHAIN-SPECIFIC VALIDATION FUNCTIONS
// ==========================================

/**
 * Detect blockchain from address format
 * @param address
. */
function detectAddressChain(address: string): AddressValidationResult {
  // EVM chains (hex format)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    const isChecksum = isValidChecksum(address);
    return {
      isValid: true,
      format: 'evm-hex',
      normalized: address.toLowerCase(),
      checksum: isChecksum ? address : toChecksumAddress(address),
      errors: [],
      warnings: isChecksum ? [] : ['Address is not in checksum format'],
      metadata: {
        chain: 'ethereum' // Default to Ethereum for EVM addresses
      }
    };
  }
  
  // Solana (Base58)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return {
      isValid: true,
      format: 'solana-base58',
      normalized: address,
      errors: [],
      warnings: [],
      metadata: {
        chain: 'solana'
      }
    };
  }
  
  return {
    isValid: false,
    errors: ['Unrecognized address format'],
    warnings: [],
    metadata: {
      chain: 'ethereum' as SupportedChain
    }
  };
}

/**
 * Validate EVM chain address
 * @param address
 * @param chain
. */
function validateEVMAddress(address: string, chain: SupportedChain): AddressValidationResult {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      isValid: false,
      errors: ['Invalid EVM address format'],
      warnings: [],
      metadata: {
        chain
      }
    };
  }

  const isChecksum = isValidChecksum(address);
  const normalized = address.toLowerCase();
  const checksum = toChecksumAddress(address);

  return {
    isValid: true,
    format: 'evm-hex',
    normalized,
    checksum,
    errors: [],
    warnings: isChecksum ? [] : ['Address is not in checksum format'],
    metadata: {
      chain
    }
  };
}

/**
 * Validate Solana address
 * @param address
. */
function validateSolanaAddress(address: string): AddressValidationResult {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return {
      isValid: false,
      errors: ['Invalid Solana address format'],
      warnings: [],
      metadata: {
        chain: 'solana'
      }
    };
  }

  return {
    isValid: true,
    format: 'solana-base58',
    normalized: address,
    errors: [],
    warnings: [],
    metadata: {
      chain: 'solana'
    }
  };
}

// ==========================================
// ADDRESS GENERATION FUNCTIONS
// ==========================================

/**
 * Generate Ethereum address from public key
 * @param publicKey
. */
function ethereumAddressFromPublicKey(publicKey: string | Buffer): string {
  let pubKeyBuffer: Buffer;
  
  if (typeof publicKey === 'string') {
    // Remove 0x prefix if present
    const cleanKey = publicKey.replace(/^0x/, '');
    pubKeyBuffer = Buffer.from(cleanKey, 'hex');
  } else {
    pubKeyBuffer = publicKey;
  }
  
  // Ethereum uses uncompressed public key (64 bytes without 0x04 prefix)
  if (pubKeyBuffer.length === 65 && pubKeyBuffer[0] === 0x04) {
    pubKeyBuffer = pubKeyBuffer.slice(1);
  }
  
  if (pubKeyBuffer.length !== 64) {
    throw new Error('Invalid public key length for Ethereum address generation');
  }
  
  // Hash the public key with Keccak-256 and take last 20 bytes
  const hash = keccak256(pubKeyBuffer.toString('hex'));
  const address = `0x${  hash.slice(-40)}`;
  
  return toChecksumAddress(address);
}

/**
 * Generate Solana address from public key
 * @param publicKey
. */
function solanaAddressFromPublicKey(publicKey: string | Buffer): string {
  let pubKeyBuffer: Buffer;
  
  if (typeof publicKey === 'string') {
    // Remove 0x prefix if present and convert from hex
    const cleanKey = publicKey.replace(/^0x/, '');
    pubKeyBuffer = Buffer.from(cleanKey, 'hex');
  } else {
    pubKeyBuffer = publicKey;
  }
  
  // Solana public keys should be 32 bytes
  if (pubKeyBuffer.length !== 32) {
    throw new Error('Invalid public key length for Solana address generation - must be 32 bytes');
  }
  
  // For Solana, the address is the public key itself encoded in base58
  // Implementing base58 encoding manually since we don't want external dependencies
  return encodeBase58(pubKeyBuffer);
}

/**
 * Base58 encoding implementation for Solana addresses
 * @param buffer
. */
function encodeBase58(buffer: Buffer): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  // Handle empty buffer
  if (buffer.length === 0) return '';
  
  // Convert to big integer
  let num = BigInt(`0x${  buffer.toString('hex')}`);
  
  // Handle zero
  if (num === 0n) return alphabet[0]!;
  
  // Convert to base58
  let result = '';
  while (num > 0n) {
    const remainder = num % 58n;
    const index = Number(remainder);
    if (index < 0 || index >= alphabet.length) {
      throw new Error('Invalid base58 encoding index');
    }
    result = alphabet[index]! + result;
    num = num / 58n;
  }
  
  // Add leading zeros as '1's
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result = alphabet[0] + result;
  }
  
  return result;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if chain is EVM-compatible
 * @param chain
. */
function isEVMChain(chain: SupportedChain): boolean {
  const evmChains: SupportedChain[] = [
    'ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche', 'fantom', 'base'
  ];
  return evmChains.includes(chain);
}

/**
 * Production-grade Keccak-256 implementation using @noble/hashes
 * @param data
. */
function keccak256(data: string | Buffer): string {
  let input: Uint8Array;
  
  if (typeof data === 'string') {
    // Convert hex string to bytes
    const cleanData = data.replace(/^0x/, '');
    input = new Uint8Array(Buffer.from(cleanData, 'hex'));
  } else {
    input = new Uint8Array(data);
  }
  
  const hash = keccak_256(input);
  return bytesToHex(hash);
}

/**
 * Batch validate multiple addresses
 * @param addresses
. */
export function batchValidateAddresses(
  addresses: Array<{ address: string; chain?: SupportedChain }>
): Array<AddressValidationResult & { originalAddress: string }> {
  return addresses.map(({ address, chain }) => ({
    ...validateAddress(address, chain),
    originalAddress: address
  }));
}

/**
 * Compare two addresses for equality (normalized)
 * @param address1
 * @param address2
 * @param chain
. */
export function compareAddresses(
  address1: string,
  address2: string,
  chain: SupportedChain
): boolean {
  try {
    const norm1 = normalizeAddress(address1, chain);
    const norm2 = normalizeAddress(address2, chain);
    return norm1.toLowerCase() === norm2.toLowerCase();
  } catch {
    return false;
  }
}

// ==========================================
// EXPORT UTILITIES OBJECT
// ==========================================

/**
 * Address utility functions organized by functionality
. */
export const addressUtils = {
  // Core operations
  toChecksumAddress,
  isValidChecksum,
  validateAddress,
  convertAddress,
  normalizeAddress,
  isValidAddressFormat,
  addressFromPublicKey,
  
  // Batch operations
  batchValidateAddresses,
  compareAddresses,
  
  // Chain-specific utilities
  ethereum: {
    toChecksum: (addr: string) => toChecksumAddress(addr),
    isValid: (addr: string) => isValidAddressFormat(addr, 'ethereum'),
    fromPublicKey: (pubKey: string | Buffer) => addressFromPublicKey(pubKey, 'ethereum'),
    isContract: async (_addr: string) => {
      // This would require a provider call to check if address has code
      throw new Error('Contract detection requires blockchain provider');
    }
  },
  
  solana: {
    isValid: (addr: string) => isValidAddressFormat(addr, 'solana'),
    fromPublicKey: (pubKey: string | Buffer) => addressFromPublicKey(pubKey, 'solana')
  },
  
  // Multi-chain utilities
  detectChain: (addr: string) => detectAddressChain(addr).metadata.chain,
  normalize: normalizeAddress,
  convert: convertAddress,
  isEVMChain,
  
  // Validation helpers
  validate: validateAddress,
  batchValidate: batchValidateAddresses,
  compare: compareAddresses
};

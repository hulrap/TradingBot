/**
 * @file Crypto utility types for the utilities package.
 * @package @trading-bot/types
 */

/** Crypto hash options. */
interface CryptoHashOptions {
  /** Hash algorithm. */
  algorithm: 'sha256' | 'sha512' | 'md5' | 'keccak256' | 'blake2b';
  
  /** Output encoding. */
  encoding?: 'hex' | 'base64' | 'buffer';
  
  /** Salt for hashing. */
  salt?: string;
  
  /** Number of iterations for key derivation. */
  iterations?: number;
}

/** Encryption options. */
interface EncryptionOptions {
  /** Encryption algorithm. */
  algorithm: 'aes-256-cbc' | 'aes-256-gcm' | 'chacha20-poly1305';
  
  /** Encryption key. */
  key: string | Buffer;
  
  /** Initialization vector. */
  iv?: Buffer;
  
  /** Additional authenticated data (for AEAD). */
  aad?: Buffer;
  
  /** Output encoding. */
  encoding?: 'hex' | 'base64' | 'buffer';
}

/** Signature options. */
interface SignatureOptions {
  /** Signature algorithm. */
  algorithm: 'ed25519' | 'secp256k1' | 'rsa' | 'hmac';
  
  /** Private key for signing. */
  privateKey: string | Buffer;
  
  /** Message encoding. */
  messageEncoding?: 'utf8' | 'hex' | 'base64';
  
  /** Signature encoding. */
  signatureEncoding?: 'hex' | 'base64' | 'der';
}

/** Signature verification options. */
interface SignatureVerificationOptions {
  /** Signature algorithm. */
  algorithm: 'ed25519' | 'secp256k1' | 'rsa' | 'hmac';
  
  /** Message encoding. */
  messageEncoding?: 'utf8' | 'hex' | 'base64';
  
  /** Signature encoding. */
  signatureEncoding?: 'hex' | 'base64' | 'der';
}

/** Signature result. */
interface SignatureResult {
  /** Generated signature. */
  signature: string;
  
  /** Message hash. */
  messageHash: string;
  
  /** Public key used for signing. */
  publicKey: string;
  
  /** Recovery ID (for ECDSA). */
  v: number;
  
  /** R component of signature. */
  r: string;
  
  /** S component of signature. */
  s: string;
}

/** Key pair result. */
interface KeyPairResult {
  /** Private key. */
  privateKey: string;
  
  /** Public key. */
  publicKey: string;
  
  /** Algorithm used. */
  algorithm: string;
}

/** Key derivation options. */
interface KeyDerivationOptions {
  /** Key derivation function. */
  kdf: 'pbkdf2' | 'scrypt' | 'argon2' | 'hkdf';
  
  /** Password/input key material. */
  password: string | Buffer;
  
  /** Salt. */
  salt: Buffer;
  
  /** Number of iterations. */
  iterations?: number;
  
  /** Memory cost (for scrypt/argon2). */
  memoryCost?: number;
  
  /** Parallelism (for argon2). */
  parallelism?: number;
  
  /** Output key length. */
  keyLength: number;
}

// ==========================================
// AMOUNT-SPECIFIC TYPES (CHAIN-AGNOSTIC)
// ==========================================

/** Amount calculation precision options. */
interface AmountPrecisionOptions {
  /** Number of decimal places to maintain. */
  precision?: number;
  
  /** Rounding mode. */
  roundingMode?: 'up' | 'down' | 'nearest' | 'truncate';
  
  /** Whether to remove trailing zeros. */
  removeTrailingZeros?: boolean;
  
  /** Maximum significant digits. */
  maxSignificantDigits?: number;
}

/** Amount display formatting options. */
interface AmountDisplayOptions extends AmountPrecisionOptions {
  /** Whether to use thousands separators. */
  useGrouping?: boolean;
  
  /** Thousands separator character. */
  groupingSeparator?: string;
  
  /** Decimal separator character. */
  decimalSeparator?: string;
  
  /** Currency symbol or token symbol. */
  symbol?: string;
  
  /** Symbol position. */
  symbolPosition?: 'before' | 'after';
  
  /** Minimum amount to display (below this shows as "< min"). */
  minimumDisplay?: string;
}

/** Trading calculation options. */
interface TradingCalculationOptions {
  /** Slippage tolerance percentage. */
  slippageTolerance?: number;
  
  /** Fee percentage. */
  feePercentage?: number;
  
  /** Fee type. */
  feeType?: 'percentage' | 'flat';
  
  /** Flat fee amount (if feeType is 'flat'). */
  flatFeeAmount?: bigint;
  
  /** Price impact tolerance. */
  priceImpactTolerance?: number;
}

/** Amount conversion result. */
interface AmountConversionResult {
  /** Converted amount. */
  amount: bigint;
  
  /** Original amount. */
  originalAmount: bigint;
  
  /** Source decimals. */
  sourceDecimals: number;
  
  /** Target decimals. */
  targetDecimals: number;
  
  /** Whether precision was lost in conversion. */
  precisionLoss: boolean;
  
  /** Human-readable formatted amount. */
  formatted: string;
}

// ==========================================
// ENHANCED SIGNATURE TYPES
// ==========================================

/** Extended signature options with blockchain-specific parameters. */
interface ExtendedSignatureOptions extends SignatureOptions {
  /** Blockchain-specific options. */
  chainOptions?: {
    /** Chain ID for EIP-155 signatures. */
    chainId?: number;
    
    /** Whether to use personal sign format. */
    usePersonalSign?: boolean;
    
    /** Custom message prefix. */
    messagePrefix?: string;
  };
  
  /** Key derivation path (for HD wallets). */
  derivationPath?: string;
  
  /** Whether to include recovery ID. */
  includeRecovery?: boolean;
}

/** Enhanced signature result with additional metadata. */
interface ExtendedSignatureResult extends SignatureResult {
  /** Signature algorithm used. */
  algorithm: string;
  
  /** Chain ID (if applicable). */
  chainId?: number;
  
  /** Whether personal sign format was used. */
  isPersonalSign?: boolean;
  
  /** Signature timestamp. */
  timestamp: number;
  
  /** Additional metadata. */
  metadata?: {
    derivationPath?: string;
    keyIndex?: number;
    walletType?: string;
    signatureType?: string;
    additional?: Record<string, string | number | boolean>;
  };
}

/** Signature verification result. */
interface SignatureVerificationResult {
  /** Whether the signature is valid. */
  isValid: boolean;
  
  /** Recovered signer address. */
  signerAddress?: string;
  
  /** Signature algorithm. */
  algorithm: string;
  
  /** Error message if verification failed. */
  error?: string;
  
  /** Additional verification metadata. */
  metadata?: {
    publicKey?: string;
    messageHash?: string;
    recoveryId?: number;
    chainId?: number;
    verificationMethod?: string;
    additional?: Record<string, string | number | boolean>;
  };
}

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Hash algorithm types.
 */
type HashAlgorithm = 'sha256' | 'sha512' | 'blake2b' | 'keccak256' | 'md5';

/**
 * Encryption algorithm types.
 */
type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-128-gcm' | 'chacha20-poly1305' | 'rsa-oaep';

/**
 * Signature algorithm types.
 */
type SignatureAlgorithm = 'ecdsa' | 'ed25519' | 'rsa-pss' | 'hmac-sha256';

/**
 * Key derivation function type (alias for KeyDerivationOptions).
 */
interface KeyDerivationFunction extends KeyDerivationOptions {}

/**
 * Crypto key interface.
 */
interface CryptoKey {
  /** Key identifier. */
  id: string;
  
  /** Key type. */
  type: 'private' | 'public' | 'symmetric';
  
  /** Key algorithm. */
  algorithm: string;
  
  /** Key size in bits. */
  size: number;
  
  /** Key data. */
  data: string | Buffer;
  
  /** Key metadata. */
  metadata: {
    created: number;
    usage: string[];
    extractable: boolean;
  };
}

/**
 * Key pair interface.
 */
interface KeyPair {
  /** Private key. */
  privateKey: CryptoKey;
  
  /** Public key. */
  publicKey: CryptoKey;
  
  /** Key pair metadata. */
  metadata: {
    algorithm: string;
    keySize: number;
    created: number;
  };
}

/**
 * Digital signature interface.
 */
interface DigitalSignature {
  /** Signature data. */
  signature: string | Buffer;
  
  /** Signature algorithm. */
  algorithm: SignatureAlgorithm;
  
  /** Public key for verification. */
  publicKey: CryptoKey;
  
  /** Signature metadata. */
  metadata: {
    created: number;
    messageHash: string;
  };
}

/**
 * Encrypted data interface.
 */
interface EncryptedData {
  /** Encrypted content. */
  data: string | Buffer;
  
  /** Encryption algorithm. */
  algorithm: EncryptionAlgorithm;
  
  /** Initialization vector. */
  iv: string | Buffer;
  
  /** Authentication tag. */
  tag?: string | Buffer;
  
  /** Encryption metadata. */
  metadata: {
    keyId: string;
    created: number;
  };
}

/**
 * Hash result interface.
 */
interface HashResult {
  /** Hash value. */
  hash: string | Buffer;
  
  /** Hash algorithm. */
  algorithm: HashAlgorithm;
  
  /** Original data size. */
  dataSize: number;
  
  /** Hash metadata. */
  metadata: {
    created: number;
    encoding: 'hex' | 'base64' | 'buffer';
  };
}

/**
 * Crypto configuration.
 */
interface CryptoConfig {
  /** Default algorithms. */
  defaults: {
    hash: HashAlgorithm;
    encryption: EncryptionAlgorithm;
    signature: SignatureAlgorithm;
  };
  
  /** Security settings. */
  security: {
    keySize: number;
    saltSize: number;
    iterations: number;
  };
  
  /** Performance settings. */
  performance: {
    enableParallel: boolean;
    maxConcurrency: number;
  };
}

/**
 * Key management interface.
 */
interface KeyManagement {
  /** Generate new key. */
  generateKey(algorithm: string, options?: Record<string, unknown>): Promise<CryptoKey>;
  
  /** Store key. */
  storeKey(key: CryptoKey): Promise<string>;
  
  /** Retrieve key. */
  getKey(keyId: string): Promise<CryptoKey | undefined>;
  
  /** Delete key. */
  deleteKey(keyId: string): Promise<boolean>;
  
  /** List keys. */
  listKeys(): Promise<string[]>;
  
  /** Rotate key. */
  rotateKey(keyId: string): Promise<CryptoKey>;
}

/**
 * Secure random interface.
 */
interface SecureRandom {
  /** Generate random bytes. */
  bytes(size: number): Buffer;
  
  /** Generate random string. */
  string(length: number, charset?: string): string;
  
  /** Generate random number. */
  number(min: number, max: number): number;
  
  /** Generate UUID. */
  uuid(): string;
}

/**
 * Crypto provider interface.
 */
interface CryptoProvider {
  /** Provider name. */
  name: string;
  
  /** Supported algorithms. */
  algorithms: string[];
  
  /** Hash data. */
  hash(data: string | Buffer, algorithm: HashAlgorithm): Promise<HashResult>;
  
  /** Encrypt data. */
  encrypt(data: string | Buffer, key: CryptoKey, algorithm: EncryptionAlgorithm): Promise<EncryptedData>;
  
  /** Decrypt data. */
  decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<string | Buffer>;
  
  /** Sign data. */
  sign(data: string | Buffer, privateKey: CryptoKey, algorithm: SignatureAlgorithm): Promise<DigitalSignature>;
  
  /** Verify signature. */
  verify(data: string | Buffer, signature: DigitalSignature): Promise<boolean>;
}

/**
 * Crypto operation interface.
 */
interface CryptoOperation {
  /** Operation ID. */
  id: string;
  
  /** Operation type. */
  type: 'hash' | 'encrypt' | 'decrypt' | 'sign' | 'verify';
  
  /** Operation status. */
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  /** Operation progress. */
  progress: number;
  
  /** Operation result. */
  result?: unknown;
  
  /** Operation error. */
  error?: string;
  
  /** Operation metadata. */
  metadata: {
    started: number;
    completed?: number;
    algorithm: string;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Supported cryptographic algorithms.
 */
const SUPPORTED_ALGORITHMS = {
  HASH: {
    SHA256: 'sha256',
    SHA512: 'sha512',
    BLAKE2B: 'blake2b',
    KECCAK256: 'keccak256'
  },
  ENCRYPTION: {
    AES_256_GCM: 'aes-256-gcm',
    AES_128_GCM: 'aes-128-gcm',
    CHACHA20_POLY1305: 'chacha20-poly1305'
  },
  SIGNATURE: {
    ECDSA: 'ecdsa',
    ED25519: 'ed25519',
    RSA_PSS: 'rsa-pss'
  }
} as const;

/**
 * Crypto standards and specifications.
 */
const CRYPTO_STANDARDS = {
  KEY_SIZES: {
    AES_128: 128,
    AES_256: 256,
    RSA_2048: 2048,
    RSA_4096: 4096,
    ECDSA_P256: 256,
    ECDSA_P384: 384
  },
  ITERATIONS: {
    PBKDF2_MIN: 10000,
    PBKDF2_RECOMMENDED: 100000,
    SCRYPT_RECOMMENDED: 32768
  },
  SALT_SIZES: {
    MINIMUM: 16,
    RECOMMENDED: 32
  }
} as const;

// Consolidated export declaration
export type {
  CryptoHashOptions,
  EncryptionOptions,
  SignatureOptions,
  SignatureVerificationOptions,
  SignatureResult,
  KeyPairResult,
  KeyDerivationOptions,
  AmountPrecisionOptions,
  AmountDisplayOptions,
  TradingCalculationOptions,
  AmountConversionResult,
  ExtendedSignatureOptions,
  ExtendedSignatureResult,
  SignatureVerificationResult,
  HashAlgorithm,
  EncryptionAlgorithm,
  SignatureAlgorithm,
  KeyDerivationFunction,
  CryptoKey,
  KeyPair,
  DigitalSignature,
  EncryptedData,
  HashResult,
  CryptoConfig,
  KeyManagement,
  SecureRandom,
  CryptoProvider,
  CryptoOperation
};

export {
  SUPPORTED_ALGORITHMS,
  CRYPTO_STANDARDS
}; 
/**
 * Encrypts a plaintext string with per-encryption salt for maximum security.
 * @param text The plaintext to encrypt.
 * @param userSalt Optional user-specific salt for additional security
 * @returns A string containing the salt, IV and the encrypted text, separated by colons.
 * @throws Error if MASTER_ENCRYPTION_KEY is not set or text is empty
 */
declare function encrypt(text: string, userSalt?: string): string;
/**
 * Decrypts a string that was encrypted with the encrypt function.
 * @param hash A string containing the salt, IV and encrypted text, separated by colons.
 * @returns The decrypted plaintext.
 * @throws Error if hash format is invalid or MASTER_ENCRYPTION_KEY is not set
 */
declare function decrypt(hash: string): string;
/**
 * Hashes a password using bcrypt with configurable salt rounds
 * @param password The plain text password to hash
 * @param rounds Optional number of salt rounds (default: 12)
 * @returns Promise resolving to the hashed password
 * @throws Error if password is too short or invalid
 */
declare function hashPassword(password: string, rounds?: number): Promise<string>;
/**
 * Verifies a password against a hash
 * @param password The plain text password to verify
 * @param hash The hash to verify against
 * @returns Promise resolving to true if password matches
 */
declare function verifyPassword(password: string, hash: string): Promise<boolean>;
interface JWTPayload extends Record<string, any> {
    sub: string;
    email?: string;
    iat?: number;
    exp?: number;
    jti?: string;
}
/**
 * Creates a JWT token with enhanced security features
 * @param payload The payload to encode in the token
 * @param expiresIn Token expiration time (default: 24h)
 * @returns Promise resolving to the JWT token
 * @throws Error if JWT_SECRET is not set or payload is invalid
 */
declare function createJWT(payload: JWTPayload, expiresIn?: string | number): Promise<string>;
/**
 * Verifies a JWT token with enhanced error handling
 * @param token The JWT token to verify
 * @returns Promise resolving to the payload if valid
 * @throws Error if token is invalid, expired, or malformed
 */
declare function verifyJWT(token: string): Promise<JWTPayload>;
/**
 * Creates a refresh token with longer expiration and additional security
 * @param payload The payload to encode in the refresh token
 * @param expiresIn Token expiration time (default: 7d)
 * @returns Promise resolving to the refresh token
 */
declare function createRefreshToken(payload: JWTPayload, expiresIn?: string): Promise<string>;
/**
 * Extracts JWT payload without verification (for debugging only)
 * @param token The JWT token to decode
 * @returns The decoded payload
 * @warning This does not verify the token signature - use only for debugging
 */
declare function decodeJWTUnsafe(token: string): JWTPayload | null;
declare function generateSecureRandom(length?: number): string;
declare function generateAPIKey(prefix?: string): string;
/**
 * Validates if a string is a properly formatted API key
 * @param apiKey The API key to validate
 * @param expectedPrefix Expected prefix (default: 'tb')
 * @returns True if the API key format is valid
 */
declare function validateAPIKeyFormat(apiKey: string, expectedPrefix?: string): boolean;
/**
 * Securely compares two strings to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
declare function secureCompare(a: string, b: string): boolean;
declare function validateCryptoEnvironment(): {
    valid: boolean;
    errors: string[];
};
/**
 * Validates Ethereum wallet address format
 * @param address The wallet address to validate
 * @returns True if address format is valid
 */
declare function validateEthereumAddress(address: string): boolean;
/**
 * Validates Bitcoin wallet address format (Legacy, P2SH, Bech32)
 * @param address The Bitcoin address to validate
 * @returns True if address format is valid
 */
declare function validateBitcoinAddress(address: string): boolean;
/**
 * Generates a secure trading session token with metadata
 * @param userId User identifier
 * @param metadata Additional session metadata
 * @param expiresIn Session expiration (default: 4h)
 * @returns Promise resolving to session token
 */
declare function createTradingSession(userId: string, metadata?: Record<string, any>, expiresIn?: string): Promise<string>;
/**
 * Creates a secure message signature for API authentication
 * @param message The message to sign
 * @param privateKey The private key for signing
 * @param algorithm Hash algorithm (default: sha256)
 * @returns The message signature
 */
declare function signMessage(message: string, privateKey: string, algorithm?: string): string;
/**
 * Verifies a message signature
 * @param message The original message
 * @param signature The signature to verify
 * @param privateKey The private key used for signing
 * @param algorithm Hash algorithm (default: sha256)
 * @returns True if signature is valid
 */
declare function verifyMessageSignature(message: string, signature: string, privateKey: string, algorithm?: string): boolean;
/**
 * Generates a secure BIP39 seed phrase for HD wallet creation - Production Ready
 * @param entropyBits Entropy bits (128, 160, 192, 224, 256) mapping to (12, 15, 18, 21, 24) words
 * @returns Secure BIP39 compliant seed phrase
 */
declare function generateSeedPhrase(entropyBits?: number): string;
/**
 * Validates BIP39 seed phrase format, checksum, and wordlist compliance - Production Ready
 * @param seedPhrase The seed phrase to validate
 * @returns True if seed phrase is valid BIP39 compliant
 */
declare function validateSeedPhrase(seedPhrase: string): boolean;
/**
 * Converts BIP39 mnemonic to cryptographic seed for key derivation - Production Ready
 * @param mnemonic Valid BIP39 mnemonic phrase
 * @param passphrase Optional passphrase for additional security
 * @returns Promise resolving to 512-bit seed as Buffer
 */
declare function mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<Buffer>;
/**
 * Converts BIP39 mnemonic to entropy bytes - Production Ready
 * @param mnemonic Valid BIP39 mnemonic phrase
 * @returns Entropy as hex string
 */
declare function mnemonicToEntropy(mnemonic: string): string;
/**
 * Converts entropy to BIP39 mnemonic - Production Ready
 * @param entropy Entropy as hex string or Buffer
 * @returns BIP39 mnemonic phrase
 */
declare function entropyToMnemonic(entropy: string | Buffer): string;
/**
 * Creates a rate-limited token for API access control
 * @param identifier Client identifier
 * @param rateLimit Requests per time window
 * @param timeWindow Time window in seconds (default: 3600)
 * @returns Rate-limited token
 */
declare function createRateLimitedToken(identifier: string, rateLimit: number, timeWindow?: number): Promise<string>;
/**
 * Derives a deterministic key from master key and derivation path
 * @param masterKey The master key
 * @param derivationPath The derivation path (e.g., "m/44'/60'/0'/0/0")
 * @param keyLength Output key length in bytes (default: 32)
 * @returns Derived key as hex string
 */
declare function deriveKey(masterKey: string, derivationPath: string, keyLength?: number): string;
interface SecurityEvent {
    timestamp: number;
    level: 'info' | 'warning' | 'error' | 'critical';
    category: string;
    message: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}
interface SecurityMetrics {
    totalEvents: number;
    failedLogins: number;
    successfulLogins: number;
    invalidTokens: number;
    rateLimitExceeded: number;
    suspiciousActivity: number;
    lastUpdated: number;
}
/**
 * Logs a security event for monitoring and alerting
 * @param level Event severity level
 * @param category Event category
 * @param message Event message
 * @param context Additional context information
 */
declare function logSecurityEvent(level: 'info' | 'warning' | 'error' | 'critical', category: string, message: string, context?: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}): void;
/**
 * Retrieves security events with optional filtering
 * @param filters Optional filters for events
 * @param limit Maximum number of events to return
 * @returns Array of filtered security events
 */
declare function getSecurityEvents(filters?: {
    level?: 'info' | 'warning' | 'error' | 'critical';
    category?: string;
    userId?: string;
    since?: number;
}, limit?: number): SecurityEvent[];
/**
 * Gets current security metrics and statistics
 * @returns Current security metrics
 */
declare function getSecurityMetrics(): SecurityMetrics;
/**
 * Detects suspicious authentication patterns
 * @param userId User identifier
 * @param ipAddress IP address
 * @param timeWindow Time window in milliseconds (default: 1 hour)
 * @returns True if suspicious activity detected
 */
declare function detectSuspiciousActivity(userId: string, ipAddress: string, timeWindow?: number): boolean;
/**
 * Monitors failed authentication attempts for brute force detection
 * @param identifier User ID or IP address
 * @param maxAttempts Maximum allowed attempts
 * @param timeWindow Time window in milliseconds
 * @returns True if threshold exceeded
 */
declare function monitorFailedAttempts(identifier: string, maxAttempts?: number, timeWindow?: number): boolean;
/**
 * Generates a comprehensive security report
 * @param timeWindow Time window for report in milliseconds (default: 24 hours)
 * @returns Security report with statistics and recommendations
 */
declare function generateSecurityReport(timeWindow?: number): {
    summary: SecurityMetrics;
    topEvents: SecurityEvent[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
};
/**
 * Advanced key rotation system for enhanced security
 * @param currentKey Current encryption key
 * @param rotationReason Reason for key rotation
 * @returns New encryption key and rotation metadata
 */
declare function rotateEncryptionKey(currentKey: string, rotationReason?: string): {
    newKey: string;
    keyId: string;
    rotationTimestamp: number;
    previousKeyHash: string;
};
/**
 * Validates the overall security posture of the crypto system
 * @returns Comprehensive security validation results
 */
declare function validateSecurityPosture(): {
    score: number;
    issues: string[];
    recommendations: string[];
    compliance: boolean;
};

export { createJWT, createRateLimitedToken, createRefreshToken, createTradingSession, decodeJWTUnsafe, decrypt, deriveKey, detectSuspiciousActivity, encrypt, entropyToMnemonic, generateAPIKey, generateSecureRandom, generateSecurityReport, generateSeedPhrase, getSecurityEvents, getSecurityMetrics, hashPassword, logSecurityEvent, mnemonicToEntropy, mnemonicToSeed, monitorFailedAttempts, rotateEncryptionKey, secureCompare, signMessage, validateAPIKeyFormat, validateBitcoinAddress, validateCryptoEnvironment, validateEthereumAddress, validateSecurityPosture, validateSeedPhrase, verifyJWT, verifyMessageSignature, verifyPassword };

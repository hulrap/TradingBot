import { createCipheriv, createDecipheriv, scryptSync, randomBytes, createHash, createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';
import * as bip39 from 'bip39';

const ALGORITHM = 'aes-256-cbc';

// Legacy cached key approach removed for security
// All encryption now uses per-operation salt generation for maximum security

/**
 * Encrypts a plaintext string with per-encryption salt for maximum security.
 * @param text The plaintext to encrypt.
 * @param userSalt Optional user-specific salt for additional security
 * @returns A string containing the salt, IV and the encrypted text, separated by colons.
 * @throws Error if MASTER_ENCRYPTION_KEY is not set or text is empty
 */
export function encrypt(text: string, userSalt?: string): string {
    if (!text || text.length === 0) {
        throw new Error('Cannot encrypt empty text');
    }
    
    const MASTER_KEY = process.env['MASTER_ENCRYPTION_KEY'];
    if (!MASTER_KEY) {
        throw new Error('FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.');
    }
    
    if (MASTER_KEY.length < 32) {
        throw new Error('FATAL: MASTER_ENCRYPTION_KEY must be at least 32 characters long.');
    }
    
    // Generate a random salt for this encryption operation
    const encryptionSalt = userSalt || randomBytes(32).toString('hex');
    const key = new Uint8Array(scryptSync(MASTER_KEY, encryptionSalt, 32));
    
    const iv = new Uint8Array(randomBytes(16)); // Initialization vector
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return salt:iv:encrypted for maximum security
    return `${encryptionSalt}:${Buffer.from(iv).toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with the encrypt function.
 * @param hash A string containing the salt, IV and encrypted text, separated by colons.
 * @returns The decrypted plaintext.
 * @throws Error if hash format is invalid or MASTER_ENCRYPTION_KEY is not set
 */
export function decrypt(hash: string): string {
    if (!hash || hash.length === 0) {
        throw new Error('Cannot decrypt empty hash');
    }
    
    const MASTER_KEY = process.env['MASTER_ENCRYPTION_KEY'];
    if (!MASTER_KEY) {
        throw new Error('FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.');
    }
    
    if (MASTER_KEY.length < 32) {
        throw new Error('FATAL: MASTER_ENCRYPTION_KEY must be at least 32 characters long.');
    }
    
    const parts = hash.split(':');
    
    // Handle both old format (iv:encrypted) and new format (salt:iv:encrypted)
    let salt: string, ivHex: string, encryptedText: string;
    
    if (parts.length === 2) {
        // Old format - use fallback key derivation
        ivHex = parts[0] || '';
        encryptedText = parts[1] || '';
        const FALLBACK_SALT = process.env['ENCRYPTION_SALT'] || 'TradingBot2024SecureSalt';
        salt = FALLBACK_SALT;
    } else if (parts.length === 3) {
        // New format with salt
        salt = parts[0] || '';
        ivHex = parts[1] || '';
        encryptedText = parts[2] || '';
    } else {
        throw new Error('Invalid hash format for decryption. Expected format: salt:iv:encrypted or iv:encrypted');
    }
    
    if (!ivHex || !encryptedText) {
        throw new Error('Invalid hash format for decryption - missing IV or encrypted text.');
    }
    
    // Derive key using the salt from the encrypted data
    const key = new Uint8Array(scryptSync(MASTER_KEY, salt, 32));
    const iv = new Uint8Array(Buffer.from(ivHex, 'hex'));
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Password hashing functions
const SALT_ROUNDS = 12; // Higher value = more secure but slower

/**
 * Hashes a password using bcrypt with configurable salt rounds
 * @param password The plain text password to hash
 * @param rounds Optional number of salt rounds (default: 12)
 * @returns Promise resolving to the hashed password
 * @throws Error if password is too short or invalid
 */
export async function hashPassword(password: string, rounds: number = SALT_ROUNDS): Promise<string> {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
    }
    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    if (rounds < 4 || rounds > 31) {
        throw new Error('Salt rounds must be between 4 and 31');
    }
    return bcrypt.hash(password, rounds);
}

/**
 * Verifies a password against a hash
 * @param password The plain text password to verify
 * @param hash The hash to verify against
 * @returns Promise resolving to true if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
        return false;
    }
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        // Log error for monitoring but don't expose details
        console.error('Password verification failed:', error instanceof Error ? error.message : 'Unknown error');
        return false;
    }
}

// JWT functions
interface JWTPayload extends Record<string, any> {
    sub: string; // User ID
    email?: string;
    iat?: number;
    exp?: number;
    jti?: string; // JWT ID for token revocation
}

/**
 * Creates a JWT token with enhanced security features
 * @param payload The payload to encode in the token
 * @param expiresIn Token expiration time (default: 24h)
 * @returns Promise resolving to the JWT token
 * @throws Error if JWT_SECRET is not set or payload is invalid
 */
export async function createJWT(
    payload: JWTPayload, 
    expiresIn: string | number = '24h'
): Promise<string> {
    if (!payload || typeof payload !== 'object') {
        throw new Error('JWT payload must be a valid object');
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
        throw new Error('JWT payload must include a valid subject (sub)');
    }
    
    const secret = getJWTSecret();
    
    // Add JWT ID for token revocation capabilities
    const enhancedPayload = {
        ...payload,
        jti: payload.jti || generateSecureRandom(16)
    };
    
    return await new jose.SignJWT(enhancedPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

/**
 * Verifies a JWT token with enhanced error handling
 * @param token The JWT token to verify
 * @returns Promise resolving to the payload if valid
 * @throws Error if token is invalid, expired, or malformed
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
    if (!token || typeof token !== 'string') {
        throw new Error('Token must be a non-empty string');
    }
    
    const secret = getJWTSecret();
    
    try {
        const { payload } = await jose.jwtVerify(token, secret);
        
        // Validate required fields
        if (!payload.sub || typeof payload.sub !== 'string') {
            throw new Error('Invalid token: missing or invalid subject');
        }
        
        return payload as JWTPayload;
    } catch (error) {
        if (error instanceof jose.errors.JWTExpired) {
            throw new Error('Token has expired');
        } else if (error instanceof jose.errors.JWTInvalid) {
            throw new Error('Invalid token format');
        } else if (error instanceof jose.errors.JWTClaimValidationFailed) {
            throw new Error('Token claim validation failed');
        } else {
            throw new Error('Token verification failed');
        }
    }
}

/**
 * Creates a refresh token with longer expiration and additional security
 * @param payload The payload to encode in the refresh token
 * @param expiresIn Token expiration time (default: 7d)
 * @returns Promise resolving to the refresh token
 */
export async function createRefreshToken(
    payload: JWTPayload, 
    expiresIn: string = '7d'
): Promise<string> {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Refresh token payload must be a valid object');
    }
    
    const secret = getJWTSecret();
    
    // Add refresh token specific claims
    const refreshPayload = {
        ...payload,
        type: 'refresh',
        jti: generateSecureRandom(16)
    };
    
    return await new jose.SignJWT(refreshPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

/**
 * Extracts JWT payload without verification (for debugging only)
 * @param token The JWT token to decode
 * @returns The decoded payload
 * @warning This does not verify the token signature - use only for debugging
 */
export function decodeJWTUnsafe(token: string): JWTPayload | null {
    if (!token || typeof token !== 'string') {
        return null;
    }
    
    try {
        return jose.decodeJwt(token) as JWTPayload;
    } catch {
        return null;
    }
}

// Helper function to get JWT secret with enhanced validation
function getJWTSecret(): Uint8Array {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long for security');
    }
    return new TextEncoder().encode(secret);
}

// Enhanced secure random string generation
export function generateSecureRandom(length: number = 32): string {
    if (length < 1 || length > 256) {
        throw new Error('Random string length must be between 1 and 256');
    }
    return randomBytes(length).toString('hex');
}

// Generate a secure API key with enhanced format
export function generateAPIKey(prefix: string = 'tb'): string {
    if (!prefix || typeof prefix !== 'string' || prefix.length === 0) {
        throw new Error('API key prefix must be a non-empty string');
    }
    
    const timestamp = Date.now().toString(36);
    const randomPart = generateSecureRandom(32);
    return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Validates if a string is a properly formatted API key
 * @param apiKey The API key to validate
 * @param expectedPrefix Expected prefix (default: 'tb')
 * @returns True if the API key format is valid
 */
export function validateAPIKeyFormat(apiKey: string, expectedPrefix: string = 'tb'): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
        return false;
    }
    
    const parts = apiKey.split('_');
    if (parts.length !== 3) {
        return false;
    }
    
    const prefix = parts[0] || '';
    const timestamp = parts[1] || '';
    const randomPart = parts[2] || '';
    return prefix === expectedPrefix && 
           timestamp.length > 0 && 
           randomPart.length === 64; // 32 bytes = 64 hex chars
}

/**
 * Securely compares two strings to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

// Environment validation for production readiness
export function validateCryptoEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const masterKey = process.env['MASTER_ENCRYPTION_KEY'];
    if (!masterKey) {
        errors.push('MASTER_ENCRYPTION_KEY environment variable is not set');
    } else if (masterKey.length < 32) {
        errors.push('MASTER_ENCRYPTION_KEY must be at least 32 characters long');
    }
    
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
        errors.push('JWT_SECRET environment variable is not set');
    } else if (jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// ==========================================
// TRADING-SPECIFIC CRYPTOGRAPHIC UTILITIES
// ==========================================

/**
 * Validates Ethereum wallet address format
 * @param address The wallet address to validate
 * @returns True if address format is valid
 */
export function validateEthereumAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }
    
    // Basic Ethereum address validation (0x + 40 hex chars)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(address);
}

/**
 * Validates Bitcoin wallet address format (Legacy, P2SH, Bech32)
 * @param address The Bitcoin address to validate
 * @returns True if address format is valid
 */
export function validateBitcoinAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }
    
    // Basic Bitcoin address validation patterns
    const legacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const p2shPattern = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const bech32Pattern = /^bc1[a-z0-9]{39,59}$/;
    
    return legacyPattern.test(address) || p2shPattern.test(address) || bech32Pattern.test(address);
}

/**
 * Generates a secure trading session token with metadata
 * @param userId User identifier
 * @param metadata Additional session metadata
 * @param expiresIn Session expiration (default: 4h)
 * @returns Promise resolving to session token
 */
export async function createTradingSession(
    userId: string, 
    metadata: Record<string, any> = {},
    expiresIn: string = '4h'
): Promise<string> {
    if (!userId || typeof userId !== 'string') {
        throw new Error('User ID must be a non-empty string');
    }
    
    const sessionPayload: JWTPayload = {
        sub: userId,
        type: 'trading_session',
        metadata,
        sessionId: generateSecureRandom(16),
        jti: generateSecureRandom(16)
    };
    
    return createJWT(sessionPayload, expiresIn);
}

/**
 * Creates a secure message signature for API authentication
 * @param message The message to sign
 * @param privateKey The private key for signing
 * @param algorithm Hash algorithm (default: sha256)
 * @returns The message signature
 */
export function signMessage(message: string, privateKey: string, algorithm: string = 'sha256'): string {
    if (!message || !privateKey) {
        throw new Error('Message and private key are required');
    }
    
    const hmac = createHmac(algorithm, privateKey);
    hmac.update(message);
    return hmac.digest('hex');
}

/**
 * Verifies a message signature
 * @param message The original message
 * @param signature The signature to verify
 * @param privateKey The private key used for signing
 * @param algorithm Hash algorithm (default: sha256)
 * @returns True if signature is valid
 */
export function verifyMessageSignature(
    message: string, 
    signature: string, 
    privateKey: string, 
    algorithm: string = 'sha256'
): boolean {
    if (!message || !signature || !privateKey) {
        return false;
    }
    
    try {
        const expectedSignature = signMessage(message, privateKey, algorithm);
        return secureCompare(signature, expectedSignature);
    } catch {
        return false;
    }
}

/**
 * Generates a secure BIP39 seed phrase for HD wallet creation - Production Ready
 * @param entropyBits Entropy bits (128, 160, 192, 224, 256) mapping to (12, 15, 18, 21, 24) words
 * @returns Secure BIP39 compliant seed phrase
 */
export function generateSeedPhrase(entropyBits: number = 128): string {
    const validEntropyBits = [128, 160, 192, 224, 256];
    if (!validEntropyBits.includes(entropyBits)) {
        throw new Error('Entropy bits must be 128, 160, 192, 224, or 256 (corresponding to 12, 15, 18, 21, or 24 words)');
    }
    
    try {
        return bip39.generateMnemonic(entropyBits);
    } catch (error) {
        throw new Error(`Failed to generate BIP39 mnemonic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Validates BIP39 seed phrase format, checksum, and wordlist compliance - Production Ready
 * @param seedPhrase The seed phrase to validate
 * @returns True if seed phrase is valid BIP39 compliant
 */
export function validateSeedPhrase(seedPhrase: string): boolean {
    if (!seedPhrase || typeof seedPhrase !== 'string') {
        return false;
    }
    
    try {
        return bip39.validateMnemonic(seedPhrase.trim());
    } catch {
        return false;
    }
}

/**
 * Converts BIP39 mnemonic to cryptographic seed for key derivation - Production Ready
 * @param mnemonic Valid BIP39 mnemonic phrase
 * @param passphrase Optional passphrase for additional security
 * @returns Promise resolving to 512-bit seed as Buffer
 */
export async function mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<Buffer> {
    if (!validateSeedPhrase(mnemonic)) {
        throw new Error('Invalid BIP39 mnemonic phrase');
    }
    
    try {
        return await bip39.mnemonicToSeed(mnemonic, passphrase);
    } catch (error) {
        throw new Error(`Failed to generate seed from mnemonic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Converts BIP39 mnemonic to entropy bytes - Production Ready
 * @param mnemonic Valid BIP39 mnemonic phrase
 * @returns Entropy as hex string
 */
export function mnemonicToEntropy(mnemonic: string): string {
    if (!validateSeedPhrase(mnemonic)) {
        throw new Error('Invalid BIP39 mnemonic phrase');
    }
    
    try {
        return bip39.mnemonicToEntropy(mnemonic);
    } catch (error) {
        throw new Error(`Failed to extract entropy from mnemonic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Converts entropy to BIP39 mnemonic - Production Ready
 * @param entropy Entropy as hex string or Buffer
 * @returns BIP39 mnemonic phrase
 */
export function entropyToMnemonic(entropy: string | Buffer): string {
    try {
        return bip39.entropyToMnemonic(entropy);
    } catch (error) {
        throw new Error(`Failed to generate mnemonic from entropy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Creates a rate-limited token for API access control
 * @param identifier Client identifier
 * @param rateLimit Requests per time window
 * @param timeWindow Time window in seconds (default: 3600)
 * @returns Rate-limited token
 */
export async function createRateLimitedToken(
    identifier: string, 
    rateLimit: number, 
    timeWindow: number = 3600
): Promise<string> {
    if (!identifier || rateLimit <= 0 || timeWindow <= 0) {
        throw new Error('Invalid rate limit parameters');
    }
    
    const rateLimitPayload: JWTPayload = {
        sub: identifier,
        type: 'rate_limited',
        rateLimit,
        timeWindow,
        windowStart: Math.floor(Date.now() / 1000),
        jti: generateSecureRandom(16)
    };
    
    return createJWT(rateLimitPayload, '24h');
}

/**
 * Derives a deterministic key from master key and derivation path
 * @param masterKey The master key
 * @param derivationPath The derivation path (e.g., "m/44'/60'/0'/0/0")
 * @param keyLength Output key length in bytes (default: 32)
 * @returns Derived key as hex string
 */
export function deriveKey(masterKey: string, derivationPath: string, keyLength: number = 32): string {
    if (!masterKey || !derivationPath) {
        throw new Error('Master key and derivation path are required');
    }
    
    if (keyLength < 16 || keyLength > 64) {
        throw new Error('Key length must be between 16 and 64 bytes');
    }
    
    // Simple key derivation (in production, use proper PBKDF2 or similar)
    const salt = createHash('sha256').update(derivationPath).digest();
    const derivedKey = scryptSync(masterKey, salt, keyLength);
    
    return derivedKey.toString('hex');
}

// ==========================================
// SECURITY MONITORING & ALERTING SYSTEM
// ==========================================

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

// In-memory storage for demo (use proper database in production)
const securityEvents: SecurityEvent[] = [];
const securityMetrics: SecurityMetrics = {
    totalEvents: 0,
    failedLogins: 0,
    successfulLogins: 0,
    invalidTokens: 0,
    rateLimitExceeded: 0,
    suspiciousActivity: 0,
    lastUpdated: Date.now()
};

/**
 * Logs a security event for monitoring and alerting
 * @param level Event severity level
 * @param category Event category
 * @param message Event message
 * @param context Additional context information
 */
export function logSecurityEvent(
    level: 'info' | 'warning' | 'error' | 'critical',
    category: string,
    message: string,
    context: {
        userId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    } = {}
): void {
    const event: SecurityEvent = {
        timestamp: Date.now(),
        level,
        category,
        message,
        ...context
    };
    
    securityEvents.push(event);
    securityMetrics.totalEvents++;
    securityMetrics.lastUpdated = Date.now();
    
    // Update specific metrics
    switch (category) {
        case 'authentication':
            if (level === 'error') {
                securityMetrics.failedLogins++;
            } else if (level === 'info') {
                securityMetrics.successfulLogins++;
            }
            break;
        case 'token_validation':
            if (level === 'error') {
                securityMetrics.invalidTokens++;
            }
            break;
        case 'rate_limiting':
            if (level === 'warning') {
                securityMetrics.rateLimitExceeded++;
            }
            break;
        case 'suspicious_activity':
            securityMetrics.suspiciousActivity++;
            break;
    }
    
    // Auto-alert on critical events
    if (level === 'critical') {
        console.error(`🚨 CRITICAL SECURITY EVENT: ${category} - ${message}`, context);
    }
    
    // Cleanup old events (keep last 10000)
    if (securityEvents.length > 10000) {
        securityEvents.splice(0, securityEvents.length - 10000);
    }
}

/**
 * Retrieves security events with optional filtering
 * @param filters Optional filters for events
 * @param limit Maximum number of events to return
 * @returns Array of filtered security events
 */
export function getSecurityEvents(
    filters: {
        level?: 'info' | 'warning' | 'error' | 'critical';
        category?: string;
        userId?: string;
        since?: number;
    } = {},
    limit: number = 100
): SecurityEvent[] {
    let filteredEvents = [...securityEvents];
    
    if (filters.level) {
        filteredEvents = filteredEvents.filter(event => event.level === filters.level);
    }
    
    if (filters.category) {
        filteredEvents = filteredEvents.filter(event => event.category === filters.category);
    }
    
    if (filters.userId) {
        filteredEvents = filteredEvents.filter(event => event.userId === filters.userId);
    }
    
    if (filters.since !== undefined) {
        filteredEvents = filteredEvents.filter(event => event.timestamp >= filters.since!);
    }
    
    return filteredEvents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}

/**
 * Gets current security metrics and statistics
 * @returns Current security metrics
 */
export function getSecurityMetrics(): SecurityMetrics {
    return { ...securityMetrics };
}

/**
 * Detects suspicious authentication patterns
 * @param userId User identifier
 * @param ipAddress IP address
 * @param timeWindow Time window in milliseconds (default: 1 hour)
 * @returns True if suspicious activity detected
 */
export function detectSuspiciousActivity(
    userId: string, 
    ipAddress: string, 
    timeWindow: number = 3600000
): boolean {
    const since = Date.now() - timeWindow;
    const recentEvents = getSecurityEvents({ userId, since }, 1000);
    
    // Check for multiple failed logins
    const failedLogins = recentEvents.filter(
        event => event.category === 'authentication' && event.level === 'error'
    ).length;
    
    // Check for multiple IP addresses
    const ipAddresses: string[] = [];
    for (const event of recentEvents) {
        if (event.ipAddress) {
            ipAddresses.push(event.ipAddress);
        }
    }
    const uniqueIPs = new Set(ipAddresses).size;
    
    // Check for rate limit violations
    const rateLimitViolations = recentEvents.filter(
        event => event.category === 'rate_limiting'
    ).length;
    
    const isSuspicious = failedLogins > 5 || uniqueIPs > 3 || rateLimitViolations > 10;
    
    if (isSuspicious) {
        logSecurityEvent('critical', 'suspicious_activity', 
            `Suspicious activity detected for user ${userId}`, {
                userId,
                ipAddress,
                metadata: { failedLogins, uniqueIPs, rateLimitViolations }
            });
    }
    
    return isSuspicious;
}

/**
 * Monitors failed authentication attempts for brute force detection
 * @param identifier User ID or IP address
 * @param maxAttempts Maximum allowed attempts
 * @param timeWindow Time window in milliseconds
 * @returns True if threshold exceeded
 */
export function monitorFailedAttempts(
    identifier: string, 
    maxAttempts: number = 5, 
    timeWindow: number = 900000
): boolean {
    const since = Date.now() - timeWindow;
    const failedAttempts = getSecurityEvents({ since }, 1000)
        .filter(event => 
            event.category === 'authentication' && 
            event.level === 'error' &&
            (event.userId === identifier || (event.ipAddress && event.ipAddress === identifier))
        ).length;
    
    const thresholdExceeded = failedAttempts >= maxAttempts;
    
    if (thresholdExceeded) {
        logSecurityEvent('warning', 'brute_force', 
            `Brute force attempt detected for ${identifier}`, {
                metadata: { attempts: failedAttempts, maxAttempts, timeWindow }
            });
    }
    
    return thresholdExceeded;
}

/**
 * Generates a comprehensive security report
 * @param timeWindow Time window for report in milliseconds (default: 24 hours)
 * @returns Security report with statistics and recommendations
 */
export function generateSecurityReport(timeWindow: number = 86400000): {
    summary: SecurityMetrics;
    topEvents: SecurityEvent[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
    const since = Date.now() - timeWindow;
    const recentEvents = getSecurityEvents({ since }, 1000);
    
    const criticalEvents = recentEvents.filter(event => event.level === 'critical').length;
    const errorEvents = recentEvents.filter(event => event.level === 'error').length;
    const warningEvents = recentEvents.filter(event => event.level === 'warning').length;
    
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (criticalEvents > 0) {
        riskLevel = 'critical';
        recommendations.push('Immediate action required: Critical security events detected');
    } else if (errorEvents > 10) {
        riskLevel = 'high';
        recommendations.push('High error rate detected - investigate authentication issues');
    } else if (warningEvents > 20) {
        riskLevel = 'medium';
        recommendations.push('Elevated warning level - monitor rate limiting and access patterns');
    }
    
    if (securityMetrics.failedLogins > securityMetrics.successfulLogins * 0.1) {
        recommendations.push('High failed login ratio - consider implementing additional security measures');
    }
    
    if (securityMetrics.rateLimitExceeded > 50) {
        recommendations.push('Frequent rate limit violations - review API usage patterns');
    }
    
    return {
        summary: getSecurityMetrics(),
        topEvents: recentEvents.slice(0, 10),
        recommendations,
        riskLevel
    };
}

/**
 * Advanced key rotation system for enhanced security
 * @param currentKey Current encryption key
 * @param rotationReason Reason for key rotation
 * @returns New encryption key and rotation metadata
 */
export function rotateEncryptionKey(
    currentKey: string,
    rotationReason: string = 'scheduled_rotation'
): {
    newKey: string;
    keyId: string;
    rotationTimestamp: number;
    previousKeyHash: string;
} {
    if (!currentKey || currentKey.length < 32) {
        throw new Error('Current key must be at least 32 characters');
    }
    
    // Generate new key
    const newKey = generateSecureRandom(64);
    const keyId = generateSecureRandom(16);
    const rotationTimestamp = Date.now();
    
    // Create hash of previous key for audit trail
    const previousKeyHash = createHash('sha256').update(currentKey).digest('hex');
    
    // Log key rotation event
    logSecurityEvent('info', 'key_rotation', 
        `Encryption key rotated: ${rotationReason}`, {
            metadata: { 
                keyId, 
                rotationTimestamp, 
                previousKeyHash: previousKeyHash.substring(0, 16) + '...' 
            }
        });
    
    return {
        newKey,
        keyId,
        rotationTimestamp,
        previousKeyHash
    };
}

/**
 * Validates the overall security posture of the crypto system
 * @returns Comprehensive security validation results
 */
export function validateSecurityPosture(): {
    score: number;
    issues: string[];
    recommendations: string[];
    compliance: boolean;
} {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // Check environment configuration
    const envValidation = validateCryptoEnvironment();
    if (!envValidation.valid) {
        issues.push(...envValidation.errors);
        score -= 20;
    }
    
    // Check recent security events
    const recentEvents = getSecurityEvents({ since: Date.now() - 86400000 }, 100);
    const criticalEvents = recentEvents.filter(event => event.level === 'critical').length;
    
    if (criticalEvents > 0) {
        issues.push(`${criticalEvents} critical security events in the last 24 hours`);
        score -= 30;
    }
    
    // Check metrics
    const metrics = getSecurityMetrics();
    const failureRate = metrics.totalEvents > 0 ? 
        (metrics.failedLogins / metrics.totalEvents) * 100 : 0;
    
    if (failureRate > 10) {
        issues.push(`High authentication failure rate: ${failureRate.toFixed(1)}%`);
        score -= 15;
        recommendations.push('Implement additional authentication security measures');
    }
    
    if (metrics.suspiciousActivity > 5) {
        issues.push(`Multiple suspicious activity alerts: ${metrics.suspiciousActivity}`);
        score -= 10;
        recommendations.push('Review and investigate suspicious activity patterns');
    }
    
    // General recommendations based on score
    if (score < 90) {
        recommendations.push('Regular security audits recommended');
    }
    
    if (score < 70) {
        recommendations.push('Immediate security review required');
    }
    
    const compliance = score >= 80 && criticalEvents === 0;
    
    return {
        score: Math.max(0, score),
        issues,
        recommendations,
        compliance
    };
} 
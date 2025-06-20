import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';

const ALGORITHM = 'aes-256-cbc';

// Lazy initialization - only check for key when needed
let cachedKey: Uint8Array | null = null;

function getKey(): Uint8Array {
    if (cachedKey) {
        return cachedKey;
    }
    
    const MASTER_KEY = process.env['MASTER_ENCRYPTION_KEY'];
    if (!MASTER_KEY) {
        throw new Error('FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.');
    }
    
    // Use scrypt to derive a consistent key of the correct length (32 bytes for AES-256)
    cachedKey = new Uint8Array(scryptSync(MASTER_KEY, 'salt', 32));
    return cachedKey;
}

/**
 * Encrypts a plaintext string.
 * @param text The plaintext to encrypt.
 * @returns A string containing the IV and the encrypted text, separated by a colon.
 */
export function encrypt(text: string): string {
    const key = getKey(); // Get key lazily
    const iv = new Uint8Array(randomBytes(16)); // Initialization vector
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${Buffer.from(iv).toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with the encrypt function.
 * @param hash A string containing the IV and encrypted text, separated by a colon.
 * @returns The decrypted plaintext.
 */
export function decrypt(hash: string): string {
    const key = getKey(); // Get key lazily
    const [ivHex, encryptedText] = hash.split(':');
    if (!ivHex || !encryptedText) {
        throw new Error('Invalid hash format for decryption.');
    }
    const iv = new Uint8Array(Buffer.from(ivHex, 'hex'));
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Password hashing functions
const SALT_ROUNDS = 12; // Higher value = more secure but slower

/**
 * Hashes a password using bcrypt
 * @param password The plain text password to hash
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against a hash
 * @param password The plain text password to verify
 * @param hash The hash to verify against
 * @returns Promise resolving to true if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
        return false;
    }
    return bcrypt.compare(password, hash);
}

// JWT functions
interface JWTPayload extends Record<string, any> {
    sub: string; // User ID
    email?: string;
    iat?: number;
    exp?: number;
}

/**
 * Creates a JWT token
 * @param payload The payload to encode in the token
 * @param expiresIn Token expiration time (default: 24h)
 * @returns Promise resolving to the JWT token
 */
export async function createJWT(
    payload: JWTPayload, 
    expiresIn: string | number = '24h'
): Promise<string> {
    const secret = getJWTSecret();
    
    return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

/**
 * Verifies a JWT token
 * @param token The JWT token to verify
 * @returns Promise resolving to the payload if valid
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
    const secret = getJWTSecret();
    
    try {
        const { payload } = await jose.jwtVerify(token, secret);
        return payload as JWTPayload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Creates a refresh token (longer expiration)
 * @param payload The payload to encode in the refresh token
 * @returns Promise resolving to the refresh token
 */
export async function createRefreshToken(payload: JWTPayload): Promise<string> {
    const secret = getJWTSecret();
    
    return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d') // 7 days for refresh token
        .sign(secret);
}

// Helper function to get JWT secret
function getJWTSecret(): Uint8Array {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    return new TextEncoder().encode(secret);
}

// Secure random string generation
export function generateSecureRandom(length: number = 32): string {
    return randomBytes(length).toString('hex');
}

// Generate a secure API key
export function generateAPIKey(): string {
    const prefix = 'tb_'; // trading bot prefix
    const randomPart = generateSecureRandom(32);
    return `${prefix}${randomPart}`;
} 
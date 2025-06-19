import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

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
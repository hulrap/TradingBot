import { createCipheriv, createDecipheriv, scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

// For backward compatibility with old fixed-salt data
const LEGACY_SALT = 'salt';

interface EncryptionMetadata {
  version: number;
  saltHex: string;
  ivHex: string;
  encrypted: string;
}

/**
 * Derives a key from master key and salt using scrypt
 * @param masterKey The master encryption key
 * @param salt The salt bytes
 * @returns Derived key bytes
 */
function deriveKey(masterKey: string, salt: Uint8Array): Uint8Array {
  return new Uint8Array(scryptSync(masterKey, salt, KEY_LENGTH));
}

/**
 * Validates the encryption format and extracts components
 * @param encryptedData The encrypted data string
 * @returns Parsed encryption metadata
 */
function parseEncryptedData(encryptedData: string): EncryptionMetadata {
  // Check for new format: version:salt:iv:encrypted
  const newFormatParts = encryptedData.split(':');
  if (newFormatParts.length === 4 && newFormatParts[0] === '2') {
    const [version, saltHex, ivHex, encrypted] = newFormatParts;
    if (!version || !saltHex || !ivHex || !encrypted) {
      throw new Error('Invalid new format encrypted data');
    }
    return {
      version: 2,
      saltHex,
      ivHex,
      encrypted
    };
  }
  
  // Legacy format: iv:encrypted (with fixed salt)
  const legacyParts = encryptedData.split(':');
  if (legacyParts.length === 2) {
    const [ivHex, encrypted] = legacyParts;
    if (!ivHex || !encrypted) {
      throw new Error('Invalid legacy format encrypted data');
    }
    return {
      version: 1,
      saltHex: Buffer.from(LEGACY_SALT).toString('hex'),
      ivHex,
      encrypted
    };
  }
  
  throw new Error('Invalid encrypted data format');
}

/**
 * Encrypts a plaintext string using secure random salt and IV.
 * @param text The plaintext to encrypt.
 * @returns A string containing version, salt, IV and encrypted text, separated by colons.
 */
export function encrypt(text: string): string {
  const MASTER_KEY = process.env['MASTER_ENCRYPTION_KEY'];
  if (!MASTER_KEY) {
    throw new Error('FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.');
  }
  
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }
  
  try {
    // Generate random salt and IV for maximum security
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    // Derive key using random salt
    const key = deriveKey(MASTER_KEY, salt);
    
    // Encrypt the data
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return version:salt:iv:encrypted format
    return `2:${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts a string that was encrypted with the encrypt function.
 * Supports both new secure format and legacy format for backward compatibility.
 * @param encryptedData A string containing the encrypted data.
 * @returns The decrypted plaintext.
 */
export function decrypt(encryptedData: string): string {
  const MASTER_KEY = process.env['MASTER_ENCRYPTION_KEY'];
  if (!MASTER_KEY) {
    throw new Error('FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.');
  }
  
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid input: encryptedData must be a non-empty string');
  }
  
  try {
    // Parse the encrypted data format
    const metadata = parseEncryptedData(encryptedData);
    
    // Convert hex strings back to bytes
    const salt = Buffer.from(metadata.saltHex, 'hex');
    const iv = Buffer.from(metadata.ivHex, 'hex');
    
    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    
    // For legacy data, use string salt; for new data, use bytes
    const key = metadata.version === 1 
      ? deriveKey(MASTER_KEY, Buffer.from(LEGACY_SALT, 'utf8'))
      : deriveKey(MASTER_KEY, salt);
    
    // Decrypt the data
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(metadata.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Migrates old encrypted data to new secure format
 * @param oldEncryptedData Data encrypted with old fixed-salt method
 * @returns Data encrypted with new secure random-salt method
 */
export function migrateEncryption(oldEncryptedData: string): string {
  try {
    // Decrypt using old method
    const plaintext = decrypt(oldEncryptedData);
    
    // Re-encrypt using new secure method
    return encrypt(plaintext);
  } catch (error) {
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Securely compares two strings to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Generates a cryptographically secure random string
 * @param length Length of the string to generate
 * @returns Random hex string
 */
export function generateSecureRandom(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Checks if data is encrypted with the old insecure format
 * @param encryptedData The encrypted data to check
 * @returns True if data uses old format
 */
export function isLegacyFormat(encryptedData: string): boolean {
  try {
    const metadata = parseEncryptedData(encryptedData);
    return metadata.version === 1;
  } catch {
    return false;
  }
} 
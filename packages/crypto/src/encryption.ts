import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { EncryptedData, PrivateKey, MasterKey, PrivateKeySchema, MasterKeySchema } from './types';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const ENCODING = 'hex';

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export function encryptPrivateKey(privateKey: PrivateKey, masterKey: MasterKey): EncryptedData {
  try {
    // Validate inputs
    PrivateKeySchema.parse(privateKey);
    MasterKeySchema.parse(masterKey);

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, Buffer.from(masterKey), iv);
    
    // Encrypt
    let encrypted = cipher.update(privateKey, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    return {
      iv: iv.toString(ENCODING),
      content: encrypted
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new EncryptionError(`Failed to encrypt private key: ${error.message}`);
    }
    throw new EncryptionError('Failed to encrypt private key');
  }
}

export function decryptPrivateKey(encrypted: EncryptedData, masterKey: MasterKey): PrivateKey {
  try {
    // Validate master key
    MasterKeySchema.parse(masterKey);
    
    // Create decipher
    const decipher = createDecipheriv(
      ALGORITHM,
      Buffer.from(masterKey),
      Buffer.from(encrypted.iv, ENCODING)
    );
    
    // Decrypt
    let decrypted = decipher.update(encrypted.content, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    // Validate decrypted value
    return PrivateKeySchema.parse(decrypted);
  } catch (error) {
    if (error instanceof Error) {
      throw new EncryptionError(`Failed to decrypt private key: ${error.message}`);
    }
    throw new EncryptionError('Failed to decrypt private key');
  }
}
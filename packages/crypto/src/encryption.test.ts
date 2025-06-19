import { encryptPrivateKey, decryptPrivateKey, EncryptionError } from './encryption';

describe('Encryption Utils', () => {
  const validMasterKey = '12345678901234567890123456789012'; // 32 chars
  const validPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  describe('encryptPrivateKey', () => {
    it('should encrypt a valid private key', () => {
      const result = encryptPrivateKey(validPrivateKey, validMasterKey);
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('content');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.content).toBe('string');
    });

    it('should throw on invalid master key length', () => {
      const shortKey = '123';
      expect(() => encryptPrivateKey(validPrivateKey, shortKey)).toThrow(EncryptionError);
    });

    it('should throw on empty private key', () => {
      expect(() => encryptPrivateKey('', validMasterKey)).toThrow(EncryptionError);
    });
  });

  describe('decryptPrivateKey', () => {
    it('should correctly decrypt an encrypted private key', () => {
      const encrypted = encryptPrivateKey(validPrivateKey, validMasterKey);
      const decrypted = decryptPrivateKey(encrypted, validMasterKey);
      expect(decrypted).toBe(validPrivateKey);
    });

    it('should throw on invalid encrypted data', () => {
      const invalidEncrypted = { iv: 'invalid', content: 'invalid' };
      expect(() => decryptPrivateKey(invalidEncrypted, validMasterKey)).toThrow(EncryptionError);
    });

    it('should throw on wrong master key', () => {
      const encrypted = encryptPrivateKey(validPrivateKey, validMasterKey);
      const wrongKey = '12345678901234567890123456789013'; // Different last char
      expect(() => decryptPrivateKey(encrypted, wrongKey)).toThrow(EncryptionError);
    });
  });
});
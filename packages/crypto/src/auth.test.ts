import { hashPassword, verifyPassword, generateToken, verifyToken, AuthError } from './auth';

describe('Authentication Utils', () => {
  const validPassword = 'StrongP@ssw0rd';
  const validSecret = 'your-jwt-secret-key';
  const validPayload = {
    userId: '123',
    walletAddress: '0x123',
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
  };

  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const hashedPassword = await hashPassword(validPassword);
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).not.toBe(validPassword);
    });

    it('should verify a correct password', async () => {
      const hashedPassword = await hashPassword(validPassword);
      const isValid = await verifyPassword(validPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const hashedPassword = await hashPassword(validPassword);
      const isValid = await verifyPassword('wrongpassword', hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    it('should generate a valid token', () => {
      const token = generateToken(validPayload, validSecret);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify a valid token', () => {
      const token = generateToken(validPayload, validSecret);
      const decoded = verifyToken(token, validSecret);
      expect(decoded).toHaveProperty('userId', validPayload.userId);
      expect(decoded).toHaveProperty('walletAddress', validPayload.walletAddress);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid.token.here', validSecret)).toThrow(AuthError);
    });

    it('should throw on wrong secret', () => {
      const token = generateToken(validPayload, validSecret);
      expect(() => verifyToken(token, 'wrong-secret')).toThrow(AuthError);
    });

    it('should throw on invalid payload', () => {
      const invalidPayload = { 
        invalidField: 'test'
      };
      expect(() => generateToken(invalidPayload as any, validSecret)).toThrow(AuthError);
    });
  });
});
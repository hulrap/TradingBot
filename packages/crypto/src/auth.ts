import { hash, compare } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { PasswordHash, JWTPayload, JWTPayloadSchema } from './types';

const SALT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  try {
    return await hash(password, SALT_ROUNDS);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to hash password: ${error.message}`);
    }
    throw new AuthError('Failed to hash password');
  }
}

export async function verifyPassword(password: string, hashedPassword: PasswordHash): Promise<boolean> {
  try {
    return await compare(password, hashedPassword);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to verify password: ${error.message}`);
    }
    throw new AuthError('Failed to verify password');
  }
}

export function generateToken(payload: JWTPayload, secret: string, expiresIn: string = '24h'): string {
  try {
    // Validate payload
    JWTPayloadSchema.parse(payload);
    return sign(payload, secret, { expiresIn });
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to generate token: ${error.message}`);
    }
    throw new AuthError('Failed to generate token');
  }
}

export function verifyToken(token: string, secret: string): JWTPayload {
  try {
    const decoded = verify(token, secret);
    return JWTPayloadSchema.parse(decoded);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to verify token: ${error.message}`);
    }
    throw new AuthError('Failed to verify token');
  }
}
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { userDb } from './database';
import { safeCompare } from '@trading-bot/crypto';

// JWT Configuration
const JWT_SECRET = process.env['JWT_SECRET'];
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'];
const JWT_EXPIRE_TIME = process.env['JWT_EXPIRE_TIME'] || '15m';
const JWT_REFRESH_EXPIRE_TIME = process.env['JWT_REFRESH_EXPIRE_TIME'] || '7d';

// Password Configuration
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

// Rate limiting in-memory store (should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

interface JWTPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

interface AuthResult {
  success: boolean;
  payload?: Omit<JWTPayload, 'type'>;
  error?: string;
  rateLimited?: boolean;
}

interface LoginResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
  rateLimited?: boolean;
}

interface User {
  id: string;
  email: string;
  encryptedPrivateKey: string; // This should be password_hash in database
  createdAt: string;
  updatedAt: string;
}

/**
 * Validates JWT configuration on startup
 */
function validateJWTConfig(): void {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long');
  }
  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters long');
  }
  if (JWT_SECRET === JWT_REFRESH_SECRET) {
    throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 */
function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` };
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return { 
      valid: false, 
      message: 'Password must contain uppercase, lowercase, numbers, and special characters' 
    };
  }
  
  return { valid: true };
}

/**
 * Checks rate limiting for IP address
 */
function checkRateLimit(clientIp: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const limitData = rateLimitStore.get(clientIp);
  
  if (!limitData) {
    // First attempt
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + LOCKOUT_DURATION });
    return { allowed: true };
  }
  
  if (now > limitData.resetTime) {
    // Reset expired
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + LOCKOUT_DURATION });
    return { allowed: true };
  }
  
  if (limitData.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, resetTime: limitData.resetTime };
  }
  
  // Increment attempt count
  rateLimitStore.set(clientIp, { count: limitData.count + 1, resetTime: limitData.resetTime });
  return { allowed: true };
}

/**
 * Hashes a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const validation = isValidPassword(password);
  if (!validation.valid) {
    throw new Error(validation.message);
  }
  
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Generates a secure JWT token
 */
function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>, type: 'access' | 'refresh'): string {
  validateJWTConfig();
  
  const secret = type === 'access' ? JWT_SECRET : JWT_REFRESH_SECRET;
  const expiresIn = type === 'access' ? JWT_EXPIRE_TIME : JWT_REFRESH_EXPIRE_TIME;
  
  return jwt.sign(
    { ...payload, type },
    secret!,
    { 
      expiresIn,
      issuer: 'trading-bot-platform',
      audience: 'trading-bot-users'
    }
  );
}

/**
 * Verifies and decodes a JWT token
 */
function verifyToken(token: string, type: 'access' | 'refresh'): JWTPayload {
  validateJWTConfig();
  
  const secret = type === 'access' ? JWT_SECRET : JWT_REFRESH_SECRET;
  
  try {
    const decoded = jwt.verify(token, secret!, {
      issuer: 'trading-bot-platform',
      audience: 'trading-bot-users'
    }) as JWTPayload;
    
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Authenticates user with email and password
 */
export async function loginUser(email: string, password: string, clientIp: string): Promise<LoginResult> {
  try {
    // Validate input
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }
    
    if (!isValidEmail(email)) {
      return { success: false, error: 'Invalid email format' };
    }
    
    // Check rate limiting
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return { 
        success: false, 
        error: 'Too many login attempts. Please try again later.',
        rateLimited: true
      };
    }
    
    // Find user by email
    const user = userDb.findByEmail(email);
    if (!user) {
      // Use timing-safe comparison to prevent timing attacks
      await bcrypt.hash('dummy-password', BCRYPT_ROUNDS);
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Verify password
    const passwordValid = await verifyPassword(password, user.encryptedPrivateKey);
    if (!passwordValid) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Generate tokens
    const tokenPayload = {
      sub: user.id,
      email: user.email
    };
    
    const accessToken = generateToken(tokenPayload, 'access');
    const refreshToken = generateToken(tokenPayload, 'refresh');
    
    // Reset rate limiting on successful login
    rateLimitStore.delete(clientIp);
    
    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email
      }
    };
    
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      error: 'Login failed due to internal error' 
    };
  }
}

/**
 * Refreshes access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    // Verify refresh token
    const payload = verifyToken(refreshToken, 'refresh');
    
    // Validate user still exists
    const user = userDb.findById(payload.sub);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Generate new access token
    const tokenPayload = {
      sub: user.id,
      email: user.email
    };
    
    const accessToken = generateToken(tokenPayload, 'access');
    
    return { success: true, accessToken };
    
  } catch (error) {
    return { 
      success: false, 
      error: 'Invalid refresh token' 
    };
  }
}

/**
 * Verifies JWT token from request
 */
export async function verifyJWT(request: NextRequest): Promise<AuthResult> {
  try {
    // Get token from cookie or Authorization header
    let token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return {
        success: false,
        error: 'No authentication token provided'
      };
    }

    // Verify access token
    const payload = verifyToken(token, 'access');
    
    // Validate user still exists
    const user = userDb.findById(payload.sub);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Return payload without type field
    const { type, ...cleanPayload } = payload;
    
    return {
      success: true,
      payload: cleanPayload
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token verification failed'
    };
  }
}

/**
 * Registers a new user
 */
export async function registerUser(email: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Validate input
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }
    
    if (!isValidEmail(email)) {
      return { success: false, error: 'Invalid email format' };
    }
    
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.message || 'Invalid password' };
    }
    
    // Check if user already exists
    const existingUser = userDb.findByEmail(email);
    if (existingUser) {
      return { success: false, error: 'User already exists' };
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create user
    userDb.create({
      id: userId,
      email,
      encryptedPrivateKey: passwordHash // This field name is confusing but matches existing schema
    });
    
    return { success: true, userId };
    
  } catch (error) {
    console.error('Registration error:', error);
    return { 
      success: false, 
      error: 'Registration failed due to internal error' 
    };
  }
}

/**
 * Logs out user (invalidates tokens - implement token blacklist in production)
 */
export async function logoutUser(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, add token to blacklist/revocation list
    // For now, we rely on short token expiration times
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: 'Logout failed' 
    };
  }
}

// Initialize configuration validation
try {
  validateJWTConfig();
} catch (error) {
  console.error('JWT Configuration Error:', error);
  // In production, this should prevent the application from starting
} 
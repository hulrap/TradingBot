import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import bcrypt from 'bcrypt';
import { z } from 'zod';

/**
 * Authentication Configuration
 * Centralized configuration for authentication security parameters
 */
const AUTH_CONFIG = {
  // JWT Configuration
  JWT_SECRET: process.env['JWT_SECRET'] || (() => { throw new Error('JWT_SECRET environment variable is required') })(),
  JWT_ALGORITHM: 'HS256' as const,
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '24h',
  JWT_ISSUER: process.env['JWT_ISSUER'] || 'trading-bot-platform',
  JWT_AUDIENCE: process.env['JWT_AUDIENCE'] || 'trading-bot-users',
  
  // Security Configuration
  BCRYPT_ROUNDS: parseInt(process.env['AUTH_BCRYPT_ROUNDS'] || '12'),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env['AUTH_MAX_LOGIN_ATTEMPTS'] || '5'),
  LOCKOUT_DURATION_MINUTES: parseInt(process.env['AUTH_LOCKOUT_DURATION_MINUTES'] || '15'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env['AUTH_RATE_LIMIT_WINDOW'] || '900000'), // 15 minutes
  RATE_LIMIT_MAX_ATTEMPTS: parseInt(process.env['AUTH_RATE_LIMIT_MAX_ATTEMPTS'] || '10'),
  
  // Cookie Configuration
  COOKIE_MAX_AGE: parseInt(process.env['AUTH_COOKIE_MAX_AGE'] || '86400'), // 24 hours
  COOKIE_SECURE: process.env['NODE_ENV'] === 'production',
  COOKIE_SAME_SITE: 'strict' as const,
} as const;

/**
 * Enhanced error types for authentication
 */
class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public errorCode: string = 'AUTH_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Rate limiting store for login attempts
 * In production, this should be replaced with Redis
 */
class LoginRateLimiter {
  private attempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();
  
  isRateLimited(identifier: string): { limited: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);
    
    if (!record) return { limited: false };
    
    // Check if currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      return { 
        limited: true, 
        retryAfter: Math.ceil((record.lockedUntil - now) / 1000) 
      };
    }
    
    // Reset if window has passed
    if (now - record.lastAttempt > AUTH_CONFIG.RATE_LIMIT_WINDOW_MS) {
      this.attempts.delete(identifier);
      return { limited: false };
    }
    
    return { limited: false };
  }
  
  recordAttempt(identifier: string, successful: boolean): void {
    const now = Date.now();
    const record = this.attempts.get(identifier) || { count: 0, lastAttempt: now };
    
    if (successful) {
      // Clear attempts on successful login
      this.attempts.delete(identifier);
      return;
    }
    
    // Increment failed attempts
    record.count += 1;
    record.lastAttempt = now;
    
    // Apply lockout if max attempts reached
    if (record.count >= AUTH_CONFIG.RATE_LIMIT_MAX_ATTEMPTS) {
      record.lockedUntil = now + (AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }
    
    this.attempts.set(identifier, record);
  }
  
  getAttemptCount(identifier: string): number {
    return this.attempts.get(identifier)?.count || 0;
  }
}

const loginRateLimiter = new LoginRateLimiter();

/**
 * Comprehensive audit logging for authentication events
 */
function logAuthEvent(
  event: string,
  email: string,
  success: boolean,
  clientIP: string,
  userAgent: string,
  details?: any,
  error?: Error
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    email: email.toLowerCase(),
    success,
    clientIP,
    userAgent,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    error: error ? {
      message: error.message,
      code: error instanceof AuthError ? error.errorCode : 'UNKNOWN_ERROR'
    } : undefined,
    severity: success ? 'INFO' : 'WARNING'
  };
  
  if (success) {
    console.log('[AUTH_SUCCESS]', logData);
  } else {
    console.warn('[AUTH_FAILURE]', logData);
  }
  
  // Security alert for multiple failures
  if (!success && loginRateLimiter.getAttemptCount(email) >= 3) {
    console.error('[AUTH_SECURITY_ALERT]', {
      ...logData,
      severity: 'CRITICAL',
      message: 'Multiple login failures detected'
    });
  }
}

/**
 * Get client information for audit logging
 */
function getClientInfo(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return { clientIP, userAgent };
}

// Secure Supabase client initialization
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new AuthError(
      'Database configuration is missing',
      500,
      'CONFIG_ERROR',
      { missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] }
    );
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Input validation schema
 */
const LoginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long')
    .transform(email => email.toLowerCase().trim()),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password too long'),
  rememberMe: z.boolean().optional().default(false)
});

/**
 * Generate secure JWT token
 */
async function generateJWT(userId: string, email: string, rememberMe: boolean = false): Promise<string> {
  const secret = new TextEncoder().encode(AUTH_CONFIG.JWT_SECRET);
  const expiresIn = rememberMe ? '7d' : AUTH_CONFIG.JWT_EXPIRES_IN;
  
  // Calculate expiration time
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + (rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60); // 7 days or 1 day
  
  const jwt = await new SignJWT({
    sub: userId,
    email: email,
    iat: now,
    exp: expiration,
    iss: AUTH_CONFIG.JWT_ISSUER,
    aud: AUTH_CONFIG.JWT_AUDIENCE
  })
    .setProtectedHeader({ alg: AUTH_CONFIG.JWT_ALGORITHM })
    .sign(secret);
  
  return jwt;
}

/**
 * Verify user credentials against database
 */
async function verifyUserCredentials(email: string, password: string): Promise<{ user: any; valid: boolean }> {
  const supabase = getSupabaseClient();
  
  // Fetch user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, is_active, created_at, last_login_at')
    .eq('email', email)
    .eq('is_active', true)
    .single();
  
  if (error || !user) {
    return { user: null, valid: false };
  }
  
  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  
  if (!passwordValid) {
    return { user: null, valid: false };
  }
  
  return { user, valid: true };
}

/**
 * Update user's last login timestamp
 */
async function updateLastLogin(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('users')
      .update({ 
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
  } catch (error) {
    console.error('Failed to update last login:', error);
    // Don't fail the login for this non-critical operation
  }
}

/**
 * Authentication Login API
 * 
 * @route POST /api/auth/login
 * @description Authenticate user with email and password
 * 
 * @param {Object} body - Login credentials
 * @param {string} body.email - User email address
 * @param {string} body.password - User password
 * @param {boolean} [body.rememberMe] - Extended session duration
 * 
 * @returns {Object} Authentication result with user data and JWT cookie
 * 
 * @throws {400} Invalid request parameters
 * @throws {401} Invalid credentials
 * @throws {423} Account locked due to too many failed attempts
 * @throws {429} Rate limit exceeded
 * @throws {500} Internal server error
 * 
 * @security Implements bcrypt password verification, JWT tokens, rate limiting, and audit logging
 */
export async function POST(request: NextRequest) {
  const { clientIP, userAgent } = getClientInfo(request);
  let email: string = '';
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);
    
    if (!validation.success) {
      throw new AuthError(
        'Invalid login data',
        400,
        'VALIDATION_ERROR',
        { errors: validation.error.errors }
      );
    }
    
    const { email: validatedEmail, password, rememberMe } = validation.data;
    email = validatedEmail;
    
    // Check rate limiting
    const rateLimitCheck = loginRateLimiter.isRateLimited(email);
    if (rateLimitCheck.limited) {
      logAuthEvent('LOGIN_RATE_LIMITED', email, false, clientIP, userAgent, {
        retryAfter: rateLimitCheck.retryAfter
      });
      
      throw new AuthError(
        'Too many login attempts. Please try again later.',
        423,
        'RATE_LIMITED',
        { retryAfter: rateLimitCheck.retryAfter }
      );
    }
    
    // Verify user credentials
    const { user, valid } = await verifyUserCredentials(email, password);
    
    // Record login attempt
    loginRateLimiter.recordAttempt(email, valid);
    
    if (!valid || !user) {
      logAuthEvent('LOGIN_FAILED', email, false, clientIP, userAgent, {
        reason: 'Invalid credentials',
        attemptCount: loginRateLimiter.getAttemptCount(email)
      });
      
      throw new AuthError(
        'Invalid email or password',
        401,
        'INVALID_CREDENTIALS'
      );
    }
    
    // Generate JWT token
    const token = await generateJWT(user.id, user.email, rememberMe);
    
    // Update last login
    await updateLastLogin(user.id);
    
    // Create secure response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      },
      message: 'Login successful'
    });
    
    // Set secure JWT cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: AUTH_CONFIG.COOKIE_SECURE,
      path: '/',
      sameSite: AUTH_CONFIG.COOKIE_SAME_SITE,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 : AUTH_CONFIG.COOKIE_MAX_AGE, // 7 days or 1 day
    });
    
    logAuthEvent('LOGIN_SUCCESS', email, true, clientIP, userAgent, {
      userId: user.id,
      rememberMe,
      lastLogin: user.last_login_at
    });
    
    return response;
    
  } catch (error) {
    if (error instanceof AuthError) {
      logAuthEvent('LOGIN_ERROR', email, false, clientIP, userAgent, {
        errorCode: error.errorCode
      }, error);
      
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          details: error.details
        },
        { status: error.statusCode }
      );
    }
    
    // Unexpected errors
    logAuthEvent('LOGIN_UNEXPECTED_ERROR', email, false, clientIP, userAgent, {}, error as Error);
    console.error('Unexpected login error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'An internal server error occurred',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
} 
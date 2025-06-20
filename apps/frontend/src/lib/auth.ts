import { NextRequest } from 'next/server';
import { verifyJWT as cryptoVerifyJWT } from '@trading-bot/crypto';
import { userDb } from './database';
import { getValidatedEnvironment } from './environment';

interface JWTPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

interface AuthResult {
  success: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * Verifies a JWT token from request headers or cookies
 * @param request The NextRequest object
 * @returns Promise resolving to AuthResult
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

    // Get validated environment configuration
    let validatedEnv;
    try {
      validatedEnv = getValidatedEnvironment();
    } catch (error) {
      console.error('Environment validation failed during JWT verification:', error);
      return {
        success: false,
        error: 'Authentication service configuration error'
      };
    }

    // Use the crypto package's JWT verification
    const payload = await cryptoVerifyJWT(token);
    
    if (!payload.sub) {
      return {
        success: false,
        error: 'Invalid token: missing user identifier'
      };
    }

    // Verify user still exists and is active
    const user = userDb.findById(payload.sub);
    if (!user) {
      return {
        success: false,
        error: 'User account not found or deactivated'
      };
    }

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return {
        success: false,
        error: 'Token has expired'
      };
    }

    const result: JWTPayload = {
      sub: payload.sub,
      ...(payload.email && { email: payload.email }),
      ...(payload.iat && { iat: payload.iat }),
      ...(payload.exp && { exp: payload.exp })
    };

    return {
      success: true,
      payload: result
    };

  } catch (error) {
    // Log security events for monitoring
    console.warn('JWT verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          error: 'Token has expired'
        };
      } else if (error.name === 'JsonWebTokenError') {
        return {
          success: false,
          error: 'Invalid token'
        };
      } else if (error.name === 'NotBeforeError') {
        return {
          success: false,
          error: 'Token not yet valid'
        };
      }
    }

    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Extracts user ID from request (requires authentication)
 * @param request The NextRequest object
 * @returns Promise resolving to user ID or null
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const authResult = await verifyJWT(request);
  return authResult.success ? authResult.payload?.sub || null : null;
}

/**
 * Creates authentication headers for responses
 * @param headers Object containing rate limiting and other headers
 * @returns Headers object with auth-related headers
 */
export function createAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'WWW-Authenticate': 'Bearer realm="Trading Bot API"',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
}

/**
 * Validates authentication and returns standardized error response
 * @param request The NextRequest object
 * @returns Promise resolving to AuthResult
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const authResult = await verifyJWT(request);
  
  if (!authResult.success) {
    // Log unauthorized access attempts
    console.warn('Unauthorized access attempt:', {
      url: request.url,
      method: request.method,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      error: authResult.error
    });

    return {
      success: false,
      error: 'Authentication required'
    };
  }

  return authResult;
}

/**
 * Validates user access to specific resources
 * @param request The NextRequest object
 * @param resourceUserId The user ID that owns the resource
 * @returns Promise resolving to boolean indicating if access is allowed
 */
export async function validateResourceAccess(
  request: NextRequest, 
  resourceUserId: string
): Promise<boolean> {
  const authResult = await verifyJWT(request);
  
  if (!authResult.success || !authResult.payload?.sub) {
    return false;
  }

  // Users can only access their own resources
  return authResult.payload.sub === resourceUserId;
}

/**
 * Rate limiting for authentication endpoints
 * @param request The NextRequest object
 * @returns Promise resolving to boolean indicating if request is allowed
 */
export async function checkAuthRateLimit(request: NextRequest): Promise<boolean> {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Implement basic rate limiting logic here
  // In production, this should use Redis or similar
  // For now, return true - implement proper rate limiting in production
  return true;
} 
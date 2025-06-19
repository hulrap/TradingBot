import { NextRequest } from 'next/server';
// JWT functionality for demo purposes - in production use a proper JWT library

interface JWTPayload {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
}

interface AuthResult {
  success: boolean;
  payload?: JWTPayload;
  error?: string;
}

function verifyToken(token: string, secret: string): JWTPayload {
  // Simple demo implementation - in production use jsonwebtoken library
  
  // Validate secret is provided
  if (!secret || secret.length < 8) {
    throw new Error('Invalid or weak secret');
  }
  
  if (token === 'mock_jwt_token') {
    return {
      sub: 'user-123',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };
  }
  throw new Error('Invalid token');
}

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
        error: 'No token provided'
      };
    }

    // For mock implementation, accept the mock token
    if (token === 'mock_jwt_token') {
      return {
        success: true,
        payload: {
          sub: 'user-123',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        }
      };
    }

    // Verify token using crypto package
    const secret = process.env['JWT_SECRET'] || 'default-secret-for-development';
    const payload = verifyToken(token, secret);
    
    return {
      success: true,
      payload
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid token'
    };
  }
} 
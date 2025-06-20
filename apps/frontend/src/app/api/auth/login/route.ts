import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyPassword, createJWT } from '@trading-bot/crypto';
import { rateLimiter } from '@/lib/rate-limiter';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Validation schema for login request
const LoginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

export async function POST(request: Request) {
  try {
    // Rate limiting for login attempts
    const rateLimitResult = await rateLimiter.check(request as any, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          message: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }, 
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = LoginSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          message: 'Invalid input data',
          errors: validationResult.error.errors
        }, 
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Get user from database
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, created_at, updated_at')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.log(`Login attempt failed - user not found: ${email}`);
      return NextResponse.json(
        { message: 'Invalid credentials' }, 
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, userData.password_hash);
    if (!isPasswordValid) {
      console.log(`Login attempt failed - invalid password: ${email}`);
      return NextResponse.json(
        { message: 'Invalid credentials' }, 
        { status: 401 }
      );
    }

    // Create JWT token
    const tokenPayload = {
      sub: userData.id,
      email: userData.email
    };

    const accessToken = await createJWT(tokenPayload, '24h');

    // Update last login time
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userData.id);

    // Create response with user data (excluding password hash)
    const user = {
      id: userData.id,
      email: userData.email,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at
    };

    console.log(`Successful login for user: ${email}`);

    const response = NextResponse.json({
      success: true,
      user,
      message: 'Login successful'
    });

    // Set secure HTTP-only cookie
    response.cookies.set('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    
    // Don't expose internal errors to client
    return NextResponse.json(
      { message: 'An internal server error occurred' }, 
      { status: 500 }
    );
  }
}

// Logout endpoint
export async function DELETE(_request: Request) {
  try {
    console.log('User logout requested');

    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

    // Clear the authentication cookie
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'An internal server error occurred' }, 
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashPassword, createJWT, generateSecureRandom } from '@trading-bot/crypto';
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

// Validation schema for registration
const RegisterSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .max(254, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function POST(request: NextRequest) {
  try {
    // Strict rate limiting for registration attempts
    const rateLimitResult = await rateLimiter.check(request, 3, 60 * 60 * 1000); // 3 attempts per hour
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Too many registration attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }, 
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = RegisterSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Invalid input data',
          errors: validationResult.error.errors
        }, 
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Check if user already exists
    const supabase = getSupabaseClient();
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { 
          success: false,
          message: 'An account with this email already exists' 
        }, 
        { status: 409 }
      );
    }

    // Hash the password securely
    const passwordHash = await hashPassword(password);

    // Generate secure user ID
    const userId = `user_${Date.now()}_${generateSecureRandom(16)}`;

    // Create user in database
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, email, created_at, updated_at')
      .single();

    if (createError) {
      console.error('User registration error:', createError);
      
      // Handle specific database errors
      if (createError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { 
            success: false,
            message: 'An account with this email already exists' 
          }, 
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          message: 'Failed to create user account' 
        }, 
        { status: 500 }
      );
    }

    // Create JWT token for immediate login
    const tokenPayload = {
      sub: newUser.id,
      email: newUser.email
    };

    const accessToken = await createJWT(tokenPayload, '24h');

    // Create response with user data
    const user = {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at
    };

    console.log(`New user registered: ${email}`);

    const response = NextResponse.json({
      success: true,
      user,
      message: 'Account created successfully'
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
    console.error('Registration error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    // Don't expose internal errors to client
    return NextResponse.json(
      { 
        success: false,
        message: 'An internal server error occurred' 
      }, 
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { LoginRequestSchema } from '@trading-bot/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = LoginRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { email, password, twoFactorCode } = validationResult.data;

    // Attempt to sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        timestamp: new Date()
      }, { status: 401 });
    }

    // Update last login timestamp
    if (data.user) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      user: data.user,
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresIn: data.session?.expires_in,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    }, { status: 500 });
  }
}
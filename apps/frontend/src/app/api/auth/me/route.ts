import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyJWT } from '@/lib/auth';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    // Use the secure authentication system instead of manual cookie parsing
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Authentication required',
          error: authResult.error 
        }, 
        { status: 401 }
      );
    }

    const userId = authResult.payload?.sub;
    if (!userId) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Invalid authentication token' 
        }, 
        { status: 401 }
      );
    }

    // Get user from database with error handling
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, created_at, updated_at, last_login_at')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.warn('User verification failed:', { userId, error: userError?.message });
      return NextResponse.json(
        { 
          success: false,
          message: 'User account not found or deactivated' 
        }, 
        { status: 401 }
      );
    }

    // Return user data (excluding sensitive information)
    const user = {
      id: userData.id,
      email: userData.email,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at
    };

    // Log successful authentication check for monitoring
    console.info('User authentication verified:', {
      userId: userData.id,
      email: userData.email,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Authentication verification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Authentication verification failed' 
      }, 
      { status: 401 }
    );
  }
} 
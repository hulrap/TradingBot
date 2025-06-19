import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { RegisterRequestSchema } from '@trading-bot/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = RegisterRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { email, password, firstName, lastName } = validationResult.data;

    // Attempt to sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        timestamp: new Date()
      }, { status: 400 });
    }

    // Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          timezone: 'UTC',
          notification_preferences: {
            email: true,
            sms: false,
            discord: false
          },
          risk_tolerance: 'medium'
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't fail the registration if profile creation fails
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      user: data.user,
      message: 'Account created successfully. Please check your email for verification.',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    }, { status: 500 });
  }
}
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { LoginRequest, RegisterRequest, AuthResponse } from '@trading-bot/types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (credentials: LoginRequest) => Promise<AuthResponse>;
  signUp: (credentials: RegisterRequest) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: any) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        toast.error(error.message);
        return {
          success: false,
          error: error.message,
          timestamp: new Date()
        };
      }

      // Update last login
      if (data.user) {
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id);
      }

      toast.success('Successfully signed in!');
      return {
        success: true,
        user: data.user,
        accessToken: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
        expiresIn: data.session?.expires_in,
        timestamp: new Date()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
      return {
        success: false,
        error: message,
        timestamp: new Date()
      };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (credentials: RegisterRequest): Promise<AuthResponse> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            first_name: credentials.firstName,
            last_name: credentials.lastName,
          }
        }
      });

      if (error) {
        toast.error(error.message);
        return {
          success: false,
          error: error.message,
          timestamp: new Date()
        };
      }

      // Create user profile
      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            first_name: credentials.firstName,
            last_name: credentials.lastName,
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
        }
      }

      toast.success('Account created! Please check your email for verification.');
      return {
        success: true,
        user: data.user,
        timestamp: new Date()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
      return {
        success: false,
        error: message,
        timestamp: new Date()
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success('Successfully signed out!');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      };
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      if (!user) {
        return {
          success: false,
          error: 'No user logged in'
        };
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
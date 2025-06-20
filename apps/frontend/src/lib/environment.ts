import { z } from 'zod';

// Environment variable validation schemas
const EnvironmentSchema = z.object({
  // JWT Security
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .regex(/^[A-Za-z0-9+/=_-]+$/, 'JWT_SECRET contains invalid characters'),
  
  // Database Configuration
  DATABASE_PATH: z.string()
    .min(1, 'DATABASE_PATH is required')
    .optional()
    .default('trading_bot.db'),
  
  // Supabase Configuration (if using Supabase)
  SUPABASE_URL: z.string()
    .url('SUPABASE_URL must be a valid URL')
    .optional(),
  
  SUPABASE_SERVICE_ROLE_KEY: z.string()
    .min(100, 'SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)')
    .optional(),
  
  SUPABASE_ANON_KEY: z.string()
    .min(100, 'SUPABASE_ANON_KEY appears to be invalid (too short)')
    .optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test'])
    .default('development'),
  
  // Security Headers
  NEXTAUTH_SECRET: z.string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters')
    .optional(),
  
  // Rate Limiting
  REDIS_URL: z.string()
    .url('REDIS_URL must be a valid URL')
    .optional(),
  
  // Encryption Keys
  ENCRYPTION_KEY: z.string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters for security')
    .optional(),
});

// Production-specific validations
const ProductionEnvironmentSchema = EnvironmentSchema.extend({
  JWT_SECRET: z.string()
    .min(64, 'JWT_SECRET must be at least 64 characters in production')
    .regex(/^[A-Za-z0-9+/=_-]{64,}$/, 'JWT_SECRET must be properly generated for production'),
  
  NODE_ENV: z.literal('production'),
  
  // Ensure critical production variables are set
  SUPABASE_URL: z.string()
    .url('SUPABASE_URL is required in production'),
  
  SUPABASE_SERVICE_ROLE_KEY: z.string()
    .min(100, 'SUPABASE_SERVICE_ROLE_KEY is required in production'),
});

// Development-specific validations (more lenient)
const DevelopmentEnvironmentSchema = EnvironmentSchema.extend({
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters even in development')
    .default(() => {
      console.warn('⚠️  Using generated JWT_SECRET for development. Set JWT_SECRET environment variable.');
      return generateSecureSecret(64);
    }),
});

interface ValidatedEnvironment {
  JWT_SECRET: string;
  DATABASE_PATH: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  NODE_ENV: 'development' | 'production' | 'test';
  NEXTAUTH_SECRET?: string;
  REDIS_URL?: string;
  ENCRYPTION_KEY?: string;
}

interface ValidationResult {
  success: boolean;
  environment?: ValidatedEnvironment;
  errors?: string[];
  warnings?: string[];
}

// Generate a cryptographically secure secret
function generateSecureSecret(length: number = 64): string {
  if (typeof window !== 'undefined') {
    throw new Error('Secret generation should only happen on server side');
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=-_';
  let result = '';
  
  // Use crypto.randomBytes if available (Node.js)
  try {
    const crypto = require('crypto');
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  } catch (error) {
    // Fallback to Math.random (less secure, development only)
    console.warn('⚠️  Using Math.random for secret generation. Install crypto module for production.');
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

// Validate environment variables
export function validateEnvironment(): ValidationResult {
  const env = process.env;
  const warnings: string[] = [];
  
  // Prepare environment object
  const environmentData = {
    JWT_SECRET: env['JWT_SECRET'],
    DATABASE_PATH: env['DATABASE_PATH'],
    SUPABASE_URL: env['SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: env['SUPABASE_SERVICE_ROLE_KEY'],
    SUPABASE_ANON_KEY: env['SUPABASE_ANON_KEY'],
    NODE_ENV: env.NODE_ENV,
    NEXTAUTH_SECRET: env['NEXTAUTH_SECRET'],
    REDIS_URL: env['REDIS_URL'],
    ENCRYPTION_KEY: env['ENCRYPTION_KEY'],
  };
  
  try {
    let validatedEnv: ValidatedEnvironment;
    
    if (env.NODE_ENV === 'production') {
      // Strict validation for production
      const prodEnv = ProductionEnvironmentSchema.parse(environmentData);
      validatedEnv = prodEnv as ValidatedEnvironment;
      
      // Additional production security checks
      if (validatedEnv.JWT_SECRET === 'default-secret-for-development') {
        throw new Error('CRITICAL: Default JWT secret detected in production');
      }
      
      // Validate Supabase configuration consistency
      if (validatedEnv.SUPABASE_URL && !validatedEnv.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is set');
      }
      
    } else {
      // More lenient validation for development
      const devEnv = DevelopmentEnvironmentSchema.parse(environmentData);
      validatedEnv = devEnv as ValidatedEnvironment;
      
      // Development warnings
      if (!env['JWT_SECRET']) {
        warnings.push('JWT_SECRET not set - using generated secret for development');
      }
      
      if (validatedEnv.JWT_SECRET === 'default-secret-for-development') {
        warnings.push('Using default JWT secret - this is insecure even for development');
      }
      
      if (!env['SUPABASE_URL'] && !env['DATABASE_PATH']) {
        warnings.push('Neither SUPABASE_URL nor DATABASE_PATH configured - using default SQLite');
      }
    }
    
    // General security warnings
    if (validatedEnv.JWT_SECRET.length < 64) {
      warnings.push('JWT_SECRET is shorter than recommended 64 characters');
    }
    
    // Log validation success
    console.log(`✅ Environment validation successful for ${validatedEnv.NODE_ENV} mode`);
    if (warnings.length > 0) {
      warnings.forEach(warning => console.warn(`⚠️  ${warning}`));
    }
    
    const result: ValidationResult = {
      success: true,
      environment: validatedEnv
    };
    
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    
    return result;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      console.error('❌ Environment validation failed:', errors);
      
      return {
        success: false,
        errors
      };
    }
    
    console.error('❌ Environment validation failed:', error instanceof Error ? error.message : 'Unknown error');
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error']
    };
  }
}

// Get validated environment (cached)
let cachedEnvironment: ValidatedEnvironment | null = null;

export function getValidatedEnvironment(): ValidatedEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }
  
  const result = validateEnvironment();
  
  if (!result.success) {
    const errorMessage = 'Environment validation failed. Check your environment variables.';
    console.error(errorMessage, result.errors);
    throw new Error(errorMessage);
  }
  
  cachedEnvironment = result.environment!;
  return cachedEnvironment;
}

// Check if configuration is production-ready
export function isProductionReady(): boolean {
  try {
    const env = getValidatedEnvironment();
    
    // Check critical production requirements
    if (env.NODE_ENV !== 'production') {
      return false;
    }
    
    if (env.JWT_SECRET.length < 64) {
      return false;
    }
    
    if (env.JWT_SECRET === 'default-secret-for-development') {
      return false;
    }
    
    // Check database configuration
    if (!env.SUPABASE_URL && !env.DATABASE_PATH) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Environment initialization for Next.js
export function initializeEnvironment(): void {
  // Run validation on module load
  const result = validateEnvironment();
  
  if (!result.success) {
    console.error('🚨 CRITICAL: Environment validation failed. Application cannot start safely.');
    console.error('Errors:', result.errors);
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Environment validation failed in production. Aborting startup.');
    } else {
      console.warn('⚠️  Continuing in development mode with validation errors.');
    }
  }
  
  // Additional runtime checks for production
  if (process.env.NODE_ENV === 'production' && !isProductionReady()) {
    throw new Error('Application is not production-ready. Check environment configuration.');
  }
}

// Export types for use in other modules
export type { ValidatedEnvironment, ValidationResult }; 
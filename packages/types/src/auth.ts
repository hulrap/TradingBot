import { z } from 'zod';

// User authentication types
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLogin: z.date().optional()
});

export type User = z.infer<typeof UserSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().default('UTC'),
  notificationPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    discord: z.boolean().default(false)
  }),
  riskTolerance: z.enum(['low', 'medium', 'high']).default('medium')
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// JWT payload types
export const JWTPayloadSchema = z.object({
  sub: z.string().uuid(), // user ID
  email: z.string().email(),
  iat: z.number(),
  exp: z.number(),
  jti: z.string().optional()
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Authentication request/response types
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  twoFactorCode: z.string().optional()
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  success: z.boolean(),
  user: z.any().optional(), // Using any for Supabase User type compatibility
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.date().default(() => new Date())
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Session types
export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string().uuid(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

export type Session = z.infer<typeof SessionSchema>;
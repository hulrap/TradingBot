import { z } from 'zod';

export const PrivateKeySchema = z.string().min(1).max(1000);
export type PrivateKey = z.infer<typeof PrivateKeySchema>;

export const MasterKeySchema = z.string().min(32).max(32);
export type MasterKey = z.infer<typeof MasterKeySchema>;

export const EncryptedDataSchema = z.object({
  iv: z.string(),
  content: z.string()
});
export type EncryptedData = z.infer<typeof EncryptedDataSchema>;

export const PasswordHashSchema = z.string();
export type PasswordHash = z.infer<typeof PasswordHashSchema>;

export const JWTPayloadSchema = z.object({
  userId: z.string(),
  walletAddress: z.string().optional(),
  exp: z.number()
});
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
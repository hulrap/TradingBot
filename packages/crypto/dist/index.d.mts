import { z } from 'zod';

declare const PrivateKeySchema: z.ZodString;
type PrivateKey = z.infer<typeof PrivateKeySchema>;
declare const MasterKeySchema: z.ZodString;
type MasterKey = z.infer<typeof MasterKeySchema>;
declare const EncryptedDataSchema: z.ZodObject<{
    iv: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    iv: string;
    content: string;
}, {
    iv: string;
    content: string;
}>;
type EncryptedData = z.infer<typeof EncryptedDataSchema>;
declare const PasswordHashSchema: z.ZodString;
type PasswordHash = z.infer<typeof PasswordHashSchema>;
declare const JWTPayloadSchema: z.ZodObject<{
    userId: z.ZodString;
    walletAddress: z.ZodOptional<z.ZodString>;
    exp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    userId: string;
    exp: number;
    walletAddress?: string | undefined;
}, {
    userId: string;
    exp: number;
    walletAddress?: string | undefined;
}>;
type JWTPayload = z.infer<typeof JWTPayloadSchema>;

declare class EncryptionError extends Error {
    constructor(message: string);
}
declare function encryptPrivateKey(privateKey: PrivateKey, masterKey: MasterKey): EncryptedData;
declare function decryptPrivateKey(encrypted: EncryptedData, masterKey: MasterKey): PrivateKey;

declare class AuthError extends Error {
    constructor(message: string);
}
declare function hashPassword(password: string): Promise<PasswordHash>;
declare function verifyPassword(password: string, hashedPassword: PasswordHash): Promise<boolean>;
declare function generateToken(payload: JWTPayload, secret: string, expiresIn?: string): string;
declare function verifyToken(token: string, secret: string): JWTPayload;

export { AuthError, type EncryptedData, EncryptedDataSchema, EncryptionError, type JWTPayload, JWTPayloadSchema, type MasterKey, MasterKeySchema, type PasswordHash, PasswordHashSchema, type PrivateKey, PrivateKeySchema, decryptPrivateKey, encryptPrivateKey, generateToken, hashPassword, verifyPassword, verifyToken };

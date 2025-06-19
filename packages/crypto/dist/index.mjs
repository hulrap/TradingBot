// src/types.ts
import { z } from "zod";
var PrivateKeySchema = z.string().min(1).max(1e3);
var MasterKeySchema = z.string().min(32).max(32);
var EncryptedDataSchema = z.object({
  iv: z.string(),
  content: z.string()
});
var PasswordHashSchema = z.string();
var JWTPayloadSchema = z.object({
  userId: z.string(),
  walletAddress: z.string().optional(),
  exp: z.number()
});

// src/encryption.ts
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
var ALGORITHM = "aes-256-cbc";
var IV_LENGTH = 16;
var ENCODING = "hex";
var EncryptionError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EncryptionError";
  }
};
function encryptPrivateKey(privateKey, masterKey) {
  try {
    PrivateKeySchema.parse(privateKey);
    MasterKeySchema.parse(masterKey);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(masterKey), iv);
    let encrypted = cipher.update(privateKey, "utf8", ENCODING);
    encrypted += cipher.final(ENCODING);
    return {
      iv: iv.toString(ENCODING),
      content: encrypted
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new EncryptionError(`Failed to encrypt private key: ${error.message}`);
    }
    throw new EncryptionError("Failed to encrypt private key");
  }
}
function decryptPrivateKey(encrypted, masterKey) {
  try {
    MasterKeySchema.parse(masterKey);
    const decipher = createDecipheriv(
      ALGORITHM,
      Buffer.from(masterKey),
      Buffer.from(encrypted.iv, ENCODING)
    );
    let decrypted = decipher.update(encrypted.content, ENCODING, "utf8");
    decrypted += decipher.final("utf8");
    return PrivateKeySchema.parse(decrypted);
  } catch (error) {
    if (error instanceof Error) {
      throw new EncryptionError(`Failed to decrypt private key: ${error.message}`);
    }
    throw new EncryptionError("Failed to decrypt private key");
  }
}

// src/auth.ts
import { hash, compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
var SALT_ROUNDS = 12;
var AuthError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
};
async function hashPassword(password) {
  try {
    return await hash(password, SALT_ROUNDS);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to hash password: ${error.message}`);
    }
    throw new AuthError("Failed to hash password");
  }
}
async function verifyPassword(password, hashedPassword) {
  try {
    return await compare(password, hashedPassword);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to verify password: ${error.message}`);
    }
    throw new AuthError("Failed to verify password");
  }
}
function generateToken(payload, secret, expiresIn = "24h") {
  try {
    JWTPayloadSchema.parse(payload);
    return sign(payload, secret, { expiresIn });
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to generate token: ${error.message}`);
    }
    throw new AuthError("Failed to generate token");
  }
}
function verifyToken(token, secret) {
  try {
    const decoded = verify(token, secret);
    return JWTPayloadSchema.parse(decoded);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to verify token: ${error.message}`);
    }
    throw new AuthError("Failed to verify token");
  }
}
export {
  AuthError,
  EncryptedDataSchema,
  EncryptionError,
  JWTPayloadSchema,
  MasterKeySchema,
  PasswordHashSchema,
  PrivateKeySchema,
  decryptPrivateKey,
  encryptPrivateKey,
  generateToken,
  hashPassword,
  verifyPassword,
  verifyToken
};
//# sourceMappingURL=index.mjs.map
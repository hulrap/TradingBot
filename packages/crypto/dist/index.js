"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AuthError: () => AuthError,
  EncryptedDataSchema: () => EncryptedDataSchema,
  EncryptionError: () => EncryptionError,
  JWTPayloadSchema: () => JWTPayloadSchema,
  MasterKeySchema: () => MasterKeySchema,
  PasswordHashSchema: () => PasswordHashSchema,
  PrivateKeySchema: () => PrivateKeySchema,
  decryptPrivateKey: () => decryptPrivateKey,
  encryptPrivateKey: () => encryptPrivateKey,
  generateToken: () => generateToken,
  hashPassword: () => hashPassword,
  verifyPassword: () => verifyPassword,
  verifyToken: () => verifyToken
});
module.exports = __toCommonJS(src_exports);

// src/types.ts
var import_zod = require("zod");
var PrivateKeySchema = import_zod.z.string().min(1).max(1e3);
var MasterKeySchema = import_zod.z.string().min(32).max(32);
var EncryptedDataSchema = import_zod.z.object({
  iv: import_zod.z.string(),
  content: import_zod.z.string()
});
var PasswordHashSchema = import_zod.z.string();
var JWTPayloadSchema = import_zod.z.object({
  userId: import_zod.z.string(),
  walletAddress: import_zod.z.string().optional(),
  exp: import_zod.z.number()
});

// src/encryption.ts
var import_crypto = require("crypto");
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
    const iv = (0, import_crypto.randomBytes)(IV_LENGTH);
    const cipher = (0, import_crypto.createCipheriv)(ALGORITHM, Buffer.from(masterKey), iv);
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
    const decipher = (0, import_crypto.createDecipheriv)(
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
var import_bcryptjs = require("bcryptjs");
var import_jsonwebtoken = require("jsonwebtoken");
var SALT_ROUNDS = 12;
var AuthError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
};
async function hashPassword(password) {
  try {
    return await (0, import_bcryptjs.hash)(password, SALT_ROUNDS);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to hash password: ${error.message}`);
    }
    throw new AuthError("Failed to hash password");
  }
}
async function verifyPassword(password, hashedPassword) {
  try {
    return await (0, import_bcryptjs.compare)(password, hashedPassword);
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
    return (0, import_jsonwebtoken.sign)(payload, secret, { expiresIn });
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to generate token: ${error.message}`);
    }
    throw new AuthError("Failed to generate token");
  }
}
function verifyToken(token, secret) {
  try {
    const decoded = (0, import_jsonwebtoken.verify)(token, secret);
    return JWTPayloadSchema.parse(decoded);
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(`Failed to verify token: ${error.message}`);
    }
    throw new AuthError("Failed to verify token");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
//# sourceMappingURL=index.js.map
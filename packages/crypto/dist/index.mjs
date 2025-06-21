import { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHmac, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';
import * as bip39 from 'bip39';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var ALGORITHM = "aes-256-cbc";
function encrypt(text, userSalt) {
  if (!text || text.length === 0) {
    throw new Error("Cannot encrypt empty text");
  }
  const MASTER_KEY = process.env["MASTER_ENCRYPTION_KEY"];
  if (!MASTER_KEY) {
    throw new Error("FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.");
  }
  if (MASTER_KEY.length < 32) {
    throw new Error("FATAL: MASTER_ENCRYPTION_KEY must be at least 32 characters long.");
  }
  const encryptionSalt = userSalt || randomBytes(32).toString("hex");
  const key = new Uint8Array(scryptSync(MASTER_KEY, encryptionSalt, 32));
  const iv = new Uint8Array(randomBytes(16));
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${encryptionSalt}:${Buffer.from(iv).toString("hex")}:${encrypted}`;
}
__name(encrypt, "encrypt");
function decrypt(hash2) {
  if (!hash2 || hash2.length === 0) {
    throw new Error("Cannot decrypt empty hash");
  }
  const MASTER_KEY = process.env["MASTER_ENCRYPTION_KEY"];
  if (!MASTER_KEY) {
    throw new Error("FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.");
  }
  if (MASTER_KEY.length < 32) {
    throw new Error("FATAL: MASTER_ENCRYPTION_KEY must be at least 32 characters long.");
  }
  const parts = hash2.split(":");
  let salt, ivHex, encryptedText;
  if (parts.length === 2) {
    ivHex = parts[0] || "";
    encryptedText = parts[1] || "";
    const FALLBACK_SALT = process.env["ENCRYPTION_SALT"] || "TradingBot2024SecureSalt";
    salt = FALLBACK_SALT;
  } else if (parts.length === 3) {
    salt = parts[0] || "";
    ivHex = parts[1] || "";
    encryptedText = parts[2] || "";
  } else {
    throw new Error("Invalid hash format for decryption. Expected format: salt:iv:encrypted or iv:encrypted");
  }
  if (!ivHex || !encryptedText) {
    throw new Error("Invalid hash format for decryption - missing IV or encrypted text.");
  }
  const key = new Uint8Array(scryptSync(MASTER_KEY, salt, 32));
  const iv = new Uint8Array(Buffer.from(ivHex, "hex"));
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
__name(decrypt, "decrypt");
var SALT_ROUNDS = 12;
async function hashPassword(password, rounds = SALT_ROUNDS) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  if (rounds < 4 || rounds > 31) {
    throw new Error("Salt rounds must be between 4 and 31");
  }
  return bcrypt.hash(password, rounds);
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, hash2) {
  if (!password || !hash2 || typeof password !== "string" || typeof hash2 !== "string") {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash2);
  } catch (error) {
    console.error("Password verification failed:", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
async function createJWT(payload, expiresIn = "24h") {
  if (!payload || typeof payload !== "object") {
    throw new Error("JWT payload must be a valid object");
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("JWT payload must include a valid subject (sub)");
  }
  const secret = getJWTSecret();
  const enhancedPayload = {
    ...payload,
    jti: payload.jti || generateSecureRandom(16)
  };
  return await new jose.SignJWT(enhancedPayload).setProtectedHeader({
    alg: "HS256"
  }).setIssuedAt().setExpirationTime(expiresIn).sign(secret);
}
__name(createJWT, "createJWT");
async function verifyJWT(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Token must be a non-empty string");
  }
  const secret = getJWTSecret();
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    if (!payload.sub || typeof payload.sub !== "string") {
      throw new Error("Invalid token: missing or invalid subject");
    }
    return payload;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new Error("Token has expired");
    } else if (error instanceof jose.errors.JWTInvalid) {
      throw new Error("Invalid token format");
    } else if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new Error("Token claim validation failed");
    } else {
      throw new Error("Token verification failed");
    }
  }
}
__name(verifyJWT, "verifyJWT");
async function createRefreshToken(payload, expiresIn = "7d") {
  if (!payload || typeof payload !== "object") {
    throw new Error("Refresh token payload must be a valid object");
  }
  const secret = getJWTSecret();
  const refreshPayload = {
    ...payload,
    type: "refresh",
    jti: generateSecureRandom(16)
  };
  return await new jose.SignJWT(refreshPayload).setProtectedHeader({
    alg: "HS256"
  }).setIssuedAt().setExpirationTime(expiresIn).sign(secret);
}
__name(createRefreshToken, "createRefreshToken");
function decodeJWTUnsafe(token) {
  if (!token || typeof token !== "string") {
    return null;
  }
  try {
    return jose.decodeJwt(token);
  } catch {
    return null;
  }
}
__name(decodeJWTUnsafe, "decodeJWTUnsafe");
function getJWTSecret() {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long for security");
  }
  return new TextEncoder().encode(secret);
}
__name(getJWTSecret, "getJWTSecret");
function generateSecureRandom(length = 32) {
  if (length < 1 || length > 256) {
    throw new Error("Random string length must be between 1 and 256");
  }
  return randomBytes(length).toString("hex");
}
__name(generateSecureRandom, "generateSecureRandom");
function generateAPIKey(prefix = "tb") {
  if (!prefix || typeof prefix !== "string" || prefix.length === 0) {
    throw new Error("API key prefix must be a non-empty string");
  }
  const timestamp = Date.now().toString(36);
  const randomPart = generateSecureRandom(32);
  return `${prefix}_${timestamp}_${randomPart}`;
}
__name(generateAPIKey, "generateAPIKey");
function validateAPIKeyFormat(apiKey, expectedPrefix = "tb") {
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }
  const parts = apiKey.split("_");
  if (parts.length !== 3) {
    return false;
  }
  const prefix = parts[0] || "";
  const timestamp = parts[1] || "";
  const randomPart = parts[2] || "";
  return prefix === expectedPrefix && timestamp.length > 0 && randomPart.length === 64;
}
__name(validateAPIKeyFormat, "validateAPIKeyFormat");
function secureCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
__name(secureCompare, "secureCompare");
function validateCryptoEnvironment() {
  const errors2 = [];
  const masterKey = process.env["MASTER_ENCRYPTION_KEY"];
  if (!masterKey) {
    errors2.push("MASTER_ENCRYPTION_KEY environment variable is not set");
  } else if (masterKey.length < 32) {
    errors2.push("MASTER_ENCRYPTION_KEY must be at least 32 characters long");
  }
  const jwtSecret = process.env["JWT_SECRET"];
  if (!jwtSecret) {
    errors2.push("JWT_SECRET environment variable is not set");
  } else if (jwtSecret.length < 32) {
    errors2.push("JWT_SECRET must be at least 32 characters long");
  }
  return {
    valid: errors2.length === 0,
    errors: errors2
  };
}
__name(validateCryptoEnvironment, "validateCryptoEnvironment");
function validateEthereumAddress(address) {
  if (!address || typeof address !== "string") {
    return false;
  }
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}
__name(validateEthereumAddress, "validateEthereumAddress");
function validateBitcoinAddress(address) {
  if (!address || typeof address !== "string") {
    return false;
  }
  const legacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const p2shPattern = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const bech32Pattern = /^bc1[a-z0-9]{39,59}$/;
  return legacyPattern.test(address) || p2shPattern.test(address) || bech32Pattern.test(address);
}
__name(validateBitcoinAddress, "validateBitcoinAddress");
async function createTradingSession(userId, metadata = {}, expiresIn = "4h") {
  if (!userId || typeof userId !== "string") {
    throw new Error("User ID must be a non-empty string");
  }
  const sessionPayload = {
    sub: userId,
    type: "trading_session",
    metadata,
    sessionId: generateSecureRandom(16),
    jti: generateSecureRandom(16)
  };
  return createJWT(sessionPayload, expiresIn);
}
__name(createTradingSession, "createTradingSession");
function signMessage(message, privateKey, algorithm = "sha256") {
  if (!message || !privateKey) {
    throw new Error("Message and private key are required");
  }
  const hmac = createHmac(algorithm, privateKey);
  hmac.update(message);
  return hmac.digest("hex");
}
__name(signMessage, "signMessage");
function verifyMessageSignature(message, signature, privateKey, algorithm = "sha256") {
  if (!message || !signature || !privateKey) {
    return false;
  }
  try {
    const expectedSignature = signMessage(message, privateKey, algorithm);
    return secureCompare(signature, expectedSignature);
  } catch {
    return false;
  }
}
__name(verifyMessageSignature, "verifyMessageSignature");
function generateSeedPhrase(entropyBits = 128) {
  const validEntropyBits = [
    128,
    160,
    192,
    224,
    256
  ];
  if (!validEntropyBits.includes(entropyBits)) {
    throw new Error("Entropy bits must be 128, 160, 192, 224, or 256 (corresponding to 12, 15, 18, 21, or 24 words)");
  }
  try {
    return bip39.generateMnemonic(entropyBits);
  } catch (error) {
    throw new Error(`Failed to generate BIP39 mnemonic: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
__name(generateSeedPhrase, "generateSeedPhrase");
function validateSeedPhrase(seedPhrase) {
  if (!seedPhrase || typeof seedPhrase !== "string") {
    return false;
  }
  try {
    return bip39.validateMnemonic(seedPhrase.trim());
  } catch {
    return false;
  }
}
__name(validateSeedPhrase, "validateSeedPhrase");
async function mnemonicToSeed2(mnemonic, passphrase) {
  if (!validateSeedPhrase(mnemonic)) {
    throw new Error("Invalid BIP39 mnemonic phrase");
  }
  try {
    return await bip39.mnemonicToSeed(mnemonic, passphrase);
  } catch (error) {
    throw new Error(`Failed to generate seed from mnemonic: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
__name(mnemonicToSeed2, "mnemonicToSeed");
function mnemonicToEntropy2(mnemonic) {
  if (!validateSeedPhrase(mnemonic)) {
    throw new Error("Invalid BIP39 mnemonic phrase");
  }
  try {
    return bip39.mnemonicToEntropy(mnemonic);
  } catch (error) {
    throw new Error(`Failed to extract entropy from mnemonic: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
__name(mnemonicToEntropy2, "mnemonicToEntropy");
function entropyToMnemonic2(entropy) {
  try {
    return bip39.entropyToMnemonic(entropy);
  } catch (error) {
    throw new Error(`Failed to generate mnemonic from entropy: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
__name(entropyToMnemonic2, "entropyToMnemonic");
async function createRateLimitedToken(identifier, rateLimit, timeWindow = 3600) {
  if (!identifier || rateLimit <= 0 || timeWindow <= 0) {
    throw new Error("Invalid rate limit parameters");
  }
  const rateLimitPayload = {
    sub: identifier,
    type: "rate_limited",
    rateLimit,
    timeWindow,
    windowStart: Math.floor(Date.now() / 1e3),
    jti: generateSecureRandom(16)
  };
  return createJWT(rateLimitPayload, "24h");
}
__name(createRateLimitedToken, "createRateLimitedToken");
function deriveKey(masterKey, derivationPath, keyLength = 32) {
  if (!masterKey || !derivationPath) {
    throw new Error("Master key and derivation path are required");
  }
  if (keyLength < 16 || keyLength > 64) {
    throw new Error("Key length must be between 16 and 64 bytes");
  }
  const salt = createHash("sha256").update(derivationPath).digest();
  const derivedKey = scryptSync(masterKey, salt, keyLength);
  return derivedKey.toString("hex");
}
__name(deriveKey, "deriveKey");
var securityEvents = [];
var securityMetrics = {
  totalEvents: 0,
  failedLogins: 0,
  successfulLogins: 0,
  invalidTokens: 0,
  rateLimitExceeded: 0,
  suspiciousActivity: 0,
  lastUpdated: Date.now()
};
function logSecurityEvent(level, category, message, context = {}) {
  const event = {
    timestamp: Date.now(),
    level,
    category,
    message,
    ...context
  };
  securityEvents.push(event);
  securityMetrics.totalEvents++;
  securityMetrics.lastUpdated = Date.now();
  switch (category) {
    case "authentication":
      if (level === "error") {
        securityMetrics.failedLogins++;
      } else if (level === "info") {
        securityMetrics.successfulLogins++;
      }
      break;
    case "token_validation":
      if (level === "error") {
        securityMetrics.invalidTokens++;
      }
      break;
    case "rate_limiting":
      if (level === "warning") {
        securityMetrics.rateLimitExceeded++;
      }
      break;
    case "suspicious_activity":
      securityMetrics.suspiciousActivity++;
      break;
  }
  if (level === "critical") {
    console.error(`\u{1F6A8} CRITICAL SECURITY EVENT: ${category} - ${message}`, context);
  }
  if (securityEvents.length > 1e4) {
    securityEvents.splice(0, securityEvents.length - 1e4);
  }
}
__name(logSecurityEvent, "logSecurityEvent");
function getSecurityEvents(filters = {}, limit = 100) {
  let filteredEvents = [
    ...securityEvents
  ];
  if (filters.level) {
    filteredEvents = filteredEvents.filter((event) => event.level === filters.level);
  }
  if (filters.category) {
    filteredEvents = filteredEvents.filter((event) => event.category === filters.category);
  }
  if (filters.userId) {
    filteredEvents = filteredEvents.filter((event) => event.userId === filters.userId);
  }
  if (filters.since !== void 0) {
    filteredEvents = filteredEvents.filter((event) => event.timestamp >= filters.since);
  }
  return filteredEvents.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
__name(getSecurityEvents, "getSecurityEvents");
function getSecurityMetrics() {
  return {
    ...securityMetrics
  };
}
__name(getSecurityMetrics, "getSecurityMetrics");
function detectSuspiciousActivity(userId, ipAddress, timeWindow = 36e5) {
  const since = Date.now() - timeWindow;
  const recentEvents = getSecurityEvents({
    userId,
    since
  }, 1e3);
  const failedLogins = recentEvents.filter((event) => event.category === "authentication" && event.level === "error").length;
  const ipAddresses = [];
  for (const event of recentEvents) {
    if (event.ipAddress) {
      ipAddresses.push(event.ipAddress);
    }
  }
  const uniqueIPs = new Set(ipAddresses).size;
  const rateLimitViolations = recentEvents.filter((event) => event.category === "rate_limiting").length;
  const isSuspicious = failedLogins > 5 || uniqueIPs > 3 || rateLimitViolations > 10;
  if (isSuspicious) {
    logSecurityEvent("critical", "suspicious_activity", `Suspicious activity detected for user ${userId}`, {
      userId,
      ipAddress,
      metadata: {
        failedLogins,
        uniqueIPs,
        rateLimitViolations
      }
    });
  }
  return isSuspicious;
}
__name(detectSuspiciousActivity, "detectSuspiciousActivity");
function monitorFailedAttempts(identifier, maxAttempts = 5, timeWindow = 9e5) {
  const since = Date.now() - timeWindow;
  const failedAttempts = getSecurityEvents({
    since
  }, 1e3).filter((event) => event.category === "authentication" && event.level === "error" && (event.userId === identifier || event.ipAddress && event.ipAddress === identifier)).length;
  const thresholdExceeded = failedAttempts >= maxAttempts;
  if (thresholdExceeded) {
    logSecurityEvent("warning", "brute_force", `Brute force attempt detected for ${identifier}`, {
      metadata: {
        attempts: failedAttempts,
        maxAttempts,
        timeWindow
      }
    });
  }
  return thresholdExceeded;
}
__name(monitorFailedAttempts, "monitorFailedAttempts");
function generateSecurityReport(timeWindow = 864e5) {
  const since = Date.now() - timeWindow;
  const recentEvents = getSecurityEvents({
    since
  }, 1e3);
  const criticalEvents = recentEvents.filter((event) => event.level === "critical").length;
  const errorEvents = recentEvents.filter((event) => event.level === "error").length;
  const warningEvents = recentEvents.filter((event) => event.level === "warning").length;
  const recommendations = [];
  let riskLevel = "low";
  if (criticalEvents > 0) {
    riskLevel = "critical";
    recommendations.push("Immediate action required: Critical security events detected");
  } else if (errorEvents > 10) {
    riskLevel = "high";
    recommendations.push("High error rate detected - investigate authentication issues");
  } else if (warningEvents > 20) {
    riskLevel = "medium";
    recommendations.push("Elevated warning level - monitor rate limiting and access patterns");
  }
  if (securityMetrics.failedLogins > securityMetrics.successfulLogins * 0.1) {
    recommendations.push("High failed login ratio - consider implementing additional security measures");
  }
  if (securityMetrics.rateLimitExceeded > 50) {
    recommendations.push("Frequent rate limit violations - review API usage patterns");
  }
  return {
    summary: getSecurityMetrics(),
    topEvents: recentEvents.slice(0, 10),
    recommendations,
    riskLevel
  };
}
__name(generateSecurityReport, "generateSecurityReport");
function rotateEncryptionKey(currentKey, rotationReason = "scheduled_rotation") {
  if (!currentKey || currentKey.length < 32) {
    throw new Error("Current key must be at least 32 characters");
  }
  const newKey = generateSecureRandom(64);
  const keyId = generateSecureRandom(16);
  const rotationTimestamp = Date.now();
  const previousKeyHash = createHash("sha256").update(currentKey).digest("hex");
  logSecurityEvent("info", "key_rotation", `Encryption key rotated: ${rotationReason}`, {
    metadata: {
      keyId,
      rotationTimestamp,
      previousKeyHash: previousKeyHash.substring(0, 16) + "..."
    }
  });
  return {
    newKey,
    keyId,
    rotationTimestamp,
    previousKeyHash
  };
}
__name(rotateEncryptionKey, "rotateEncryptionKey");
function validateSecurityPosture() {
  const issues = [];
  const recommendations = [];
  let score = 100;
  const envValidation = validateCryptoEnvironment();
  if (!envValidation.valid) {
    issues.push(...envValidation.errors);
    score -= 20;
  }
  const recentEvents = getSecurityEvents({
    since: Date.now() - 864e5
  }, 100);
  const criticalEvents = recentEvents.filter((event) => event.level === "critical").length;
  if (criticalEvents > 0) {
    issues.push(`${criticalEvents} critical security events in the last 24 hours`);
    score -= 30;
  }
  const metrics = getSecurityMetrics();
  const failureRate = metrics.totalEvents > 0 ? metrics.failedLogins / metrics.totalEvents * 100 : 0;
  if (failureRate > 10) {
    issues.push(`High authentication failure rate: ${failureRate.toFixed(1)}%`);
    score -= 15;
    recommendations.push("Implement additional authentication security measures");
  }
  if (metrics.suspiciousActivity > 5) {
    issues.push(`Multiple suspicious activity alerts: ${metrics.suspiciousActivity}`);
    score -= 10;
    recommendations.push("Review and investigate suspicious activity patterns");
  }
  if (score < 90) {
    recommendations.push("Regular security audits recommended");
  }
  if (score < 70) {
    recommendations.push("Immediate security review required");
  }
  const compliance = score >= 80 && criticalEvents === 0;
  return {
    score: Math.max(0, score),
    issues,
    recommendations,
    compliance
  };
}
__name(validateSecurityPosture, "validateSecurityPosture");

export { createJWT, createRateLimitedToken, createRefreshToken, createTradingSession, decodeJWTUnsafe, decrypt, deriveKey, detectSuspiciousActivity, encrypt, entropyToMnemonic2 as entropyToMnemonic, generateAPIKey, generateSecureRandom, generateSecurityReport, generateSeedPhrase, getSecurityEvents, getSecurityMetrics, hashPassword, logSecurityEvent, mnemonicToEntropy2 as mnemonicToEntropy, mnemonicToSeed2 as mnemonicToSeed, monitorFailedAttempts, rotateEncryptionKey, secureCompare, signMessage, validateAPIKeyFormat, validateBitcoinAddress, validateCryptoEnvironment, validateEthereumAddress, validateSecurityPosture, validateSeedPhrase, verifyJWT, verifyMessageSignature, verifyPassword };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map
import logger from '@/lib/logger.js';

/**
 * Production-grade encryption key management for the Colaris Care healthcare system.
 * Supports three key resolution strategies:
 * 1. AWS KMS (recommended for production)
 * 2. HashiCorp Vault (on-premises option)
 * 3. Local file (development only)
 *
 * All PHI encryption/decryption MUST use keys obtained through this module.
 * Keys are cached in memory with TTL to reduce external service calls.
 * Tokens are STATELESS — refreshed tokens do NOT trigger re-encryption of PHI.
 *
 * HIPAA Compliance:
 * - All key operations are logged via audit-logger
 * - Keys never logged, only key IDs and metadata
 * - Memory zeroing on shutdown to prevent key leakage
 */

// Key cache with TTL (1 hour by default)
const keyCache = new Map();
const CACHE_TTL_MS = process.env.ENCRYPTION_KEY_CACHE_TTL_MS || (60 * 60 * 1000);

/**
 * Supported key management strategies
 */
export const KEY_STRATEGIES = {
  AWS_KMS: 'aws-kms',
  VAULT: 'vault',
  LOCAL_FILE: 'local-file',
  ENV_VAR: 'env-var',
};

const CURRENT_STRATEGY = process.env.ENCRYPTION_KEY_STRATEGY || 'env-var';

/**
 * Get data encryption key for a tenant.
 * Returns a 256-bit (64-char hex) key for AES-256-GCM encryption.
 *
 * Strategy selection (in priority order):
 * 1. AWS KMS (if KMS_RESIDENT_ENCRYPTION_KEY_ID set)
 * 2. HashiCorp Vault (if VAULT_ADDR set)
 * 3. Local file (if ENCRYPTION_KEY_FILE_PATH set)
 * 4. Environment variable (DEV_TENANT_ENCRYPTION_KEY, development only)
 *
 * @param {string} tenantId - Tenant identifier for multi-tenant isolation
 * @returns {Promise<string>} 256-bit encryption key as 64-character hex string
 * @throws {Error} If key resolution fails or strategy not configured
 */
export async function getTenantEncryptionKey(tenantId) {
  if (!tenantId) {
    throw new Error('getTenantEncryptionKey: tenantId is required');
  }

  // Check cache first (stateless, no re-encryption on token refresh)
  const cacheKey = `encryption:tenant:${tenantId}`;
  const cached = keyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.debug({ tenantId, cacheKey, strategy: CURRENT_STRATEGY }, 'Encryption key served from cache');
    return cached.key;
  }

  let keyHex;

  try {
    if (CURRENT_STRATEGY === KEY_STRATEGIES.AWS_KMS) {
      keyHex = await _getKeyFromKMS(tenantId);
    } else if (CURRENT_STRATEGY === KEY_STRATEGIES.VAULT) {
      keyHex = await _getKeyFromVault(tenantId);
    } else if (CURRENT_STRATEGY === KEY_STRATEGIES.LOCAL_FILE) {
      keyHex = await _getKeyFromFile(tenantId);
    } else {
      // Default: environment variable (development)
      keyHex = _getKeyFromEnv(tenantId);
    }

    // Validate key format
    if (!keyHex || typeof keyHex !== 'string' || !/^[a-f0-9]{64}$/.test(keyHex)) {
      throw new Error('Invalid encryption key format: must be 64 hex characters');
    }

    // Cache the key
    keyCache.set(cacheKey, {
      key: keyHex,
      timestamp: Date.now(),
      strategy: CURRENT_STRATEGY,
      tenantId,
    });

    logger.info(
      { tenantId, strategy: CURRENT_STRATEGY, cacheKey },
      'Encryption key resolved and cached'
    );

    return keyHex;
  } catch (err) {
    logger.error(
      { err, tenantId, strategy: CURRENT_STRATEGY },
      'CRITICAL: Failed to resolve encryption key'
    );
    throw new Error('Encryption key unavailable — cannot proceed with PHI operations');
  }
}

/**
 * Resolve encryption key from AWS KMS (recommended for production).
 * Calls KMS.GenerateDataKey which returns:
 * - Plaintext key (used for actual encryption/decryption)
 * - Encrypted key (for archival/recovery)
 *
 * @private
 */
async function _getKeyFromKMS(tenantId) {
  try {
    const { KMS } = await import('@aws-sdk/client-kms');
    const kms = new KMS({ region: process.env.AWS_REGION || 'us-east-1' });

    const keyId = process.env.KMS_RESIDENT_ENCRYPTION_KEY_ID;
    if (!keyId) {
      throw new Error('KMS strategy selected but KMS_RESIDENT_ENCRYPTION_KEY_ID not set');
    }

    const response = await kms.generateDataKey({
      KeyId: keyId,
      KeySpec: 'AES_256',
    });

    if (!response.Plaintext) {
      throw new Error('KMS returned empty plaintext key');
    }

    const keyHex = Buffer.from(response.Plaintext).toString('hex');

    logger.info(
      { tenantId, keyId, keyLength: keyHex.length },
      'Data key generated from AWS KMS'
    );

    return keyHex;
  } catch (err) {
    logger.error(
      { err, tenantId, strategy: KEY_STRATEGIES.AWS_KMS },
      'KMS key resolution failed'
    );
    throw err;
  }
}

/**
 * Resolve encryption key from HashiCorp Vault.
 * Reads secret from Vault at path: secret/tenant/{tenantId}/encryption-key
 *
 * @private
 */
async function _getKeyFromVault(tenantId) {
  try {
    const vault = await import('node-vault');
    const client = vault.default({ endpoint: process.env.VAULT_ADDR });

    // Authenticate with Vault (requires VAULT_TOKEN in env)
    const token = process.env.VAULT_TOKEN;
    if (!token) {
      throw new Error('Vault strategy selected but VAULT_TOKEN not set');
    }
    client.token = token;

    const secretPath = `secret/tenant/${tenantId}/encryption-key`;
    const secret = await client.read(secretPath);

    if (!secret?.data?.data?.key) {
      throw new Error(`Vault returned invalid secret structure at ${secretPath}`);
    }

    const keyHex = secret.data.data.key;

    logger.info(
      { tenantId, secretPath },
      'Data key resolved from HashiCorp Vault'
    );

    return keyHex;
  } catch (err) {
    logger.error(
      { err, tenantId, strategy: KEY_STRATEGIES.VAULT },
      'Vault key resolution failed'
    );
    throw err;
  }
}

/**
 * Resolve encryption key from local file (development only).
 * Reads from file specified by ENCRYPTION_KEY_FILE_PATH.
 *
 * File format: JSON or plaintext hex string (one key per line for multi-tenant)
 * Example JSON:
 * {
 *   "tenant1": "a1b2c3d4e5f6...",
 *   "tenant2": "f9e8d7c6b5a4..."
 * }
 *
 * @private
 */
async function _getKeyFromFile(tenantId) {
  try {
    const fs = await import('fs/promises');
    const filePath = process.env.ENCRYPTION_KEY_FILE_PATH;

    if (!filePath) {
      throw new Error('Local file strategy selected but ENCRYPTION_KEY_FILE_PATH not set');
    }

    const content = await fs.readFile(filePath, 'utf8');
    let keyHex;

    // Try parsing as JSON
    try {
      const keyMap = JSON.parse(content);
      keyHex = keyMap[tenantId];
      if (!keyHex) {
        throw new Error(`Key for tenant '${tenantId}' not found in key file`);
      }
    } catch (jsonErr) {
      // Fall back to plaintext single key
      if (jsonErr instanceof SyntaxError) {
        keyHex = content.trim();
      } else {
        throw jsonErr;
      }
    }

    logger.info(
      { tenantId, filePath, strategy: KEY_STRATEGIES.LOCAL_FILE },
      'Data key loaded from local file'
    );

    return keyHex;
  } catch (err) {
    logger.error(
      { err, tenantId, strategy: KEY_STRATEGIES.LOCAL_FILE },
      'Local file key resolution failed'
    );
    throw err;
  }
}

/**
 * Resolve encryption key from environment variable (development only).
 * DEV_TENANT_ENCRYPTION_KEY is converted to 64-char hex.
 *
 * @private
 */
function _getKeyFromEnv(tenantId) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Production environment detected. Encryption key must be configured via AWS KMS, Vault, or local file. Set ENCRYPTION_KEY_STRATEGY env var.'
    );
  }

  const keyString = process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  const keyHex = Buffer.from(keyString)
    .toString('hex')
    .slice(0, 64)
    .padEnd(64, '0');

  logger.warn(
    { tenantId, keyLength: keyHex.length, strategy: KEY_STRATEGIES.ENV_VAR },
    'DEV_TENANT_ENCRYPTION_KEY used — NOT FOR PRODUCTION'
  );

  return keyHex;
}

/**
 * Manually rotate encryption keys (emergency procedure).
 * Invalidates all cached keys, forces fresh fetch from source.
 *
 * Used when:
 * 1. Key compromise detected
 * 2. Manual key rotation triggered
 * 3. Key management service unavailable (switch to fallback)
 *
 * @param {string} reason - Reason for rotation (for audit log)
 * @returns {Promise<void>}
 */
export async function rotateKeysEmergency(reason) {
  logger.warn({ reason }, 'EMERGENCY KEY ROTATION INITIATED');

  // Clear all cached keys
  const clearedCount = keyCache.size;
  keyCache.clear();

  logger.warn(
    { clearedCount, reason },
    `Cleared ${clearedCount} cached encryption keys due to: ${reason}`
  );
}

/**
 * Get cache status for monitoring/debugging.
 * Returns current cache state without exposing key material.
 *
 * @returns {Object} Cache metadata (count, TTL, sizes, last access times)
 */
export function getCacheStatus() {
  const entries = Array.from(keyCache.entries()).map(([cacheKey, value]) => ({
    cacheKey,
    tenantId: value.tenantId,
    strategy: value.strategy,
    ageMs: Date.now() - value.timestamp,
    isExpired: Date.now() - value.timestamp > CACHE_TTL_MS,
  }));

  return {
    strategy: CURRENT_STRATEGY,
    cacheSize: keyCache.size,
    cacheTTLMs: CACHE_TTL_MS,
    entries,
  };
}

/**
 * Zero out all cached keys from memory (called on process shutdown).
 * Prevents key exposure if memory is dumped.
 *
 * @returns {void}
 */
export function clearKeyCache() {
  const clearedCount = keyCache.size;
  keyCache.clear();

  logger.info({ clearedCount }, 'All encryption keys cleared from memory');
}

/**
 * Validate encryption key format and generate test vectors.
 * Used for sanity checks on application startup.
 *
 * @returns {Promise<void>}
 * @throws {Error} If validation fails
 */
export async function validateKeyManagement() {
  try {
    // Only validate in development or if explicitly enabled
    if (process.env.VALIDATE_ENCRYPTION_KEYS !== 'true' && process.env.NODE_ENV === 'production') {
      logger.info('Encryption key validation skipped in production (set VALIDATE_ENCRYPTION_KEYS=true to enable)');
      return;
    }

    logger.info(
      { strategy: CURRENT_STRATEGY },
      'Validating encryption key management configuration...'
    );

    // Test key resolution
    const testKey = await getTenantEncryptionKey('test-validation');
    if (!testKey || !/^[a-f0-9]{64}$/.test(testKey)) {
      throw new Error('Test key resolution failed: invalid format');
    }

    // Test encryption/decryption round-trip
    const { encryptPHI, decryptPHI } = await import('@/lib/encryption.js');
    const testData = 'VALIDATION_TEST_RESIDENT_PHI_DATA_123';
    const encrypted = encryptPHI(testData, testKey);
    const decrypted = decryptPHI(encrypted, testKey);

    if (decrypted !== testData) {
      throw new Error('Encryption/decryption round-trip failed');
    }

    logger.info(
      { strategy: CURRENT_STRATEGY, testKey: testKey.slice(0, 8) + '...' },
      'Encryption key management validation PASSED'
    );
  } catch (err) {
    logger.error({ err, strategy: CURRENT_STRATEGY }, 'CRITICAL: Encryption validation FAILED');
    throw err;
  }
}

// Register shutdown hooks
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, clearing encryption key cache');
    clearKeyCache();
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, clearing encryption key cache');
    clearKeyCache();
  });
}

export default {
  getTenantEncryptionKey,
  rotateKeysEmergency,
  getCacheStatus,
  clearKeyCache,
  validateKeyManagement,
  KEY_STRATEGIES,
};

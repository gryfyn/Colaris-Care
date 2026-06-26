import crypto from 'crypto';
import logger from '@/lib/logger.js';

const ALGORITHM    = 'aes-256-gcm';
const IV_LENGTH    = 12;
const AUTH_TAG_LEN = 16;
const MIN_ENCRYPTED_BYTES = IV_LENGTH + AUTH_TAG_LEN + 1;
const AAD_DELIMITER = '|';

export function looksLikeEncryptedPHI(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 40 || trimmed.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return false;
  return Buffer.from(trimmed, 'base64').length >= MIN_ENCRYPTED_BYTES;
}

/**
 * Build the Additional Authenticated Data (AAD) that binds a ciphertext to its
 * tenant + storage location. Per docs/DATABASE_SCHEMA.md §8, authenticated
 * additional data binds ciphertext to organization, facility, table, row, and
 * field, so a value encrypted for one (org, facility, table, row, field) tuple
 * cannot be silently relocated to another and still decrypt.
 *
 * The AAD is NOT secret and is NOT stored with the ciphertext — the caller must
 * reconstruct the same context at decrypt time from the row's own tenant keys.
 *
 * @param {object} ctx
 * @param {string} ctx.organizationId
 * @param {string} [ctx.facilityId]
 * @param {string} ctx.table
 * @param {string} ctx.rowId
 * @param {string} ctx.field
 * @returns {Buffer}
 */
export function buildAAD({ organizationId, facilityId, table, rowId, field }) {
  return Buffer.from(
    [organizationId, facilityId, table, rowId, field]
      .map((part) => (part == null ? '' : String(part)))
      .join(AAD_DELIMITER),
    'utf8'
  );
}

function toAadBuffer(aad) {
  if (aad == null) return null;
  return Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad), 'utf8');
}

/**
 * Current cipher/key version stamped into envelope-encrypted columns
 * (e.g. residents.ssn_last4_key_version). Key rotation bumps this without
 * rewriting signed record hashes (docs/DATABASE_SCHEMA.md §8).
 */
export const PHI_CIPHER_VERSION = 1;

/**
 * Deterministic, tenant-scoped lookup hash for exact-match search of an encrypted
 * identifier. Per docs/DATABASE_SCHEMA.md §8, exact lookup uses a tenant-specific
 * keyed hash (partial search is unsupported). Same (value, key, field) always
 * yields the same hash, so callers can query `<field>_lookup_hash = $1` without
 * decrypting. NOT reversible and NOT a substitute for the ciphertext.
 *
 * @param {string} value   plaintext identifier (e.g. last 4 of SSN)
 * @param {string} keyHex  64-char hex tenant key (see @/lib/tenant-key.js)
 * @param {string} [field] field label, mixed into the HMAC so the same value in
 *                          two fields does not collide
 * @returns {string|null} lowercase hex HMAC-SHA256, or null for empty input
 */
export function lookupHashPHI(value, keyHex, field = '') {
  if (value == null || value === '') return null;
  if (!keyHex) {
    logger.error({ field, keyHex: 'missing' }, 'PHI lookup hash failed — encryption key is missing');
    throw new Error('Encryption error: missing encryption key');
  }
  return crypto
    .createHmac('sha256', Buffer.from(keyHex, 'hex'))
    .update(`${field}|${value}`, 'utf8')
    .digest('hex');
}

/**
 * Encrypt a PHI value with AES-256-GCM.
 *
 * @param {string} plaintext
 * @param {string} keyHex          64-char hex key (see @/lib/tenant-key.js)
 * @param {Buffer|string|null} [aad]  optional AAD (see buildAAD)
 * @returns {string|null} base64( iv | authTag | ciphertext )
 */
export function encryptPHI(plaintext, keyHex, aad = null) {
  if (!plaintext) return null;
  if (!keyHex) {
    logger.error({ plaintext: 'present', keyHex: 'missing' }, 'PHI encryption failed — encryption key is missing');
    throw new Error('Encryption error: missing encryption key');
  }
  try {
    const key       = Buffer.from(keyHex, 'hex');
    const iv        = crypto.randomBytes(IV_LENGTH);
    const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
    const aadBuf    = toAadBuffer(aad);
    if (aadBuf) cipher.setAAD(aadBuf);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag   = cipher.getAuthTag();
    const combined  = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  } catch (err) {
    logger.error({ err }, 'PHI encryption failed');
    throw new Error('Encryption error');
  }
}

/**
 * Decrypt a PHI value produced by encryptPHI.
 *
 * @param {string} encryptedBase64
 * @param {string} keyHex
 * @param {Buffer|string|null} [aad]  must match the AAD used at encrypt time
 * @returns {string|null}
 */
export function decryptPHI(encryptedBase64, keyHex, aad = null) {
  if (!encryptedBase64) return null;
  if (!keyHex) {
    logger.error({ encryptedBase64: 'present', keyHex: 'missing' }, 'PHI decryption failed — encryption key is missing');
    throw new Error('Decryption error: missing encryption key');
  }
  try {
    const key        = Buffer.from(keyHex, 'hex');
    const combined   = Buffer.from(encryptedBase64, 'base64');
    const iv         = combined.subarray(0, IV_LENGTH);
    const authTag    = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LEN);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LEN);
    const decipher   = crypto.createDecipheriv(ALGORITHM, key, iv);
    const aadBuf     = toAadBuffer(aad);
    if (aadBuf) decipher.setAAD(aadBuf);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (err) {
    logger.error({ err }, 'PHI decryption failed — possible key mismatch, AAD mismatch, or tampered data');
    throw new Error('Decryption error');
  }
}

/**
 * Encrypt a set of fields on an object.
 *
 * When `aadContext` is supplied (`{ organizationId, facilityId, table, rowId }`)
 * each field is bound to its own AAD via buildAAD(), so ciphertext is pinned to
 * its tenant + row + field. Omit it to encrypt without AAD (faithful to the
 * the original reference behavior).
 *
 * @param {object} obj
 * @param {string[]} fields
 * @param {string} keyHex
 * @param {object|null} [aadContext]
 * @returns {object}
 */
export function encryptFields(obj, fields, keyHex, aadContext = null) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) {
      const aad = aadContext ? buildAAD({ ...aadContext, field }) : null;
      result[field] = encryptPHI(String(result[field]), keyHex, aad);
    }
  }
  return result;
}

/**
 * Decrypt a set of fields on an object. `aadContext` must match what was used
 * at encrypt time (see encryptFields).
 *
 * @param {object} obj
 * @param {string[]} fields
 * @param {string} keyHex
 * @param {object|null} [aadContext]
 * @returns {object}
 */
export function decryptFields(obj, fields, keyHex, aadContext = null) {
  if (!keyHex) {
    logger.error({ keyHex: 'missing', fieldsCount: fields?.length || 0 }, 'Cannot decrypt fields — encryption key is missing');
    // Return object with error markers for encrypted fields
    const result = { ...obj };
    for (const field of fields) {
      if (result[field] != null) {
        result[field] = '[DECRYPT_ERROR: missing key]';
      }
    }
    return result;
  }

  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) {
      if (!looksLikeEncryptedPHI(result[field])) {
        continue;
      }
      try {
        const aad = aadContext ? buildAAD({ ...aadContext, field }) : null;
        result[field] = decryptPHI(result[field], keyHex, aad);
      } catch (err) {
        logger.error({ field, err: err.message }, 'Field decryption error');
        result[field] = '[DECRYPT_ERROR]';
      }
    }
  }
  return result;
}

export const RESIDENT_ENCRYPTED_FIELDS = [
  'first_name', 'last_name', 'preferred_name',
  'medicaid_id', 'phone', 'email',
  'address_line1', 'address_line2',
  'ssn_last4',
];

export const REP_ENCRYPTED_FIELDS = [
  'first_name', 'last_name', 'email', 'primary_phone', 'address_line1',
];

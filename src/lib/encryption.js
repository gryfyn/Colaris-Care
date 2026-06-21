import crypto from 'crypto';
import logger from '@/lib/logger.js';

const ALGORITHM    = 'aes-256-gcm';
const IV_LENGTH    = 12;
const AUTH_TAG_LEN = 16;
const MIN_ENCRYPTED_BYTES = IV_LENGTH + AUTH_TAG_LEN + 1;

export function looksLikeEncryptedPHI(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 40 || trimmed.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return false;
  return Buffer.from(trimmed, 'base64').length >= MIN_ENCRYPTED_BYTES;
}

export function encryptPHI(plaintext, keyHex) {
  if (!plaintext) return null;
  if (!keyHex) {
    logger.error({ plaintext: 'present', keyHex: 'missing' }, 'PHI encryption failed — encryption key is missing');
    throw new Error('Encryption error: missing encryption key');
  }
  try {
    const key       = Buffer.from(keyHex, 'hex');
    const iv        = crypto.randomBytes(IV_LENGTH);
    const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag   = cipher.getAuthTag();
    const combined  = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  } catch (err) {
    logger.error({ err }, 'PHI encryption failed');
    throw new Error('Encryption error');
  }
}

export function decryptPHI(encryptedBase64, keyHex) {
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
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (err) {
    logger.error({ err }, 'PHI decryption failed — possible key mismatch or tampered data');
    throw new Error('Decryption error');
  }
}

export function encryptFields(obj, fields, keyHex) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) {
      result[field] = encryptPHI(String(result[field]), keyHex);
    }
  }
  return result;
}

export function decryptFields(obj, fields, keyHex) {
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
        result[field] = decryptPHI(result[field], keyHex);
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

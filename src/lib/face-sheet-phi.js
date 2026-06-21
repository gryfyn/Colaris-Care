// Application-layer PHI handling for resident face sheets.
//
// Sensitive face-sheet values (SSN, Medicare/Medicaid #) are encrypted before
// being written into the form_data JSONB blob, and decrypted (privileged roles)
// or masked (everyone else) on read. Mirrors the residents-route pattern.
import { encryptPHI, decryptPHI } from '@/lib/encryption.js';
import { getTenantKey } from '@/lib/tenant-key.js';

export const FACE_SHEET_SENSITIVE_KEYS = ['ssn', 'medicare_number', 'medicaid_number'];

const PRIVILEGED_ROLES = new Set(['admin', 'manager', 'superadmin']);

// Re-exported for existing imports; resolves a real key in production
// (TENANT_ENCRYPTION_KEY) and a derived dev key otherwise.
export { getTenantKey };

function trimStrings(formData) {
  const out = {};
  for (const [k, v] of Object.entries(formData || {})) {
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// Encrypt sensitive keys in a plaintext form_data object for persistence.
export function encryptFaceSheet(formData, keyHex) {
  const out = trimStrings(formData);
  for (const k of FACE_SHEET_SENSITIVE_KEYS) {
    const v = out[k];
    if (v != null && v !== '' && !(typeof v === 'object' && v.__enc)) {
      out[k] = { __enc: encryptPHI(String(v), keyHex) };
    }
  }
  return out;
}

function decryptOne(v, keyHex) {
  if (v && typeof v === 'object' && v.__enc) {
    try { return decryptPHI(v.__enc, keyHex); } catch { return ''; }
  }
  return v; // legacy plaintext (pre-encryption rows)
}

function maskValue(key, val) {
  if (val == null || val === '') return val;
  const s = String(val);
  if (key === 'ssn') {
    const digits = s.replace(/\D/g, '');
    return digits.length >= 4 ? `•••-••-${digits.slice(-4)}` : '•••';
  }
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
}

// Return form_data with sensitive keys decrypted (privileged) or masked.
export function decryptFaceSheet(formData, keyHex, role) {
  if (!formData || typeof formData !== 'object') return {};
  const out = { ...formData };
  const privileged = PRIVILEGED_ROLES.has(role);
  for (const k of FACE_SHEET_SENSITIVE_KEYS) {
    if (!(k in out)) continue;
    const plain = decryptOne(out[k], keyHex);
    out[k] = privileged ? plain : maskValue(k, plain);
  }
  return out;
}

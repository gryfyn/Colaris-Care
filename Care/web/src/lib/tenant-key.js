import crypto from 'crypto';

// Resolves the per-tenant PHI encryption key (64-char hex) used by
// encryptPHI / decryptPHI (AES-256-GCM, see @/lib/encryption.js).
//
// Colaris uses DUAL tenant keys (docs/DATABASE_SCHEMA.md): every tenant-owned
// row carries organization_id, and facility-owned rows also carry facility_id.
// The data-encryption key is therefore SCOPED to (organization_id, facility_id)
// so a key compromise or mis-scoped query cannot cross tenant boundaries. The
// scoped key is derived deterministically from a single master secret with
// HKDF-SHA256, so:
//   - the same (organization_id, facility_id) always derives the same key
//     (values round-trip across routes / requests), and
//   - no per-tenant key material has to be stored anywhere.
//
// Master secret resolution:
//   - production : TENANT_ENCRYPTION_KEY (>= 32 chars; generate with
//                  `openssl rand -hex 32`)
//   - otherwise  : DEV_TENANT_ENCRYPTION_KEY or the dev fallback below.
//
// NOTE (HIPAA): HKDF derivation from one master secret is the minimum bar. For
// multi-tenant production under a BAA, back the master secret with a managed
// KMS / Vault per-tenant key (see @/lib/key-management.js and
// ENCRYPTION_KEY_STRATEGY) — getTenantKey's signature stays the same.

const DEV_FALLBACK = 'dev-only-32-char-key-change-me!!';
const HKDF_SALT = Buffer.from('colaris-care-tenant-key-v1', 'utf8');

function resolveMasterSecret() {
  if (process.env.NODE_ENV === 'production') {
    const key = process.env.TENANT_ENCRYPTION_KEY;
    if (!key || key.length < 32 || key === DEV_FALLBACK) {
      throw new Error(
        'TENANT_ENCRYPTION_KEY missing or too weak in production. ' +
        'Provide a strong secret (>= 32 chars). Generate with: openssl rand -hex 32'
      );
    }
    return key;
  }
  return process.env.DEV_TENANT_ENCRYPTION_KEY || DEV_FALLBACK;
}

function deriveScopedKey(masterSecret, organizationId, facilityId) {
  const ikm  = Buffer.from(masterSecret, 'utf8');
  const info = Buffer.from(`org:${organizationId || ''}|fac:${facilityId || ''}`, 'utf8');
  // 32 bytes → 64-char lowercase hex, matching the AES-256 key format expected
  // by encryptPHI / decryptPHI and key-management's /^[a-f0-9]{64}$/ check.
  const derived = crypto.hkdfSync('sha256', ikm, HKDF_SALT, info, 32);
  return Buffer.from(derived).toString('hex');
}

/**
 * Return the 64-char hex encryption key scoped to a tenant.
 *
 * @param {string} organizationId  tenant (organization) identifier — required
 *                                  for production isolation; falsy derives the
 *                                  deployment-wide key (dev / migration use).
 * @param {string} [facilityId]    facility identifier for facility-owned rows;
 *                                  omit for organization-owned rows.
 * @returns {Promise<string>} 64-char hex key
 */
export async function getTenantKey(organizationId, facilityId) {
  return deriveScopedKey(resolveMasterSecret(), organizationId, facilityId);
}

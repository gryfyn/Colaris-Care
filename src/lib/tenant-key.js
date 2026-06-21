// Resolves the per-tenant PHI encryption key (64-char hex) used by
// encryptPHI / decryptPHI (AES-256-GCM).
//
// IMPORTANT — derivation must match the inline resolvers scattered across the
// API routes (e.g. residents/[id], admin/residents, care-plans, profile,
// auth/login), or data encrypted by one route can't be decrypted by another.
// The shared shape is:
//     Buffer.from(keyString).toString('hex').slice(0, 64).padEnd(64, '0')
// where keyString is the secret (TENANT_ENCRYPTION_KEY in prod, the dev key
// otherwise). Generate the prod secret with:  openssl rand -hex 32
//
// NOTE (HIPAA): one deployment-wide key is the minimum bar. For multi-tenant
// production under a BAA, migrate to per-tenant keys via AWS KMS / Vault
// (see src/lib/key-management.js and ENCRYPTION_KEY_STRATEGY). The duplicated
// inline resolvers should also be collapsed onto this module — tracked as the
// top post-launch follow-up.

const DEV_FALLBACK = 'dev-only-32-char-key-change-me!!';

function deriveKey(keyString) {
  return Buffer.from(keyString).toString('hex').slice(0, 64).padEnd(64, '0');
}

function resolveSecret() {
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

/**
 * Return the 64-char hex encryption key for a tenant.
 * @param {string} [_tenantId] reserved for future per-tenant key lookup
 * @returns {Promise<string>} 64-char hex key
 */
export async function getTenantKey(_tenantId) {
  return deriveKey(resolveSecret());
}

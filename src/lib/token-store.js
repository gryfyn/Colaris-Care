/**
 * Postgres-backed refresh-token store and access-token revocation blacklist.
 *
 * Drop-in replacement for the former Redis-backed store (src/lib/redis.js).
 * Backed by auth.refresh_tokens + auth.revoked_jti (see migration
 * db/migrations/0030_auth_token_store.sql). These tables carry no PHI and are
 * accessed via the plain service connection, so they are NOT under RLS.
 *
 * Callers (login / refresh / logout / auth-guard) wrap these in try/catch and
 * degrade to stateless behavior if the store is briefly unavailable, matching
 * the previous Redis fail-open semantics.
 */
import { query } from '@/lib/db.js';

/**
 * Persist a refresh token (by its JWT id) with the associated session payload.
 */
export async function storeRefreshToken({ jti, userId, tenantId, role, staffId, residentId, ttlSeconds }) {
  await query(
    `INSERT INTO auth.refresh_tokens
       (jti, user_id, tenant_id, role, staff_id, resident_id, is_grace, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW() + make_interval(secs => $7))
     ON CONFLICT (jti) DO UPDATE SET
       user_id     = EXCLUDED.user_id,
       tenant_id   = EXCLUDED.tenant_id,
       role        = EXCLUDED.role,
       staff_id    = EXCLUDED.staff_id,
       resident_id = EXCLUDED.resident_id,
       is_grace    = FALSE,
       expires_at  = EXCLUDED.expires_at`,
    [jti, userId, tenantId, role, staffId || null, residentId || null, ttlSeconds]
  );
}

/**
 * Look up a stored, unexpired refresh token (active or within its grace window).
 * Returns the session payload or null if not found / expired.
 */
export async function getRefreshToken(userId, jti) {
  const { rows } = await query(
    `SELECT user_id, tenant_id, role, staff_id, resident_id
       FROM auth.refresh_tokens
      WHERE jti = $1 AND user_id = $2 AND expires_at > NOW()`,
    [jti, userId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    userId:     r.user_id,
    tenantId:   r.tenant_id,
    role:       r.role,
    staffId:    r.staff_id,
    residentId: r.resident_id,
  };
}

/**
 * Demote a rotated refresh token to a short grace window so a single in-flight
 * concurrent refresh (e.g. parallel tabs) doesn't fail. The old jti stays valid
 * only until NOW() + graceSeconds.
 */
export async function graceRefreshToken(userId, jti, graceSeconds) {
  await query(
    `UPDATE auth.refresh_tokens
        SET is_grace = TRUE,
            expires_at = NOW() + make_interval(secs => $3)
      WHERE jti = $1 AND user_id = $2`,
    [jti, userId, graceSeconds]
  );
}

/**
 * Delete a refresh token outright (used on logout).
 */
export async function deleteRefreshToken(userId, jti) {
  await query(
    `DELETE FROM auth.refresh_tokens WHERE jti = $1 AND user_id = $2`,
    [jti, userId]
  );
}

/**
 * Add an access-token jti to the revocation blacklist until it would have
 * expired anyway (ttlSeconds).
 */
export async function blacklistJti(jti, ttlSeconds) {
  await query(
    `INSERT INTO auth.revoked_jti (jti, expires_at)
     VALUES ($1, NOW() + make_interval(secs => $2))
     ON CONFLICT (jti) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [jti, ttlSeconds]
  );
}

/**
 * True if the given access-token jti has been revoked and not yet expired.
 */
export async function isJtiBlacklisted(jti) {
  const { rows } = await query(
    `SELECT 1 FROM auth.revoked_jti WHERE jti = $1 AND expires_at > NOW() LIMIT 1`,
    [jti]
  );
  return rows.length > 0;
}

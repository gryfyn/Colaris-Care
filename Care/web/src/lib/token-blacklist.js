/**
 * Access-token revocation (logout blacklist).
 *
 * A revoked token's `jti` is stored until the token would have expired anyway, so
 * the entry is small and self-cleaning (TTL = token's remaining lifetime). Uses
 * Upstash Redis when configured; otherwise an in-memory Set-with-expiry that works
 * per-instance for local dev / tests. Only the opaque `jti` is stored — never PHI.
 */
import { getRedis } from '@/lib/redis.js';
import logger from '@/lib/logger.js';

const PREFIX = 'revoked:jti:';
// Cap used when a token carries no usable `exp` (defensive — JWTs always set exp).
const DEFAULT_TTL_SECONDS = 15 * 60;

// In-memory fallback: jti -> absolute expiry (epoch seconds).
const memoryStore = new Map();

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function ttlFrom(expiresAtEpoch) {
  const exp = Number(expiresAtEpoch);
  if (!Number.isFinite(exp) || exp <= 0) return DEFAULT_TTL_SECONDS;
  return Math.max(1, exp - nowEpoch());
}

function pruneMemory() {
  const now = nowEpoch();
  for (const [jti, expiry] of memoryStore) {
    if (expiry <= now) memoryStore.delete(jti);
  }
}

/**
 * Revoke a token by its `jti` so it can no longer authenticate.
 * @param {string} jti - token identifier
 * @param {number} [expiresAtEpoch] - token `exp` (epoch seconds); sets the TTL
 * @returns {Promise<boolean>} true once recorded
 */
export async function revokeToken(jti, expiresAtEpoch) {
  if (!jti) return false;
  const ttl = ttlFrom(expiresAtEpoch);

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${PREFIX}${jti}`, '1', { ex: ttl });
      return true;
    } catch (err) {
      logger.warn({ err }, '[token-blacklist] Redis revoke failed; using in-memory fallback');
    }
  }

  memoryStore.set(jti, nowEpoch() + ttl);
  return true;
}

/**
 * Check whether a token's `jti` has been revoked.
 * @param {string} jti - token identifier
 * @returns {Promise<boolean>}
 */
export async function isTokenRevoked(jti) {
  if (!jti) return false;

  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get(`${PREFIX}${jti}`);
      return value !== null && value !== undefined;
    } catch (err) {
      logger.warn({ err }, '[token-blacklist] Redis lookup failed; using in-memory fallback');
    }
  }

  pruneMemory();
  const expiry = memoryStore.get(jti);
  if (expiry === undefined) return false;
  if (expiry <= nowEpoch()) {
    memoryStore.delete(jti);
    return false;
  }
  return true;
}

export default { revokeToken, isTokenRevoked };

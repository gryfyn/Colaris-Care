/**
 * Upstash Redis client factory.
 *
 * Returns a configured Upstash REST client when both UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set, otherwise returns null so every consumer can
 * degrade gracefully to its in-memory behavior (local dev / tests without Upstash
 * keep working). Never store PHI in Redis — only ids, jti values and counters.
 */
import { Redis } from '@upstash/redis';
import logger from '@/lib/logger.js';

// Cache the client per resolved config so we don't rebuild it on every call but
// still react to env changes (important for tests that toggle the vars).
let cached = { key: null, client: null };

function configValue(name) {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Get the shared Upstash Redis client.
 * @returns {import('@upstash/redis').Redis | null} client when configured, else null
 */
export function getRedis() {
  const url = configValue('UPSTASH_REDIS_REST_URL');
  const token = configValue('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) return null;

  const key = `${url}|${token}`;
  if (cached.key === key) return cached.client;

  try {
    cached = { key, client: new Redis({ url, token }) };
  } catch (err) {
    logger.warn({ err }, '[redis] Failed to initialize Upstash client; using in-memory fallback');
    cached = { key, client: null };
  }
  return cached.client;
}

export default getRedis;

// Centralized environment access + light validation.
//
// Redis URL resolution is inlined here (the DCLLC port keeps Redis optional —
// rate limiting in Colaris is in-memory, see @/lib/rate-limiter.js). REDIS_URL
// is still surfaced so later tasks can opt into a shared store without changing
// this module's shape.

const DEV_REDIS_URL = 'redis://localhost:6379';

function normalizeUrl(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function buildUpstashUrl(restUrl, token) {
  const url = normalizeUrl(restUrl);
  const secret = normalizeUrl(token);
  if (!url || !secret) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port || '6379';
    if (!host) return null;
    return `rediss://default:${encodeURIComponent(secret)}@${host}:${port}`;
  } catch {
    return null;
  }
}

function resolveRedisUrl() {
  const direct = normalizeUrl(process.env.REDIS_URL);
  if (direct) return direct;

  const upstash = buildUpstashUrl(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
  if (upstash) return upstash;

  return process.env.NODE_ENV === 'production' ? null : DEV_REDIS_URL;
}

const env = {
  NODE_ENV:               process.env.NODE_ENV || 'development',
  PORT:                   parseInt(process.env.PORT || '3000'),
  API_VERSION:            process.env.API_VERSION || 'v1',
  DATABASE_URL:           process.env.DATABASE_URL,
  REDIS_URL:              resolveRedisUrl(),
  JWT_SECRET:             process.env.JWT_SECRET || process.env.COOKIE_SECRET || process.env.TENANT_ENCRYPTION_KEY || null,
  JWT_PRIVATE_KEY_PATH:   process.env.JWT_PRIVATE_KEY_PATH,
  JWT_PUBLIC_KEY_PATH:    process.env.JWT_PUBLIC_KEY_PATH,
  JWT_ACCESS_EXPIRES_IN:  process.env.JWT_ACCESS_EXPIRES_IN  || '2h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
  ALLOWED_ORIGINS:        process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  COOKIE_SECRET:          process.env.COOKIE_SECRET  || 'dev-cookie-secret-change-in-production',
  RATE_LIMIT_WINDOW_MS:   parseInt(process.env.RATE_LIMIT_WINDOW_MS    || '60000'),
  RATE_LIMIT_MAX:         parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  AUTH_RATE_LIMIT_MAX:    parseInt(process.env.AUTH_RATE_LIMIT_MAX     || '5'),
};

export default env;

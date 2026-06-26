/**
 * Rate limiting utility for sensitive endpoints.
 *
 * When Upstash Redis is configured (see @/lib/redis.js) requests are counted in a
 * shared Redis fixed-window counter (INCR + EXPIRE) so limits hold across instances.
 * When Redis is absent it falls back to the original in-memory, per-instance store
 * so local dev and tests keep working unchanged.
 */
import { getRedis } from '@/lib/redis.js';
import logger from '@/lib/logger.js';

class RateLimiter {
  constructor() {
    // Map of {key: [timestamps]}
    this.store = new Map();
    // Cleanup interval: remove old entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed under rate limit
   * @param {string} key - Unique identifier (e.g., user ID, IP address)
   * @param {number} maxRequests - Max requests allowed in window
   * @param {number} windowSeconds - Time window in seconds
   * @returns {object} - { allowed: boolean, remaining: number, retryAfter: number|null }
   */
  check(key, maxRequests = 10, windowSeconds = 60) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Get or create entry for this key
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }

    const timestamps = this.store.get(key);

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      // Rate limit exceeded
      const oldestTimestamp = validTimestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    return {
      allowed: true,
      remaining: maxRequests - validTimestamps.length,
      retryAfter: null,
    };
  }

  /**
   * Clean up old entries from store
   * @private
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, timestamps] of this.store.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < maxAge);
      if (validTimestamps.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, validTimestamps);
      }
    }
  }

  /**
   * Reset limit for a key
   * @param {string} key - Unique identifier
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * Destroy the rate limiter and cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton instance
export const globalRateLimiter = new RateLimiter();

/**
 * Redis fixed-window counter. Keyed by client+route plus the current window id so
 * each window gets its own auto-expiring counter (only integers are stored — no PHI).
 * @returns {Promise<object>} - { allowed, remaining, retryAfter }
 */
async function checkRateLimitRedis(redis, key, maxRequests, windowSeconds) {
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const redisKey = `ratelimit:${key}:${windowId}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    // First hit in this window — set the expiry so the counter self-cleans.
    await redis.expire(redisKey, windowSeconds);
  }

  if (count > maxRequests) {
    let retryAfter = await redis.ttl(redisKey);
    if (!retryAfter || retryAfter < 0) retryAfter = windowSeconds;
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - count, retryAfter: null };
}

/**
 * Middleware for rate limiting. Uses Redis when configured, otherwise the
 * in-memory limiter. Returns a Promise so callers must `await` the result; the
 * resolved shape is identical to the original synchronous return value.
 * @param {string} key - Rate limit key (e.g., userId or IP)
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<object>} - { allowed: boolean, remaining: number, retryAfter: number|null }
 */
export async function checkRateLimit(key, maxRequests = 10, windowSeconds = 60) {
  const redis = getRedis();
  if (redis) {
    try {
      return await checkRateLimitRedis(redis, key, maxRequests, windowSeconds);
    } catch (err) {
      // Never let a Redis outage block legitimate traffic — fall back in-memory.
      logger.warn({ err }, '[rate-limiter] Redis check failed; using in-memory fallback');
    }
  }
  return globalRateLimiter.check(key, maxRequests, windowSeconds);
}

/**
 * Build rate limit error response
 * @param {object} rateLimitResult - Result from checkRateLimit
 * @returns {object} - Response with status and headers
 */
export function getRateLimitResponse(rateLimitResult) {
  return {
    body: {
      error: 'Too many requests',
      message: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds.`,
    },
    status: 429,
    headers: {
      'Retry-After': String(rateLimitResult.retryAfter),
      'X-RateLimit-Remaining': '0',
    },
  };
}

export default globalRateLimiter;

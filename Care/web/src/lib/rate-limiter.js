/**
 * Rate limiting utility for sensitive endpoints.
 * Uses a simple in-memory store with time-window tracking.
 * For production, consider using Redis or a dedicated rate-limiting service.
 */

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
 * Middleware for rate limiting
 * @param {string} key - Rate limit key (e.g., userId or IP)
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {object} - { allowed: boolean, remaining: number, retryAfter: number|null }
 */
export function checkRateLimit(key, maxRequests = 10, windowSeconds = 60) {
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

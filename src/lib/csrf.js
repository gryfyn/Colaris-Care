/**
 * CSRF Protection (Double-Submit Cookie pattern)
 *
 * How it works:
 *  1. The server issues a CSRF token in a non-httpOnly cookie (`csrf_token`) so that
 *     client-side JavaScript can read it.
 *  2. Every state-changing request (POST, PATCH, PUT, DELETE) must echo the value
 *     back in the `X-CSRF-Token` request header.
 *  3. The server compares the header value against the cookie value using a
 *     constant-time comparison to prevent timing attacks.
 *  4. Because a third-party origin cannot set or read cookies on this domain, and
 *     cannot set arbitrary headers on cross-origin requests, a forged request
 *     cannot supply the matching token.
 *
 * NOTE: This protection is complementary to the SameSite=Strict setting on the
 * refresh_token cookie.  The JWT access token never touches a cookie, so it
 * is not directly CSRF-vulnerable, but CSRF protection is added here as a
 * defence-in-depth measure for any session-adjacent endpoints.
 */

import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_BYTES = 32;

/**
 * Generate a cryptographically-random CSRF token (hex string).
 */
export function generateCsrfToken() {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Attach a CSRF token cookie to a Next.js response object.
 * Call this on any GET response that renders a form-bearing page.
 *
 * @param {import('next/server').NextResponse} response
 * @param {string} token  — value from generateCsrfToken()
 */
export function attachCsrfCookie(response, token) {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,           // Must be readable by JS for the double-submit pattern
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60,           // 1 hour — rotated on each page load
  });
}

/**
 * Validate CSRF token on a state-changing request.
 * Returns null on success, or { error, status } on failure.
 *
 * @param {Request} request  — Next.js request object
 * @returns {{ error: string, status: number } | null}
 */
export function validateCsrf(request) {
  const method = request.method?.toUpperCase();

  // Only validate state-changing methods.
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return { error: 'CSRF token missing', status: 403 };
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const cookieBuf = Buffer.from(cookieToken, 'hex');
    const headerBuf = Buffer.from(headerToken, 'hex');
    if (cookieBuf.length !== TOKEN_BYTES || headerBuf.length !== TOKEN_BYTES) {
      return { error: 'CSRF token invalid', status: 403 };
    }
    if (!timingSafeEqual(cookieBuf, headerBuf)) {
      return { error: 'CSRF token mismatch', status: 403 };
    }
  } catch {
    return { error: 'CSRF token invalid', status: 403 };
  }

  return null; // valid
}

import crypto from 'crypto';
import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

// Sessions and sign-in activity for the Settings "Security & sessions" tab.
// Every write here is best-effort: a failure must never break login/refresh/
// logout, so all calls are wrapped and only logged.

export function sessionTokenHash(refreshToken) {
  return crypto.createHash('sha256').update(String(refreshToken)).digest('hex');
}

// Best-effort human label from a user-agent string, e.g. "Chrome on Windows".
export function describeDevice(ua) {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /Linux/.test(ua) ? 'Linux'
    : 'device';
  return `${browser} on ${os}`;
}

export function requestContext(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || null;
  const userAgent = request.headers.get('user-agent') || null;
  return { ip, userAgent };
}

// All writes go through app.* SECURITY DEFINER functions: the runtime role does
// not bypass the FORCE RLS on care.sessions / audit_log.audit_events, and these
// run pre-auth (no request context), so direct table access would be rejected.
export async function recordLoginSession({ userId, organizationId, facilityId, refreshToken, ttlSeconds, ip, userAgent }) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await query(
      'select app.session_record($1, $2, $3, $4, $5, $6, $7)',
      [userId, organizationId || null, facilityId || null, sessionTokenHash(refreshToken), expiresAt, userAgent, ip]
    );
  } catch (err) {
    logger.warn({ err }, '[session-tracking] recordLoginSession failed');
  }
}

export async function rotateSession({ oldRefreshToken, newRefreshToken, ttlSeconds }) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await query(
      'select app.session_rotate($1, $2, $3)',
      [sessionTokenHash(oldRefreshToken), sessionTokenHash(newRefreshToken), expiresAt]
    );
  } catch (err) {
    logger.warn({ err }, '[session-tracking] rotateSession failed');
  }
}

export async function revokeSessionByToken(refreshToken) {
  try {
    await query('select app.session_revoke_by_token($1)', [sessionTokenHash(refreshToken)]);
  } catch (err) {
    logger.warn({ err }, '[session-tracking] revokeSessionByToken failed');
  }
}

export async function logAuthEvent({ organizationId, facilityId, userId, outcome, ip, userAgent, email }) {
  try {
    const metadata = {};
    if (userAgent) metadata.userAgent = userAgent;
    if (email) metadata.email = email;
    await query(
      'select app.auth_event_log($1, $2, $3, $4, $5, $6::jsonb)',
      [organizationId || null, facilityId || null, userId || null, outcome, ip, JSON.stringify(metadata)]
    );
  } catch (err) {
    logger.warn({ err }, '[session-tracking] logAuthEvent failed');
  }
}

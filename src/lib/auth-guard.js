import { verifyToken } from '@/lib/jwt.js';
import { hasPermission, ROLES, PHI_MASKED_FIELDS } from '@/lib/roles.js';
import { query } from '@/lib/db.js';
import { isJtiBlacklisted } from '@/lib/token-store.js';
import logger from '@/lib/logger.js';

/**
 * Verify JWT Bearer token. Returns { user } on success or { error, status } on failure.
 */
export async function authenticate(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or malformed Authorization header', status: 401 };
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token, 'access');

    try {
      if (await isJtiBlacklisted(decoded.jti)) {
        return { error: 'Token has been revoked', status: 401 };
      }
    } catch (storeErr) {
      logger.warn({ err: storeErr }, 'Token store unavailable during auth blacklist check; continuing without blacklist enforcement');
    }

    return {
      user: {
        id:         decoded.sub,
        staffId:    decoded.staffId,
        residentId: decoded.residentId,
        tenantId:   decoded.tenantId,
        role:       decoded.role,
        jti:        decoded.jti,
        exp:        decoded.exp,
      },
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { error: 'Token expired', code: 'TOKEN_EXPIRED', status: 401 };
    }
    return { error: 'Invalid token', status: 401 };
  }
}

/**
 * Check RBAC permission. Returns true if allowed, false otherwise.
 */
export function authorize(role, ...permissions) {
  const allowed = permissions.some(p => hasPermission(role, p));
  if (!allowed) logger.warn({ role, permissions }, 'Authorization denied');
  return allowed;
}

/**
 * Guard for resident_care_of — may only access their own resident record.
 * Returns null (pass-through) for clinical roles, or { linkedResidentId } / { error, status }.
 */
export async function guardResidentAccess(user, requestedId) {
  if (user.role !== ROLES.RESIDENT_CARE_OF) return null;

  const { rows } = await query(
    'SELECT resident_id FROM care.user_accounts WHERE id = $1 AND is_active = TRUE',
    [user.id]
  );
  if (!rows.length) {
    return { error: 'No resident record linked to this account', status: 403 };
  }

  const linkedResidentId = rows[0].resident_id;
  if (requestedId && requestedId !== linkedResidentId) {
    return { error: 'Access denied: you may only view your own record', status: 403 };
  }

  return { linkedResidentId };
}

/**
 * Strip PHI fields a role is not permitted to see.
 */
export function maskPHI(obj, role) {
  if (!obj) return obj;
  const masked = { ...obj };
  const fields = PHI_MASKED_FIELDS[role] || [];
  for (const f of fields) {
    if (f in masked) masked[f] = '[RESTRICTED]';
  }
  return masked;
}

/**
 * Build an Express-compatible request context object from a Next.js request.
 * Passed to AuditLogger methods in place of the Express req object.
 */
export function getRequestContext(request, user) {
  return {
    user: {
      id:       user?.id,
      staffId:  user?.staffId,
      tenantId: user?.tenantId,
      role:     user?.role,
      jti:      user?.jti,
    },
    id:  request.headers.get('x-request-id'),
    ip:  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
  };
}

/**
 * Translate database/app errors to appropriate HTTP responses.
 */
export function handleError(err) {
  if (!err) err = {};
  if (err.code === 'T0001') {
    return Response.json({ error: err.message, code: 'OPTIMISTIC_LOCK_CONFLICT' }, { status: 409 });
  }
  if (err.code === '55000') {
    return Response.json({ error: err.message, code: 'SIGNED_NOTE_IMMUTABLE' }, { status: 422 });
  }
  if (err.code === '23505') {
    return Response.json({ error: 'A record with that value already exists', code: 'DUPLICATE' }, { status: 409 });
  }
  if (err.code === '23503') {
    return Response.json({ error: 'Referenced record does not exist', code: 'FK_VIOLATION' }, { status: 422 });
  }
  if (err.code === '23502') {
    const col = err.column ? `'${err.column}' is required` : 'A required field is missing';
    return Response.json({ error: col, code: 'NOT_NULL_VIOLATION' }, { status: 422 });
  }
  if (err.code === '23514') {
    return Response.json({ error: 'A value failed a validation constraint', code: 'CHECK_VIOLATION' }, { status: 422 });
  }
  if (err.code === '22P02') {
    return Response.json({ error: 'A value has an invalid format', code: 'INVALID_INPUT_SYNTAX' }, { status: 422 });
  }
  if (err.code === '22001') {
    return Response.json({ error: 'A value is too long', code: 'VALUE_TOO_LONG' }, { status: 422 });
  }
  const status = err.status || err.statusCode || 500;
  return Response.json(
    {
      error: status >= 500 ? 'Internal server error' : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    { status }
  );
}

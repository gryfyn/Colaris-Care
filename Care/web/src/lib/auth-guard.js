import { verifyToken } from '@/lib/jwt.js';
import logger from '@/lib/logger.js';
import {
  hasPermission,
  PHI_MASKED_FIELDS,
  RESTRICTED_VALUE,
  ROLES,
} from '@/lib/roles.js';
import { getRequestContext as buildRequestContext } from '@/lib/request-context.js';
import { isTokenRevoked } from '@/lib/token-blacklist.js';

export class AuthError extends Error {
  constructor(message, status = 401, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

function bearerToken(request) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function userFromToken(decoded) {
  return {
    id: decoded.sub,
    staffId: decoded.staffId || null,
    residentId: decoded.residentId || null,
    tenantId: decoded.tenantId || decoded.organizationId || null,
    organizationId: decoded.organizationId || decoded.tenantId || null,
    facilityId: decoded.facilityId || null,
    role: decoded.role,
    jti: decoded.jti,
    exp: decoded.exp,
  };
}

export async function authenticate(request) {
  const token = bearerToken(request);
  if (!token) {
    return {
      error: 'Missing or malformed Authorization header',
      code: 'AUTH_MISSING',
      status: 401,
    };
  }

  try {
    const decoded = verifyToken(token, 'access');
    if (decoded.jti && (await isTokenRevoked(decoded.jti))) {
      return { error: 'Token has been revoked', code: 'TOKEN_REVOKED', status: 401 };
    }
    return { user: userFromToken(decoded) };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { error: 'Token expired', code: 'TOKEN_EXPIRED', status: 401 };
    }
    logger.warn({ err }, 'Invalid access token');
    return { error: 'Invalid token', code: 'TOKEN_INVALID', status: 401 };
  }
}

export function authorize(role, ...permissions) {
  const allowed = permissions.some((permission) => hasPermission(role, permission));
  if (!allowed) logger.warn({ role, permissions }, 'Authorization denied');
  return allowed;
}

export function requirePermissions(user, ...permissions) {
  if (!user?.role) {
    throw new AuthError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (!authorize(user.role, ...permissions)) {
    throw new AuthError('Forbidden', 403, 'AUTH_FORBIDDEN');
  }

  return true;
}

export async function requireUser(request, ...permissions) {
  const auth = await authenticate(request);
  if (auth.error) {
    throw new AuthError(auth.error, auth.status, auth.code);
  }

  if (permissions.length) {
    requirePermissions(auth.user, ...permissions);
  }

  return auth.user;
}

export function canAccessPortal(user, portal) {
  if (!user?.role) return false;

  if (portal === 'admin') {
    return user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN;
  }

  if (portal === 'staff') {
    return [ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPERADMIN].includes(user.role);
  }

  return false;
}

export function guardResidentAccess(user, requestedResidentId) {
  if (user?.role !== ROLES.RESIDENT_CARE_OF) return null;

  if (!user.residentId) {
    return { error: 'No resident record linked to this account', status: 403 };
  }

  if (requestedResidentId && String(requestedResidentId) !== String(user.residentId)) {
    return { error: 'Access denied: you may only view your own record', status: 403 };
  }

  return { linkedResidentId: user.residentId };
}

export function maskPHI(value, role) {
  if (Array.isArray(value)) return value.map((item) => maskPHI(item, role));
  if (!value || typeof value !== 'object') return value;

  const masked = { ...value };
  for (const field of PHI_MASKED_FIELDS[role] || []) {
    if (field in masked) masked[field] = RESTRICTED_VALUE;
  }
  return masked;
}

export function getRequestContext(request, user) {
  return buildRequestContext(request, user);
}

export function authErrorResponse(err) {
  const status = err?.status || err?.statusCode || 500;
  return Response.json(
    {
      error: status >= 500 ? 'Internal server error' : err.message,
      code: err?.code || (status === 403 ? 'AUTH_FORBIDDEN' : 'AUTH_ERROR'),
    },
    { status }
  );
}

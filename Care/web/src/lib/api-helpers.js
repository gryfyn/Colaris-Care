import { AuthError, authErrorResponse, requireUser } from '@/lib/auth-guard.js';
import { withRequestContext } from '@/lib/db.js';
import { withPrismaContext } from '@/lib/prisma-context.js';

export function jsonError(message, status = 400, code = 'BAD_REQUEST') {
  return Response.json({ error: message, code }, { status });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new AuthError('Invalid JSON request body', 400, 'INVALID_JSON');
  }
}

export async function withApiContext(request, permission, action, handler) {
  try {
    const user = await requireUser(request, permission);
    const result = await withRequestContext(user, action || permission, (client) => handler({ client, user }));
    return Response.json({ data: result });
  } catch (err) {
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return authErrorResponse(err);
    }
    const status = err?.status || err?.statusCode || 500;
    return Response.json(
      {
        error: status >= 500 ? 'Internal server error' : err.message,
        code: err?.code || 'API_ERROR',
      },
      { status }
    );
  }
}

/**
 * Prisma-backed twin of withApiContext: identical RBAC, response shape and
 * error handling, but the data access runs inside withPrismaContext so the
 * caller's handler receives a Prisma transaction client (`tx`) already under
 * the correct RLS context. Use this when a route's data access has been
 * migrated to Prisma models; routes still on raw pg keep using withApiContext.
 */
export async function withPrismaApiContext(request, permission, action, handler) {
  try {
    const user = await requireUser(request, permission);
    const result = await withPrismaContext(user, action || permission, (tx) => handler({ tx, user }));
    return Response.json({ data: result });
  } catch (err) {
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return authErrorResponse(err);
    }
    const status = err?.status || err?.statusCode || 500;
    return Response.json(
      {
        error: status >= 500 ? 'Internal server error' : err.message,
        code: err?.code || 'API_ERROR',
      },
      { status }
    );
  }
}

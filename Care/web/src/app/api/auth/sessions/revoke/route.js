import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

// POST /api/auth/sessions/revoke  { id }
// Signs out one of the current user's sessions. The revoked session can no
// longer refresh, so that device is logged out when its short-lived access
// token expires.
export async function POST(request) {
  try {
    const user = await requireUser(request);

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }
    const id = String(body?.id || '');
    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 422 });
    }

    const { rows } = await query('select app.session_revoke($1, $2) as ok', [user.id, id]);
    if (!rows[0]?.ok) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    return Response.json({ data: { message: 'Session signed out.' } });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[auth/sessions/revoke] failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

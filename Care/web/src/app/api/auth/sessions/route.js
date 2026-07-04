import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';
import { sessionTokenHash, describeDevice } from '@/lib/session-tracking.js';
import logger from '@/lib/logger.js';

// GET /api/auth/sessions — active sessions for the signed-in user. Lives under
// /api/auth so the httpOnly refresh cookie (Path=/api/auth) is available to flag
// which row is this device.
export async function GET(request) {
  try {
    const user = await requireUser(request);
    const refreshToken = request.cookies.get('refresh_token')?.value;
    const currentHash = refreshToken ? sessionTokenHash(refreshToken) : null;

    const { rows } = await query('select * from app.session_list($1)', [user.id]);

    const data = rows.map((r) => ({
      id: r.id,
      device: describeDevice(r.user_agent),
      ip: r.source_ip || null,
      current: Boolean(currentHash && r.token_hash === currentHash),
      signedInAt: r.issued_at,
      lastSeenAt: r.last_seen_at || r.issued_at,
    }));

    return Response.json({ data });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[auth/sessions] list failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

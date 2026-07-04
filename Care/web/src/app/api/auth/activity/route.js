import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';
import { describeDevice } from '@/lib/session-tracking.js';
import logger from '@/lib/logger.js';

// GET /api/auth/activity — recent sign-in activity (success + failed attempts)
// for the signed-in user, from audit_log.audit_events.
export async function GET(request) {
  try {
    const user = await requireUser(request);

    const { rows } = await query('select * from app.auth_event_list($1)', [user.id]);

    const data = rows.map((r) => {
      const metadata = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
      return {
        outcome: r.outcome,
        ip: r.source_ip || null,
        device: describeDevice(metadata.userAgent),
        at: r.occurred_at,
      };
    });

    return Response.json({ data });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[auth/activity] failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

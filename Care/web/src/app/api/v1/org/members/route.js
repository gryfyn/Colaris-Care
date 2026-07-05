import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

// GET /api/v1/org/members — users in the admin's organization, for the
// "add member" picker. Admin only; scoped to the actor's org in the function.
export async function GET(request) {
  try {
    const user = await requireUser(request, PERMISSIONS.ACCOUNTS_MANAGE);
    const { rows } = await query('select * from app.org_users($1, $2)', [user.id, user.organizationId]);
    return Response.json({
      data: rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, roles: r.roles, homes: Number(r.homes) })),
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[org/members] failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

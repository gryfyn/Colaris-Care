import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

const MAX_HOMES = 3;

function mapMsg(err) {
  const msg = String(err?.message || '');
  if (msg.includes('NOT_AUTHORIZED')) return { error: 'You must be an admin of this home to manage its members.', status: 403 };
  if (msg.includes('FACILITY_LIMIT_REACHED')) return { error: `That user already belongs to ${MAX_HOMES} homes.`, status: 409 };
  if (msg.includes('INVALID_ROLE')) return { error: 'Invalid role.', status: 422 };
  if (msg.includes('USER_NOT_FOUND')) return { error: 'User not found.', status: 404 };
  if (msg.includes('CANNOT_REMOVE_SELF')) return { error: 'You cannot remove yourself.', status: 409 };
  return null;
}

// GET /api/v1/facilities/members?facilityId=  — members of a home (admin of it).
export async function GET(request) {
  try {
    const user = await requireUser(request);
    const facilityId = new URL(request.url).searchParams.get('facilityId') || user.facilityId;
    const { rows } = await query('select * from app.facility_members($1, $2)', [user.id, facilityId]);
    return Response.json({
      data: rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, status: r.status, isSelf: r.user_id === user.id })),
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[facilities/members] list failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/facilities/members  { facilityId, userId, role }  — add/reactivate.
export async function POST(request) {
  try {
    const user = await requireUser(request, PERMISSIONS.ACCOUNTS_MANAGE);
    let body;
    try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON request body' }, { status: 400 }); }
    const facilityId = String(body?.facilityId || '');
    const userId = String(body?.userId || '');
    const role = String(body?.role || 'manager');
    if (!facilityId || !userId) return Response.json({ error: 'facilityId and userId are required.' }, { status: 422 });
    try {
      await query('select app.add_member($1, $2, $3, $4, $5)', [user.id, facilityId, userId, role, MAX_HOMES]);
      return Response.json({ data: { ok: true } });
    } catch (err) {
      const m = mapMsg(err);
      if (m) return Response.json({ error: m.error }, { status: m.status });
      throw err;
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[facilities/members] add failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/facilities/members?facilityId=&userId=  — deactivate membership.
export async function DELETE(request) {
  try {
    const user = await requireUser(request, PERMISSIONS.ACCOUNTS_MANAGE);
    const params = new URL(request.url).searchParams;
    const facilityId = params.get('facilityId') || '';
    const userId = params.get('userId') || '';
    if (!facilityId || !userId) return Response.json({ error: 'facilityId and userId are required.' }, { status: 422 });
    try {
      await query('select app.remove_member($1, $2, $3)', [user.id, facilityId, userId]);
      return Response.json({ data: { ok: true } });
    } catch (err) {
      const m = mapMsg(err);
      if (m) return Response.json({ error: m.error }, { status: m.status });
      throw err;
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[facilities/members] remove failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

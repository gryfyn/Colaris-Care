import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

const MAX_HOMES = 3;

// GET /api/v1/facilities — the facilities (homes) the signed-in user belongs to,
// with the active one flagged. Any authenticated user; scoped to their own id in
// the SECURITY DEFINER function.
export async function GET(request) {
  try {
    const user = await requireUser(request);
    const { rows } = await query('select * from app.user_facilities($1)', [user.id]);
    const facilities = rows.map((r) => ({
      id: r.facility_id,
      organizationId: r.organization_id,
      name: r.name,
      role: r.role,
      current: r.facility_id === user.facilityId,
    }));
    const isAdmin = ['admin', 'superadmin'].includes(user.role);
    return Response.json({
      data: {
        facilities,
        currentFacilityId: user.facilityId,
        max: MAX_HOMES,
        isAdmin,
        canAdd: isAdmin && facilities.length < MAX_HOMES,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[facilities] list failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/facilities — add a new home under the user's organization. Admin
// only; enforces the max-homes cap inside app.create_home.
export async function POST(request) {
  try {
    const user = await requireUser(request, PERMISSIONS.ACCOUNTS_MANAGE);

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }
    const name = String(body?.name || '').trim();
    if (!name) return Response.json({ error: 'Facility name is required.' }, { status: 422 });
    const timezone = body?.timezone ? String(body.timezone) : null;

    try {
      const { rows } = await query(
        'select * from app.create_home($1, $2, $3, $4, $5::jsonb, $6)',
        [user.id, user.organizationId, name, timezone, JSON.stringify({}), MAX_HOMES]
      );
      return Response.json({ data: { id: rows[0].facility_id, name: rows[0].name } });
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('FACILITY_LIMIT_REACHED')) {
        return Response.json({ error: `You can have at most ${MAX_HOMES} homes.` }, { status: 409 });
      }
      if (msg.includes('NOT_AUTHORIZED')) {
        return Response.json({ error: 'Not authorized to add a home for this organization.' }, { status: 403 });
      }
      if (msg.includes('FACILITY_NAME_REQUIRED')) {
        return Response.json({ error: 'Facility name is required.' }, { status: 422 });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[facilities] create failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/activities/[id]
 * Fetch a single activity.
 *
 * Auth: Any authenticated user can read
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id } = await params;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT a.id, a.tenant_id, a.day_of_week, a.start_time, a.name,
                a.location, a.category, a.description, a.duration_minutes,
                a.active, a.created_by, a.created_at, a.updated_at
           FROM care.activities a
          WHERE a.id = $1 AND a.tenant_id = $2`,
        [id, user.tenantId]
      );
      return rows[0] || null;
    });

    if (!result) {
      return Response.json({ error: 'Activity not found' }, { status: 404 });
    }

    const req = getRequestContext(request, user);
    await audit
      .logSelect({ tableName: 'care.activities', req })

    return Response.json({ data: result });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/activities/[id]
 * Update an activity.
 *
 * Body: any fields to update
 *   day_of_week, start_time, name, location, category, description, duration_minutes, active
 *
 * Auth: admin, manager only
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate day_of_week if provided
    if (body.day_of_week) {
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(body.day_of_week)) {
        return Response.json(
          { error: `Invalid day_of_week. Must be one of: ${validDays.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate start_time format if provided
    if (body.start_time && !/^\d{2}:\d{2}$/.test(body.start_time)) {
      return Response.json(
        { error: 'start_time must be in HH:MM format' },
        { status: 400 }
      );
    }

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify activity exists
      const { rows: existing } = await client.query(
        'SELECT id FROM care.activities WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!existing.length) throw { status: 404, message: 'Activity not found' };

      const updates = ['updated_at = NOW()'];
      const updateParams = [id, user.tenantId];

      const fieldMap = {
        day_of_week: 'day_of_week',
        start_time: 'start_time',
        name: 'name',
        location: 'location',
        category: 'category',
        description: 'description',
        duration_minutes: 'duration_minutes',
        active: 'active',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (key in body) {
          updates.push(`${column} = $${updateParams.length + 1}`);
          updateParams.push(body[key]);
        }
      }

      const { rows } = await client.query(
        `UPDATE care.activities
            SET ${updates.join(', ')}
          WHERE id = $1 AND tenant_id = $2
          RETURNING id, day_of_week, start_time, name, location, category,
                    description, duration_minutes, active, updated_at`,
        updateParams
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit
      .logUpdate({
        tableName: 'care.activities',
        recordId: id,
        newValues: body,
        req,
      })

    return Response.json({ data: updated });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * DELETE /api/v1/activities/[id]
 * Delete an activity.
 *
 * Auth: admin, manager only
 */
export async function DELETE(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const deleted = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: existing } = await client.query(
        'SELECT id FROM care.activities WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!existing.length) throw { status: 404, message: 'Activity not found' };

      const { rows } = await client.query(
        'DELETE FROM care.activities WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, user.tenantId]
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit
      .logDelete({
        tableName: 'care.activities',
        recordId: id,
        req,
      })

    return Response.json({ data: { id: deleted.id } }, { status: 200 });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

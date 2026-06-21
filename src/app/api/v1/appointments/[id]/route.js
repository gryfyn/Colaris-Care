import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/appointments/[id]
 * Retrieve a single appointment by ID.
 *
 * Auth: RESIDENTS_READ permission. Staff can only view appointments for assigned residents.
 * Response: { data: { id, resident_id, appointment_type, ... } }
 */
export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const row = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT a.*, r.first_name, r.last_name
           FROM care.appointments a
           JOIN care.residents r ON r.id = a.resident_id
          WHERE a.id = $1 AND a.tenant_id = $2`,
        [id, user.tenantId]
      );

      if (rows.length && staffAssignmentRequired(user)) {
        const { rows: assignedRows } = await client.query(
          'SELECT 1 FROM care.staff_assignments WHERE resident_id = $1 AND staff_id = $2 AND is_active = TRUE',
          [rows[0].resident_id, user.staffId]
        );
        if (!assignedRows.length) return null;
      }

      return rows[0];
    });

    if (!row) return Response.json({ error: 'Appointment not found' }, { status: 404 });

    const { resident_id, ...data } = row;
    const req = getRequestContext(request, user);
    await audit.logSelect({
      tableName: 'care.appointments',
      recordId: id,
      residentId: resident_id,
      req,
    });
    return Response.json({ data: row });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/appointments/[id]
 * Update an appointment.
 *
 * Body: Partial update of fields:
 *   title, description, location, scheduled_at, duration_minutes, status, notes
 *
 * Auth: admin/manager can update any; staff can update only their assigned residents' appointments.
 * Response: { data: { id, ... } }
 */
export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'staff', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const updates = await request.json();

    const allowedFields = ['title', 'description', 'location', 'scheduled_at', 'duration_minutes', 'status', 'notes'];

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: current } = await client.query(
        'SELECT * FROM care.appointments WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!current.length) throw { status: 404, message: 'Appointment not found' };

      if (staffAssignmentRequired(user)) {
        const { rows: assignedRows } = await client.query(
          'SELECT 1 FROM care.staff_assignments WHERE resident_id = $1 AND staff_id = $2 AND is_active = TRUE',
          [current[0].resident_id, user.staffId]
        );
        if (!assignedRows.length) throw { status: 403, message: 'Not assigned to this resident' };
      }

      const san = sanitizeFields(
        updates,
        allowedFields.filter(f => f in updates)
      );

      const setClauses = [];
      const params = [];
      for (const field of allowedFields) {
        if (field in san) {
          params.push(san[field]);
          setClauses.push(`${field} = $${params.length}`);
        }
      }

      if (!setClauses.length) return current[0];

      params.push(user.staffId);
      setClauses.push(`updated_by = $${params.length}`);
      params.push(id, user.tenantId);

      const { rows } = await client.query(
        `UPDATE care.appointments SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
         RETURNING *`,
        params
      );

      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.appointments',
      recordId: id,
      residentId: updated.resident_id,
      diffKeys: Object.keys(updates).filter(k => allowedFields.includes(k)),
      req,
    });
    return Response.json({ data: updated });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * DELETE /api/v1/appointments/[id]
 * Cancel (soft delete) an appointment.
 *
 * Auth: admin/manager can delete any; staff can delete only assigned residents' appointments.
 * Response: { data: { id, status, cancelled_at } }
 */
export async function DELETE(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'staff', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const deleted = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: current } = await client.query(
        'SELECT * FROM care.appointments WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!current.length) throw { status: 404, message: 'Appointment not found' };

      if (staffAssignmentRequired(user)) {
        const { rows: assignedRows } = await client.query(
          'SELECT 1 FROM care.staff_assignments WHERE resident_id = $1 AND staff_id = $2 AND is_active = TRUE',
          [current[0].resident_id, user.staffId]
        );
        if (!assignedRows.length) throw { status: 403, message: 'Not assigned to this resident' };
      }

      const { rows } = await client.query(
        `UPDATE care.appointments SET status = 'cancelled', updated_by = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3
         RETURNING id, status, updated_at`,
        [user.staffId, id, user.tenantId]
      );

      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logDelete({
      tableName: 'care.appointments',
      recordId: id,
      req,
    });
    return Response.json({ data: deleted });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

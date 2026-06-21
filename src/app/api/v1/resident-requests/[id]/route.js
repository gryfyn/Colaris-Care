import { authenticate, authorize, guardResidentAccess, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();
const normalizeRequestStatus = (status) => (status === 'completed' ? 'fulfilled' : status);

/**
 * GET /api/v1/resident-requests/[id]
 * Fetch a single resident request.
 *
 * Auth:
 * - resident_care_of: can only view their own request
 * - staff, manager, admin: can view any request in their tenant
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id } = await params;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT rr.id, rr.tenant_id, rr.resident_id, rr.request_type, rr.details,
                rr.status, rr.response_notes AS response, rr.handled_by AS responded_by,
                rr.completed_date AS responded_at, rr.submitted_date,
                rr.created_at, rr.updated_at,
                r.first_name, r.last_name
           FROM care.resident_requests rr
           JOIN care.residents r ON r.id = rr.resident_id
          WHERE rr.id = $1 AND rr.tenant_id = $2 AND rr.deleted_at IS NULL`,
        [id, user.tenantId]
      );
      const row = rows[0] || null;
      return row
        ? { ...row, status: normalizeRequestStatus(row.status) }
        : null;
    });

    if (!result) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    // If resident_care_of, ensure they own this request
    if (user.role === ROLES.RESIDENT_CARE_OF) {
      const guardResult = await guardResidentAccess(user, result.resident_id);
      if (guardResult && guardResult.error) {
        return Response.json({ error: guardResult.error }, { status: guardResult.status });
      }
    }

    const req = getRequestContext(request, user);
    await audit
      .logSelect({ tableName: 'care.resident_requests', req })

    return Response.json({ data: result });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/resident-requests/[id]
 * Update request status and/or response.
 *
 * Body:
 *   status (string, optional) - 'pending', 'approved', 'denied', 'fulfilled'
 *   response (string, optional) - staff response
 *
 * Auth: staff, manager, admin only
 * Sets responded_by and responded_at automatically
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, response } = body;

    // At least one field must be updated
    if (status === undefined && response === undefined) {
      return Response.json(
        { error: 'At least one of status or response must be provided' },
        { status: 422 }
      );
    }

    const validStatuses = ['pending', 'in_review', 'approved', 'denied', 'fulfilled', 'completed'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // First verify the request exists
      const { rows: existing } = await client.query(
        'SELECT id, resident_id FROM care.resident_requests WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!existing.length) throw { status: 404, message: 'Request not found' };

      const updates = ['updated_at = NOW()'];
      const updateParams = [id, user.tenantId];

      const dbStatus = status === 'fulfilled' ? 'completed' : status;

      if (status !== undefined) {
        updates.push(`status = $${updateParams.length + 1}`);
        updateParams.push(dbStatus);
      }

      if (response !== undefined) {
        updates.push(`response_notes = $${updateParams.length + 1}`);
        updateParams.push(response);
      }

      // If responding, set handled_by and completed_date
      if (response !== undefined || status !== undefined) {
        updates.push(`handled_by = $${updateParams.length + 1}`);
        updateParams.push(user.staffId || user.id);
        if (status === 'completed' || status === 'fulfilled' || status === 'approved' || status === 'denied') {
          updates.push(`completed_date = CURRENT_DATE`);
        }
      }

      const { rows } = await client.query(
        `UPDATE care.resident_requests
            SET ${updates.join(', ')}
          WHERE id = $1 AND tenant_id = $2
          RETURNING id, resident_id, request_type, details, status,
                    response_notes AS response, handled_by AS responded_by,
                    completed_date AS responded_at, updated_at`,
        updateParams
      );
      const row = rows[0];
      return row
        ? { ...row, status: normalizeRequestStatus(row.status) }
        : row;
    });

    const req = getRequestContext(request, user);
    await audit
      .logUpdate({
        tableName: 'care.resident_requests',
        recordId: id,
        residentId: updated.resident_id,
        newValues: { status: updated.status, response: updated.response, responded_by: updated.responded_by },
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
 * DELETE /api/v1/resident-requests/[id]
 * Cancel/delete a resident request.
 *
 * Auth:
 * - resident_care_of: can only cancel their own pending request
 * - staff, manager, admin: can delete any request
 */
export async function DELETE(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id } = await params;

    const deleted = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: existing } = await client.query(
        'SELECT id, resident_id, status FROM care.resident_requests WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!existing.length) throw { status: 404, message: 'Request not found' };

      const request = existing[0];

      // If resident_care_of, check ownership and status
      if (user.role === ROLES.RESIDENT_CARE_OF) {
        const guardResult = await guardResidentAccess(user, request.resident_id);
        if (guardResult && guardResult.error) {
          throw guardResult;
        }
        // Residents can only cancel pending requests
        if (request.status !== 'pending') {
          throw { status: 422, message: 'Can only cancel pending requests' };
        }
      }

      const { rows } = await client.query(
        'DELETE FROM care.resident_requests WHERE id = $1 AND tenant_id = $2 RETURNING id, resident_id',
        [id, user.tenantId]
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit
      .logDelete({
        tableName: 'care.resident_requests',
        recordId: id,
        residentId: deleted.resident_id,
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

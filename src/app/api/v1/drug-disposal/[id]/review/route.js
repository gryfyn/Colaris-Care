import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * PATCH /api/v1/drug-disposal/[id]/review
 * Admin/manager approves or rejects a drug disposal record (changes review_status).
 *
 * Path params:
 *   id (UUID) - drug disposal record ID
 *
 * Body:
 *   status (string, required) - one of: approved, rejected
 *   notes (string, optional) - review notes (e.g., compliance issues)
 *
 * Auth: admin, manager, or superadmin role only
 * Validation:
 *   - Returns 404 if disposal record not found in tenant
 *   - Returns 422 if status not approved or rejected
 *
 * Response: {
 *   id, status (review_status), reviewed_at,
 *   message: "Drug disposal record approved" or "Drug disposal record rejected"
 * }
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const user = authResult.user;
    const { id } = await params;

    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Only admins and managers can review drug disposal records' }, { status: 403 });
    }

    const body = await request.json();
    const { status, notes } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return Response.json({ error: 'status must be approved or rejected' }, { status: 422 });
    }

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: existing } = await client.query(
        `SELECT id, resident_id, review_status
           FROM care.drug_disposal_records
          WHERE id = $1 AND tenant_id = $2`,
        [id, user.tenantId]
      );
      if (!existing.length) throw { status: 404, message: 'Drug disposal record not found' };

      const { rows } = await client.query(
        `UPDATE care.drug_disposal_records
            SET review_status = $1,
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                review_notes = $3
          WHERE id = $4 AND tenant_id = $5
        RETURNING id, resident_id, review_status, reviewed_at`,
        [status, user.staffId, notes || null, id, user.tenantId]
      );
      return { row: rows[0], previousStatus: existing[0].review_status };
    });

    await audit.logUpdate({
      tableName: 'care.drug_disposal_records',
      recordId: id,
      residentId: updated.row.resident_id,
      oldValues: { review_status: updated.previousStatus },
      newValues: { review_status: status, review_notes: notes || null },
      diffKeys: ['review_status', 'review_notes'],
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: updated.row.id,
      status: updated.row.review_status,
      reviewed_at: updated.row.reviewed_at,
      message: `Drug disposal record ${status}`,
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

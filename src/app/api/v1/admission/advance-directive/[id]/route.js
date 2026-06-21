import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admission/advance-directive/[id]
 * Load an advance-directive draft for rehydration (form_data blob).
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    const { user } = authResult;
    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_READ)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const row = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, status, pre_screening_id, nursing_admission_id, resident_id, form_data, submitted_at, created_at, updated_at
           FROM care.advance_directives WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );
      return rows[0];
    });
    if (!row) return Response.json({ error: 'Advance directive not found' }, { status: 404 });

    await audit.logSelect({ tableName: 'care.advance_directives', recordId: id, req: getRequestContext(request, user) });
    return Response.json({
      data: {
        id: row.id,
        advanceId: row.id,
        status: row.status,
        pre_screening_id: row.pre_screening_id,
        nursing_admission_id: row.nursing_admission_id,
        resident_id: row.resident_id,
        advance_directive_data: row.form_data || {},
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

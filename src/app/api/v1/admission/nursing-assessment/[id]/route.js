import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admission/nursing-assessment/[id]
 * Load a nursing assessment draft for rehydration. Returns its form_data blob
 * as nursing_assessment_data (the shape the wizard restores from).
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
        `SELECT id, status, pre_screening_id, resident_id, form_data, submitted_at, created_at, updated_at
           FROM care.nursing_admissions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );
      return rows[0];
    });
    if (!row) return Response.json({ error: 'Nursing assessment not found' }, { status: 404 });

    await audit.logSelect({ tableName: 'care.nursing_admissions', recordId: id, req: getRequestContext(request, user) });
    return Response.json({
      data: {
        id: row.id,
        nursingId: row.id,
        status: row.status,
        pre_screening_id: row.pre_screening_id,
        resident_id: row.resident_id,
        nursing_assessment_data: row.form_data || {},
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

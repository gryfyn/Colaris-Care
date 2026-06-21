import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey, decryptFaceSheet } from '@/lib/face-sheet-phi.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/face-sheets/resident/[residentId]
 * Retrieve the face sheet for a specific resident.
 *
 * Auth: RESIDENTS_READ permission. Staff can only view for assigned residents.
 * Response: { data: { id, resident_id, ... } } or { error: "Face sheet not found" }
 */
export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { residentId } = await context.params;

    const row = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      if (staffAssignmentRequired(user)) {
        const { rows: assignedRows } = await client.query(
          'SELECT 1 FROM care.staff_assignments WHERE resident_id = $1 AND staff_id = $2 AND is_active = TRUE',
          [residentId, user.staffId]
        );
        if (!assignedRows.length) return null;
      }

      const { rows } = await client.query(
        `SELECT fs.* FROM care.resident_face_sheets fs
          WHERE fs.resident_id = $1 AND fs.tenant_id = $2`,
        [residentId, user.tenantId]
      );

      return rows[0];
    });

    if (!row) return Response.json({ error: 'Face sheet not found' }, { status: 404 });

    const tenantKey = await getTenantKey(user.tenantId);
    row.form_data = decryptFaceSheet(row.form_data, tenantKey, user.role);

    const req = getRequestContext(request, user);
    await audit.logSelect({
      tableName: 'care.resident_face_sheets',
      recordId: row.id,
      residentId: residentId,
      req,
    });
    return Response.json({ data: row });
  } catch (err) {
    return handleError(err);
  }
}

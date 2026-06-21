import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey, encryptFaceSheet, decryptFaceSheet } from '@/lib/face-sheet-phi.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/face-sheets/[id]
 * Retrieve a single face sheet by ID.
 *
 * Auth: RESIDENTS_READ permission. Staff can only view for assigned residents.
 * Response: { data: { id, resident_id, form_data, ... } }
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
        `SELECT fs.* FROM care.resident_face_sheets fs
          WHERE fs.id = $1 AND fs.tenant_id = $2`,
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

    if (!row) return Response.json({ error: 'Face sheet not found' }, { status: 404 });

    const tenantKey = await getTenantKey(user.tenantId);
    row.form_data = decryptFaceSheet(row.form_data, tenantKey, user.role);

    const req = getRequestContext(request, user);
    await audit.logSelect({
      tableName: 'care.resident_face_sheets',
      recordId: id,
      residentId: row.resident_id,
      req,
    });
    return Response.json({ data: row });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/face-sheets/[id]
 * Update a face sheet's content.
 *
 * Body: { form_data: { ...partial or full face sheet fields... } }
 *   Provided keys are merged over the stored form_data; sensitive keys
 *   (ssn, medicare_number, medicaid_number) are re-encrypted at rest.
 *
 * Auth: admin or manager only
 * Response: { data: { id, resident_id, updated_at } }
 */
export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const incoming = body.form_data;

    if (!incoming || typeof incoming !== 'object') {
      return Response.json({ error: 'form_data (object) is required' }, { status: 422 });
    }

    const tenantKey = await getTenantKey(user.tenantId);
    const encryptedIncoming = encryptFaceSheet(incoming, tenantKey);

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: current } = await client.query(
        'SELECT id, resident_id, form_data FROM care.resident_face_sheets WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!current.length) throw { status: 404, message: 'Face sheet not found' };

      const merged = { ...(current[0].form_data || {}), ...encryptedIncoming };

      const { rows } = await client.query(
        `UPDATE care.resident_face_sheets
            SET form_data = $1, last_updated_by = $2, updated_at = NOW()
          WHERE id = $3 AND tenant_id = $4
          RETURNING id, resident_id, photo_url, photo_public_id, photo_uploaded_at, photo_metadata, updated_at`,
        [JSON.stringify(merged), user.staffId, id, user.tenantId]
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.resident_face_sheets',
      recordId: id,
      residentId: updated.resident_id,
      diffKeys: Object.keys(incoming),
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

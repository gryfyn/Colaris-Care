import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentScope } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey, encryptFaceSheet, decryptFaceSheet } from '@/lib/face-sheet-phi.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/face-sheets
 * List face sheets with pagination.
 * Staff users see only face sheets for their assigned residents.
 *
 * Query params:
 *   resident_id   - filter by specific resident (UUID)
 *   limit         - items per page (1-200, default 50)
 *   offset        - pagination offset (default 0)
 *
 * Auth: RESIDENTS_READ permission
 * Response: { data: [...], pagination: { limit, offset, total, pages } }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('resident_id');
    const staffOnly = staffAssignmentScope(user, searchParams.get('staff_only'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['fs.tenant_id = $1'];
      const params = [user.tenantId];
      let joinStaffAssignments = '';

      if (residentId) {
        params.push(residentId);
        conditions.push(`fs.resident_id = $${params.length}`);
      }

      if (staffOnly) {
        joinStaffAssignments = 'JOIN care.staff_assignments sa ON sa.resident_id = fs.resident_id AND sa.is_active = TRUE';
        params.push(user.staffId);
        conditions.push(`sa.staff_id = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT fs.id, fs.resident_id, fs.form_data,
                fs.photo_url, fs.photo_public_id, fs.photo_uploaded_at, fs.photo_metadata,
                fs.created_at, fs.updated_at,
                r.first_name, r.last_name,
                COUNT(*) OVER() AS total_count
           FROM care.resident_face_sheets fs
           JOIN care.residents r ON r.id = fs.resident_id
           ${joinStaffAssignments}
          WHERE ${where}
          ORDER BY r.last_name, r.first_name
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(result[0]?.total_count || 0);
    const tenantKey = await getTenantKey(user.tenantId);
    const data = result.map(({ total_count, form_data, ...rest }) => ({
      ...rest,
      form_data: decryptFaceSheet(form_data, tenantKey, user.role),
    }));

    await audit.logSelect({
      tableName: 'care.resident_face_sheets',
      residentId: null,
      req: getRequestContext(request, user),
    });
    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/face-sheets
 * Create a new face sheet for a resident.
 *
 * Body:
 *   resident_id (UUID, required)
 *   form_data (object, required) — full face sheet content keyed by field
 *     (see src/app/components/faceSheetConfig.js). Sensitive keys (ssn,
 *     medicare_number, medicaid_number) are encrypted at rest.
 *
 * Auth: admin or manager only
 * Response: { data: { id, resident_id, created_at } }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { resident_id, form_data } = body;

    if (!resident_id || !form_data || typeof form_data !== 'object') {
      return Response.json(
        { error: 'resident_id and form_data (object) are required' },
        { status: 422 }
      );
    }

    const tenantKey = await getTenantKey(user.tenantId);
    const encrypted = encryptFaceSheet(form_data, tenantKey);

    const faceSheet = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: residentRows } = await client.query(
        'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );
      if (!residentRows.length) throw { status: 404, message: 'Resident not found' };

      const { rows: existingRows } = await client.query(
        'SELECT id FROM care.resident_face_sheets WHERE resident_id = $1 AND tenant_id = $2',
        [resident_id, user.tenantId]
      );
      if (existingRows.length) throw { status: 409, message: 'Face sheet already exists for this resident' };

      const { rows } = await client.query(
        `INSERT INTO care.resident_face_sheets (
           tenant_id, resident_id, form_data, last_updated_by
         ) VALUES ($1, $2, $3, $4)
         RETURNING id, resident_id, photo_url, photo_public_id, photo_uploaded_at, photo_metadata, created_at`,
        [user.tenantId, resident_id, JSON.stringify(encrypted), user.staffId]
      );
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.resident_face_sheets',
      recordId: faceSheet.id,
      residentId: resident_id,
      req: getRequestContext(request, user),
    });
    return Response.json({ data: faceSheet }, { status: 201 });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

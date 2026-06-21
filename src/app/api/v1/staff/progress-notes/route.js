import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { decryptFields } from '@/lib/encryption.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/staff/progress-notes
 * List progress notes filtered by staff member with pagination.
 * Query params: staff_id, resident_id, review_status, limit (1-200, default 50), offset (default 0)
 * Requires PROGRESS_NOTES_READ permission.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.PROGRESS_NOTES_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staff_id');
    const residentId = searchParams.get('resident_id');
    const reviewStatus = searchParams.get('review_status');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Validate review_status if provided
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (reviewStatus && !validStatuses.includes(reviewStatus)) {
      return Response.json(
        { error: `Invalid review_status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['dpn.tenant_id = $1'];
      const params = [user.tenantId];

      if (staffId) {
        params.push(staffId);
        conditions.push(`dpn.staff_id = $${params.length}`);
      }

      if (residentId) {
        params.push(residentId);
        conditions.push(`dpn.resident_id = $${params.length}`);
      }

      if (reviewStatus) {
        params.push(reviewStatus);
        conditions.push(`dpn.review_status = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT dpn.id, dpn.resident_id, dpn.staff_id, dpn.note_date, dpn.shift,
                dpn.note_body, dpn.review_status, dpn.reviewed_at, dpn.review_notes,
                r.first_name AS resident_first_name, r.last_name AS resident_last_name,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name,
                dpn.created_at, dpn.updated_at,
                COUNT(*) OVER() AS total_count
         FROM care.daily_progress_notes dpn
         LEFT JOIN care.residents r ON r.id = dpn.resident_id
         LEFT JOIN ref.staff s ON s.id = dpn.staff_id
         WHERE ${where}
         ORDER BY dpn.note_date DESC, dpn.shift DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = result[0]?.total_count || 0;
    const tenantKey = await getTenantKey(user.tenantId);
    const data = result.map((row) => {
      const decrypted = decryptFields(
        {
          resident_first_name: row.resident_first_name,
          resident_last_name: row.resident_last_name,
        },
        ['resident_first_name', 'resident_last_name'],
        tenantKey
      );
      return { ...row, ...decrypted };
    });
    await audit.logSelect({
      tableName: 'care.daily_progress_notes',
      residentId: null,
      req: { user },
    });
    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

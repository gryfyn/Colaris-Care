import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

// Staff review lifecycle -> the badge vocabulary the Reports Hub renders.
const STATUS_MAP = { pending: 'pending_review', approved: 'approved', rejected: 'rejected' };

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ed.tenant_id = $1'];
      const params = [user.tenantId];

      if (startDate) {
        params.push(startDate);
        conditions.push(`ed.drill_date >= $${params.length}`);
      }

      if (endDate) {
        params.push(endDate);
        conditions.push(`ed.drill_date <= $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit);
      params.push(offset);

      const { rows } = await client.query(
        `SELECT
          ed.id,
          'evacuation_drills' AS form_type,
          NULL::UUID AS resident_id,
          ed.afh_licensee_name AS resident_name,
          ed.created_at AS date_created,
          CONCAT(s.first_name, ' ', s.last_name) AS author,
          COALESCE(ed.review_status, 'pending') AS db_status,
          COUNT(*) OVER() AS total_count
        FROM care.evacuation_drills ed
        LEFT JOIN ref.staff s ON ed.created_by = s.id
        WHERE ${where}
        ORDER BY ed.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return rows;
    });

    await audit.logSelect({
      tableName: 'care.evacuation_drills',
      residentId: null,
      req: { user },
      justification: 'Forms history report',
    });

    const total = result[0]?.total_count || 0;

    return Response.json({
      data: result.map(row => {
        const status = STATUS_MAP[row.db_status] || 'pending_review';
        return {
          id: row.id,
          formType: row.form_type,
          residentId: row.resident_id,
          residentName: row.resident_name || 'Facility-wide',
          dateCreated: row.date_created,
          author: (row.author || '').trim() || 'Unknown',
          status,
          progressPercent: status === 'approved' ? 100 : status === 'rejected' ? 50 : 75,
        };
      }),
      total,
      limit,
      offset,
    });
  } catch (err) {
    return handleError(err);
  }
}

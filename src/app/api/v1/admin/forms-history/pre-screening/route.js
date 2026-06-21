import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { decryptPHI } from '@/lib/encryption.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

function safeDecrypt(value, key) {
  if (!value) return '';
  try { return decryptPHI(value, key) || ''; } catch { return ''; }
}

function emptyResult(limit, offset) {
  return Response.json({ data: [], total: 0, limit, offset });
}

function isMissingReportSchema(err) {
  return err?.code === '42P01' || err?.code === '42703';
}

// Standalone-screening lifecycle -> the badge vocabulary the Reports Hub renders.
const STATUS_MAP = {
  draft: 'in_progress', deferred: 'in_progress',
  submitted: 'completed', approved: 'approved', admitted: 'approved',
  declined: 'draft',
};

export async function GET(request) {
  let limit = 20;
  let offset = 0;
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Pre-screening is now its own table (migration 0028): care.pre_admission_screenings.
    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ps.tenant_id = $1', 'ps.deleted_at IS NULL'];
      const params = [user.tenantId];

      if (residentId) {
        params.push(residentId);
        conditions.push(`ps.resident_id = $${params.length}`);
      }
      if (startDate) {
        params.push(startDate);
        conditions.push(`COALESCE(ps.submitted_at, ps.created_at)::date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`COALESCE(ps.submitted_at, ps.created_at)::date <= $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit);
      params.push(offset);

      const { rows } = await client.query(
        `SELECT
          ps.id,
          'pre_screening' AS form_type,
          ps.resident_id,
          ps.client_full_name AS encrypted_name,
          ps.form_data AS form_data,
          ps.completed_by_name AS author,
          COALESCE(ps.submitted_at, ps.created_at) AS date_created,
          ps.status AS db_status,
          COUNT(*) OVER() AS total_count
        FROM care.pre_admission_screenings ps
        WHERE ${where}
        ORDER BY COALESCE(ps.submitted_at, ps.created_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return rows;
    });

    await audit.logSelect({
      tableName: 'care.pre_admission_screenings',
      residentId: null,
      req: { user },
      justification: 'Forms history report',
    });

    const total = result[0]?.total_count || 0;
    const tenantKey = await getTenantKey(user.tenantId);

    return Response.json({
      data: result.map(row => {
        const fd = row.form_data || {};
        const residentName =
          safeDecrypt(row.encrypted_name, tenantKey) ||
          fd.clientFullName || fd.client_full_name || fd.fullName || fd.name || 'Unknown';
        const status = STATUS_MAP[row.db_status] || 'in_progress';
        return {
          id: row.id,
          formType: row.form_type,
          residentId: row.resident_id,
          residentName,
          dateCreated: row.date_created,
          author: row.author || 'Unknown',
          status,
          progressPercent: status === 'completed' || status === 'approved' ? 100 : 50,
        };
      }),
      total,
      limit,
      offset,
    });
  } catch (err) {
    if (isMissingReportSchema(err)) return emptyResult(limit, offset);
    return handleError(err);
  }
}

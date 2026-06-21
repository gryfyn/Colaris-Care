import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptPHI } from '@/lib/encryption.js';
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

    // Nursing Assessment is now its own table (migration 0029): care.nursing_admissions.
    // The applicant name lives in form_data; fall back to the linked pre-screening.
    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['na.tenant_id = $1', 'na.deleted_at IS NULL'];
      const params = [user.tenantId];

      if (residentId) {
        params.push(residentId);
        conditions.push(`na.resident_id = $${params.length}`);
      }
      if (startDate) {
        params.push(startDate);
        conditions.push(`COALESCE(na.submitted_at, na.created_at)::date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`COALESCE(na.submitted_at, na.created_at)::date <= $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit);
      params.push(offset);

      const { rows } = await client.query(
        `SELECT
          na.id,
          'nursing_assessment' AS form_type,
          na.resident_id,
          na.form_data AS form_data,
          ps.client_full_name AS ps_encrypted_name,
          CONCAT(s.first_name, ' ', s.last_name) AS author,
          COALESCE(na.submitted_at, na.created_at) AS date_created,
          na.status AS db_status,
          COUNT(*) OVER() AS total_count
        FROM care.nursing_admissions na
        LEFT JOIN care.pre_admission_screenings ps ON na.pre_screening_id = ps.id
        LEFT JOIN ref.staff s ON na.created_by = s.id
        WHERE ${where}
        ORDER BY COALESCE(na.submitted_at, na.created_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return rows;
    });

    await audit.logSelect({
      tableName: 'care.nursing_admissions',
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
          fd.name || fd.fullName || fd.full_name ||
          safeDecrypt(row.ps_encrypted_name, tenantKey) ||
          'Unknown';
        const status = STATUS_MAP[row.db_status] || 'in_progress';
        const author = (row.author || '').trim() || 'Unknown';
        return {
          id: row.id,
          formType: row.form_type,
          residentId: row.resident_id,
          residentName,
          dateCreated: row.date_created,
          author,
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

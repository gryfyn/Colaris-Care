import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { decryptPHI } from '@/lib/encryption.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

// Staff review lifecycle -> the badge vocabulary the Reports Hub renders.
const STATUS_MAP = { pending: 'pending_review', approved: 'approved', rejected: 'rejected' };

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

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ddr.tenant_id = $1'];
      const params = [user.tenantId];

      if (residentId) {
        params.push(residentId);
        conditions.push(`ddr.resident_id = $${params.length}`);
      }

      if (startDate) {
        params.push(startDate);
        conditions.push(`ddr.disposal_date >= $${params.length}`);
      }

      if (endDate) {
        params.push(endDate);
        conditions.push(`ddr.disposal_date <= $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit);
      params.push(offset);

      const { rows } = await client.query(
        `SELECT
          ddr.id,
          'drug_disposal' AS form_type,
          ddr.resident_id,
          r.first_name AS r_first_name,
          r.last_name  AS r_last_name,
          ddr.created_at AS date_created,
          COALESCE(NULLIF(CONCAT(s.first_name, ' ', s.last_name), ' '), ddr.counting_staff_name) AS author,
          ddr.review_status AS db_status,
          COUNT(*) OVER() AS total_count
        FROM care.drug_disposal_records ddr
        LEFT JOIN care.residents r ON ddr.resident_id = r.id
        LEFT JOIN ref.staff s ON ddr.counting_staff_id = s.id
        WHERE ${where}
        ORDER BY ddr.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return rows;
    });

    await audit.logSelect({
      tableName: 'care.drug_disposal_records',
      residentId: null,
      req: { user },
      justification: 'Forms history report',
    });

    const tenantKey = await getTenantKey(user.tenantId);
    for (const row of result) {
      const first = safeDecrypt(row.r_first_name, tenantKey);
      const last  = safeDecrypt(row.r_last_name,  tenantKey);
      row.resident_name = [first, last].filter(Boolean).join(' ') || 'Unknown';
    }
    const total = result[0]?.total_count || 0;

    return Response.json({
      data: result.map(row => {
        const status = STATUS_MAP[row.db_status] || 'pending_review';
        return {
          id: row.id,
          formType: row.form_type,
          residentId: row.resident_id,
          residentName: row.resident_name,
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
    if (isMissingReportSchema(err)) return emptyResult(limit, offset);
    return handleError(err);
  }
}

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
      const conditions = ['ma.tenant_id = $1'];
      const params = [user.tenantId];

      if (residentId) {
        params.push(residentId);
        conditions.push(`ma.resident_id = $${params.length}`);
      }
      if (startDate) {
        params.push(startDate);
        conditions.push(`COALESCE(ma.administered_at, ma.created_at)::date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`COALESCE(ma.administered_at, ma.created_at)::date <= $${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const { rows } = await client.query(
        `SELECT
          ma.id,
          'medication_administrations' AS form_type,
          ma.resident_id,
          r.first_name AS r_first_name,
          r.last_name AS r_last_name,
          COALESCE(ma.administered_at, ma.created_at) AS date_created,
          CONCAT(s.first_name, ' ', s.last_name) AS author,
          CASE WHEN ma.was_refused THEN 'refused' ELSE 'given' END AS db_status,
          COUNT(*) OVER() AS total_count
        FROM care.medication_administrations ma
        JOIN care.residents r ON r.id = ma.resident_id
        LEFT JOIN ref.staff s ON s.id = ma.administered_by
        WHERE ${conditions.join(' AND ')}
        ORDER BY COALESCE(ma.administered_at, ma.created_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    await audit.logSelect({
      tableName: 'care.medication_administrations',
      residentId: null,
      req: { user },
      justification: 'Forms history report',
    });

    const tenantKey = await getTenantKey(user.tenantId);
    const total = result[0]?.total_count || 0;

    return Response.json({
      data: result.map(row => {
        const residentName =
          [safeDecrypt(row.r_first_name, tenantKey), safeDecrypt(row.r_last_name, tenantKey)]
            .filter(Boolean).join(' ') || 'Unknown';
        const status = row.db_status === 'refused' ? 'rejected' : 'completed';
        return {
          id: row.id,
          formType: row.form_type,
          residentId: row.resident_id,
          residentName,
          dateCreated: row.date_created,
          author: (row.author || '').trim() || 'Unknown',
          status,
          progressPercent: status === 'completed' ? 100 : 50,
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

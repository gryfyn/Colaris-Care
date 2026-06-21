import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { decryptFields } from '@/lib/encryption.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

function safeDecrypt(value, key) {
  if (!value) return '';
  try { return decryptFields({ value }, ['value'], key).value || ''; } catch { return ''; }
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
      const conditions = ['fs.tenant_id = $1'];
      const params = [user.tenantId];

      if (residentId) {
        params.push(residentId);
        conditions.push(`fs.resident_id = $${params.length}`);
      }
      if (startDate) {
        params.push(startDate);
        conditions.push(`COALESCE(fs.updated_at, fs.created_at)::date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`COALESCE(fs.updated_at, fs.created_at)::date <= $${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const { rows } = await client.query(
        `SELECT
          fs.id,
          'face_sheets' AS form_type,
          fs.resident_id,
          r.first_name AS r_first_name,
          r.last_name AS r_last_name,
          COALESCE(fs.updated_at, fs.created_at) AS date_created,
          CONCAT(s.first_name, ' ', s.last_name) AS author,
          fs.updated_at AS db_status,
          COUNT(*) OVER() AS total_count
        FROM care.resident_face_sheets fs
        LEFT JOIN care.residents r ON fs.resident_id = r.id
        LEFT JOIN ref.staff s ON s.id = fs.last_updated_by
        WHERE ${conditions.join(' AND ')}
        ORDER BY COALESCE(fs.updated_at, fs.created_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    await audit.logSelect({
      tableName: 'care.resident_face_sheets',
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
        return {
          id: row.id,
          formType: row.form_type,
          residentId: row.resident_id,
          residentName,
          dateCreated: row.date_created,
          author: (row.author || '').trim() || 'Unknown',
          status: 'completed',
          progressPercent: 100,
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

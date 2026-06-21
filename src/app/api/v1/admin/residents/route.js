import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admin/residents
 * Search and filter residents with pagination.
 * Query params: search, status, limit, offset
 * Requires RESIDENTS_READ permission.
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
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    if (search && search.length < 2) {
      return Response.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const tenantKey = await getTenantKey(user.tenantId);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['r.tenant_id = $1', 'r.deleted_at IS NULL'];
      const params = [user.tenantId];

      if (status) {
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      if (!search) {
        params.push(limit, offset);
      }

      const { rows } = await client.query(
        `SELECT id, first_name, last_name, status, intake_date, discharge_date,
                primary_diagnosis, medicaid_id, created_at, updated_at,
                COUNT(*) OVER() AS total_count
         FROM care.residents r
         WHERE ${where}
         ORDER BY r.intake_date DESC
         ${search ? 'LIMIT 2000' : `LIMIT $${params.length - 1} OFFSET $${params.length}`}`,
        params
      );
      return rows;
    });

    await audit.logSelect({
      tableName: 'care.residents',
      residentId: null,
      req: { user },
      justification: searchParams.get('justification'),
    });
    let decryptedResult = result.map(row =>
      decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey)
    );
    if (search) {
      const needle = search.toLowerCase();
      decryptedResult = decryptedResult.filter((row) =>
        [row.id, row.first_name, row.last_name, row.preferred_name, row.medicaid_id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }
    const total = search ? decryptedResult.length : result[0]?.total_count || 0;
    decryptedResult = decryptedResult.slice(search ? offset : 0, search ? offset + limit : undefined);

    return Response.json({
      data: decryptedResult,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

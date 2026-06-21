import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { decryptFields } from '@/lib/encryption.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admin/incidents
 * Filter and search incident reports with pagination.
 * Query params: search, review_status, severity, resident_id, date_from, date_to, limit, offset
 * Requires INCIDENTS_READ permission.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.SAFETY_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const reviewStatus = searchParams.get('review_status');
    const severity = searchParams.get('severity');
    const residentId = searchParams.get('resident_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    if (search && search.length < 2) {
      return Response.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'reviewed', 'closed'];
    if (reviewStatus && !validStatuses.includes(reviewStatus)) {
      return Response.json(
        { error: `Invalid review_status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (severity && !validSeverities.includes(severity)) {
      return Response.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate date formats
    if (dateFrom) {
      try {
        new Date(dateFrom);
      } catch {
        return Response.json(
          { error: 'Invalid date_from format. Use ISO 8601 format' },
          { status: 400 }
        );
      }
    }

    if (dateTo) {
      try {
        new Date(dateTo);
      } catch {
        return Response.json(
          { error: 'Invalid date_to format. Use ISO 8601 format' },
          { status: 400 }
        );
      }
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['i.tenant_id = $1'];
      const params = [user.tenantId];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(i.incident_details ILIKE $${params.length} OR i.incident_location ILIKE $${params.length})`);
      }

      if (reviewStatus) {
        params.push(reviewStatus);
        conditions.push(`i.review_status = $${params.length}`);
      }

      if (residentId) {
        params.push(residentId);
        conditions.push(`i.resident_id = $${params.length}`);
      }

      if (dateFrom) {
        params.push(dateFrom);
        conditions.push(`i.incident_date >= $${params.length}`);
      }

      if (dateTo) {
        params.push(dateTo);
        conditions.push(`i.incident_date <= $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT i.id, i.resident_id, i.incident_date, i.incident_time, i.incident_type,
                i.incident_location, i.incident_details AS description, i.staff_actions_taken,
                i.review_status, i.completed_by_staff_id AS reported_by, i.reviewed_by,
                i.reviewed_at, i.created_at, i.updated_at,
                r.first_name, r.last_name,
                COUNT(*) OVER() AS total_count
         FROM care.incident_reports i
         LEFT JOIN care.residents r ON i.resident_id = r.id
         WHERE ${where} AND i.deleted_at IS NULL
         ORDER BY i.incident_date DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    await audit.logSelect({
      tableName: 'care.incident_reports',
      residentId: null,
      req: { user },
      justification: searchParams.get('justification'),
    });
    const total = result[0]?.total_count || 0;
    const tenantKey = await getTenantKey(user.tenantId);
    const data = result.map((row) => {
      const decrypted = decryptFields(
        { first_name: row.first_name, last_name: row.last_name },
        ['first_name', 'last_name'],
        tenantKey
      );
      return { ...row, ...decrypted };
    });
    return Response.json({
      data,
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

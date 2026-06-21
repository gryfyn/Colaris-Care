import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admin/staff
 * List and search staff members with pagination.
 * Query params: search, role, is_active, limit, offset
 * Requires STAFF_READ permission.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    if (search && search.length < 2) {
      return Response.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const validRoles = ['staff', 'manager', 'admin', 'superadmin'];
    if (role && !validRoles.includes(role)) {
      return Response.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['s.tenant_id = $1'];
      const params = [user.tenantId];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.email ILIKE $${params.length})`
        );
      }

      if (role) {
        params.push(role);
        conditions.push(`s.role = $${params.length}`);
      }

      if (isActive !== null && isActive !== undefined) {
        const activeVal = isActive === 'true' || isActive === '1';
        params.push(activeVal);
        conditions.push(`s.is_active = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT id, first_name, last_name, email, role, is_active,
                license_no AS license_number, phone, hire_date, created_at, updated_at,
                COUNT(*) OVER() AS total_count
         FROM ref.staff s
         WHERE ${where}
         ORDER BY s.first_name ASC, s.last_name ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    await audit.logSelect({
      tableName: 'ref.staff',
      residentId: null,
      req: { user },
    });
    const total = result[0]?.total_count || 0;
    return Response.json({
      data: result,
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

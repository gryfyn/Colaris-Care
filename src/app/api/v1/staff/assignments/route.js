import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/staff/assignments
 * List staff assignments (residents assigned to staff) with pagination.
 * Staff role automatically filters to their own assignments.
 *
 * Query params:
 *   staff_id (UUID, optional) - filter by specific staff member
 *   resident_id (UUID, optional) - filter by specific resident
 *   limit (integer, 1-200, default 50)
 *   offset (integer, default 0)
 *
 * Auth: STAFF_READ permission (staff, manager, admin, superadmin)
 * Staff role always sees only their own assignments for security.
 * Response: { data: [...], pagination: { limit, offset, total, pages } }
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
    // Staff users default to seeing only their own assignments unless overridden
    const staffId = searchParams.get('staff_id') || (user.role === 'staff' ? user.staffId : null);
    const residentId = searchParams.get('resident_id');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['sa.tenant_id = $1', 'sa.is_active = TRUE'];
      const params = [user.tenantId];

      if (staffId) {
        params.push(staffId);
        conditions.push(`sa.staff_id = $${params.length}`);
      }

      if (residentId) {
        params.push(residentId);
        conditions.push(`sa.resident_id = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT sa.id, sa.staff_id, sa.resident_id,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name, s.role,
                r.first_name, r.last_name, r.status, r.primary_diagnosis,
                sa.assignment_date, sa.end_date, sa.is_active, sa.created_at,
                COUNT(*) OVER() AS total_count
         FROM care.staff_assignments sa
         JOIN ref.staff s ON s.id = sa.staff_id
         JOIN care.residents r ON r.id = sa.resident_id
         WHERE ${where}
         ORDER BY sa.assignment_date DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = result[0]?.total_count || 0;

    // Decrypt resident names before returning (HIPAA § 164.312)
    const tenantKey = getTenantKey();
    const data = result.map(row => {
      const { total_count, ...rest } = row;
      return decryptFields(rest, ['first_name', 'last_name'], tenantKey);
    });

    await audit
      .logSelect({ tableName: 'care.staff_assignments', residentId: null, req: { user } })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/staff/assignments
 * Create a new staff assignment (assign resident to staff member).
 *
 * Body:
 *   staff_id (UUID, required)
 *   resident_id (UUID, required)
 *   assignment_date (date, optional) - YYYY-MM-DD format, defaults to today
 *   end_date (date, optional) - YYYY-MM-DD format, marks when assignment ends
 *
 * Auth: STAFF_WRITE permission (manager, admin, superadmin)
 * Validation:
 *   - Errors on duplicate active assignment
 *   - Returns 404 if staff or resident not found in tenant
 *   - Validates UUID format on both IDs
 *
 * Response: { data: { id, staff_id, resident_id, assignment_date, end_date, created_at } }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { staff_id, resident_id, assignment_date, end_date } = await request.json();

    // Validate required fields
    if (!staff_id || !resident_id) {
      return Response.json({ error: 'staff_id and resident_id are required' }, { status: 422 });
    }

    // Validate UUID format (basic check)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staff_id)) {
      return Response.json({ error: 'Invalid staff_id format' }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resident_id)) {
      return Response.json({ error: 'Invalid resident_id format' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify staff exists in tenant
      const { rows: staffRows } = await client.query(
        'SELECT id FROM ref.staff WHERE id = $1 AND tenant_id = $2',
        [staff_id, user.tenantId]
      );
      if (!staffRows.length) {
        throw { message: 'Staff member not found', status: 404 };
      }

      // Verify resident exists in tenant
      const { rows: residentRows } = await client.query(
        'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2',
        [resident_id, user.tenantId]
      );
      if (!residentRows.length) {
        throw { message: 'Resident not found', status: 404 };
      }

      // Check if assignment already exists
      const { rows: existingAssignment } = await client.query(
        'SELECT id FROM care.staff_assignments WHERE staff_id = $1 AND resident_id = $2 AND is_active = TRUE',
        [staff_id, resident_id]
      );
      if (existingAssignment.length) {
        throw { message: 'This staff member is already assigned to this resident', status: 409 };
      }

      // Create assignment
      const { rows: [assignment] } = await client.query(
        `INSERT INTO care.staff_assignments (tenant_id, staff_id, resident_id, assignment_date, end_date, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id, staff_id, resident_id, assignment_date, end_date, created_at`,
        [user.tenantId, staff_id, resident_id, assignment_date || new Date().toISOString().split('T')[0], end_date]
      );
      return assignment;
    });

    await audit.logInsert({
      tableName: 'care.staff_assignments',
      recordId: result.id,
      residentId: resident_id,
      req: { user },
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

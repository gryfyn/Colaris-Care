import bcrypt from 'bcryptjs';
import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient, query, pool } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/staff
 * List staff members with pagination and filtering.
 *
 * Query params:
 *   search (string, optional) - search by first/last name or email (min 2 chars)
 *   role (string, optional) - filter by role (staff, manager, admin, superadmin)
 *   is_active (string, optional) - 'true'/'1' for active only
 *   limit (integer, 1-200, default 50)
 *   offset (integer, default 0)
 *
 * Auth: STAFF_READ permission (manager, admin, superadmin)
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

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['s.tenant_id = $1', 's.is_active = TRUE'];
      const params = [user.tenantId];

      if (search) {
        params.push(`%${search}%`);
        const searchIdx = params.length;
        conditions.push(`(s.first_name ILIKE $${searchIdx} OR s.last_name ILIKE $${searchIdx} OR s.email ILIKE $${searchIdx})`);
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
        `SELECT s.id, s.first_name, s.last_name, s.role, s.email, s.phone,
                s.license_no, s.hire_date, s.is_active, s.created_at, s.updated_at,
                COUNT(*) OVER() AS total_count
         FROM ref.staff s
         WHERE ${where}
         ORDER BY s.last_name ASC, s.first_name ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const req = getRequestContext(request, user);

    const total = rows[0]?.total_count || 0;
    return Response.json({
      data: rows,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/staff
 * Create a new staff member and user account.
 * Requires STAFF_WRITE permission.
 *
 * Request body: {
 *   first_name: string,
 *   last_name: string,
 *   role: 'staff' | 'manager' | 'admin',
 *   email: string (unique per tenant),
 *   password: string (minimum 12 chars recommended),
 *   phone: string (optional),
 *   license_no: string (optional),
 *   hire_date: DATE (optional)
 * }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { first_name, last_name, role, license_no, email, phone, password, hire_date } = await request.json();

    // Validate required fields
    if (!first_name || !last_name || !role || !email || !password) {
      return Response.json(
        { error: 'first_name, last_name, role, email, and password are required' },
        { status: 422 }
      );
    }

    // Validate role
    const validRoles = ['staff', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return Response.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create staff record
      const { rows: staff } = await client.query(
        `INSERT INTO ref.staff (tenant_id, first_name, last_name, role, license_no, email, phone, hire_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING id, email, role`,
        [user.tenantId, first_name, last_name, role, license_no, email.toLowerCase(), phone, hire_date]
      );

      // Create user account
      await client.query(
        `INSERT INTO care.user_accounts (tenant_id, staff_id, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [user.tenantId, staff[0].id, email.toLowerCase(), passwordHash, role]
      );

      await client.query('COMMIT');

      const req = getRequestContext(request, user);
      await audit.logInsert({
        tableName: 'ref.staff',
        recordId: staff[0].id,
        residentId: null,
        req,
      });

      return Response.json({ data: { id: staff[0].id, email: staff[0].email, role: staff[0].role } }, { status: 201 });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') { // Unique violation
        return Response.json({ error: 'Email already exists for this tenant' }, { status: 409 });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/activities
 * List activities with optional filters.
 *
 * Query params:
 *   day_of_week  - filter by day (e.g., 'Monday', 'Tuesday', etc.)
 *   category     - filter by category
 *   active       - 'true'/'false' (default: true)
 *   page         - pagination page (default 1)
 *   limit        - items per page (default 50, max 200)
 *
 * Auth: Any authenticated user can read
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get('day_of_week');
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') !== 'false';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['a.tenant_id = $1'];
      const params = [user.tenantId];

      if (activeOnly) {
        conditions.push('a.active = TRUE');
      }

      if (dayOfWeek) {
        params.push(dayOfWeek);
        conditions.push(`a.day_of_week = $${params.length}`);
      }

      if (category) {
        params.push(category);
        conditions.push(`a.category = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT a.id, a.tenant_id, a.day_of_week, a.start_time, a.name,
                a.location, a.category, a.description, a.duration_minutes,
                a.active, a.created_by, a.created_at, a.updated_at,
                COUNT(*) OVER() AS total_count
           FROM care.activities a
          WHERE ${where}
          ORDER BY a.day_of_week, a.start_time, a.name
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(result[0]?.total_count || 0);

    const req = getRequestContext(request, user);
    await audit
      .logSelect({ tableName: 'care.activities', req })

    return Response.json({
      data: result.map(row => {
        const { total_count, ...rest } = row;
        return rest;
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/activities
 * Create a new activity.
 *
 * Body:
 *   day_of_week (string, required) - 'Monday' through 'Sunday'
 *   start_time (string, required) - HH:MM format
 *   name (string, required)
 *   location (string, required)
 *   category (string, required)
 *   description (string, optional)
 *   duration_minutes (integer, optional)
 *   active (boolean, optional, default: true)
 *
 * Auth: admin, manager only
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      day_of_week,
      start_time,
      name,
      location,
      category,
      description,
      duration_minutes,
      active,
    } = body;

    if (!day_of_week || !start_time || !name || !location || !category) {
      return Response.json(
        { error: 'day_of_week, start_time, name, location, and category are required' },
        { status: 422 }
      );
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day_of_week)) {
      return Response.json(
        { error: `Invalid day_of_week. Must be one of: ${validDays.join(', ')}` },
        { status: 400 }
      );
    }

    const validCategories = ['Therapy', 'Wellness', 'Creative', 'Life Skills', 'Community'];
    if (!validCategories.includes(category)) {
      return Response.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate start_time format HH:MM
    if (!/^\d{2}:\d{2}$/.test(start_time)) {
      return Response.json(
        { error: 'start_time must be in HH:MM format' },
        { status: 400 }
      );
    }

    const newActivity = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.activities (
           tenant_id, day_of_week, start_time, name, location, category,
           description, duration_minutes, active, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id, day_of_week, start_time, name, location, category,
                   description, duration_minutes, active, created_at, updated_at`,
        [
          user.tenantId,
          day_of_week,
          start_time,
          name,
          location,
          category,
          description || null,
          duration_minutes || null,
          active !== false,
          user.staffId || user.id,
        ]
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit
      .logInsert({
        tableName: 'care.activities',
        recordId: newActivity.id,
        req,
      })

    return Response.json({ data: newActivity }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

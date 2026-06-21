import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/announcements
 * List announcements filtered by audience and active status.
 * Only returns announcements where audience matches user role and published_at <= NOW and (expires_at IS NULL or expires_at > NOW).
 *
 * Query params:
 *   audience      - filter by audience (all, staff, admin, optional)
 *   limit         - items per page (1-200, default 50)
 *   offset        - pagination offset (default 0)
 *
 * Auth: Any authenticated user
 * Response: { data: [...], pagination: { limit, offset, total, pages } }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const audience = searchParams.get('audience');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = [
        'a.tenant_id = $1',
        'a.active = TRUE',
        'a.published_at IS NOT NULL AND a.published_at <= NOW()',
        '(a.expires_at IS NULL OR a.expires_at > NOW())',
      ];
      const params = [user.tenantId];

      if (audience) {
        params.push(audience);
        conditions.push(`(a.audience = $${params.length} OR a.audience = 'all')`);
      } else {
        conditions.push(`(a.audience = 'all' OR a.audience = $2)`);
        params.push(user.role);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT a.id, a.title, a.body, a.audience, a.priority, a.published_at,
                a.expires_at, a.active, a.created_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.announcements a
           LEFT JOIN ref.staff u ON u.id = a.created_by
          WHERE ${where}
          ORDER BY a.priority DESC, a.published_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(result[0]?.total_count || 0);
    const data = result.map(({ total_count, ...rest }) => rest);

    await audit.logSelect({
      tableName: 'care.announcements',
      residentId: null,
      req: getRequestContext(request, user),
    });
    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/announcements
 * Create a new announcement (admin only).
 *
 * Body:
 *   title (string, required)
 *   body (string, required)
 *   audience (string, required) - 'all', 'staff', 'admin', etc.
 *   priority (integer, optional, default: 0)
 *   published_at (datetime, optional, default: NOW())
 *   expires_at (datetime, optional)
 *
 * Auth: admin or superadmin only
 * Response: { data: { id, title, audience, published_at, created_at } }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Only admin can create announcements' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      body: announcementBody,
      audience,
      priority,
      published_at,
      expires_at,
    } = body;

    if (!title || !announcementBody || !audience) {
      return Response.json(
        { error: 'title, body, and audience are required' },
        { status: 422 }
      );
    }

    const validAudiences = ['all', 'staff', 'admin'];
    if (!validAudiences.includes(audience)) {
      return Response.json(
        { error: `Invalid audience. Must be one of: ${validAudiences.join(', ')}` },
        { status: 400 }
      );
    }

    const san = sanitizeFields(
      { title, body: announcementBody },
      ['title', 'body']
    );

    const announcement = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.announcements (
           tenant_id, title, body, audience, priority, published_at, expires_at, created_by, active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING id, title, audience, published_at, created_at`,
        [
          user.tenantId, san.title, san.body, audience, priority || 0,
          published_at || new Date().toISOString(),
          expires_at || null, user.staffId,
        ]
      );
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.announcements',
      recordId: announcement.id,
      residentId: null,
      req: getRequestContext(request, user),
    });
    return Response.json({ data: announcement }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/announcements/[id]
 * Retrieve a single announcement by ID (if published and not expired).
 *
 * Auth: Any authenticated user
 * Response: { data: { id, title, body, audience, priority, ... } }
 */
export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id } = await context.params;

    const row = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT a.* FROM care.announcements a
          WHERE a.id = $1 AND a.tenant_id = $2 AND a.active = TRUE
            AND a.published_at IS NOT NULL AND a.published_at <= NOW()
            AND (a.expires_at IS NULL OR a.expires_at > NOW())`,
        [id, user.tenantId]
      );
      return rows[0];
    });

    if (!row) return Response.json({ error: 'Announcement not found' }, { status: 404 });

    const req = getRequestContext(request, user);
    await audit.logSelect({
      tableName: 'care.announcements',
      recordId: id,
      residentId: null,
      req,
    });
    return Response.json({ data: row });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/announcements/[id]
 * Update an announcement (admin only).
 *
 * Body: Partial update of fields:
 *   title, body, audience, priority, published_at, expires_at, active
 *
 * Auth: admin or superadmin only
 * Response: { data: { id, ... } }
 */
export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const updates = await request.json();

    const allowedFields = ['title', 'body', 'audience', 'priority', 'published_at', 'expires_at', 'active'];

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: current } = await client.query(
        'SELECT * FROM care.announcements WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!current.length) throw { status: 404, message: 'Announcement not found' };

      const san = sanitizeFields(
        updates,
        allowedFields.filter(f => f in updates && !['audience'].includes(f))
      );

      if ('audience' in updates) {
        const validAudiences = ['all', 'staff', 'admin'];
        if (!validAudiences.includes(updates.audience)) {
          throw { status: 400, message: `Invalid audience. Must be one of: ${validAudiences.join(', ')}` };
        }
      }

      const setClauses = [];
      const params = [];

      for (const field of allowedFields) {
        if (field in updates) {
          const value = field === 'body' ? san.body : field === 'title' ? san.title : updates[field];
          params.push(value);
          setClauses.push(`${field} = $${params.length}`);
        }
      }

      if (!setClauses.length) return current[0];

      params.push(id, user.tenantId);

      const { rows } = await client.query(
        `UPDATE care.announcements SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
         RETURNING *`,
        params
      );

      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.announcements',
      recordId: id,
      residentId: null,
      diffKeys: Object.keys(updates).filter(k => allowedFields.includes(k)),
      req,
    });
    return Response.json({ data: updated });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * DELETE /api/v1/announcements/[id]
 * Delete an announcement (soft delete via active flag).
 *
 * Auth: admin or superadmin only
 * Response: { data: { id, active } }
 */
export async function DELETE(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const deleted = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: current } = await client.query(
        'SELECT * FROM care.announcements WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!current.length) throw { status: 404, message: 'Announcement not found' };

      const { rows } = await client.query(
        `UPDATE care.announcements SET active = FALSE, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, active`,
        [id, user.tenantId]
      );

      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logDelete({
      tableName: 'care.announcements',
      recordId: id,
      req,
    });
    return Response.json({ data: deleted });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

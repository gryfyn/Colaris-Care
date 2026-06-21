import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * PATCH /api/v1/notifications/[id]/read
 * Mark a notification as read for the authenticated user.
 *
 * Auth: any authenticated user (reads only their own notifications)
 * Response: { data: { id, is_read, read_at } }
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id } = await params;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `UPDATE care.notifications
            SET is_read = TRUE, read_at = NOW()
          WHERE id = $1 AND user_id = $2 AND tenant_id = $3
          RETURNING id, is_read, read_at`,
        [id, user.id, user.tenantId]
      );
      return rows[0] || null;
    });

    if (!result) {
      return Response.json({ error: 'Notification not found' }, { status: 404 });
    }

    await audit.logUpdate({
      tableName: 'care.notifications',
      recordId: id,
      req: getRequestContext(request, user),
    });
    return Response.json({ data: result });
  } catch (err) {
    return handleError(err);
  }
}

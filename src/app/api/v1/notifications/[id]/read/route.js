import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * PATCH /api/v1/notifications/[id]/read
 * Mark a notification as read by the authenticated user.
 *
 * Auth: Any authenticated user (only their own notifications)
 * Response: { data: { id, is_read, read_at } }
 */
export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id } = await context.params;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: notifRows } = await client.query(
        `SELECT * FROM care.notifications WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
        [id, user.id, user.tenantId]
      );

      if (!notifRows.length) {
        return { error: 'Notification not found or access denied', status: 404 };
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE care.notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE id = $1
         RETURNING id, is_read, read_at`,
        [id]
      );

      return updatedRows[0];
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.notifications',
      recordId: id,
      oldValues: { is_read: false },
      newValues: { is_read: true, read_at: result.read_at },
      diffKeys: ['is_read', 'read_at'],
      req,
    });
    return Response.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getNotificationAttachments } from '@/lib/notification-helper.js';

const audit = new AuditLogger();

function parseCredentialBody(row, role) {
  if (row.category !== 'account' && row.type !== 'credentials' && row.notification_type !== 'new_credentials') {
    return null;
  }

  let payload = null;
  if (typeof row.body === 'string') {
    try {
      payload = JSON.parse(row.body);
    } catch {
      payload = null;
    }
  } else if (row.body && typeof row.body === 'object') {
    payload = row.body;
  }

  if (!payload) return null;

  const canSeePassword = ['admin', 'superadmin'].includes(role) && payload.password;
  return {
    payload,
    message: canSeePassword
      ? `Email: ${payload.email || payload.username || 'account'} | Temporary password: ${payload.password} | Must change on login`
      : 'Temporary account issued. Please change your password on first login.',
    credentials: {
      email: payload.email || null,
      username: payload.username || payload.email || null,
      ...(canSeePassword ? { password: payload.password } : {}),
      mustChangeOnLogin: payload.mustChangeOnLogin === true,
    },
  };
}

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '25'));
    const offset = (page - 1) * pageSize;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      try {
        const { rows } = await client.query(
          `SELECT n.*, COUNT(*) OVER() AS total_count
           FROM care.notifications n
           WHERE n.tenant_id = $4
             AND n.dismissed_at IS NULL
             AND (
               n.user_id = $1
               OR (n.user_id IS NULL AND n.role_filter IS NOT NULL AND POSITION($5 IN n.role_filter) > 0)
             )
           ORDER BY n.created_at DESC
           LIMIT $2 OFFSET $3`,
          [user.id, pageSize, offset, user.tenantId, user.role]
        );
        return rows;
      } catch (err) {
        if (err.code === '42P01') {
          return [];
        }
        throw err;
      }
    });

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.notifications', req });

    // Enrich notifications with attachments for those with related_admission_id
    const enrichedNotifications = await Promise.all(
      result.map(async (row) => {
        const credentialBody = parseCredentialBody(row, user.role);
        const notification = {
          id: row.id,
          type: row.type,
          notification_type: row.notification_type,
          category: row.category,
          title: row.title,
          message: credentialBody?.message || row.body || row.message,
          subject: row.title || row.subject,
          is_read: row.is_read,
          read_at: row.read_at,
          created_at: row.created_at,
          body: credentialBody?.message || row.body || row.message,
          action_url: row.action_url,
          relatedResidentId: row.resident_id,
          relatedAdmissionId: row.related_admission_id,
        };
        if (credentialBody?.credentials) {
          notification.credentials = credentialBody.credentials;
        }

        // If notification is linked to admission documents, fetch attachments
        if (row.related_admission_id) {
          try {
            const attachments = await getNotificationAttachments(
              user.tenantId,
              row.related_admission_id,
              user.staffId
            );
            notification.attachments = attachments;
          } catch (err) {
            // Log error but don't fail the request
            notification.attachments = [];
          }
        } else {
          notification.attachments = [];
        }

        return notification;
      })
    );

    return Response.json({
      notifications: enrichedNotifications,
      data: enrichedNotifications,
      pagination: { page, pageSize, total: +(result[0]?.total_count || 0), pages: Math.ceil((result[0]?.total_count || 0) / pageSize) },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { notificationId, action } = data;

    if (!notificationId) {
      return Response.json({ error: 'Missing notificationId' }, { status: 400 });
    }

    if (!['read', 'dismiss'].includes(action)) {
      return Response.json({ error: 'Invalid action. Must be read or dismiss' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: notifRows } = await client.query(
        `SELECT * FROM care.notifications
          WHERE id = $1
            AND tenant_id = $3
            AND (
              user_id = $2
              OR (user_id IS NULL AND role_filter IS NOT NULL AND POSITION($4 IN role_filter) > 0)
            )`,
        [notificationId, user.id, user.tenantId, user.role]
      );

      if (!notifRows.length) {
        return { error: 'Notification not found or access denied', status: 404 };
      }

      const updateQuery = action === 'read'
        ? `UPDATE care.notifications
           SET is_read = TRUE, read_at = NOW()
           WHERE id = $1
           RETURNING *`
        : `UPDATE care.notifications
           SET dismissed_at = NOW()
           WHERE id = $1
           RETURNING *`;

      const { rows: updatedRows } = await client.query(updateQuery, [notificationId]);

      return updatedRows[0];
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.notifications',
      recordId: notificationId,
      oldValues: { [action === 'read' ? 'is_read' : 'dismissed_at']: null },
      newValues: { [action === 'read' ? 'is_read' : 'dismissed_at']: action === 'read' ? true : new Date().toISOString() },
      diffKeys: [action === 'read' ? 'is_read' : 'dismissed_at'],
      req,
    });

    return Response.json({
      data: {
        id: result.id,
        type: result.type,
        title: result.title,
        is_read: result.is_read,
        read_at: result.read_at,
        dismissed_at: result.dismissed_at,
      },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/notifications
 * Create a new notification
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { type, resident_id, title, body: notificationBody, action_url } = body;

    if (!type || !title) {
      return Response.json({ error: 'type and title are required' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.notifications (
          tenant_id, resident_id, type, title, body, action_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, type, title, created_at`,
        [user.tenantId, resident_id || null, type, title, notificationBody || null, action_url || null, new Date().toISOString()]
      );

      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logInsert({
      tableName: 'care.notifications',
      recordId: result.id,
      residentId: resident_id,
      newValues: { type, title },
      req,
    });
    return Response.json({
      id: result.id,
      success: true,
      message: 'Notification created'
    }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';

/**
 * GET /api/v1/admin/audit-log
 * List and filter audit log entries with pagination.
 * Query params: resident_id, actor_id, event_type, date_from, date_to, limit, offset
 * Requires ADMIN_AUDIT_READ permission.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_AUDIT_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('resident_id');
    const actorId = searchParams.get('actor_id');
    const eventType = searchParams.get('event_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const validEventTypes = [
      'select',
      'insert',
      'update',
      'delete',
      'sign',
      'approve',
      'reject',
      'login',
      'logout',
      'change_password',
    ];

    if (eventType && !validEventTypes.includes(eventType)) {
      return Response.json(
        { error: `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

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

    const conditions = ['tenant_id = $1'];
    const params = [user.tenantId];

    if (residentId) {
      params.push(residentId);
      conditions.push(`resident_id = $${params.length}`);
    }

    if (actorId) {
      params.push(actorId);
      conditions.push(`actor_id = $${params.length}`);
    }

    if (eventType) {
      params.push(eventType);
      conditions.push(`event_type = $${params.length}`);
    }

    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`event_time >= $${params.length}`);
    }

    if (dateTo) {
      params.push(dateTo);
      conditions.push(`event_time <= $${params.length}`);
    }

    params.push(limit, offset);

    const { rows } = await query(
      `SELECT id, event_time, actor_id, actor_ip, actor_role, event_type,
              table_name, record_id, resident_id, diff_keys, phi_accessed, justification,
              COUNT(*) OVER() AS total_count
       FROM audit_log.event_log
       WHERE ${conditions.join(' AND ')}
       ORDER BY event_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = rows[0]?.total_count || 0;
    return Response.json({
      data: rows,
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

import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

function mapAudit(row) {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorUserId: row.actor_user_id,
    actorStaffId: row.actor_staff_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    reason: row.reason,
    metadata: row.metadata,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.ADMIN_AUDIT_READ, 'admin:audit_read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select id, occurred_at, actor_user_id, actor_staff_id, action,
               target_type, target_id, outcome, reason, metadata
          from audit_log.audit_events
         order by occurred_at desc
         limit 200
      `
    );
    return rows.map(mapAudit);
  });
}

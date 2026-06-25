import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapDrill(row) {
  return {
    id: row.id,
    drillType: row.drill_type,
    status: row.status,
    occurredAt: row.occurred_at,
    durationMinutes: row.duration_minutes,
    summary: row.summary,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_READ, 'safety:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select id, drill_type, status, occurred_at, duration_minutes, summary
          from care.evacuation_drills
         order by occurred_at desc
         limit 100
      `
    );
    return rows.map(mapDrill);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_WRITE, 'safety:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.evacuation_drills(
          organization_id, facility_id, drill_type, status, occurred_at,
          duration_minutes, summary, created_by
        )
        values ($1, $2, $3, coalesce($4, 'completed'), coalesce($5, now()), $6, $7, $8)
        returning id, drill_type, status, occurred_at, duration_minutes, summary
      `,
      [
        user.organizationId,
        user.facilityId,
        body.drillType,
        body.status || 'completed',
        body.occurredAt || null,
        body.durationMinutes || null,
        body.summary || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'evacuation_drill.create', { type: 'evacuation_drill', id: rows[0].id });
    return mapDrill(rows[0]);
  });
}

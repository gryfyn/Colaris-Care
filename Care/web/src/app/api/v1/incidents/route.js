import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapIncident(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    incidentType: row.incident_type,
    severity: row.severity,
    status: row.status,
    occurredAt: row.occurred_at,
    summary: row.summary,
    followUpDueAt: row.follow_up_due_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_READ, 'safety:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select i.id, i.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               i.incident_type, i.severity, i.status, i.occurred_at, i.summary, i.follow_up_due_at
          from care.incident_reports i
          left join care.residents r
            on r.organization_id = i.organization_id
           and r.facility_id = i.facility_id
           and r.id = i.resident_id
         order by i.occurred_at desc
         limit 200
      `
    );
    return rows.map(mapIncident);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_WRITE, 'safety:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.incident_reports(
          organization_id, facility_id, resident_id, incident_type, severity,
          status, occurred_at, summary, follow_up_due_at, created_by, updated_by
        )
        values ($1, $2, $3, $4, coalesce($5, 'low'), coalesce($6, 'open'), coalesce($7, now()), $8, $9, $10, $10)
        returning id, resident_id, incident_type, severity, status, occurred_at, summary, follow_up_due_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId || null,
        body.incidentType,
        body.severity || 'low',
        body.status || 'open',
        body.occurredAt || null,
        body.summary,
        body.followUpDueAt || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'incident.create', { type: 'incident_report', id: rows[0].id });
    return { ...mapIncident(rows[0]), residentName: null };
  });
}

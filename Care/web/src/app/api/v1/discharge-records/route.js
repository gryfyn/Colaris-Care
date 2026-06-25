import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapDischarge(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    status: row.status,
    dischargeDate: row.discharge_date,
    destination: row.destination,
    summary: row.summary,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.DISCHARGE_READ, 'discharge:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select d.id, d.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               d.status, d.discharge_date, d.destination, d.summary
          from care.discharge_records d
          join care.residents r
            on r.organization_id = d.organization_id
           and r.facility_id = d.facility_id
           and r.id = d.resident_id
         order by d.updated_at desc
         limit 200
      `
    );
    return rows.map(mapDischarge);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.DISCHARGE_WRITE, 'discharge:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.discharge_records(
          organization_id, facility_id, resident_id, status,
          discharge_date, destination, summary, created_by, updated_by
        )
        values ($1, $2, $3, coalesce($4, 'draft'), $5, $6, $7, $8, $8)
        returning id, resident_id, status, discharge_date, destination, summary
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId,
        body.status || 'draft',
        body.dischargeDate || null,
        body.destination || null,
        body.summary || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'discharge_record.create', { type: 'discharge_record', id: rows[0].id });
    return { ...mapDischarge(rows[0]), residentName: null };
  });
}

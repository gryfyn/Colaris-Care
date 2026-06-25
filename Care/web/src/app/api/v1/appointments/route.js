import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapAppointment(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    status: row.status,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_READ, 'appointments:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select a.id, a.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               a.title, a.starts_at, a.ends_at, a.location, a.status
          from care.appointments a
          left join care.residents r
            on r.organization_id = a.organization_id
           and r.facility_id = a.facility_id
           and r.id = a.resident_id
         order by a.starts_at asc
         limit 200
      `
    );
    return rows.map(mapAppointment);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_WRITE, 'appointments:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.appointments(
          organization_id, facility_id, resident_id, title,
          starts_at, ends_at, location, status, created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'scheduled'), $9)
        returning id, resident_id, title, starts_at, ends_at, location, status
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId || null,
        body.title,
        body.startsAt,
        body.endsAt || null,
        body.location || null,
        body.status || 'scheduled',
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'appointment.create', { type: 'appointment', id: rows[0].id });
    return { ...mapAppointment(rows[0]), residentName: null };
  });
}

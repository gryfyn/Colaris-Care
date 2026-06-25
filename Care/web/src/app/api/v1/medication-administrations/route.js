import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';

function mapAdministration(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    medicationId: row.medication_id,
    residentName: row.resident_name,
    medicationName: row.medication_name,
    scheduledFor: row.scheduled_for,
    outcome: row.outcome,
    administeredAt: row.administered_at,
    administeredBy: row.administered_by,
    note: row.note,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_READ, 'medication_administrations:read', async ({ client }) => {
    const { searchParams } = new URL(request.url);
    const outcome = searchParams.get('outcome') || 'due';
    const { rows } = await client.query(
      `
        select ma.id, ma.resident_id, ma.medication_id,
               r.first_name || ' ' || r.last_name as resident_name,
               m.name as medication_name, ma.scheduled_for, ma.outcome,
               ma.administered_at, ma.administered_by, ma.note
          from care.medication_administrations ma
          join care.residents r
            on r.organization_id = ma.organization_id
           and r.facility_id = ma.facility_id
           and r.id = ma.resident_id
          join care.medications m
            on m.organization_id = ma.organization_id
           and m.facility_id = ma.facility_id
           and m.id = ma.medication_id
         where ma.outcome = $1
         order by ma.scheduled_for asc
         limit 300
      `,
      [outcome]
    );
    return rows.map(mapAdministration);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_WRITE, 'medication_administrations:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.medication_administrations(
          organization_id, facility_id, resident_id, medication_id,
          scheduled_for, outcome, administered_at, administered_by, note
        )
        values ($1, $2, $3, $4, $5, coalesce($6, 'administered'), coalesce($7, now()), $8, $9)
        returning id, resident_id, medication_id, scheduled_for, outcome, administered_at, administered_by, note
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId,
        body.medicationId,
        body.scheduledFor || new Date().toISOString(),
        body.outcome || 'administered',
        body.administeredAt || null,
        user.staffId || user.id,
        body.note || null,
      ]
    );
    return { ...mapAdministration(rows[0]), residentName: null, medicationName: null };
  });
}

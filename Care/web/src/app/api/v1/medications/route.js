import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';

function mapMedication(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    name: row.name,
    dosage: row.dosage,
    route: row.route,
    frequency: row.frequency,
    status: row.status,
    startDate: row.start_date,
    stopDate: row.stop_date,
    prescriber: row.prescriber,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_READ, 'medications:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select m.id, m.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               m.name, m.dosage, m.route, m.frequency, m.status, m.start_date, m.stop_date, m.prescriber
          from care.medications m
          join care.residents r
            on r.organization_id = m.organization_id
           and r.facility_id = m.facility_id
           and r.id = m.resident_id
         order by r.last_name, r.first_name, m.name
         limit 300
      `
    );
    return rows.map(mapMedication);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_WRITE, 'medications:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.medications(
          organization_id, facility_id, resident_id, name, dosage,
          route, frequency, status, start_date, stop_date, prescriber, created_by, updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'active'), $9, $10, $11, $12, $12)
        returning id, resident_id, name, dosage, route, frequency, status, start_date, stop_date, prescriber
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId,
        body.name,
        body.dosage || null,
        body.route || null,
        body.frequency || null,
        body.status || 'active',
        body.startDate || null,
        body.stopDate || null,
        body.prescriber || null,
        user.id,
      ]
    );
    return { ...mapMedication(rows[0]), residentName: null };
  });
}

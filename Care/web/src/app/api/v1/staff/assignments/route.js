import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapAssignment(row) {
  return {
    id: row.id,
    staffProfileId: row.staff_profile_id,
    staffName: row.staff_name,
    residentId: row.resident_id,
    residentName: row.resident_name,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'staff:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select sa.id, sa.staff_profile_id, sp.first_name || ' ' || sp.last_name as staff_name,
               sa.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               sa.status, sa.starts_at, sa.ends_at
          from care.staff_assignments sa
          join care.staff_profiles sp
            on sp.organization_id = sa.organization_id
           and sp.facility_id = sa.facility_id
           and sp.id = sa.staff_profile_id
          join care.residents r
            on r.organization_id = sa.organization_id
           and r.facility_id = sa.facility_id
           and r.id = sa.resident_id
         order by sp.last_name, sp.first_name, r.last_name, r.first_name
         limit 300
      `
    );
    return rows.map(mapAssignment);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.STAFF_WRITE, 'staff:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.staff_assignments(
          organization_id, facility_id, staff_profile_id, resident_id,
          status, starts_at, ends_at
        )
        values ($1, $2, $3, $4, coalesce($5, 'active'), coalesce($6, now()), $7)
        on conflict (organization_id, facility_id, staff_profile_id, resident_id)
        do update set status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at
        returning id, staff_profile_id, resident_id, status, starts_at, ends_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.staffProfileId,
        body.residentId,
        body.status || 'active',
        body.startsAt || null,
        body.endsAt || null,
      ]
    );
    await recordAuditEvent(client, user, 'staff_assignment.upsert', { type: 'staff_assignment', id: rows[0].id });
    return { ...mapAssignment(rows[0]), staffName: null, residentName: null };
  });
}

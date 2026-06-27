import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';

function mapStaff(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    firstName: row.first_name,
    lastName: row.last_name,
    roleTitle: row.role_title,
    employeeNumber: row.employee_number,
    email: row.email,
    phone: row.phone,
    status: row.status,
    photoUrl: row.photo_url,
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
    createdAt: row.created_at,
  };
}

function mapAssignment(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    room: row.room,
    status: row.status,
    startsAt: row.starts_at,
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'staff:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select id, user_id, first_name, last_name, role_title, employee_number,
               email, phone, status, photo_url, certifications, created_at
          from care.staff_profiles
         where id = $1
         limit 1
      `,
      [id]
    );
    if (!rows.length) {
      const err = new Error('Staff member not found');
      err.status = 404;
      throw err;
    }

    const { rows: assignments } = await client.query(
      `
        select sa.id, sa.resident_id, sa.status, sa.starts_at,
               r.first_name || ' ' || r.last_name as resident_name, r.room
          from care.staff_assignments sa
          join care.residents r
            on r.organization_id = sa.organization_id
           and r.facility_id = sa.facility_id
           and r.id = sa.resident_id
         where sa.staff_profile_id = $1
           and sa.status = 'active'
         order by r.last_name, r.first_name
         limit 100
      `,
      [id]
    );

    return { ...mapStaff(rows[0]), assignments: assignments.map(mapAssignment) };
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.STAFF_WRITE, 'staff:write', async ({ client }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        update care.staff_profiles
           set photo_url = coalesce($2, photo_url),
               role_title = coalesce($3, role_title),
               phone = coalesce($4, phone),
               updated_at = now()
         where id = $1
        returning id, user_id, first_name, last_name, role_title, employee_number,
                  email, phone, status, photo_url, certifications, created_at
      `,
      [id, body.photoUrl || null, body.roleTitle || null, body.phone || null]
    );
    if (!rows.length) {
      const err = new Error('Staff member not found');
      err.status = 404;
      throw err;
    }
    return mapStaff(rows[0]);
  });
}

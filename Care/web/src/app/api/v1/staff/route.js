import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { hashPassword } from '@/lib/passwords.js';
import { buildStaffLoginNotice, generatePortalPassword, normalizePortalEmail } from '@/lib/portal-credentials.js';

function mapStaff(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: `${row.first_name} ${row.last_name}`,
    firstName: row.first_name,
    lastName: row.last_name,
    roleTitle: row.role_title,
    email: row.email,
    phone: row.phone,
    status: row.status,
    photoUrl: row.photo_url,
    certifications: row.certifications,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'staff:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select id, user_id, first_name, last_name, role_title, email, phone, status, photo_url, certifications
          from care.staff_profiles
         order by last_name, first_name
         limit 200
      `
    );
    return rows.map(mapStaff);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.STAFF_WRITE, 'staff:write', async ({ client, user }) => {
    const body = await readJson(request);
    const fullName = `${body.firstName || ''} ${body.lastName || ''}`.trim();
    const loginEmail = normalizePortalEmail(body.email);

    // Provision a real, working staff login when an email is given. The login is
    // scoped to the admin's own org/facility (taken from their token), so the
    // new staff can only ever see this facility's data.
    let userId = body.userId || null;
    let adminNotification = null;
    if (loginEmail && body.createLogin !== false) {
      const password = generatePortalPassword(loginEmail);
      const passwordHash = hashPassword(password);
      const { rows: prov } = await client.query(
        'select * from app.provision_staff_login($1, $2, $3, $4, $5)',
        [user.organizationId, user.facilityId, loginEmail, fullName, passwordHash]
      );
      userId = prov[0].out_user_id;
      adminNotification = buildStaffLoginNotice({ loginEmail, name: fullName, password, created: prov[0].out_created });
    }

    const { rows } = await client.query(
      `
        insert into care.staff_profiles(
          organization_id, facility_id, user_id, employee_number,
          first_name, last_name, role_title, email, phone, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, 'active'))
        returning id, user_id, first_name, last_name, role_title, email, phone, status, photo_url, certifications
      `,
      [
        user.organizationId,
        user.facilityId,
        userId,
        body.employeeNumber,
        body.firstName,
        body.lastName,
        body.roleTitle || null,
        body.email || null,
        body.phone || null,
        body.status || 'active',
      ]
    );
    const staff = mapStaff(rows[0]);
    return adminNotification ? { ...staff, adminNotification } : staff;
  });
}

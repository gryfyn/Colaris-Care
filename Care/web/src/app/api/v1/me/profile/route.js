import { requireUser, authErrorResponse } from '@/lib/auth-guard.js';
import { withRequestContext } from '@/lib/db.js';

export async function GET(request) {
  try {
    const user = await requireUser(request);
    return await withRequestContext(user, 'me:profile', async (client) => {
      const { rows } = await client.query(
        `
          select sp.id, sp.first_name, sp.last_name, sp.role_title,
                 sp.email, sp.phone, sp.employee_number, sp.status,
                 sp.certifications, f.name as facility_name, o.name as organization_name
            from care.staff_profiles sp
            left join care.facilities f on f.id = sp.facility_id
            left join care.organizations o on o.id = sp.organization_id
           where sp.user_id = $1
           limit 1
        `,
        [user.id]
      );
      const profile = rows[0] || null;
      return Response.json({
        data: {
          user,
          profile: profile ? {
            id: profile.id,
            name: `${profile.first_name} ${profile.last_name}`,
            firstName: profile.first_name,
            lastName: profile.last_name,
            roleTitle: profile.role_title,
            email: profile.email,
            phone: profile.phone,
            employeeNumber: profile.employee_number,
            status: profile.status,
            certifications: profile.certifications || [],
            facilityName: profile.facility_name,
            organizationName: profile.organization_name,
          } : null,
        },
      });
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}

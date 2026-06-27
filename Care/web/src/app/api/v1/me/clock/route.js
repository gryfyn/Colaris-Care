import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

// Returns the current user's open time entry (clocked-in state), if any.
async function openEntry(client, user) {
  const { rows } = await client.query(
    `
      select id, clock_in_at
        from care.staff_time_entries
       where organization_id = $1 and facility_id = $2 and user_id = $3
         and clock_out_at is null
       order by clock_in_at desc
       limit 1
    `,
    [user.organizationId, user.facilityId, user.id]
  );
  return rows[0] || null;
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'me:clock', async ({ client, user }) => {
    const open = await openEntry(client, user);
    return { clockedIn: Boolean(open), since: open?.clock_in_at || null };
  });
}

// Toggle: clock out if an open entry exists, otherwise clock in.
export async function POST(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'me:clock', async ({ client, user }) => {
    const open = await openEntry(client, user);
    if (open) {
      const { rows } = await client.query(
        `update care.staff_time_entries set clock_out_at = now() where id = $1 returning clock_out_at`,
        [open.id]
      );
      return { clockedIn: false, since: null, clockedOutAt: rows[0].clock_out_at };
    }
    const { rows } = await client.query(
      `
        insert into care.staff_time_entries(organization_id, facility_id, user_id)
        values ($1, $2, $3)
        returning clock_in_at
      `,
      [user.organizationId, user.facilityId, user.id]
    );
    return { clockedIn: true, since: rows[0].clock_in_at };
  });
}

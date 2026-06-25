import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

export async function POST(request, { params }) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'notifications:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        update care.notifications
           set status = 'read',
               read_at = coalesce(read_at, now())
         where id = $1
           and (user_id is null or user_id = $2)
        returning id, status, read_at
      `,
      [params.id, user.id]
    );
    if (!rows.length) {
      const err = new Error('Notification not found');
      err.status = 404;
      throw err;
    }
    return rows[0];
  });
}

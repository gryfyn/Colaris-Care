import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';

function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'notifications:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        select id, user_id, title, body, status, created_at, read_at
          from care.notifications
         where (user_id is null or user_id = $1)
           and status <> 'archived'
         order by created_at desc
         limit 100
      `,
      [user.id]
    );
    return rows.map(mapNotification);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.ADMIN_TENANT_SETTINGS, 'notifications:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.notifications(organization_id, facility_id, user_id, title, body, status)
        values ($1, $2, $3, $4, $5, coalesce($6, 'unread'))
        returning id, user_id, title, body, status, created_at, read_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.userId || null,
        body.title,
        body.body,
        body.status || 'unread',
      ]
    );
    return mapNotification(rows[0]);
  });
}

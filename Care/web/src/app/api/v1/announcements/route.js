import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'announcements:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select id, title, body, audience, status, starts_at, ends_at
          from care.announcements
         where status = 'published'
         order by starts_at desc
         limit 100
      `
    );
    return rows.map(mapAnnouncement);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.ADMIN_TENANT_SETTINGS, 'announcements:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.announcements(
          organization_id, facility_id, title, body, audience,
          status, starts_at, ends_at, created_by
        )
        values ($1, $2, $3, $4, coalesce($5, 'all'), coalesce($6, 'published'), coalesce($7, now()), $8, $9)
        returning id, title, body, audience, status, starts_at, ends_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.title,
        body.body,
        body.audience || 'all',
        body.status || 'published',
        body.startsAt || null,
        body.endsAt || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'announcement.create', { type: 'announcement', id: rows[0].id });
    return mapAnnouncement(rows[0]);
  });
}

import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

export async function POST(request, { params }) {
  return withApiContext(request, PERMISSIONS.CARE_PLANS_APPROVE, 'care_plans:approve', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        update care.care_plans
           set status = 'active',
               approved_at = coalesce(approved_at, now()),
               updated_at = now(),
               updated_by = $2
         where id = $1
        returning id, status, approved_at
      `,
      [params.id, user.id]
    );
    if (!rows.length) {
      const err = new Error('Care plan not found');
      err.status = 404;
      throw err;
    }
    await recordAuditEvent(client, user, 'care_plans:approve', { type: 'care_plan', id: params.id });
    return rows[0];
  });
}

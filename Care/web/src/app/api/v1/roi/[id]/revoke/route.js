import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

export async function POST(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.ROI_REVOKE, 'roi:revoke', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        update care.roi_records
           set status = 'revoked',
               revoked_at = coalesce(revoked_at, now())
         where id = $1
        returning id, status, revoked_at
      `,
      [id]
    );
    if (!rows.length) {
      const err = new Error('ROI record not found');
      err.status = 404;
      throw err;
    }
    await recordAuditEvent(client, user, 'roi:revoke', { type: 'roi_record', id: id }, { reason: body.reason || null });
    return rows[0];
  });
}

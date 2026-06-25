import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

export async function POST(request, { params }) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_SIGN, 'progress_notes:sign', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        update care.progress_notes
           set status = 'signed',
               signed_at = coalesce(signed_at, now()),
               signed_by = $2,
               updated_at = now(),
               updated_by = $2
         where id = $1
           and status <> 'voided'
        returning id, status, signed_at, signed_by
      `,
      [params.id, user.id]
    );
    if (!rows.length) {
      const err = new Error('Progress note not found or cannot be signed');
      err.status = 404;
      throw err;
    }
    await recordAuditEvent(client, user, 'progress_notes:sign', { type: 'progress_note', id: params.id });
    return rows[0];
  });
}

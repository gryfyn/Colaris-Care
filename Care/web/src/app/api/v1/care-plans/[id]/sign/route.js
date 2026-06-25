import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';
import { staffAssignmentPredicate } from '@/lib/staff-access.js';

export async function POST(request, { params }) {
  return withApiContext(request, PERMISSIONS.CARE_PLANS_SIGN, 'care_plans:sign', async ({ client, user }) => {
    const existing = await client.query(
      `
        select resident_id
          from care.care_plans
         where id = $1
      `,
      [params.id]
    );
    if (!existing.rows.length) {
      const err = new Error('Care plan not found');
      err.status = 404;
      throw err;
    }

    const assignmentPredicate = staffAssignmentPredicate(user, '$1::uuid');
    if (assignmentPredicate) {
      const assignment = await client.query(
        `
          select 1
           where true
          ${assignmentPredicate}
        `,
        [existing.rows[0].resident_id]
      );
      if (!assignment.rows.length) {
        const err = new Error('Staff user is not assigned to this resident');
        err.status = 403;
        err.code = 'STAFF_ASSIGNMENT_REQUIRED';
        throw err;
      }
    }

    const { rows } = await client.query(
      `
        update care.care_plans
           set signed_at = coalesce(signed_at, now()),
               updated_at = now(),
               updated_by = $2
         where id = $1
        returning id, signed_at
      `,
      [params.id, user.id]
    );
    if (!rows.length) {
      const err = new Error('Care plan not found');
      err.status = 404;
      throw err;
    }
    await recordAuditEvent(client, user, 'care_plans:sign', { type: 'care_plan', id: params.id });
    return rows[0];
  });
}

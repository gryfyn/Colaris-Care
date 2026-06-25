import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { staffAssignmentPredicate } from '@/lib/staff-access.js';

function mapNote(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    noteType: row.note_type,
    body: row.body,
    status: row.status,
    occurredAt: row.occurred_at,
    signedAt: row.signed_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_READ, 'progress_notes:read', async ({ client, user }) => {
    const assignmentPredicate = staffAssignmentPredicate(user, 'pn.resident_id');
    const { rows } = await client.query(
      `
        select pn.id, pn.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               pn.note_type, pn.body, pn.status, pn.occurred_at, pn.signed_at
          from care.progress_notes pn
          join care.residents r
            on r.organization_id = pn.organization_id
           and r.facility_id = pn.facility_id
           and r.id = pn.resident_id
         where true
         ${assignmentPredicate}
         order by pn.occurred_at desc
         limit 200
      `
    );
    return rows.map(mapNote);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_WRITE, 'progress_notes:write', async ({ client, user }) => {
    const body = await readJson(request);
    if (user.role === ROLES.STAFF) {
      const assigned = await client.query(
        `
          select 1
            from care.staff_assignments
           where staff_profile_id = $1
             and resident_id = $2
             and status = 'active'
           limit 1
        `,
        [user.staffId, body.residentId]
      );
      if (!assigned.rowCount) {
        const err = new Error('Staff user is not assigned to this resident');
        err.status = 403;
        throw err;
      }
    }

    const { rows } = await client.query(
      `
        insert into care.progress_notes(
          organization_id, facility_id, resident_id, note_type, body,
          status, occurred_at, created_by, updated_by
        )
        values ($1, $2, $3, coalesce($4, 'shift'), $5, coalesce($6, 'draft'), coalesce($7, now()), $8, $8)
        returning id, resident_id, note_type, body, status, occurred_at, signed_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId,
        body.noteType || 'shift',
        body.body,
        body.status || 'draft',
        body.occurredAt || null,
        user.id,
      ]
    );
    return { ...mapNote(rows[0]), residentName: null };
  });
}

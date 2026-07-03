import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';
import { requireStaffAssignedToResident } from '@/lib/staff-access.js';
import { ROLES } from '@/lib/roles.js';
import { normalizeNoteBody } from '@/lib/progress-notes-schema.js';

// GET /api/v1/daily-progress-notes/history?residentId=UUID
//
// Full progress-note history for one resident, newest first. Powers the admin
// drill-down table (date, shift, staff who filled, approver, status). Staff may
// only read residents they are assigned to.
export async function GET(request) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_READ, 'daily_progress_notes:history', async ({ client, user }) => {
    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId') || searchParams.get('resident_id');
    if (!residentId) {
      const err = new Error('residentId is required');
      err.status = 422;
      throw err;
    }

    if (user.role === ROLES.STAFF) {
      await requireStaffAssignedToResident(user, residentId);
    }

    const { rows } = await client.query(
      `
        select dpn.id, dpn.note_date, dpn.shift, dpn.note_body, dpn.review_status,
               dpn.approver_name, dpn.source, dpn.created_at,
               r.first_name as resident_first_name, r.last_name as resident_last_name,
               sp.first_name as staff_first_name, sp.last_name as staff_last_name
          from care.daily_progress_notes dpn
          join care.residents r
            on r.organization_id = dpn.organization_id
           and r.facility_id     = dpn.facility_id
           and r.id              = dpn.resident_id
          left join care.staff_profiles sp
            on sp.organization_id = dpn.organization_id
           and sp.facility_id     = dpn.facility_id
           and sp.id              = dpn.staff_profile_id
         where dpn.resident_id = $1
         order by dpn.note_date desc, dpn.created_at desc
         limit 500
      `,
      [residentId]
    );

    return {
      residentId,
      residentName: rows.length
        ? `${rows[0].resident_first_name || ''} ${rows[0].resident_last_name || ''}`.trim()
        : null,
      notes: rows.map((row) => ({
        id: row.id,
        noteDate: row.note_date,
        shift: row.shift,
        noteBody: normalizeNoteBody(row.note_body),
        reviewStatus: row.review_status,
        approverName: row.approver_name,
        source: row.source,
        createdAt: row.created_at,
        staffName: [row.staff_first_name, row.staff_last_name].filter(Boolean).join(' ').trim() || null,
      })),
    };
  });
}

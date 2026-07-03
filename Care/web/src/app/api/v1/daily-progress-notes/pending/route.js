import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';
import { staffAssignmentPredicate } from '@/lib/staff-access.js';

// GET /api/v1/daily-progress-notes/pending?date=YYYY-MM-DD
//
// Drives the daily worklist and the "X / N done" counter. Returns the active
// residents who do NOT yet have a note for the date (`pending`), plus totals so
// the caller can render e.g. 2/6. Staff are scoped to their assignments; admin
// and managers see the whole facility. No cron: "due every day for every
// resident" is computed here on every request.
export async function GET(request) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_READ, 'daily_progress_notes:pending', async ({ client, user }) => {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const assignmentPredicate = staffAssignmentPredicate(user, 'r.id');

    const { rows } = await client.query(
      `
        select r.id as resident_id, r.first_name, r.last_name, r.room,
               (dpn.id is not null) as has_note
          from care.residents r
          left join care.daily_progress_notes dpn
            on dpn.organization_id = r.organization_id
           and dpn.facility_id     = r.facility_id
           and dpn.resident_id     = r.id
           and dpn.note_date        = $1
         where r.status = 'active'
         ${assignmentPredicate}
         order by r.last_name, r.first_name
      `,
      [date]
    );

    const residents = rows.map((row) => ({
      residentId: row.resident_id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident',
      room: row.room,
      hasNote: row.has_note,
    }));

    const total = residents.length;
    const completed = residents.filter((r) => r.hasNote).length;

    return {
      date,
      total,
      completed,
      remaining: total - completed,
      pending: residents.filter((r) => !r.hasNote),
      residents,
    };
  });
}

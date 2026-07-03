import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { staffAssignmentPredicate, requireStaffAssignedToResident } from '@/lib/staff-access.js';
import { normalizeNoteBody, SHIFT_VALUES } from '@/lib/progress-notes-schema.js';

function mapNote(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: [row.resident_first_name, row.resident_last_name].filter(Boolean).join(' ').trim() || 'Resident',
    staffId: row.staff_profile_id,
    staffName: [row.staff_first_name, row.staff_last_name].filter(Boolean).join(' ').trim() || null,
    noteDate: row.note_date,
    shift: row.shift,
    noteBody: normalizeNoteBody(row.note_body),
    reviewStatus: row.review_status,
    approverName: row.approver_name,
    source: row.source,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS = `
  dpn.id, dpn.resident_id, dpn.staff_profile_id, dpn.note_date, dpn.shift,
  dpn.note_body, dpn.review_status, dpn.approver_name, dpn.source, dpn.created_at,
  r.first_name  as resident_first_name, r.last_name  as resident_last_name,
  sp.first_name as staff_first_name,    sp.last_name as staff_last_name
`;

const FROM_JOINS = `
  from care.daily_progress_notes dpn
  join care.residents r
    on r.organization_id = dpn.organization_id
   and r.facility_id     = dpn.facility_id
   and r.id              = dpn.resident_id
  left join care.staff_profiles sp
    on sp.organization_id = dpn.organization_id
   and sp.facility_id     = dpn.facility_id
   and sp.id              = dpn.staff_profile_id
`;

// GET /api/v1/daily-progress-notes?date=&residentId=&status=
// Lists structured daily progress notes. Staff are assignment-scoped by the
// predicate; admin/manager see the whole facility (RLS still scopes the tenant).
export async function GET(request) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_READ, 'daily_progress_notes:read', async ({ client, user }) => {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const residentId = searchParams.get('residentId');
    const status = searchParams.get('status');

    const conditions = ['true'];
    const params = [];
    if (date) { params.push(date); conditions.push(`dpn.note_date = $${params.length}`); }
    if (residentId) { params.push(residentId); conditions.push(`dpn.resident_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`dpn.review_status = $${params.length}`); }

    // staffAssignmentPredicate returns an `AND EXISTS (...)` fragment (empty for
    // facility-wide roles); the `where true` base lets it compose either way.
    const assignmentPredicate = staffAssignmentPredicate(user, 'dpn.resident_id');

    const { rows } = await client.query(
      `
        select ${SELECT_COLUMNS}
        ${FROM_JOINS}
        where ${conditions.join(' and ')}
        ${assignmentPredicate}
        order by dpn.note_date desc, dpn.created_at desc
        limit 500
      `,
      params
    );
    return rows.map(mapNote);
  });
}

// POST /api/v1/daily-progress-notes
// Create one structured daily note. One per resident/date/shift (409 on repeat).
// review_status defaults to 'submitted' — admin does not approve.
export async function POST(request) {
  return withApiContext(request, PERMISSIONS.PROGRESS_NOTES_WRITE, 'daily_progress_notes:write', async ({ client, user }) => {
    const body = await readJson(request);

    const residentId = body.residentId || body.resident_id;
    const noteDate = body.noteDate || body.note_date;
    const shift = body.shift;

    if (!residentId) throwStatus('residentId is required', 422);
    if (!noteDate || !/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) throwStatus('noteDate must be YYYY-MM-DD', 422);
    if (!SHIFT_VALUES.includes(shift)) throwStatus(`shift must be one of ${SHIFT_VALUES.join(', ')}`, 422);

    const noteBody = normalizeNoteBody(body.noteBody || body.note_body);
    if (!noteBody.progressNotes || !noteBody.progressNotes.trim()) throwStatus('progressNotes is required', 422);

    if (user.role === ROLES.STAFF) {
      await requireStaffAssignedToResident(user, residentId);
    }

    const approverName = body.approverName ? String(body.approverName).slice(0, 200) : null;
    const source = body.source === 'upload' ? 'upload' : 'manual';

    const { rows } = await client.query(
      `
        insert into care.daily_progress_notes(
          organization_id, facility_id, resident_id, staff_profile_id,
          note_date, shift, note_body, review_status, approver_name, source,
          created_by, updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'submitted', $8, $9, $10, $10)
        on conflict (organization_id, facility_id, resident_id, note_date, shift) do nothing
        returning id
      `,
      [
        user.organizationId,
        user.facilityId,
        residentId,
        user.staffId || null,
        noteDate,
        shift,
        JSON.stringify(noteBody),
        approverName,
        source,
        user.id,
      ]
    );

    if (!rows.length) {
      throwStatus('A progress note already exists for this resident, date and shift', 409);
    }
    return { id: rows[0].id, residentId, noteDate, shift, reviewStatus: 'submitted', source };
  });
}

function throwStatus(message, status) {
  const err = new Error(message);
  err.status = status;
  err.code = 'VALIDATION';
  throw err;
}

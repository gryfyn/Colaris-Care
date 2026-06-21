import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeNoteBody } from '@/lib/sanitize.js';
import { validateRequired, validateUUID, validateEnum, validateDateFormat, getValidationErrorResponse } from '@/lib/request-validator.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * POST /api/v1/daily-progress-notes
 * Submit a daily progress note (pending review).
 *
 * Body:
 *   resident_id (UUID, required)
 *   note_date (date, required) - YYYY-MM-DD format
 *   shift (string, required) - morning, afternoon, or night
 *   note_body (object, required) - sanitized note content
 *
 * Auth: staff, manager, admin, or superadmin
 * Staff role:
 *   - Must be assigned to the resident (via care.staff_assignments, active=true)
 *   - Returns 403 if not assigned
 * Conflict handling:
 *   - Returns 409 if note already exists for resident/date/shift combo
 *
 * Response: { id, status: 'pending', message }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const user = authResult.user;

    if (!authorize(user.role, PERMISSIONS.PROGRESS_NOTES_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { resident_id, note_date, shift, note_body } = body;

    const reqErr = validateRequired(body, ['resident_id', 'note_date', 'shift', 'note_body']);
    if (reqErr) return Response.json(getValidationErrorResponse(reqErr), { status: reqErr.status });
    if (!validateUUID(resident_id)) {
      return Response.json({ error: 'resident_id must be a valid UUID', field: 'resident_id' }, { status: 422 });
    }
    if (!validateDateFormat(note_date)) {
      return Response.json({ error: 'note_date must be YYYY-MM-DD', field: 'note_date' }, { status: 422 });
    }
    const shiftErr = validateEnum(shift, ['morning', 'afternoon', 'night'], 'shift');
    if (shiftErr) return Response.json(getValidationErrorResponse(shiftErr), { status: shiftErr.status });
    if (typeof note_body !== 'object' || Array.isArray(note_body)) {
      return Response.json({ error: 'note_body must be an object', field: 'note_body' }, { status: 422 });
    }

    const sanitizedNoteBody = sanitizeNoteBody(note_body);

    const note = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Per-resident assignment gate (disabled under facility-wide staff policy)
      if (staffAssignmentRequired(user)) {
        const { rows } = await client.query(
          `SELECT 1 FROM care.staff_assignments
            WHERE tenant_id = $1 AND staff_id = $2 AND resident_id = $3 AND is_active = TRUE
            LIMIT 1`,
          [user.tenantId, user.staffId, resident_id]
        );
        if (!rows.length) {
          throw { status: 403, message: 'Not assigned to this resident' };
        }
      }

      const { rows } = await client.query(
        `INSERT INTO care.daily_progress_notes
          (tenant_id, resident_id, staff_id, note_date, shift, note_body, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         ON CONFLICT (tenant_id, resident_id, note_date, shift) DO NOTHING
         RETURNING id`,
        [
          user.tenantId,
          resident_id,
          user.staffId,
          note_date,
          shift,
          JSON.stringify(sanitizedNoteBody),
        ]
      );
      if (!rows.length) {
        throw { status: 409, message: 'A progress note already exists for this resident, date and shift' };
      }
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.daily_progress_notes',
      recordId: note.id,
      residentId: resident_id,
      req: getRequestContext(request, user),
    });

    return Response.json({
      id: note.id,
      status: 'pending',
      message: 'Progress note submitted for approval',
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * GET /api/v1/daily-progress-notes
 * List progress notes for admin/manager review with pagination.
 *
 * Query params:
 *   status    - filter by review_status (pending/approved/rejected)
 *   date      - filter by note_date (YYYY-MM-DD)
 *   limit     - items per page (1-500, default 100)
 *   offset    - pagination offset (default 0)
 *
 * Requires: admin, manager, or superadmin role.
 * Response: { data: [...], pagination: { limit, offset, total, pages } }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const user = authResult.user;

    // Admin review queue: restrict to admin/manager/superadmin (staff use /staff/progress-notes for their own queue)
    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json(
        { error: 'Forbidden: Only admins and managers can view progress notes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['dpn.tenant_id = $1'];
      const params = [user.tenantId];
      if (status) {
        params.push(status);
        conditions.push(`dpn.review_status = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`dpn.note_date = $${params.length}`);
      }
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT dpn.id, dpn.resident_id, dpn.note_date, dpn.shift, dpn.review_status,
                dpn.reviewed_at, dpn.review_notes, dpn.note_body, dpn.created_at,
                cr.first_name, cr.last_name,
                rs.first_name AS staff_first_name, rs.last_name AS staff_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.daily_progress_notes dpn
           LEFT JOIN care.residents cr ON cr.id = dpn.resident_id
           LEFT JOIN ref.staff rs ON rs.id = dpn.staff_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY dpn.note_date DESC, dpn.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);

    // Decrypt resident PHI (staff names from ref.staff are NOT encrypted)
    const tenantKey = getTenantKey();
    const data = rows.map(row => {
      const { total_count, ...rest } = row;
      return decryptFields(rest, ['first_name', 'last_name'], tenantKey);
    });

    await audit
      .logSelect({ tableName: 'care.daily_progress_notes', residentId: null, req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

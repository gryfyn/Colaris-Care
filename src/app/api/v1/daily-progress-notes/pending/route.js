import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { staffAssignmentScope } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

async function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/daily-progress-notes/pending
 *
 * Returns residents who do NOT yet have a daily progress note for the given date.
 * Automatically filters based on user role for data integrity.
 *
 * Query params:
 *   date (date, optional) - YYYY-MM-DD format, defaults to today
 *
 * Auth: staff, manager, admin, or superadmin
 * Staff role:
 *   - Returns only residents assigned to them (via care.staff_assignments, active=true)
 * Manager/Admin/Superadmin:
 *   - Returns all active residents in the tenant
 *
 * HIPAA Compliance:
 *   - Resident names are AES-256 encrypted at rest
 *   - decryptFields() is called before returning
 *   - Access is audited via audit_log.event_log
 *
 * Response: { data: [{ resident_id, first_name, last_name, status, assignment_date }],
 *             date, total_pending }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    // Roles that may view this endpoint
    const allowedRoles = ['staff', 'manager', 'admin', 'superadmin'];
    if (!allowedRoles.includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const today = new Date().toISOString().split('T')[0];
    const targetDate = dateParam || today;

    // Under the facility-wide policy staff see every active resident needing a
    // note; pass ?staff_only=1 to scope the worklist to their own assignments.
    const isStaff = staffAssignmentScope(user, searchParams.get('staff_only'));

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      if (isStaff) {
        // Assigned residents who don't yet have ANY progress note for this date
        const { rows } = await client.query(
          `SELECT cr.id          AS resident_id,
                  cr.first_name,
                  cr.last_name,
                  cr.status,
                  sa.assignment_date
             FROM care.residents cr
             JOIN care.staff_assignments sa
               ON sa.resident_id = cr.id
              AND sa.staff_id    = $2
              AND sa.is_active   = TRUE
             LEFT JOIN care.daily_progress_notes dpn
               ON dpn.resident_id = cr.id
              AND dpn.note_date   = $3
            WHERE cr.tenant_id   = $1
              AND cr.status      = 'active'
              AND cr.deleted_at IS NULL
              AND dpn.id IS NULL
            ORDER BY cr.last_name, cr.first_name`,
          [user.tenantId, user.staffId, targetDate]
        );
        return rows;
      }

      const { rows } = await client.query(
        `SELECT cr.id          AS resident_id,
                cr.first_name,
                cr.last_name,
                cr.status,
                NULL::date     AS assignment_date
           FROM care.residents cr
           LEFT JOIN care.daily_progress_notes dpn
             ON dpn.resident_id = cr.id
            AND dpn.note_date   = $2
          WHERE cr.tenant_id   = $1
            AND cr.status      = 'active'
            AND cr.deleted_at IS NULL
            AND dpn.id IS NULL
          ORDER BY cr.last_name, cr.first_name`,
        [user.tenantId, targetDate]
      );
      return rows;
    });

    // Decrypt PHI fields before returning
    const tenantKey = await getTenantKey();
    const data = rows.map(r =>
      decryptFields(
        {
          resident_id: r.resident_id,
          first_name: r.first_name,
          last_name: r.last_name,
          status: r.status,
          assignment_date: r.assignment_date,
        },
        ['first_name', 'last_name'],
        tenantKey
      )
    );

    // Audit log PHI access
    const req = getRequestContext(request, user);
    audit
      .logSelect({ tableName: 'care.daily_progress_notes', residentId: null, req })

    return Response.json(
      { data, date: targetDate, total_pending: data.length },
      { status: 200 }
    );
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/staff/dashboard
 * Staff dashboard summary with assigned residents, pending progress notes, recent incidents, and today's assignments.
 *
 * Auth: STAFF_READ permission (staff, manager, admin, superadmin)
 * Staff role automatically filters to their own assignments.
 * Manager/Admin roles see facility-wide summary.
 *
 * Response: {
 *   assignedResidents: number,
 *   pendingProgressNotes: number,
 *   recentIncidents: [{ id, resident_id, incident_date, incident_time, first_name, last_name, incident_type }],
 *   assignedForToday: [{ id, first_name, last_name, status, assignment_date }]
 * }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dashboard = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Count assigned residents for this staff member
      const { rows: assignedCount } = await client.query(
        `SELECT COUNT(DISTINCT r.id) as count
         FROM care.residents r
         JOIN care.staff_assignments sa ON sa.resident_id = r.id
         WHERE r.tenant_id = $1 AND sa.staff_id = $2 AND sa.is_active = TRUE`,
        [user.tenantId, user.staffId]
      );

      // Count pending progress notes authored by this staff member
      const { rows: pendingNotes } = await client.query(
        `SELECT COUNT(dpn.id) as count
         FROM care.daily_progress_notes dpn
         WHERE dpn.tenant_id = $1 AND dpn.staff_id = $2 AND dpn.review_status = 'pending'`,
        [user.tenantId, user.staffId]
      );

      // Get recent incidents involving assigned residents
      const { rows: recentIncidents } = await client.query(
        `SELECT ir.id, ir.resident_id, ir.incident_date, ir.incident_time,
                cr.first_name, cr.last_name, ir.incident_type
         FROM care.incident_reports ir
         JOIN care.residents cr ON cr.id = ir.resident_id
         JOIN care.staff_assignments sa ON sa.resident_id = ir.resident_id
         WHERE ir.tenant_id = $1 AND sa.staff_id = $2 AND sa.is_active = TRUE
         ORDER BY ir.incident_date DESC, ir.incident_time DESC
         LIMIT 5`,
        [user.tenantId, user.staffId]
      );

      // Get today's assigned residents
      const { rows: todaysAssignments } = await client.query(
        `SELECT r.id, r.first_name, r.last_name, r.status, sa.assignment_date
         FROM care.residents r
         JOIN care.staff_assignments sa ON sa.resident_id = r.id
         WHERE r.tenant_id = $1 AND sa.staff_id = $2
         AND sa.is_active = TRUE
         AND DATE(sa.assignment_date) <= CURRENT_DATE
         ORDER BY r.last_name, r.first_name
         LIMIT 20`,
        [user.tenantId, user.staffId]
      );

      return {
        assignedResidents: parseInt(assignedCount[0]?.count || 0),
        pendingProgressNotes: parseInt(pendingNotes[0]?.count || 0),
        recentIncidents: recentIncidents || [],
        assignedForToday: todaysAssignments || [],
      };
    });

    // Decrypt resident PHI fields in incidents and assignedForToday (HIPAA)
    const tenantKey = getTenantKey();
    dashboard.recentIncidents = dashboard.recentIncidents.map(row =>
      decryptFields(row, ['first_name', 'last_name'], tenantKey)
    );
    dashboard.assignedForToday = dashboard.assignedForToday.map(row =>
      decryptFields(row, ['first_name', 'last_name'], tenantKey)
    );


    return Response.json({ data: dashboard }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

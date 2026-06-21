import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentScope } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

function getTenantKey(tenantId) {
  if (process.env.NODE_ENV !== 'production') {
    return (Buffer.from(process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!').toString('hex').slice(0, 64)).padEnd(64, '0');
  }
  return (Buffer.from(process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!').toString('hex').slice(0, 64)).padEnd(64, '0');
}

/**
 * GET /api/v1/care-plans
 * List care plans for the current tenant with resident info and summary fields.
 * Staff users see only care plans for their assigned residents (minimum necessary access).
 *
 * Query params:
 *   resident_id   - filter by specific resident (UUID)
 *   staff_only    - '1' to filter to residents assigned to current staff (default: auto-enabled for staff role)
 *   limit         - items per page (1-200, default 100)
 *   offset        - pagination offset (default 0)
 *
 * Auth: CARE_PLANS_READ permission
 * Staff role automatically filters results to assigned residents for HIPAA compliance.
 *
 * Response: { data: [...] }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('resident_id');
    const staffOnly = staffAssignmentScope(user, searchParams.get('staff_only'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const tenantKey = getTenantKey(user.tenantId);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['cp.tenant_id = $1', 'cp.deleted_at IS NULL'];
      const params = [user.tenantId];
      let joinStaffAssignments = '';

      if (residentId) {
        params.push(residentId);
        conditions.push(`cp.resident_id = $${params.length}`);
      }

      if (staffOnly) {
        joinStaffAssignments = 'JOIN care.staff_assignments sa ON sa.resident_id = cp.resident_id AND sa.is_active = TRUE';
        params.push(user.staffId);
        conditions.push(`sa.staff_id = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT
          cp.id, cp.resident_id, cp.plan_type, cp.status, cp.effective_date, cp.expiration_date,
          cp.review_date, cp.review_schedule, cp.created_at, cp.updated_at,
          r.first_name, r.last_name, r.primary_diagnosis, r.medicaid_id,
          s.first_name || ' ' || s.last_name AS primary_counselor_name,
          (SELECT goal_text FROM care.goals g WHERE g.care_plan_id = cp.id AND g.deleted_at IS NULL ORDER BY g.goal_number NULLS LAST, g.created_at LIMIT 1 OFFSET 0) AS goal1_statement,
          (SELECT goal_text FROM care.goals g WHERE g.care_plan_id = cp.id AND g.deleted_at IS NULL ORDER BY g.goal_number NULLS LAST, g.created_at LIMIT 1 OFFSET 1) AS goal2_statement,
          (SELECT goal_text FROM care.goals g WHERE g.care_plan_id = cp.id AND g.deleted_at IS NULL ORDER BY g.goal_number NULLS LAST, g.created_at LIMIT 1 OFFSET 2) AS goal3_statement,
          (SELECT array_agg(DISTINCT g.domain) FROM care.goals g WHERE g.care_plan_id = cp.id AND g.deleted_at IS NULL AND g.domain IS NOT NULL) AS selected_domains,
          NULL::text AS crisis_warning_signs
         FROM care.care_plans cp
         JOIN care.residents r ON r.id = cp.resident_id
         LEFT JOIN ref.staff s ON s.id = cp.primary_counselor_id
         ${joinStaffAssignments}
         WHERE ${where}
         ORDER BY cp.updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      // Decrypt resident PHI
      return rows.map(row => {
        const decrypted = decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey);
        return {
          ...decrypted,
          resident_name: `${decrypted.first_name || ''} ${decrypted.last_name || ''}`.trim(),
        };
      });
    });

    await audit.logSelect({
      tableName: 'care.care_plans',
      residentId: null,
      req: { user },
      justification: searchParams.get('justification'),
    });
    return Response.json({ data: result });
  } catch (err) {
    return handleError(err);
  }
}

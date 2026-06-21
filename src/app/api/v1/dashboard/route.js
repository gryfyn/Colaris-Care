import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `SELECT
           (SELECT COUNT(*) FROM care.residents WHERE deleted_at IS NULL AND status = 'active') AS active_residents,
           (SELECT COUNT(*) FROM care.care_plans WHERE status = 'active' AND deleted_at IS NULL) AS active_plans,
           (SELECT COUNT(*) FROM care.v_active_residents_with_plan WHERE plan_expiring_soon = TRUE) AS plans_expiring_soon,
           (SELECT COUNT(*) FROM care.v_active_residents_with_plan WHERE review_overdue = TRUE) AS reviews_overdue,
           (SELECT COUNT(*) FROM care.v_high_risk_residents) AS high_risk_residents,
           (SELECT COUNT(*) FROM care.v_roi_expiring_soon) AS roi_expiring_soon,
           (SELECT COUNT(*) FROM care.daily_progress_notes WHERE review_status = 'pending') AS pending_daily_progress_notes,
           (SELECT COUNT(*) FROM care.incident_reports WHERE review_status = 'pending' AND deleted_at IS NULL) AS pending_incident_reports,
           (SELECT COUNT(*) FROM care.drug_disposal_records WHERE review_status = 'pending') AS pending_drug_disposals,
           (SELECT COUNT(*) FROM care.evacuation_drills WHERE review_status = 'pending') AS pending_evacuation_drills`
      )
    );

    return Response.json({ data: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}

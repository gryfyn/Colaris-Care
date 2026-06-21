import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.GOALS_READ, PERMISSIONS.GOALS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: carePlanId } = await context.params;

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `SELECT g.*, json_agg(o.* ORDER BY o.objective_number) FILTER (WHERE o.id IS NOT NULL) AS objectives
         FROM care.goals g
         LEFT JOIN care.objectives o ON o.goal_id = g.id AND o.deleted_at IS NULL
         WHERE g.care_plan_id = $1 AND g.deleted_at IS NULL
         GROUP BY g.id ORDER BY g.section, g.goal_number`,
        [carePlanId]
      )
    );

    return Response.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.GOALS_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: carePlanId } = await context.params;
    const { section, goal_number, goal_text, status, domain, target_date } = await request.json();

    const { rows: plan } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query('SELECT resident_id FROM care.care_plans WHERE id = $1', [carePlanId])
    );
    if (!plan.length) return Response.json({ error: 'Care plan not found' }, { status: 404 });

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `INSERT INTO care.goals (care_plan_id, tenant_id, section, goal_number, goal_text, status, domain, target_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [carePlanId, user.tenantId, section, goal_number, goal_text, status || 'not_started', domain, target_date]
      )
    );

    const req = getRequestContext(request, user);
    await audit.logInsert({ tableName: 'care.goals', recordId: rows[0].id, residentId: plan[0].resident_id, newValues: rows[0], req });

    return Response.json({ data: rows[0] }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

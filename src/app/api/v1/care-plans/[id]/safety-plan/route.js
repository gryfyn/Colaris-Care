import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient, query } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.SAFETY_READ, PERMISSIONS.SAFETY_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: carePlanId } = await context.params;

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query('SELECT * FROM care.safety_plans WHERE care_plan_id = $1', [carePlanId])
    );

    const { rows: plan } = await query('SELECT resident_id FROM care.care_plans WHERE id = $1', [carePlanId]);
    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.safety_plans', residentId: plan[0]?.resident_id, req });

    return Response.json({ data: rows[0] || null });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.SAFETY_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: carePlanId } = await context.params;
    const body = await request.json();

    const { rows: plan } = await query('SELECT resident_id FROM care.care_plans WHERE id = $1', [carePlanId]);
    if (!plan.length) return Response.json({ error: 'Care plan not found' }, { status: 404 });

    const fields = [
      'crisis_plan','crisis_resources','suicide_risk_level','suicide_risk_protocol',
      'self_harm_risk_level','self_harm_protocol','aggression_risk_level','aggression_protocol',
      'awol_risk_level','awol_prevention','contraband_policy','mandatory_reporting',
      'de_escalation_techniques','last_reviewed_at','reviewed_by',
    ];

    const colList = fields.filter(f => f in body);
    if (!colList.length) return Response.json({ error: 'No valid fields' }, { status: 422 });

    const params     = [carePlanId, user.tenantId];
    const insertCols = ['care_plan_id', 'tenant_id', ...colList];
    const insertVals = ['$1', '$2', ...colList.map((_, i) => `$${i + 3}`)];
    const updateSet  = colList.map((f, i) => `${f} = $${i + 3}`);

    for (const f of colList) params.push(body[f]);

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `INSERT INTO care.safety_plans (${insertCols.join(',')})
         VALUES (${insertVals.join(',')})
         ON CONFLICT (care_plan_id) DO UPDATE SET ${updateSet.join(',')}, updated_at = NOW()
         RETURNING *`,
        params
      )
    );

    const req = getRequestContext(request, user);
    await audit.logUpdate({ tableName: 'care.safety_plans', recordId: rows[0].id, residentId: plan[0].resident_id, diffKeys: colList, req });

    return Response.json({ data: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}

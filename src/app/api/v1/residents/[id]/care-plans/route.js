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

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_READ, PERMISSIONS.CARE_PLANS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: residentId } = await context.params;

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `SELECT cp.*,
                s1.first_name || ' ' || s1.last_name AS primary_counselor_name,
                s2.first_name || ' ' || s2.last_name AS program_director_name
         FROM care.care_plans cp
         LEFT JOIN ref.staff s1 ON s1.id = cp.primary_counselor_id
         LEFT JOIN ref.staff s2 ON s2.id = cp.program_director_id
         WHERE cp.resident_id = $1 AND cp.deleted_at IS NULL
         ORDER BY cp.effective_date DESC`,
        [residentId]
      )
    );

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.care_plans', residentId, req });

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

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_CREATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: residentId } = await context.params;
    const body = await request.json();

    const plan = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      await client.query(
        `UPDATE care.care_plans SET status = 'superseded', updated_by = $2
         WHERE resident_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [residentId, user.staffId]
      );

      const { rows } = await client.query(
        `INSERT INTO care.care_plans (
           resident_id, tenant_id, plan_type, status, effective_date,
           expiration_date, review_date, review_schedule,
           primary_counselor_id, program_director_id, created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
        [
          residentId, user.tenantId,
          body.plan_type || 'initial', body.status || 'draft',
          body.effective_date, body.expiration_date, body.review_date,
          body.review_schedule, body.primary_counselor_id,
          body.program_director_id, user.staffId,
        ]
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit.logInsert({
      tableName: 'care.care_plans', recordId: plan.id, residentId,
      newValues: { id: plan.id, plan_type: plan.plan_type, status: plan.status }, req,
    });

    return Response.json({ data: plan }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

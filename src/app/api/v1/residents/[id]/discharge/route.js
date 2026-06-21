import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_DISCHARGE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { discharge_date, discharge_destination, aftercare_providers } = await request.json();

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `UPDATE care.residents
         SET status = 'discharged', discharge_date = $2,
             aftercare_providers = $3, updated_by = $4
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, status, discharge_date`,
        [id, discharge_date, aftercare_providers, user.staffId]
      )
    );

    if (!rows.length) return Response.json({ error: 'Resident not found' }, { status: 404 });

    await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `UPDATE care.discharge_plans
         SET actual_discharge_date = $2, discharge_destination = $3
         WHERE resident_id = $1`,
        [id, discharge_date, discharge_destination]
      )
    );

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.residents', recordId: id, residentId: id,
      newValues: { status: 'discharged', discharge_date },
      diffKeys:  ['status', 'discharge_date'], req,
    });

    return Response.json({ data: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}

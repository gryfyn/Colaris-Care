import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

const sigMap = {
  staff:            { col: 'counselor_signed_at' },
  manager:          { col: 'director_signed_at' },
  resident_care_of: { col: 'client_signed_at', statusCol: 'client_sig_status' },
};

export async function POST(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_SIGN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { sig_status } = await request.json();
    const now = new Date().toISOString();

    const mapping = sigMap[user.role];
    if (!mapping) return Response.json({ error: 'Your role cannot sign care plans' }, { status: 403 });

    const setClauses = [`${mapping.col} = $2`];
    const params     = [id, now];

    if (mapping.statusCol && sig_status) {
      params.push(sig_status);
      setClauses.push(`${mapping.statusCol} = $${params.length}`);
    }

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `UPDATE care.care_plans SET ${setClauses.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING id, resident_id`,
        params
      )
    );

    if (!rows.length) return Response.json({ error: 'Care plan not found' }, { status: 404 });

    const req = getRequestContext(request, user);
    await audit.log({ eventType: 'CARE_PLAN_SIGN', tableName: 'care.care_plans', recordId: id, residentId: rows[0].resident_id, req });

    return Response.json({ message: 'Signature recorded', signedAt: now });
  } catch (err) {
    return handleError(err);
  }
}

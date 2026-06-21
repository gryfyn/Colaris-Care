import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.SAFETY_READ, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query('SELECT * FROM care.v_high_risk_residents ORDER BY suicide_risk_level DESC NULLS LAST')
    );

    return Response.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

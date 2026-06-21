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

    if (!authorize(user.role, PERMISSIONS.ROI_REVOKE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `UPDATE care.roi_records SET revoked_at = NOW(), revoked_by = $2, is_active = FALSE
         WHERE id = $1 AND revoked_at IS NULL RETURNING id, resident_id`,
        [id, user.staffId]
      )
    );
    if (!rows.length) return Response.json({ error: 'ROI not found or already revoked' }, { status: 404 });

    const req = getRequestContext(request, user);
    await audit.logUpdate({ tableName: 'care.roi_records', recordId: id, residentId: rows[0].resident_id, diffKeys: ['revoked_at'], req });

    return Response.json({ message: 'ROI revoked', revokedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}

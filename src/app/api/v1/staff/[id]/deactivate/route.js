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

    if (!authorize(user.role, PERMISSIONS.STAFF_DEACTIVATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify staff exists in tenant
      const { rows: staffRows } = await client.query(
        'SELECT id FROM ref.staff WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      if (!staffRows.length) {
        throw { message: 'Staff member not found', status: 404 };
      }

      // Deactivate staff record
      await client.query(
        'UPDATE ref.staff SET is_active = FALSE WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );

      // Deactivate associated user account
      await client.query(
        'UPDATE care.user_accounts SET is_active = FALSE WHERE staff_id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
    });

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'ref.staff',
      recordId: id,
      residentId: null,
      req,
    });
    return Response.json({ message: 'Staff member deactivated' }, { status: 200 });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

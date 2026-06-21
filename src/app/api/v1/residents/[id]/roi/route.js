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

    if (!authorize(user.role, PERMISSIONS.ROI_READ, PERMISSIONS.ROI_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: residentId } = await context.params;

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `SELECT roi.*, o.name AS recipient_org_name
         FROM care.roi_records roi
         LEFT JOIN ref.organizations o ON o.id = roi.recipient_org
         WHERE roi.resident_id = $1
         ORDER BY roi.expiration_date ASC NULLS LAST`,
        [residentId]
      )
    );

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.roi_records', residentId, req });

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

    if (!authorize(user.role, PERMISSIONS.ROI_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: residentId } = await context.params;
    const { recipient_name, recipient_type, information_scope, signed_date, effective_date, expiration_date } = await request.json();

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `INSERT INTO care.roi_records
           (resident_id, tenant_id, recipient_name, recipient_type, information_scope,
            signed_date, effective_date, expiration_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [residentId, user.tenantId, recipient_name, recipient_type, information_scope, signed_date, effective_date, expiration_date, user.staffId]
      )
    );

    const req = getRequestContext(request, user);
    await audit.logInsert({ tableName: 'care.roi_records', recordId: rows[0].id, residentId, newValues: rows[0], req });

    return Response.json({ data: rows[0] }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

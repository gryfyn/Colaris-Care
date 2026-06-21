import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function POST(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_APPROVE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return Response.json({ error: 'Missing admission ID' }, { status: 400 });
    }

    const body = await request.json();

    if (!body.rejection_reason || body.rejection_reason.trim().length === 0) {
      return Response.json({ error: 'Missing required field: rejection_reason' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: admissionRows } = await client.query(
        `SELECT * FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2`,
        [id, user.tenantId]
      );

      if (!admissionRows.length) {
        return { error: 'Admission not found', status: 404 };
      }

      const admission = admissionRows[0];

      if (admission.status !== 'pending') {
        return { error: `Cannot reject admission with status: ${admission.status}`, status: 422 };
      }

      const { rows: updateRows } = await client.query(
        `UPDATE care.pending_admissions
         SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [body.rejection_reason.trim(), user.staffId, id]
      );

      return { admission: updateRows[0] };
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const req = getRequestContext(request, user);
    await audit.logUpdate({
      tableName: 'care.pending_admissions',
      recordId: id,
      oldValues: { status: 'pending' },
      newValues: { status: 'rejected', rejection_reason: body.rejection_reason },
      diffKeys: ['status', 'rejection_reason'],
      req,
    });

    return Response.json({
      data: {
        status: 'rejected',
      },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

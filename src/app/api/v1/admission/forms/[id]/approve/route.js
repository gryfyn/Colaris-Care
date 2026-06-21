import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * POST /api/v1/admission/forms/[id]/approve
 *
 * Admin/manager approves a pending admission.
 * Sets status='approved', approved_by, approved_at.
 * Does NOT create resident (moved to finalize on advance-directive submit in POST /api/v1/admission/forms).
 *
 * NOTE: This endpoint is kept for backward compatibility. The PATCH /api/v1/admission/[id]/review
 * endpoint handles the same approve logic and is the preferred path.
 */
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
    if (!id) return Response.json({ error: 'Missing admission ID' }, { status: 400 });

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: admissionRows } = await client.query(
        `SELECT * FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2`,
        [id, user.tenantId]
      );
      if (!admissionRows.length) throw { status: 404, message: 'Admission not found' };

      const admission = admissionRows[0];
      if (admission.status !== 'pending') {
        throw { status: 422, message: `Cannot approve admission with status: ${admission.status}` };
      }

      // Just set status to approved. Resident creation moved to finalize on advance-directive submit.
      await client.query(
        `UPDATE care.pending_admissions
            SET status = 'approved', approved_by = $1, approved_at = NOW()
          WHERE id = $2`,
        [user.staffId, id]
      );

      return { status: 'approved' };
    });

    await audit.logUpdate({
      tableName: 'care.pending_admissions',
      recordId: id,
      oldValues: { status: 'pending' },
      newValues: { status: 'approved' },
      diffKeys: ['status'],
      req: getRequestContext(request, user),
    });
    return Response.json({
      data: {
        status: 'approved',
        message: 'Admission approved. Resident will be created when advance directive is submitted.',
      },
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

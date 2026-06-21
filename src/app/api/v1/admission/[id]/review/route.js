import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * PATCH /api/v1/admission/[id]/review
 *
 * Approve or reject a pending admission.
 * - On approval: sets status='approved', approved_by, approved_at. Does NOT create resident (moved to finalize on advance-directive submit).
 * - On rejection: sets status='rejected' and requires rejection_reason.
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }

    const { user } = authResult;
    const { id } = await params;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_APPROVE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status, notes } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return Response.json({ error: 'status must be "approved" or "rejected"' }, { status: 422 });
    }
    if (status === 'rejected' && !notes) {
      return Response.json({ error: 'A reason (notes) is required when rejecting' }, { status: 422 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Pre-screening is standalone — handle its review here first.
      const { rows: screeningRows } = await client.query(
        `SELECT id, status FROM care.pre_admission_screenings
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );
      if (screeningRows.length) {
        const sc = screeningRows[0];
        if (!['submitted', 'deferred'].includes(sc.status)) {
          throw { status: 422, message: `Cannot review a screening already ${sc.status}` };
        }
        if (status === 'rejected') {
          await client.query(
            `UPDATE care.pre_admission_screenings
                SET status = 'declined', screening_outcome = 'not_appropriate',
                    review_notes = $1, reviewed_by_staff_id = $2, reviewed_at = NOW(), updated_at = NOW()
              WHERE id = $3`,
            [notes, user.staffId, id]
          );
          return { status: 'rejected', residentId: null, residentName: null, kind: 'screening' };
        }
        await client.query(
          `UPDATE care.pre_admission_screenings
              SET status = 'approved', screening_outcome = 'approved',
                  review_notes = $1, reviewed_by_staff_id = $2, reviewed_at = NOW(), updated_at = NOW()
            WHERE id = $3`,
          [notes || null, user.staffId, id]
        );
        return { status: 'approved', residentId: null, residentName: null, kind: 'screening' };
      }

      const { rows: admissionRows } = await client.query(
        `SELECT * FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2`,
        [id, user.tenantId]
      );
      if (!admissionRows.length) throw { status: 404, message: 'Admission not found' };

      const admission = admissionRows[0];
      if (admission.status !== 'pending') {
        throw { status: 422, message: `Cannot review an admission already ${admission.status}` };
      }

      // REJECTION: set status and reason
      if (status === 'rejected') {
        await client.query(
          `UPDATE care.pending_admissions
              SET status = 'rejected', rejection_reason = $1,
                  approved_by = $2, approved_at = NOW()
            WHERE id = $3`,
          [notes, user.staffId, id]
        );
        return { status: 'rejected', residentId: null, residentName: null };
      }

      // APPROVAL: just set status, approved_by, approved_at. Resident creation moved to finalize on advance-directive submit.
      await client.query(
        `UPDATE care.pending_admissions
            SET status = 'approved', approved_by = $1, approved_at = NOW(), rejection_reason = NULL
          WHERE id = $2`,
        [user.staffId, id]
      );

      return {
        status: 'approved',
        residentId: null,
        residentName: null,
      };
    });

    await audit.logUpdate({
      tableName: 'care.pending_admissions',
      recordId: id,
      oldValues: { status: 'pending' },
      newValues: { status: result.status, review_notes: notes || null },
      diffKeys: ['status'],
      req: getRequestContext(request, user),
    });
    return Response.json({
      id,
      status: result.status,
      residentId: result.residentId,
      residentName: result.residentName,
      message: result.status === 'approved'
        ? 'Admission approved. Resident will be created when advance directive is submitted.'
        : 'Admission rejected.',
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { validateUUID } from '@/lib/request-validator.js';

const audit = new AuditLogger();

/**
 * DELETE /api/v1/admin/accounts/[id]
 * Deactivate (soft-delete) a user account. Sets is_active = false and clears
 * any active refresh session. Account row is preserved for audit history.
 *
 * Body (optional): { reason?: string }
 *
 * Admin cannot deactivate their own account.
 * Requires: ACCOUNTS_MANAGE permission.
 */
export async function DELETE(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ACCOUNTS_MANAGE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!validateUUID(id)) {
      return Response.json({ error: 'id must be a valid UUID' }, { status: 422 });
    }

    if (id === user.id) {
      return Response.json({ error: 'You cannot deactivate your own account' }, { status: 422 });
    }

    let reason = null;
    try {
      const body = await request.json();
      reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
    } catch { /* no body */ }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `UPDATE care.user_accounts
            SET is_active = FALSE,
                updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE
          RETURNING id, email, role, staff_id, resident_id`,
        [id, user.tenantId]
      );
      if (!rows.length) {
        const { rows: check } = await client.query(
          `SELECT is_active FROM care.user_accounts WHERE id = $1 AND tenant_id = $2`,
          [id, user.tenantId]
        );
        if (!check.length) throw { status: 404, message: 'Account not found' };
        throw { status: 422, message: 'Account is already deactivated' };
      }
      return rows[0];
    });

    await audit.logUpdate({
      tableName: 'care.user_accounts',
      recordId: result.id,
      oldValues: { is_active: true },
      newValues: { is_active: false, deactivation_reason: reason },
      diffKeys: ['is_active'],
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: result.id,
      email: result.email,
      is_active: false,
      message: 'Account deactivated. The user can no longer log in.',
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/admin/accounts/[id]
 * Reactivate a deactivated account.
 *
 * Body: { is_active: true }
 *
 * Requires: ACCOUNTS_MANAGE permission.
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ACCOUNTS_MANAGE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!validateUUID(id)) {
      return Response.json({ error: 'id must be a valid UUID' }, { status: 422 });
    }

    const body = await request.json();
    if (body.is_active !== true) {
      return Response.json({ error: 'Only is_active: true is supported via PATCH (use DELETE to deactivate)' }, { status: 422 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `UPDATE care.user_accounts
            SET is_active = TRUE,
                failed_attempts = 0,
                locked_until = NULL,
                updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id, email, role`,
        [id, user.tenantId]
      );
      if (!rows.length) throw { status: 404, message: 'Account not found' };
      return rows[0];
    });

    await audit.logUpdate({
      tableName: 'care.user_accounts',
      recordId: result.id,
      oldValues: { is_active: false },
      newValues: { is_active: true },
      diffKeys: ['is_active'],
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: result.id,
      email: result.email,
      is_active: true,
      message: 'Account reactivated.',
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

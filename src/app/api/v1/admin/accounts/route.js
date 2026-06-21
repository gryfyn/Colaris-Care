import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { validateEnum, getValidationErrorResponse } from '@/lib/request-validator.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admin/accounts
 * List all user accounts (staff + residents) for the current tenant.
 *
 * Query params:
 *   role?: 'staff' | 'manager' | 'admin' | 'superadmin' | 'resident_care_of'
 *   search?: name or email substring (case-insensitive)
 *   active?: '1' | '0' — filter by is_active
 *   limit (1–500, default 100)
 *   offset (default 0)
 *
 * Requires: ACCOUNTS_MANAGE permission (admin/superadmin only).
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ACCOUNTS_MANAGE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');
    if (roleParam) {
      const err = validateEnum(roleParam, ['staff', 'manager', 'admin', 'superadmin', 'resident_care_of'], 'role');
      if (err) return Response.json(getValidationErrorResponse(err), { status: err.status });
    }
    const search = searchParams.get('search')?.trim() || '';
    const active = searchParams.get('active');
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const tenantKey = await getTenantKey(user.tenantId);

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ua.tenant_id = $1'];
      const params = [user.tenantId];
      if (roleParam) {
        params.push(roleParam);
        conditions.push(`ua.role = $${params.length}`);
      }
      if (active === '1' || active === '0') {
        params.push(active === '1');
        conditions.push(`ua.is_active = $${params.length}`);
      }
      if (!search) {
        params.push(limit, offset);
      }

      const { rows } = await client.query(
        `SELECT ua.id, ua.email, ua.role, ua.is_active, ua.last_login,
                ua.password_changed_at, ua.failed_attempts, ua.locked_until,
                ua.staff_id, ua.resident_id, ua.created_at,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name,
                r.first_name AS resident_first_name, r.last_name AS resident_last_name,
                COUNT(*) OVER() AS total_count
          FROM care.user_accounts ua
          LEFT JOIN ref.staff      s ON s.id = ua.staff_id
          LEFT JOIN care.residents r ON r.id = ua.resident_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY ua.created_at DESC
          ${search ? 'LIMIT 2000' : `LIMIT $${params.length - 1} OFFSET $${params.length}`}`,
        params
      );
      return rows;
    });

    let data = rows.map(row => {
      // Staff names are plaintext; resident names are encrypted.
      let firstName = row.staff_first_name || row.resident_first_name;
      let lastName = row.staff_last_name || row.resident_last_name;
      if (row.resident_first_name) {
        try {
          const dec = decryptFields(
            { first_name: row.resident_first_name, last_name: row.resident_last_name },
            ['first_name', 'last_name'],
            tenantKey
          );
          firstName = dec.first_name;
          lastName = dec.last_name;
        } catch { /* fall back to ciphertext, will display garbled */ }
      }
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        is_active: row.is_active,
        last_login: row.last_login,
        password_changed_at: row.password_changed_at,
        failed_attempts: row.failed_attempts,
        locked_until: row.locked_until,
        account_type: row.staff_id ? 'staff' : (row.resident_id ? 'resident' : 'unknown'),
        first_name: firstName,
        last_name: lastName,
        created_at: row.created_at,
      };
    });
    if (search) {
      const needle = search.toLowerCase();
      data = data.filter((row) =>
        [row.email, row.first_name, row.last_name, row.role]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }
    const total = search ? data.length : parseInt(rows[0]?.total_count || 0);
    data = data.slice(search ? offset : 0, search ? offset + limit : undefined);

    audit
      .logSelect({ tableName: 'care.user_accounts', req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

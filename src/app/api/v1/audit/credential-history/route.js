import { authenticate, authorize, handleError } from '@/lib/auth-guard';
import { withTenantClient } from '@/lib/db';
import { decryptFields } from '@/lib/encryption';
import { getTenantKey } from '@/lib/tenant-key';
import { PERMISSIONS } from '@/lib/roles';
import { getRequestContext } from '@/lib/request-context';

export async function GET(request) {
  const context = getRequestContext(request);

  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_AUDIT_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const staffId = url.searchParams.get('staff_id');
    const residentId = url.searchParams.get('resident_id');
    const userAccountId = url.searchParams.get('user_account_id');
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    let query = `
      SELECT
        ch.id,
        ch.user_account_id,
        ch.staff_id,
        ch.resident_id,
        ch.credential_type,
        ch.username,
        ch.was_temporary,
        ch.generated_by,
        ch.generated_at,
        ch.first_login_at,
        ch.password_changed_at,
        ch.reason,
        ch.notes,
        COALESCE(s.first_name || ' ' || s.last_name, 'Unknown') as generated_by_name,
        COALESCE(s2.first_name || ' ' || s2.last_name, 'Unknown') as staff_name,
        r.first_name as resident_first_name,
        r.last_name as resident_last_name
      FROM audit_log.credential_history ch
      LEFT JOIN ref.staff s ON ch.generated_by = s.id
      LEFT JOIN ref.staff s2 ON ch.staff_id = s2.id
      LEFT JOIN care.residents r ON ch.resident_id = r.id
      WHERE ch.tenant_id = $1
    `;

    const params = [user.tenantId];

    if (staffId) {
      query += ` AND ch.staff_id = $${params.length + 1}`;
      params.push(staffId);
    }

    if (residentId) {
      query += ` AND ch.resident_id = $${params.length + 1}`;
      params.push(residentId);
    }

    if (userAccountId) {
      query += ` AND ch.user_account_id = $${params.length + 1}`;
      params.push(userAccountId);
    }

    query += ` ORDER BY ch.generated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // The audit_log.credential_history table is not yet defined in the schema —
      // return an empty page rather than 500 so the UI degrades gracefully.
      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'audit_log' AND table_name = 'credential_history'`
      );
      if (!exists.rows.length) {
        return { data: [], pagination: { total: 0, limit, offset, pages: 0 } };
      }

      const { rows } = await client.query(query, params);
      const tenantKey = await getTenantKey(user.tenantId);
      const data = rows.map((row) => {
        const decrypted = decryptFields(row, ['resident_first_name', 'resident_last_name'], tenantKey);
        return {
          ...decrypted,
          resident_name:
            decrypted.resident_first_name || decrypted.resident_last_name
              ? `${decrypted.resident_first_name || ''} ${decrypted.resident_last_name || ''}`.trim()
              : 'Unknown',
          resident_first_name: undefined,
          resident_last_name: undefined,
        };
      });

      let countQuery = `SELECT COUNT(*) as count FROM audit_log.credential_history WHERE tenant_id = $1`;
      const countParams = [user.tenantId];
      if (staffId) { countQuery += ` AND staff_id = $${countParams.length + 1}`; countParams.push(staffId); }
      if (residentId) { countQuery += ` AND resident_id = $${countParams.length + 1}`; countParams.push(residentId); }
      if (userAccountId) { countQuery += ` AND user_account_id = $${countParams.length + 1}`; countParams.push(userAccountId); }
      const { rows: countRows } = await client.query(countQuery, countParams);
      const total = parseInt(countRows[0].count);

      return { data, pagination: { total, limit, offset, pages: Math.ceil(total / limit) } };
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return handleError(error, context);
  }
}

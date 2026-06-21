import { authenticate, handleError } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    const { rows } = await query(
      `SELECT ua.id, ua.email, ua.role, ua.staff_id, ua.resident_id,
              COALESCE(s.first_name, r.first_name) AS first_name,
              COALESCE(s.last_name,  r.last_name)  AS last_name,
              s.role AS staff_role,
              ua.tenant_id, ua.last_login, ua.password_changed_required
       FROM care.user_accounts ua
       LEFT JOIN ref.staff      s ON s.id = ua.staff_id
       LEFT JOIN care.residents r ON r.id = ua.resident_id
       WHERE ua.id = $1`,
      [user.id]
    );
    if (!rows.length) return Response.json({ error: 'User not found' }, { status: 404 });

    const row = rows[0];
    return Response.json({
      user: {
        ...row,
        id: row.id,
        email: row.email,
        role: row.role,
        staffId: row.staff_id,
        residentId: row.resident_id,
        firstName: row.first_name,
        lastName: row.last_name,
        tenantId: row.tenant_id,
        passwordChangedRequired: row.password_changed_required === true,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

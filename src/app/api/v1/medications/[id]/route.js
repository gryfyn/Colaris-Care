import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/medications/[id]
 * Get a single medication prescription with resident details.
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;
    const { id } = await params;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT m.*, r.first_name, r.last_name,
                s.first_name AS prescribed_by_first_name,
                s.last_name AS prescribed_by_last_name
           FROM care.medications m
           JOIN care.residents r ON r.id = m.resident_id
           LEFT JOIN ref.staff s ON s.id = m.created_by
          WHERE m.id = $1 AND m.tenant_id = $2`,
        [id, user.tenantId]
      );
      return rows[0];
    });

    if (!result) {
      return Response.json({ error: 'Medication not found' }, { status: 404 });
    }

    const tenantKey = getTenantKey();
    const data = decryptFields(result, ['first_name', 'last_name'], tenantKey);

    audit
      .logSelect({ tableName: 'care.medications', recordId: id, residentId: result.resident_id, req: getRequestContext(request, user) })

    return Response.json({ data });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/medications/[id]
 * Discontinue or update a prescription. Admin/manager only.
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;
    const { id } = await params;

    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Only admin or manager can modify prescriptions' }, { status: 403 });
    }

    const body = await request.json();
    const { is_active, discontinued_reason, end_date } = body;

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: existing } = await client.query(
        `SELECT id, resident_id, is_active FROM care.medications WHERE id = $1 AND tenant_id = $2`,
        [id, user.tenantId]
      );
      if (!existing.length) throw { status: 404, message: 'Medication not found' };

      const { rows } = await client.query(
        `UPDATE care.medications
            SET is_active = COALESCE($1, is_active),
                discontinued_reason = $2,
                discontinued_at = CASE WHEN $1 = FALSE THEN CURRENT_DATE ELSE NULL END,
                end_date = COALESCE($3, end_date),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND tenant_id = $5
        RETURNING id, resident_id, is_active, end_date`,
        [
          is_active === undefined ? null : is_active,
          discontinued_reason || null,
          end_date || null,
          id, user.tenantId,
        ]
      );
      return { row: rows[0], previous: existing[0] };
    });

    await audit.logUpdate({
      tableName: 'care.medications',
      recordId: id,
      residentId: updated.row.resident_id,
      oldValues: { is_active: updated.previous.is_active },
      newValues: { is_active: updated.row.is_active, discontinued_reason },
      diffKeys: ['is_active', 'discontinued_reason'],
      req: getRequestContext(request, user),
    });
    return Response.json({ data: updated.row });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

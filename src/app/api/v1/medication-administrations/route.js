import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
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
 * GET /api/v1/medication-administrations
 * View history of medication administrations.
 * Query params: medication_id, resident_id, date, status (given/refused/all),
 *               staff_only, limit
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const medicationId = searchParams.get('medication_id');
    const residentId = searchParams.get('resident_id');
    const date = searchParams.get('date');
    const status = searchParams.get('status'); // 'given' | 'refused' | 'all'
    const staffOnly = searchParams.get('staff_only') === '1';
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ma.tenant_id = $1'];
      const params = [user.tenantId];

      if (medicationId) {
        params.push(medicationId);
        conditions.push(`ma.medication_id = $${params.length}`);
      }
      if (residentId) {
        params.push(residentId);
        conditions.push(`ma.resident_id = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`DATE(ma.administered_at) = $${params.length}`);
      }
      if (status === 'given') conditions.push(`ma.was_refused = FALSE`);
      if (status === 'refused') conditions.push(`ma.was_refused = TRUE`);
      if (staffOnly) {
        params.push(user.staffId);
        conditions.push(`ma.administered_by = $${params.length}`);
      }
      params.push(limit);

      const { rows } = await client.query(
        `SELECT ma.id, ma.medication_id, ma.resident_id, ma.administered_at,
                ma.shift, ma.dose_given, ma.route_used,
                ma.was_refused, ma.refusal_reason, ma.side_effects_noted,
                ma.prn_reason, ma.notes,
                m.drug_name, m.drug_strength, m.dosage, m.frequency, m.is_prn,
                r.first_name, r.last_name,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name
           FROM care.medication_administrations ma
           JOIN care.medications m ON m.id = ma.medication_id
           JOIN care.residents r ON r.id = ma.resident_id
           LEFT JOIN ref.staff s ON s.id = ma.administered_by
          WHERE ${conditions.join(' AND ')}
          ORDER BY ma.administered_at DESC
          LIMIT $${params.length}`,
        params
      );
      return rows;
    });

    const tenantKey = getTenantKey();
    const data = rows.map(row => decryptFields(row, ['first_name', 'last_name'], tenantKey));

    audit
      .logSelect({ tableName: 'care.medication_administrations', residentId: null, req: getRequestContext(request, user) })

    return Response.json({ data });
  } catch (err) {
    return handleError(err);
  }
}

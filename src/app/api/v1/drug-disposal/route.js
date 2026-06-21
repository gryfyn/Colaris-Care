import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';
import { validateRequired, validateUUID, validateDateFormat, getValidationErrorResponse } from '@/lib/request-validator.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * POST /api/v1/drug-disposal
 * Submit a drug disposal record (pending admin/manager review).
 *
 * Body:
 *   resident_id (UUID, required)
 *   disposal_date (date, required) - YYYY-MM-DD format
 *   drug_name (string, required)
 *   drug_strength (string, optional)
 *   quantity_disposed (number, optional)
 *   quantity_unit (string, optional) - mg, ml, tablet, etc.
 *   disposal_reason (string, optional)
 *   disposal_reason_other (string, optional)
 *   disposal_method (string, optional)
 *   disposal_method_other (string, optional)
 *   counting_staff_name (string, optional)
 *   witness_name (string, optional)
 *   is_controlled_substance (boolean, optional, default: false)
 *
 * Auth: SAFETY_WRITE permission (staff, manager, admin, superadmin)
 * Response: { id, status: 'pending', message }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const user = authResult.user;

    if (!authorize(user.role, PERMISSIONS.SAFETY_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const {
      resident_id,
      disposal_date,
      drug_name,
      drug_strength,
      quantity_disposed,
      quantity_unit,
      disposal_reason,
      disposal_reason_other,
      disposal_method,
      disposal_method_other,
      counting_staff_name,
      witness_name,
      is_controlled_substance,
    } = data;

    const reqErr = validateRequired(data, ['resident_id', 'disposal_date', 'drug_name']);
    if (reqErr) return Response.json(getValidationErrorResponse(reqErr), { status: reqErr.status });
    if (!validateUUID(resident_id)) {
      return Response.json({ error: 'resident_id must be a valid UUID', field: 'resident_id' }, { status: 422 });
    }
    if (!validateDateFormat(disposal_date)) {
      return Response.json({ error: 'disposal_date must be YYYY-MM-DD', field: 'disposal_date' }, { status: 422 });
    }
    if (drug_name.length > 200) {
      return Response.json({ error: 'drug_name must be 200 chars or fewer', field: 'drug_name' }, { status: 422 });
    }
    if (quantity_disposed != null && (typeof quantity_disposed !== 'number' || quantity_disposed < 0)) {
      return Response.json({ error: 'quantity_disposed must be a non-negative number', field: 'quantity_disposed' }, { status: 422 });
    }

    const san = sanitizeFields(
      { drug_name, drug_strength, disposal_reason_other, disposal_method_other, counting_staff_name, witness_name },
      ['drug_name', 'drug_strength', 'disposal_reason_other', 'disposal_method_other', 'counting_staff_name', 'witness_name']
    );

    const record = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.drug_disposal_records (
          tenant_id, resident_id, disposal_date, drug_name, drug_strength,
          quantity_disposed, quantity_unit, disposal_reason, disposal_reason_other,
          disposal_method, disposal_method_other, counting_staff_name, witness_name,
          is_controlled_substance, counting_staff_id, review_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          user.tenantId, resident_id, disposal_date,
          san.drug_name, san.drug_strength,
          quantity_disposed, quantity_unit,
          disposal_reason, san.disposal_reason_other,
          disposal_method, san.disposal_method_other,
          san.counting_staff_name, san.witness_name,
          is_controlled_substance, user.staffId,
        ]
      );
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.drug_disposal_records',
      recordId: record.id,
      residentId: resident_id,
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: record.id,
      status: 'pending',
      message: 'Drug disposal record submitted for approval',
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * GET /api/v1/drug-disposal
 * List drug disposal records with optional filters. Staff users see only their own submissions.
 *
 * Query params:
 *   status (string, optional) - pending, approved, rejected
 *   date (date, optional) - filter by disposal_date (YYYY-MM-DD)
 *   staff_only (string, '1' for current user's records) - auto-enabled for staff role
 *   limit (integer, 1-200, default 100)
 *   offset (integer, default 0)
 *
 * Auth: SAFETY_READ permission (staff, manager, admin, superadmin)
 * Staff role automatically filters to their own submitted records.
 * Response: { data: [...], pagination: { limit, offset, total, pages } }
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const user = authResult.user;

    if (!authorize(user.role, PERMISSIONS.SAFETY_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const staffOnly = searchParams.get('staff_only') === '1';
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ddr.tenant_id = $1'];
      const params = [user.tenantId];

      if (status) {
        params.push(status);
        conditions.push(`ddr.review_status = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`ddr.disposal_date = $${params.length}`);
      }
      if (staffOnly) {
        params.push(user.staffId);
        conditions.push(`ddr.counting_staff_id = $${params.length}`);
      }
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT ddr.id, ddr.resident_id, ddr.disposal_date, ddr.drug_name, ddr.drug_strength,
                ddr.quantity_disposed, ddr.quantity_unit, ddr.disposal_reason, ddr.disposal_reason_other,
                ddr.disposal_method, ddr.disposal_method_other,
                ddr.is_controlled_substance, ddr.review_status, ddr.reviewed_at, ddr.review_notes,
                ddr.counting_staff_name, ddr.witness_name, ddr.created_at,
                cr.first_name, cr.last_name,
                rs.first_name AS staff_first_name, rs.last_name AS staff_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.drug_disposal_records ddr
           LEFT JOIN care.residents cr ON cr.id = ddr.resident_id
           LEFT JOIN ref.staff rs ON rs.id = ddr.counting_staff_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY ddr.disposal_date DESC, ddr.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);

    // Decrypt resident names
    const tenantKey = getTenantKey();
    const data = rows.map(row => {
      const { total_count, ...rest } = row;
      return decryptFields(rest, ['first_name', 'last_name'], tenantKey);
    });

    audit
      .logSelect({ tableName: 'care.drug_disposal_records', residentId: null, req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentScope } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/medications
 * List medications with optional filters. Staff users see only medications for their assigned residents.
 *
 * Query params:
 *   resident_id   - filter by specific resident (UUID)
 *   search        - search by drug name or resident name (substring, case-insensitive)
 *   active        - 'true' to filter active only (default: true)
 *   staff_only    - '1' to filter to residents assigned to current staff (default: auto-enabled for staff role)
 *   limit         - items per page (1-200, default 50)
 *   offset        - pagination offset (default 0)
 *
 * Auth: RESIDENTS_READ permission (staff, manager, admin, superadmin)
 * Staff role automatically filters results to assigned residents for data integrity.
 *
 * Response: { data: [...], pagination: { limit, offset, total, pages } }
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
    const residentId = searchParams.get('resident_id');
    const search = searchParams.get('search')?.trim();
    const activeOnly = searchParams.get('active') !== 'false';
    const staffOnly = staffAssignmentScope(user, searchParams.get('staff_only'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['m.tenant_id = $1'];
      const params = [user.tenantId];
      let joinStaffAssignments = '';

      if (activeOnly) {
        conditions.push(`m.is_active = TRUE`);
      }
      if (residentId) {
        params.push(residentId);
        conditions.push(`m.resident_id = $${params.length}`);
      }
      if (staffOnly) {
        joinStaffAssignments = 'JOIN care.staff_assignments sa ON sa.resident_id = m.resident_id AND sa.is_active = TRUE';
        params.push(user.staffId);
        conditions.push(`sa.staff_id = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`m.drug_name ILIKE $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT m.id, m.resident_id, m.drug_name, m.drug_strength, m.drug_form,
                m.dosage, m.route, m.frequency, m.prescriber, m.indication,
                m.start_date, m.end_date,
                m.is_active, m.is_controlled_substance, m.is_prn, m.prn_instructions,
                m.special_instructions, m.created_at,
                r.first_name, r.last_name,
                s.first_name AS prescribed_by_first_name, s.last_name AS prescribed_by_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.medications m
           JOIN care.residents r ON r.id = m.resident_id
           LEFT JOIN ref.staff s ON s.id = m.created_by
           ${joinStaffAssignments}
          WHERE ${where}
          ORDER BY r.last_name, r.first_name, m.drug_name
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(result[0]?.total_count || 0);

    // Decrypt resident PHI
    const tenantKey = getTenantKey();
    const data = result.map(row => {
      const { total_count, ...rest } = row;
      return decryptFields(rest, ['first_name', 'last_name'], tenantKey);
    });

    audit
      .logSelect({ tableName: 'care.medications', residentId: null, req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/medications
 * Create a new medication prescription.
 *
 * Body:
 *   resident_id (UUID, required)
 *   drug_name (string, required)
 *   drug_strength (string, optional)
 *   drug_form (string, optional)
 *   dosage (string, required)
 *   route (string, required) - one of: oral, sublingual, topical, injection, inhalation, transdermal, other
 *   frequency (string, required) - e.g., "BID", "TID", "QID", "once daily"
 *   prescriber (string, required) - provider name
 *   pharmacy (string, optional)
 *   rx_number (string, optional)
 *   indication (string, optional)
 *   start_date (date, required) - YYYY-MM-DD format
 *   end_date (date, optional) - YYYY-MM-DD format
 *   is_controlled_substance (boolean, optional, default: false)
 *   is_prn (boolean, optional, default: false)
 *   prn_instructions (string, optional) - instructions for PRN medications
 *   special_instructions (string, optional)
 *
 * Auth: admin, manager, or superadmin role only.
 * Response: { data: { id, resident_id, drug_name, dosage, route, frequency, start_date, created_at } }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json(
        { error: 'Only admin or manager can prescribe medications' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      resident_id,
      drug_name,
      drug_strength,
      drug_form,
      dosage,
      route,
      frequency,
      prescriber,
      pharmacy,
      rx_number,
      indication,
      start_date,
      end_date,
      is_controlled_substance,
      is_prn,
      prn_instructions,
      special_instructions,
    } = body;

    if (!resident_id || !drug_name || !dosage || !route || !frequency || !prescriber || !start_date) {
      return Response.json(
        { error: 'resident_id, drug_name, dosage, route, frequency, prescriber, and start_date are required' },
        { status: 422 }
      );
    }

    const validRoutes = ['oral', 'sublingual', 'topical', 'injection', 'inhalation', 'transdermal', 'other'];
    if (!validRoutes.includes(route)) {
      return Response.json({ error: `Invalid route. Must be one of: ${validRoutes.join(', ')}` }, { status: 400 });
    }

    const san = sanitizeFields(
      { drug_name, drug_strength, drug_form, dosage, frequency, prescriber, pharmacy, rx_number, indication, prn_instructions, special_instructions },
      ['drug_name', 'drug_strength', 'drug_form', 'dosage', 'frequency', 'prescriber', 'pharmacy', 'rx_number', 'indication', 'prn_instructions', 'special_instructions']
    );

    const medication = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: residentRows } = await client.query(
        'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );
      if (!residentRows.length) throw { status: 404, message: 'Resident not found' };

      const { rows } = await client.query(
        `INSERT INTO care.medications (
           tenant_id, resident_id, drug_name, drug_strength, drug_form,
           dosage, route, frequency, prescriber, pharmacy, rx_number,
           indication, start_date, end_date,
           is_controlled_substance, is_prn,
           prn_instructions, special_instructions, is_active, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, TRUE, $19)
         RETURNING id, resident_id, drug_name, dosage, route, frequency, start_date, created_at`,
        [
          user.tenantId, resident_id,
          san.drug_name, san.drug_strength, san.drug_form,
          san.dosage, route, san.frequency, san.prescriber, san.pharmacy, san.rx_number,
          san.indication, start_date, end_date || null,
          is_controlled_substance || false, is_prn || false,
          san.prn_instructions, san.special_instructions, user.staffId,
        ]
      );
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.medications',
      recordId: medication.id,
      residentId: resident_id,
      req: getRequestContext(request, user),
    });
    return Response.json({ data: medication }, { status: 201 });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

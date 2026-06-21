import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/staff/medications
 * List medications filtered by resident/staff with pagination.
 * Query params: resident_id, staff_id, is_active, limit (1-200, default 50), offset (default 0)
 * Requires RESIDENTS_READ permission.
 *
 * Response: {
 *   data: [
 *     {
 *       id, resident_id, resident_name,
 *       drug_name, drug_strength, dosage, route, frequency,
 *       is_active, is_controlled_substance, is_prn,
 *       start_date, end_date, created_by, created_at, updated_at
 *     }
 *   ],
 *   pagination: { limit, offset, total, pages }
 * }
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
    const staffId = searchParams.get('staff_id');
    const isActive = searchParams.get('is_active');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['m.tenant_id = $1'];
      const params = [user.tenantId];

      if (residentId) {
        params.push(residentId);
        conditions.push(`m.resident_id = $${params.length}`);
      }

      if (staffId) {
        params.push(staffId);
        conditions.push(`sa.staff_id = $${params.length}`);
      }

      if (isActive !== null && isActive !== undefined) {
        const activeVal = isActive === 'true' || isActive === '1';
        params.push(activeVal);
        conditions.push(`m.is_active = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT m.id, m.resident_id, m.drug_name, m.drug_strength, m.drug_form,
                m.dosage, m.route, m.frequency, m.rx_number,
                m.is_active, m.is_controlled_substance, m.is_prn, m.prn_instructions,
                m.special_instructions, m.start_date, m.end_date,
                m.prescriber, m.pharmacy, m.indication,
                m.created_by, m.created_at, m.updated_at,
                r.first_name, r.last_name,
                s.first_name AS creator_first_name, s.last_name AS creator_last_name,
                COUNT(*) OVER() AS total_count
         FROM care.medications m
         JOIN care.residents r ON r.id = m.resident_id
         LEFT JOIN ref.staff s ON s.id = m.created_by
         ${staffId ? 'JOIN care.staff_assignments sa ON sa.resident_id = m.resident_id' : ''}
         WHERE ${where}
         ORDER BY m.start_date DESC NULLS LAST, r.last_name, r.first_name
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = result[0]?.total_count || 0;
    await audit.logSelect({
      tableName: 'care.medications',
      residentId: null,
      req: { user },
    });
    return Response.json({
      data: result,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/staff/medications
 * Create a new medication record.
 * Requires RESIDENTS_UPDATE permission (staff/manager/admin/superadmin).
 *
 * Request body: {
 *   resident_id: UUID,
 *   drug_name: string,
 *   drug_strength: string (optional),
 *   drug_form: string (optional),
 *   dosage: string,
 *   route: 'oral' | 'sublingual' | 'topical' | 'injection' | 'inhalation' | 'transdermal' | 'other',
 *   frequency: string,
 *   prescriber: string,
 *   pharmacy: string (optional),
 *   rx_number: string (optional),
 *   indication: string (optional),
 *   start_date: DATE,
 *   is_controlled_substance: boolean (default false),
 *   is_prn: boolean (default false),
 *   prn_instructions: string (optional),
 *   special_instructions: string (optional)
 * }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      is_controlled_substance,
      is_prn,
      prn_instructions,
      special_instructions,
    } = await request.json();

    // Validate required fields
    if (!resident_id || !drug_name || !dosage || !route || !frequency || !prescriber || !start_date) {
      return Response.json(
        { error: 'resident_id, drug_name, dosage, route, frequency, prescriber, and start_date are required' },
        { status: 422 }
      );
    }

    // Validate route enum
    const validRoutes = ['oral', 'sublingual', 'topical', 'injection', 'inhalation', 'transdermal', 'other'];
    if (!validRoutes.includes(route)) {
      return Response.json({ error: `Invalid route. Must be one of: ${validRoutes.join(', ')}` }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify resident exists
      const { rows: residentRows } = await client.query(
        'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2',
        [resident_id, user.tenantId]
      );
      if (!residentRows.length) {
        throw { message: 'Resident not found', status: 404 };
      }

      // Create medication record
      const { rows: [medication] } = await client.query(
        `INSERT INTO care.medications (
           tenant_id, resident_id, drug_name, drug_strength, drug_form,
           dosage, route, frequency, prescriber, pharmacy, rx_number,
           indication, start_date, is_controlled_substance, is_prn,
           prn_instructions, special_instructions, is_active, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, $18)
         RETURNING id, resident_id, drug_name, dosage, route, frequency, start_date, created_at`,
        [
          user.tenantId, resident_id, drug_name, drug_strength, drug_form,
          dosage, route, frequency, prescriber, pharmacy, rx_number,
          indication, start_date, is_controlled_substance || false, is_prn || false,
          prn_instructions, special_instructions, user.staffId,
        ]
      );
      return medication;
    });

    await audit.logInsert({
      tableName: 'care.medications',
      recordId: result.id,
      residentId: resident_id,
      req: { user },
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

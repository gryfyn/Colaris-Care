import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/staff/certifications
 * List staff certifications with pagination.
 * Query params: staff_id, certification_type, limit (1-200, default 50), offset (default 0)
 * Requires STAFF_READ permission.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staff_id');
    const certificationType = searchParams.get('certification_type');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['sc.tenant_id = $1'];
      const params = [user.tenantId];

      if (staffId) {
        params.push(staffId);
        conditions.push(`sc.staff_id = $${params.length}`);
      }

      if (certificationType) {
        params.push(`%${certificationType}%`);
        conditions.push(`sc.certification_type ILIKE $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT sc.id, sc.staff_id, sc.certification_type, sc.certification_name,
                sc.certificate_no, sc.issued_date, sc.expiry_date, sc.verified_date,
                s.first_name, s.last_name,
                sv.first_name AS verified_by_first_name, sv.last_name AS verified_by_last_name,
                sc.notes, sc.created_at, sc.updated_at,
                COUNT(*) OVER() AS total_count
         FROM ref.staff_certifications sc
         JOIN ref.staff s ON s.id = sc.staff_id
         LEFT JOIN ref.staff sv ON sv.id = sc.verified_by
         WHERE ${where}
         ORDER BY s.last_name, s.first_name, sc.certification_type
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = result[0]?.total_count || 0;
    await audit.logSelect({
      tableName: 'ref.staff_certifications',
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
 * POST /api/v1/staff/certifications
 * Add a new certification for a staff member.
 * Requires STAFF_WRITE permission.
 *
 * Request body: {
 *   staff_id: UUID,
 *   certification_type: string,
 *   certification_name: string (optional),
 *   certificate_no: string (optional),
 *   issued_date: DATE,
 *   expiry_date: DATE (optional),
 *   notes: string (optional)
 * }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      staff_id,
      certification_type,
      certification_name,
      certificate_no,
      issued_date,
      expiry_date,
      notes,
    } = await request.json();

    // Validate required fields
    if (!staff_id || !certification_type || !issued_date) {
      return Response.json(
        { error: 'staff_id, certification_type, and issued_date are required' },
        { status: 422 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify staff exists
      const { rows: staffRows } = await client.query(
        'SELECT id FROM ref.staff WHERE id = $1 AND tenant_id = $2',
        [staff_id, user.tenantId]
      );
      if (!staffRows.length) {
        throw { message: 'Staff member not found', status: 404 };
      }

      // Create certification record
      const { rows: [cert] } = await client.query(
        `INSERT INTO ref.staff_certifications (
           tenant_id, staff_id, certification_type, certification_name,
           certificate_no, issued_date, expiry_date, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, staff_id, certification_type, certification_name, issued_date, expiry_date, created_at`,
        [user.tenantId, staff_id, certification_type, certification_name, certificate_no, issued_date, expiry_date, notes]
      );
      return cert;
    });

    await audit.logInsert({
      tableName: 'ref.staff_certifications',
      recordId: result.id,
      residentId: null,
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

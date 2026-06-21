import { authenticate, authorize, guardResidentAccess, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();
const normalizeRequestStatus = (status) => (status === 'completed' ? 'fulfilled' : status);

/**
 * GET /api/v1/resident-requests
 * List resident requests with optional filters.
 * - Residents (resident_care_of) see only their own requests
 * - Staff, manager, admin see all requests in their tenant
 *
 * Query params:
 *   resident_id  - filter by specific resident (UUID)
 *   status       - filter by status (pending, approved, denied, fulfilled)
 *   page         - pagination page (default 1)
 *   limit        - items per page (default 25, max 100)
 *
 * Auth: Any authenticated user (resident, staff, manager, admin)
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const residentIdParam = searchParams.get('resident_id');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    let residentIdFilter = residentIdParam;

    // If resident_care_of, ensure they only see their own requests
    if (user.role === ROLES.RESIDENT_CARE_OF) {
      const guardResult = await guardResidentAccess(user, residentIdParam);
      if (guardResult && guardResult.error) {
        return Response.json({ error: guardResult.error }, { status: guardResult.status });
      }
      residentIdFilter = guardResult?.linkedResidentId;
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['rr.tenant_id = $1'];
      const params = [user.tenantId];

      if (residentIdFilter) {
        params.push(residentIdFilter);
        conditions.push(`rr.resident_id = $${params.length}`);
      }

      if (status) {
        if (status === 'fulfilled') {
          params.push(status);
          conditions.push(`(rr.status = $${params.length} OR rr.status = 'completed')`);
        } else {
          params.push(status);
          conditions.push(`rr.status = $${params.length}`);
        }
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT rr.id, rr.tenant_id, rr.resident_id, rr.request_type, rr.details,
                rr.status, rr.response_notes AS response, rr.handled_by AS responded_by,
                rr.completed_date AS responded_at, rr.submitted_date,
                rr.created_at, rr.updated_at,
                r.first_name, r.last_name,
                COUNT(*) OVER() AS total_count
           FROM care.resident_requests rr
           JOIN care.residents r ON r.id = rr.resident_id
          WHERE ${where} AND rr.deleted_at IS NULL
          ORDER BY rr.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(result[0]?.total_count || 0);

    const req = getRequestContext(request, user);
    await audit
      .logSelect({ tableName: 'care.resident_requests', req })

    return Response.json({
      data: result.map(row => {
        const { total_count, ...rest } = row;
        return { ...rest, status: normalizeRequestStatus(rest.status) };
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/resident-requests
 * Create a new resident request.
 *
 * Body:
 *   resident_id (UUID, required unless resident_care_of — auto-filled)
 *   request_type (string, required)
 *   details (string, required)
 *   priority (string, optional) - 'low', 'normal', 'high' (default: 'normal')
 *
 * Auth: Any authenticated user
 * - If resident_care_of, resident_id is auto-set to their linked resident
 * - If staff/manager/admin, resident_id must be provided
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const body = await request.json();
    let { resident_id, request_type, details } = body;

    // If resident_care_of, auto-fill resident_id from their linked account
    if (user.role === ROLES.RESIDENT_CARE_OF) {
      const guardResult = await guardResidentAccess(user);
      if (guardResult && guardResult.error) {
        return Response.json({ error: guardResult.error }, { status: guardResult.status });
      }
      resident_id = guardResult?.linkedResidentId;
    }

    if (!resident_id || !request_type || !details) {
      return Response.json(
        { error: 'resident_id, request_type, and details are required' },
        { status: 422 }
      );
    }

    const newRequest = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Verify resident exists
      const { rows: residentRows } = await client.query(
        'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );
      if (!residentRows.length) throw { status: 404, message: 'Resident not found' };

      const { rows } = await client.query(
        `INSERT INTO care.resident_requests (
           tenant_id, resident_id, request_type, details, status, submitted_date, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 'pending', CURRENT_DATE, NOW(), NOW())
         RETURNING id, resident_id, request_type, details, status, submitted_date, created_at, updated_at`,
        [user.tenantId, resident_id, request_type, details]
      );
      return rows[0];
    });

    const req = getRequestContext(request, user);
    await audit
      .logInsert({
        tableName: 'care.resident_requests',
        recordId: newRequest.id,
        residentId: resident_id,
        req,
      })

    return Response.json({ data: newRequest }, { status: 201 });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

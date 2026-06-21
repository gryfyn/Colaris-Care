import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';
import { validateRequired, validateEnum, validateDateFormat, getValidationErrorResponse } from '@/lib/request-validator.js';

const audit = new AuditLogger();

/**
 * POST /api/v1/evacuation-drills
 * Submit an evacuation drill record (pending admin/manager review).
 *
 * Body:
 *   drill_date (date, required) - YYYY-MM-DD format
 *   drill_time (time, required) - HH:MM format
 *   drill_type (string, required) - type of drill (fire, weather, etc.)
 *   location_evacuated_to (string, optional)
 *   residents_present (array, optional) - list of resident IDs
 *   evacuation_time_seconds (number, optional)
 *   all_residents_accounted (boolean, optional)
 *   issues_noted (string, optional)
 *   conducted_by_signature (string, optional)
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

    const body = await request.json();
    const {
      drill_date,
      drill_time,
      drill_type,
      location_evacuated_to,
      residents_present,
      evacuation_time_seconds,
      all_residents_accounted,
      issues_noted,
      conducted_by_signature,
    } = body;

    const reqErr = validateRequired(body, ['drill_date', 'drill_time', 'drill_type']);
    if (reqErr) return Response.json(getValidationErrorResponse(reqErr), { status: reqErr.status });
    if (!validateDateFormat(drill_date)) {
      return Response.json({ error: 'drill_date must be YYYY-MM-DD', field: 'drill_date' }, { status: 422 });
    }
    if (!/^\d{2}:\d{2}$/.test(drill_time)) {
      return Response.json({ error: 'drill_time must be HH:MM', field: 'drill_time' }, { status: 422 });
    }
    const typeErr = validateEnum(drill_type, ['fire', 'weather', 'earthquake', 'lockdown', 'medical', 'other'], 'drill_type');
    if (typeErr) return Response.json(getValidationErrorResponse(typeErr), { status: typeErr.status });
    if (evacuation_time_seconds != null && (typeof evacuation_time_seconds !== 'number' || evacuation_time_seconds < 0)) {
      return Response.json({ error: 'evacuation_time_seconds must be a non-negative number', field: 'evacuation_time_seconds' }, { status: 422 });
    }

    const san = sanitizeFields(
      { location_evacuated_to, issues_noted, conducted_by_signature },
      ['location_evacuated_to', 'issues_noted', 'conducted_by_signature']
    );

    const drill = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.evacuation_drills (
          tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to,
          residents_present, evacuation_time_seconds, all_residents_accounted,
          issues_noted, conducted_by_staff_id, conducted_by_signature,
          review_status, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          user.tenantId,
          user.staffId,
          drill_date,
          drill_time,
          drill_type,
          san.location_evacuated_to,
          JSON.stringify(residents_present || []),
          evacuation_time_seconds,
          all_residents_accounted || false,
          san.issues_noted,
          user.staffId,
          san.conducted_by_signature,
        ]
      );
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.evacuation_drills',
      recordId: drill.id,
      residentId: null,
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: drill.id,
      status: 'pending',
      message: 'Evacuation drill submitted for approval',
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * GET /api/v1/evacuation-drills
 * List evacuation drills with optional filters. Staff users see only their own submissions.
 *
 * Query params:
 *   status (string, optional) - pending, approved, rejected
 *   date (date, optional) - filter by drill_date (YYYY-MM-DD)
 *   staff_only (string, '1' for current user's drills) - auto-enabled for staff role
 *   limit (integer, 1-200, default 100)
 *   offset (integer, default 0)
 *
 * Auth: SAFETY_READ permission (staff, manager, admin, superadmin)
 * Staff role automatically filters to their own submitted drills.
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
      const conditions = ['ed.tenant_id = $1'];
      const params = [user.tenantId];

      if (status) {
        params.push(status);
        conditions.push(`ed.review_status = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`ed.drill_date = $${params.length}`);
      }
      if (staffOnly) {
        params.push(user.staffId);
        conditions.push(`(ed.staff_id = $${params.length} OR ed.conducted_by_staff_id = $${params.length})`);
      }
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT ed.id, ed.drill_date, ed.drill_time, ed.drill_type,
                ed.location_evacuated_to, ed.evacuation_time_seconds,
                ed.residents_present, ed.all_residents_accounted, ed.issues_noted,
                ed.conducted_by_signature,
                ed.review_status, ed.reviewed_at, ed.review_notes,
                ed.created_at,
                rs.first_name AS staff_first_name, rs.last_name AS staff_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.evacuation_drills ed
           LEFT JOIN ref.staff rs ON rs.id = ed.staff_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY ed.drill_date DESC, ed.drill_time DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);

    const data = rows.map(row => {
      const { total_count, ...rest } = row;
      return rest;
    });

    audit
      .logSelect({ tableName: 'care.evacuation_drills', residentId: null, req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

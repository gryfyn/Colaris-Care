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
 * POST /api/v1/incidents
 * Submit an incident report (pending admin/manager review).
 *
 * Body:
 *   resident_id (UUID, required)
 *   incident_date (date, required) - YYYY-MM-DD format
 *   incident_time (time, required) - HH:MM format
 *   incident_types (array, optional) - list of incident types
 *   location (string, optional)
 *   other_residents_involved (boolean, optional)
 *   witnessed (boolean, optional)
 *   witnessed_by (string, optional)
 *   body_areas_injured (object, optional)
 *   incident_details (string, optional)
 *   staff_actions_taken (string, optional)
 *   follow_up_plan (string, optional)
 *   notifications (array, optional) - list of staff to notify
 *   completed_by_name (string, optional)
 *   completed_by_signature (string, optional) - stored as licensee_signature
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
      resident_id,
      incident_date,
      incident_time,
      incident_types,
      location,
      other_residents_involved,
      witnessed,
      witnessed_by,
      body_areas_injured,
      incident_details,
      staff_actions_taken,
      follow_up_plan,
      notifications,
      completed_by_name,
      completed_by_signature,
    } = body;

    const requiredError = validateRequired(body, ['resident_id', 'incident_date', 'incident_time']);
    if (requiredError) {
      return Response.json(getValidationErrorResponse(requiredError));
    }

    if (!validateUUID(resident_id)) {
      return Response.json({ error: 'resident_id must be a valid UUID', field: 'resident_id' }, { status: 422 });
    }

    if (!validateDateFormat(incident_date)) {
      return Response.json({ error: 'incident_date must be YYYY-MM-DD format', field: 'incident_date' }, { status: 422 });
    }

    const sanitized = sanitizeFields(
      { incident_details, staff_actions_taken, follow_up_plan, location, witnessed_by, completed_by_name, completed_by_signature },
      ['incident_details', 'staff_actions_taken', 'follow_up_plan', 'location', 'witnessed_by', 'completed_by_name', 'completed_by_signature']
    );

    const incident = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.incident_reports (
          tenant_id, resident_id, incident_date, incident_time,
          incident_type, incident_location, other_residents_involved,
          was_witnessed, witnessed_by, body_areas_injured,
          incident_details, staff_actions_taken, follow_up_plan,
          completed_by_name, completed_by_staff_id,
          licensee_signature,
          review_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          user.tenantId,
          resident_id,
          incident_date,
          incident_time,
          incident_types && Array.isArray(incident_types) && incident_types.length > 0 ? incident_types[0] : 'other',
          sanitized.location,
          other_residents_involved,
          witnessed || false,
          sanitized.witnessed_by,
          JSON.stringify(body_areas_injured || {}),
          sanitized.incident_details,
          sanitized.staff_actions_taken,
          sanitized.follow_up_plan,
          sanitized.completed_by_name,
          user.staffId,
          sanitized.completed_by_signature,
        ]
      );
      return rows[0];
    });

    if (notifications && Array.isArray(notifications)) {
      await withTenantClient(user.tenantId, user.staffId, async (client) => {
        for (const notif of notifications) {
          await client.query(
            `INSERT INTO care.incident_notifications (
              incident_id, tenant_id, notified_party, was_notified, contact_name, notified_date, notified_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [incident.id, user.tenantId, notif.party, notif.was_notified || false, notif.contact_name, notif.notified_date, notif.notified_time]
          );
        }
      });
    }

    await audit.logInsert({
      tableName: 'care.incident_reports',
      recordId: incident.id,
      residentId: resident_id,
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: incident.id,
      status: 'pending',
      message: 'Incident report submitted for approval',
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * GET /api/v1/incidents
 * List incident reports with optional filters. Staff users see only their own submitted reports.
 *
 * Query params:
 *   status (string, optional) - pending, approved, rejected
 *   date (date, optional) - filter by incident_date (YYYY-MM-DD)
 *   resident_id (UUID, optional) - filter by resident
 *   staff_only (string, '1' for current user's reports) - auto-enabled for staff role
 *   limit (integer, 1-200, default 100)
 *   offset (integer, default 0)
 *
 * Auth: SAFETY_READ permission (staff, manager, admin, superadmin)
 * Staff role automatically filters to their own submitted reports.
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
    const residentId = searchParams.get('resident_id');
    const staffOnly = searchParams.get('staff_only') === '1';
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['ir.tenant_id = $1', 'ir.deleted_at IS NULL'];
      const params = [user.tenantId];

      if (status) {
        params.push(status);
        conditions.push(`ir.review_status = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`ir.incident_date = $${params.length}`);
      }
      if (residentId) {
        params.push(residentId);
        conditions.push(`ir.resident_id = $${params.length}`);
      }
      if (staffOnly) {
        params.push(user.staffId);
        conditions.push(`ir.completed_by_staff_id = $${params.length}`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT ir.id, ir.resident_id, ir.incident_date, ir.incident_time,
                ir.incident_type, ir.incident_location, ir.completed_by_name,
                ir.other_residents_involved, ir.was_witnessed, ir.witnessed_by,
                ir.body_areas_injured, ir.licensee_signature AS completed_by_signature,
                ir.review_status, ir.reviewed_at, ir.review_notes,
                ir.incident_details, ir.staff_actions_taken, ir.follow_up_plan,
                ir.created_at, ir.updated_at,
                COALESCE(inotif.notifications, '[]'::json) AS notifications,
                cr.first_name, cr.last_name,
                rs.first_name AS staff_first_name, rs.last_name AS staff_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.incident_reports ir
           LEFT JOIN care.residents cr ON cr.id = ir.resident_id
           LEFT JOIN ref.staff rs ON rs.id = ir.completed_by_staff_id
           LEFT JOIN LATERAL (
             SELECT json_agg(
                      json_build_object(
                        'notified_party', ino.notified_party,
                        'was_notified', ino.was_notified,
                        'contact_name', ino.contact_name,
                        'notified_date', ino.notified_date,
                        'notified_time', ino.notified_time
                      )
                      ORDER BY ino.notified_party
                    ) AS notifications
               FROM care.incident_notifications ino
              WHERE ino.incident_id = ir.id
           ) inotif ON true
          WHERE ${where}
          ORDER BY ir.incident_date DESC, ir.incident_time DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);

    // Decrypt resident PHI names
    const tenantKey = getTenantKey();
    const data = rows.map(row => {
      const { total_count, ...rest } = row;
      return decryptFields(rest, ['first_name', 'last_name'], tenantKey);
    });

    audit
      .logSelect({ tableName: 'care.incident_reports', residentId: null, req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

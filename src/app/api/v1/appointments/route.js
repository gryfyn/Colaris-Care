import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptPHI } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentScope, staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyString =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyString).toString('hex').slice(0, 64).padEnd(64, '0');
}

function safeDecrypt(value, key) {
  if (!value) return '';
  try { return decryptPHI(value, key) || ''; } catch { return ''; }
}

async function ensureFacilityEventSchema(client) {
  try {
    await client.query(`
      ALTER TABLE IF EXISTS care.appointments
        ADD COLUMN IF NOT EXISTS is_facility_event BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE IF EXISTS care.appointments
        ALTER COLUMN resident_id DROP NOT NULL
    `);
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE care.appointments
          DROP CONSTRAINT IF EXISTS appointments_resident_required_for_non_facility;

        ALTER TABLE care.appointments
          ADD CONSTRAINT appointments_resident_required_for_non_facility
          CHECK (is_facility_event = TRUE OR resident_id IS NOT NULL);
      END $$
    `);
  } catch {
    // Some production DB roles can read/write data but not run DDL. The route
    // below adapts to the existing schema if this migration guard cannot run.
  }

  const { rows } = await client.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'care'
      AND table_name = 'appointments'
      AND column_name IN ('resident_id', 'is_facility_event')
  `);
  return {
    hasFacilityEventColumn: rows.some(row => row.column_name === 'is_facility_event'),
    residentIdNullable: rows.some(row => row.column_name === 'resident_id' && row.is_nullable === 'YES'),
  };
}

async function findFallbackResidentId(client, tenantId) {
  const { rows } = await client.query(
    `SELECT id
       FROM care.residents
      WHERE tenant_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId]
  );
  return rows[0]?.id || null;
}

/**
 * GET /api/v1/appointments
 * List appointments with optional filters and pagination.
 * Staff users see only appointments for their assigned residents.
 *
 * Query params:
 *   resident_id   - filter by specific resident (UUID)
 *   staff_id      - filter by staff member (UUID, admin only)
 *   status        - filter by status (scheduled, completed, cancelled, no_show)
 *   date_from     - start date (YYYY-MM-DD)
 *   date_to       - end date (YYYY-MM-DD)
 *   limit         - items per page (1-200, default 50)
 *   offset        - pagination offset (default 0)
 *
 * Auth: RESIDENTS_READ permission
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
    const staffId = searchParams.get('staff_id');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const schema = await ensureFacilityEventSchema(client);

      const conditions = ['a.tenant_id = $1'];
      const params = [user.tenantId];
      let joinStaffAssignments = '';
      const facilitySelect = schema.hasFacilityEventColumn
        ? 'a.is_facility_event'
        : 'FALSE AS is_facility_event';

      if (residentId) {
        params.push(residentId);
        conditions.push(`a.resident_id = $${params.length}`);
      }

      if (staffId && ['admin', 'manager', 'superadmin'].includes(user.role)) {
        params.push(staffId);
        conditions.push(`a.staff_id = $${params.length}`);
      } else if (staffAssignmentScope(user, searchParams.get('staff_only'))) {
        joinStaffAssignments = 'JOIN care.staff_assignments sa ON sa.resident_id = a.resident_id AND sa.is_active = TRUE';
        params.push(user.staffId);
        conditions.push(`sa.staff_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`a.status = $${params.length}`);
      }

      if (dateFrom) {
        params.push(dateFrom);
        conditions.push(`a.scheduled_at >= $${params.length}::date`);
      }

      if (dateTo) {
        params.push(dateTo);
        conditions.push(`a.scheduled_at <= ($${params.length}::date + '1 day'::interval)`);
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT a.id, a.resident_id, a.staff_id, a.appointment_type, a.title, a.description,
                a.location, a.scheduled_at, a.duration_minutes, a.status, a.notes, a.created_at,
                ${facilitySelect},
                r.first_name, r.last_name,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name,
                COUNT(*) OVER() AS total_count
           FROM care.appointments a
           LEFT JOIN care.residents r ON r.id = a.resident_id
           LEFT JOIN ref.staff s ON s.id = a.staff_id
           ${joinStaffAssignments}
          WHERE ${where}
          ORDER BY a.scheduled_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(result[0]?.total_count || 0);
    const tenantKey = getTenantKey();
    const data = result.map(({ total_count, first_name, last_name, ...rest }) => ({
      ...rest,
      first_name: safeDecrypt(first_name, tenantKey),
      last_name:  safeDecrypt(last_name,  tenantKey),
    }));

    await audit.logSelect({
      tableName: 'care.appointments',
      residentId: null,
      req: getRequestContext(request, user),
    });
    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/appointments
 * Create a new appointment.
 *
 * Body:
 *   resident_id (UUID, required)
 *   staff_id (UUID, optional)
 *   appointment_type (string, required) - e.g., medical, therapy, social, other
 *   title (string, required)
 *   description (string, optional)
 *   location (string, optional)
 *   scheduled_at (datetime, required) - ISO 8601 format
 *   duration_minutes (integer, optional, default 30)
 *   status (string, optional, default: scheduled) - scheduled, completed, cancelled, no_show
 *   notes (string, optional)
 *
 * Auth: admin, manager, or staff role. Staff can only create for assigned residents.
 * Response: { data: { id, resident_id, appointment_type, title, scheduled_at, created_at } }
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'staff', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      resident_id,
      staff_id,
      appointment_type,
      title,
      description,
      location,
      scheduled_at,
      duration_minutes,
      status,
      notes,
    } = body;

    const isFacility = !!body.is_facility_event;
    if (!appointment_type || !title || !scheduled_at) {
      return Response.json(
        { error: 'appointment_type, title, and scheduled_at are required' },
        { status: 422 }
      );
    }
    if (!isFacility && !resident_id) {
      return Response.json(
        { error: 'resident_id is required for resident appointments' },
        { status: 422 }
      );
    }
    const allowedAppointmentTypes = ['medical', 'dental', 'social', 'family', 'other'];
    const dbAppointmentType = allowedAppointmentTypes.includes(appointment_type)
      ? appointment_type
      : (isFacility ? 'other' : null);
    if (!dbAppointmentType) {
      return Response.json(
        { error: `Invalid appointment_type. Must be one of: ${allowedAppointmentTypes.join(', ')}` },
        { status: 422 }
      );
    }

    const san = sanitizeFields(
      { title, description, location, notes },
      ['title', 'description', 'location', 'notes']
    );

    const appointment = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const schema = await ensureFacilityEventSchema(client);
      let appointmentResidentId = isFacility ? null : resident_id;

      if (!isFacility) {
        const { rows: residentRows } = await client.query(
          'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
          [resident_id, user.tenantId]
        );
        if (!residentRows.length) throw { status: 404, message: 'Resident not found' };

        if (staffAssignmentRequired(user)) {
          const { rows: assignedRows } = await client.query(
            'SELECT 1 FROM care.staff_assignments WHERE resident_id = $1 AND staff_id = $2 AND is_active = TRUE',
            [resident_id, user.staffId]
          );
          if (!assignedRows.length) throw { status: 403, message: 'Not assigned to this resident' };
        }

        // Check for appointment conflicts (overlapping appointments for the same resident)
        const appointmentDuration = duration_minutes || 30;
        const scheduledTime = new Date(scheduled_at);
        const endTime = new Date(scheduledTime.getTime() + appointmentDuration * 60000);

        const { rows: conflictRows } = await client.query(
          `SELECT id, title, scheduled_at, duration_minutes
           FROM care.appointments
           WHERE resident_id = $1
             AND status IN ('scheduled', 'completed')
             AND (
               scheduled_at < $2::timestamp
               AND (scheduled_at + (COALESCE(duration_minutes, 30) || ' minutes')::interval) > $3::timestamp
             )
           LIMIT 1`,
          [resident_id, endTime.toISOString(), scheduledTime.toISOString()]
        );

        if (conflictRows.length > 0) {
          const conflict = conflictRows[0];
          const conflictStart = new Date(conflict.scheduled_at);
          throw {
            status: 409,
            message: `Appointment conflicts with existing appointment "${conflict.title}" at ${conflictStart.toLocaleString()}`
          };
        }
      } else if (!schema.residentIdNullable) {
        appointmentResidentId = await findFallbackResidentId(client, user.tenantId);
        if (!appointmentResidentId) {
          throw { status: 422, message: 'A resident record is required before facility events can be saved' };
        }
      }

      const insertColumns = [
        'tenant_id', 'resident_id', 'staff_id', 'appointment_type', 'title', 'description',
        'location', 'scheduled_at', 'duration_minutes', 'status', 'notes', 'created_by',
      ];
      const values = [
        user.tenantId, appointmentResidentId, staff_id || null, dbAppointmentType, san.title,
        san.description || null, san.location || null, scheduled_at,
        duration_minutes || 30, status || 'scheduled', san.notes || null, user.staffId,
      ];
      const returningColumns = [
        'id', 'resident_id', 'appointment_type', 'title', 'scheduled_at', 'status', 'created_at',
      ];
      if (schema.hasFacilityEventColumn) {
        insertColumns.push('is_facility_event');
        values.push(isFacility);
        returningColumns.push('is_facility_event');
      }

      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const { rows } = await client.query(
        `INSERT INTO care.appointments (${insertColumns.join(', ')})
         VALUES (${placeholders})
         RETURNING ${returningColumns.join(', ')}`,
        values
      );
      if (!schema.hasFacilityEventColumn) {
        rows[0].is_facility_event = isFacility;
      }
      return rows[0];
    });

    await audit.logInsert({
      tableName: 'care.appointments',
      recordId: appointment.id,
      residentId: resident_id,
      req: getRequestContext(request, user),
    });
    return Response.json({ data: appointment }, { status: 201 });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

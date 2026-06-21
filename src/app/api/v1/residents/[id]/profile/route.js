import { authenticate, guardResidentAccess, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { ROLES } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/residents/[id]/profile
 * Return enriched resident data needed by the resident portal.
 *
 * Returns:
 *   id, name, first_name, preferred_name, room, intake_date, intake_days,
 *   wellness_summary, goals, medications, team, upcoming_appointments,
 *   past_appointments, requests
 *
 * Auth:
 * - resident_care_of: can only view their own profile
 * - staff, manager, admin: can view any resident in tenant (subject to staff_assignments)
 */
export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const { id: residentId } = await context.params;

    // Check resident ownership for resident_care_of
    if (user.role === ROLES.RESIDENT_CARE_OF) {
      const guardResult = await guardResidentAccess(user, residentId);
      if (guardResult && guardResult.error) {
        return Response.json({ error: guardResult.error }, { status: guardResult.status });
      }
    }

    const tenantKey = await getTenantKey(user.tenantId);

    const profileData = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Fetch resident base data
      const { rows: residentRows } = await client.query(
        `SELECT r.id, r.first_name, r.last_name, r.preferred_name, r.intake_date,
                r.primary_diagnosis
           FROM care.residents r
          WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL`,
        [residentId, user.tenantId]
      );

      if (!residentRows.length) throw { status: 404, message: 'Resident not found' };

      const resident = decryptFields(residentRows[0], RESIDENT_ENCRYPTED_FIELDS, tenantKey);
      const intakeDays = resident.intake_date
        ? Math.floor((new Date() - new Date(resident.intake_date)) / (1000 * 60 * 60 * 24))
        : null;

      // Fetch active care plan (for wellness summary)
      const { rows: carePlanRows } = await client.query(
        `SELECT cp.id, cp.status
           FROM care.care_plans cp
          WHERE cp.resident_id = $1 AND cp.tenant_id = $2
                AND cp.deleted_at IS NULL AND cp.status = 'active'
          LIMIT 1`,
        [residentId, user.tenantId]
      );

      const activePlan = carePlanRows[0] || null;

      // Fetch goals for the active care plan
      const { rows: goalRows } = activePlan
        ? await client.query(
            `SELECT g.id, g.domain AS area, g.goal_text, g.status
               FROM care.goals g
              WHERE g.care_plan_id = $1 AND g.tenant_id = $2 AND g.deleted_at IS NULL
              ORDER BY g.goal_number NULLS LAST, g.created_at`,
            [activePlan.id, user.tenantId]
          )
        : { rows: [] };

      const wellnessSummary = goalRows.length
        ? goalRows.slice(0, 3).map(g => g.goal_text).filter(Boolean).join(' | ')
        : null;

      // Fetch medications
      const { rows: medicationRows } = await client.query(
        `SELECT m.id, m.drug_name, m.frequency, m.indication
           FROM care.medications m
          WHERE m.resident_id = $1 AND m.tenant_id = $2 AND m.is_active = TRUE
          ORDER BY m.created_at DESC`,
        [residentId, user.tenantId]
      );

      // Fetch care team (staff assignments)
      const { rows: teamRows } = await client.query(
        `SELECT sa.id, s.first_name, s.last_name, s.role, s.phone, s.email
           FROM care.staff_assignments sa
           JOIN ref.staff s ON s.id = sa.staff_id
          WHERE sa.resident_id = $1 AND sa.is_active = TRUE
          ORDER BY s.first_name, s.last_name`,
        [residentId]
      );

      // Map roles to emoji icons (simple mapping)
      const roleEmoji = {
        counselor: '👥',
        nurse: '⚕',
        doctor: '👨‍⚕️',
        therapist: '🧠',
        social_worker: '🤝',
        care_coordinator: '📋',
      };

      const team = teamRows.map(member => ({
        name: `${member.first_name} ${member.last_name}`,
        role: member.role,
        contact: member.phone || member.email || '',
        emoji: roleEmoji[member.role] || '👤',
      }));

      // Fetch upcoming appointments (next 30 days)
      const { rows: upcomingRows } = await client.query(
        `SELECT a.id, a.appointment_type, a.title, a.description, a.location, a.scheduled_at, a.status
           FROM care.appointments a
          WHERE a.resident_id = $1 AND a.tenant_id = $2
                AND a.scheduled_at >= NOW() AND a.scheduled_at < NOW() + INTERVAL '90 days'
          ORDER BY a.scheduled_at ASC`,
        [residentId, user.tenantId]
      );

      const upcomingAppointments = upcomingRows.map(apt => ({
        id: apt.id,
        type: apt.appointment_type,
        provider: apt.title,
        facility: apt.location || '',
        date: apt.scheduled_at ? new Date(apt.scheduled_at).toISOString().split('T')[0] : null,
        time: apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        transport: 'See care team',
      }));

      // Fetch past appointments (last 12 months)
      const { rows: pastRows } = await client.query(
        `SELECT a.id, a.appointment_type, a.title, a.scheduled_at, a.notes
           FROM care.appointments a
          WHERE a.resident_id = $1 AND a.tenant_id = $2
                AND a.scheduled_at < NOW() AND a.scheduled_at >= NOW() - INTERVAL '12 months'
          ORDER BY a.scheduled_at DESC
          LIMIT 10`,
        [residentId, user.tenantId]
      );

      const pastAppointments = pastRows.map(apt => ({
        id: apt.id,
        type: apt.appointment_type,
        provider: apt.title,
        date: apt.scheduled_at ? new Date(apt.scheduled_at).toISOString().split('T')[0] : null,
        time: apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        notes: apt.notes,
      }));

      // Fetch resident requests (recent)
      const { rows: requestRows } = await client.query(
        `SELECT rr.id, rr.request_type, rr.details, rr.status, rr.created_at
           FROM care.resident_requests rr
          WHERE rr.resident_id = $1 AND rr.tenant_id = $2
          ORDER BY rr.created_at DESC
          LIMIT 10`,
        [residentId, user.tenantId]
      );

      const normalizeRequestStatus = (status) => (status === 'completed' ? 'fulfilled' : status);
      const requests = requestRows.map(req => ({
        id: req.id,
        type: req.request_type,
        details: req.details,
        status: normalizeRequestStatus(req.status),
        date: new Date(req.created_at).toISOString().split('T')[0],
      }));

      return {
        id: resident.id,
        name: `${resident.first_name} ${resident.last_name}`,
        first_name: resident.first_name,
        preferred_name: resident.preferred_name || resident.first_name,
        room: resident.room || 'TBD', // Note: room may not be in residents table; add to query if needed
        intake_date: resident.intake_date,
        intake_days: intakeDays,
        wellness_summary: wellnessSummary,
        goals: goalRows.map(g => ({
          id: g.id,
          area: g.area || 'General',
          text: g.goal_text,
          progress: g.status === 'achieved' ? 100 : g.status === 'in_progress' ? 50 : 0,
        })),
        medications: medicationRows.map(m => ({
          name: m.drug_name,
          frequency: m.frequency,
          purpose: m.indication,
        })),
        team,
        upcoming_appointments: upcomingAppointments,
        past_appointments: pastAppointments,
        requests,
      };
    });

    const req = getRequestContext(request, user);
    await audit
      .logSelect({ tableName: 'care.residents', req })

    return Response.json({ data: profileData });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

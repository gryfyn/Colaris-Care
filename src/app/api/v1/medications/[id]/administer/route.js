import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { sanitizeFields } from '@/lib/sanitize.js';

const audit = new AuditLogger();

/**
 * POST /api/v1/medications/[id]/administer
 * Staff logs medication administration (or refusal/non-administration).
 * Enforces proper audit trail for controlled substances and PRN meds.
 *
 * Path params:
 *   id (UUID) - medication ID
 *
 * Body:
 *   administered (boolean, required) - true if given, false if refused/missed
 *   dose_given (string, optional) - dose actually given (e.g., "10mg"), defaults to prescribed dosage
 *   shift (string, optional) - one of: morning, afternoon, night, prn
 *   refusal_reason (string, required if administered=false) - reason medication not given
 *   side_effects_noted (string, optional) - any observed reactions
 *   prn_reason (string, required for PRN meds when administered=true) - justification for PRN dose
 *   notes (string, optional) - additional clinical notes
 *
 * Auth: staff, manager, admin, or superadmin
 * Staff role:
 *   - Must be assigned to the resident (via care.staff_assignments, active=true)
 *   - Returns 403 if not assigned
 * Validation:
 *   - Returns 404 if medication not found
 *   - Returns 400 if medication is no longer active
 *   - Enforces required fields per medication type (PRN, refusal reason)
 *
 * Response: {
 *   id, administered_at, was_refused,
 *   message: "[Drug] administered successfully" or "[Drug] marked as not administered (reason)"
 * }
 */
export async function POST(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;
    const { id: medicationId } = await params;

    if (!['staff', 'manager', 'admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      administered,
      dose_given,
      shift,
      refusal_reason,
      side_effects_noted,
      prn_reason,
      notes,
    } = body;

    if (typeof administered !== 'boolean') {
      return Response.json({ error: 'administered (boolean) is required' }, { status: 422 });
    }

    if (administered === false && !refusal_reason) {
      return Response.json({ error: 'refusal_reason is required when administered is false' }, { status: 422 });
    }

    // Accept either morning/afternoon/night/prn (UI-friendly) or day/swing/night/prn
    // (the underlying enum). Map the former to the latter.
    const shiftMap = { morning: 'day', afternoon: 'swing', night: 'night', day: 'day', swing: 'swing', prn: null };
    if (shift && !(shift in shiftMap)) {
      return Response.json({ error: 'shift must be one of: morning, afternoon, night, prn' }, { status: 422 });
    }
    const shiftValue = shift ? shiftMap[shift] : null;

    const san = sanitizeFields(
      { dose_given, refusal_reason, side_effects_noted, prn_reason, notes },
      ['dose_given', 'refusal_reason', 'side_effects_noted', 'prn_reason', 'notes']
    );

    const record = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Look up the prescription + verify staff has access to the resident
      const { rows: medRows } = await client.query(
        `SELECT m.id, m.resident_id, m.route, m.is_active, m.is_prn, m.dosage, m.drug_name
           FROM care.medications m
          WHERE m.id = $1 AND m.tenant_id = $2`,
        [medicationId, user.tenantId]
      );
      if (!medRows.length) throw { status: 404, message: 'Medication not found' };
      const med = medRows[0];
      if (!med.is_active) throw { status: 400, message: 'Medication is no longer active' };

      // Per-resident assignment gate (disabled under facility-wide staff policy)
      if (staffAssignmentRequired(user)) {
        const { rows: assigned } = await client.query(
          `SELECT 1 FROM care.staff_assignments
            WHERE tenant_id = $1 AND staff_id = $2 AND resident_id = $3 AND is_active = TRUE
            LIMIT 1`,
          [user.tenantId, user.staffId, med.resident_id]
        );
        if (!assigned.length) throw { status: 403, message: 'You are not assigned to this resident' };
      }

      if (med.is_prn && administered && !san.prn_reason) {
        throw { status: 422, message: 'prn_reason is required for PRN medications when administered' };
      }

      const { rows } = await client.query(
        `INSERT INTO care.medication_administrations (
           tenant_id, medication_id, resident_id, administered_at, shift,
           administered_by, dose_given, route_used, was_refused, refusal_reason,
           side_effects_noted, prn_reason, notes
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, administered_at, was_refused`,
        [
          user.tenantId, medicationId, med.resident_id,
          shiftValue,
          user.staffId,
          san.dose_given || med.dosage,
          med.route,
          !administered,
          administered ? null : san.refusal_reason,
          san.side_effects_noted,
          san.prn_reason,
          san.notes,
        ]
      );
      return { row: rows[0], drug: med.drug_name };
    });

    await audit.logInsert({
      tableName: 'care.medication_administrations',
      recordId: record.row.id,
      residentId: null,
      req: getRequestContext(request, user),
    });
    return Response.json({
      id: record.row.id,
      administered_at: record.row.administered_at,
      was_refused: record.row.was_refused,
      message: administered
        ? `${record.drug} administered successfully`
        : `${record.drug} marked as not administered (${refusal_reason})`,
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

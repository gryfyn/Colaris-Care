import { authenticate, authorize, guardResidentAccess, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/residents/[id]/forms
 *
 * Aggregates every form associated with a resident for the admin "Resident
 * Forms Hub" page. Returns:
 *   - admissionForms: the 3 editable intake forms (pre-screening, nursing
 *     assessment, advance directive). Each is one-per-resident, so we surface
 *     the latest record's id + status so the page can deep-link into the form
 *     route (Edit) or the Reports Hub PDF endpoint (View).
 *   - otherForms: read-only counts of the other care records tied to the
 *     resident (care plans, progress notes, incidents, etc.).
 *
 * The form pages already restore data when given their id query param:
 *   pre-screening    -> /admission/pre-screening?screening_id=<id>
 *   nursing assessment -> /admission/nursing-assessment?nursing_id=<id>
 *   advance directive  -> /admission/advance-directive?advance_id=<id>
 */

// Admission (intake) forms — editable. `editParam` is the query key each form
// page reads to resume an existing record; `pdfType` is the Reports Hub PDF
// formType. All three live in their own standalone tables (migrations 0028/0029)
// and carry resident_id once the admission is finalized.
const ADMISSION_FORMS = [
  { key: 'pre-screening',      label: 'Pre-Admission Screening', table: 'care.pre_admission_screenings', editPath: '/admission/pre-screening',     editParam: 'screening_id', pdfType: 'pre-screening' },
  { key: 'nursing-assessment', label: 'Nursing Assessment',      table: 'care.nursing_admissions',       editPath: '/admission/nursing-assessment', editParam: 'nursing_id',   pdfType: 'nursing-assessment' },
  { key: 'advance-directive',  label: 'Advance Directive',       table: 'care.advance_directives',       editPath: '/admission/advance-directive',  editParam: 'advance_id',   pdfType: 'advance-directive' },
];

// Other resident-linked records — surfaced as read-only counts only.
const OTHER_FORMS = [
  { key: 'care-plans',                 label: 'Care Plan',                table: 'care.care_plans' },
  { key: 'daily-progress-notes',       label: 'Daily Progress Note',      table: 'care.daily_progress_notes' },
  { key: 'medication-administrations', label: 'Medication Administration', table: 'care.medication_administrations' },
  { key: 'incidents',                  label: 'Incident Report',          table: 'care.incident_reports' },
  { key: 'drug-disposal',              label: 'Drug Disposal Record',     table: 'care.drug_disposal_records' },
  { key: 'face-sheets',                label: 'Face Sheet',               table: 'care.resident_face_sheets' },
  { key: 'appointments',               label: 'Appointment',              table: 'care.appointments' },
];

export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Honour the same per-resident access guard the rest of the API uses.
    const guardResult = await guardResidentAccess(user, id);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }

    const tenantKey = await getTenantKey(user.tenantId);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Resident header (name + status). 404 if the resident doesn't exist.
      const { rows: resRows } = await client.query(
        `SELECT id, first_name, last_name, status
           FROM care.residents
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );
      if (!resRows.length) return null;
      const resident = resRows[0];

      // Admission forms — latest record id + status + count per form.
      const admissionForms = [];
      for (const form of ADMISSION_FORMS) {
        const { rows } = await client.query(
          `SELECT id, status, COALESCE(submitted_at, created_at) AS updated_at,
                  COUNT(*) OVER() AS total
             FROM ${form.table}
            WHERE resident_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            ORDER BY COALESCE(submitted_at, created_at) DESC
            LIMIT 1`,
          [id, user.tenantId]
        );
        const latest = rows[0] || null;
        admissionForms.push({
          key: form.key,
          label: form.label,
          editable: true,
          formId: latest?.id || null,
          status: latest?.status || null,
          count: latest ? Number(latest.total) : 0,
          updatedAt: latest?.updated_at || null,
          editPath: form.editPath,
          editParam: form.editParam,
          pdfType: form.pdfType,
        });
      }

      // Other forms — counts only. Each query is independent (withTenantClient
      // is not transactional) so a missing optional table can't poison the rest.
      const otherForms = [];
      for (const form of OTHER_FORMS) {
        let count = 0;
        try {
          const { rows } = await client.query(
            `SELECT COUNT(*)::int AS count FROM ${form.table}
              WHERE resident_id = $1 AND tenant_id = $2`,
            [id, user.tenantId]
          );
          count = rows[0]?.count || 0;
        } catch {
          // Table/column shape varies across environments — treat as 0 rather
          // than failing the whole hub.
          count = 0;
        }
        otherForms.push({ key: form.key, label: form.label, editable: false, count });
      }

      return { resident, admissionForms, otherForms };
    });

    if (!result) {
      return Response.json({ error: 'Resident not found' }, { status: 404 });
    }

    const decrypted = decryptFields(result.resident, RESIDENT_ENCRYPTED_FIELDS, tenantKey);
    const fullName = [decrypted.first_name, decrypted.last_name].filter(Boolean).join(' ').trim() || 'Resident';

    await audit.logSelect({
      tableName: 'care.residents',
      recordId: id,
      residentId: id,
      req: getRequestContext(request, user),
      justification: 'Resident Forms Hub',
    });

    return Response.json({
      data: {
        resident: { id: result.resident.id, full_name: fullName, status: result.resident.status },
        admissionForms: result.admissionForms,
        otherForms: result.otherForms,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

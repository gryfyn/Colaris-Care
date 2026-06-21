import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

const ADMISSION_ENCRYPTED_FIELDS = [
  'full_name', 'preferred_name',
  'contact_phone', 'email',
  'address_line1', 'address_line2',
  'emergency_contact', 'emergency_contact_phone',
  'primary_physician', 'primary_physician_phone',
  'insurance_member_id', 'insurance_group_number', 'insurance_contact_phone',
  'medicaid_id', 'ssn_last4',
  'healthcare_agent_name', 'healthcare_agent_phone',
  'alternate_agent_name', 'alternate_agent_phone',
  'witness1_name', 'witness2_name',
];

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/admission/forms/[id]
 * Retrieve a specific pending admission with all form data (nursing assessment,
 * pre-screening, advance directive) so forms can restore data on page reload.
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const tenantKey = getTenantKey();

    const found = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Pre-screening is now standalone — check it first. The review modal loads
      // its form_data blob as pre_screening_data.
      const ps = await client.query(
        `SELECT id, status, client_full_name, contact_phone, form_data,
                screening_outcome, review_notes, created_at, updated_at, submitted_at
           FROM care.pre_admission_screenings
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );
      if (ps.rows.length) return { kind: 'screening', row: ps.rows[0] };

      // Legacy: a pending_admissions packet (nursing assessment + advance directive).
      const pa = await client.query(
        `SELECT
           id, resident_id, status,
           full_name, contact_phone, emergency_contact,
           pre_screening_complete, nursing_assessment_complete, advance_directive_complete,
           pre_screening_data, nursing_assessment_data, advance_directive_data,
           created_at, updated_at, submitted_at
         FROM care.pending_admissions
         WHERE id = $1 AND tenant_id = $2`,
        [id, user.tenantId]
      );
      if (pa.rows.length) return { kind: 'admission', row: pa.rows[0] };
      return null;
    });

    if (!found) {
      return Response.json({ error: 'Admission not found' }, { status: 404 });
    }

    // Standalone pre-screening: return its blob as pre_screening_data so the
    // review modal renders it through the pre_screening config + PDF.
    if (found.kind === 'screening') {
      const sr = found.row;
      const decS = decryptFields(
        { full_name: sr.client_full_name, contact_phone: sr.contact_phone },
        ['full_name', 'contact_phone'],
        tenantKey
      );
      await audit.logSelect({
        tableName: 'care.pre_admission_screenings',
        recordId: id,
        req: getRequestContext(request, user),
      });
      return Response.json({
        data: {
          id: sr.id,
          resident_id: null,
          status: sr.status,
          full_name: decS.full_name,
          contact_phone: decS.contact_phone,
          pre_screening_complete: true,
          nursing_assessment_complete: false,
          advance_directive_complete: false,
          pre_screening_data: sr.form_data || {},
          nursing_assessment_data: {},
          advance_directive_data: {},
          screening_outcome: sr.screening_outcome,
          review_notes: sr.review_notes,
          created_at: sr.created_at,
          updated_at: sr.updated_at,
          submitted_at: sr.submitted_at,
        },
      });
    }

    const row = found.row;

    // Decrypt PHI
    const decrypted = decryptFields(
      {
        full_name: row.full_name,
        contact_phone: row.contact_phone,
        emergency_contact: row.emergency_contact,
      },
      ADMISSION_ENCRYPTED_FIELDS,
      tenantKey
    );

    // Build response with form data
    const formData = {
      id: row.id,
      resident_id: row.resident_id,
      status: row.status,
      full_name: decrypted.full_name,
      contact_phone: decrypted.contact_phone,
      emergency_contact: decrypted.emergency_contact,
      pre_screening_complete: row.pre_screening_complete,
      nursing_assessment_complete: row.nursing_assessment_complete,
      advance_directive_complete: row.advance_directive_complete,
      // Include raw form data from JSONB blobs
      nursing_assessment_data: row.nursing_assessment_data || {},
      pre_screening_data: row.pre_screening_data || {},
      advance_directive_data: row.advance_directive_data || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      submitted_at: row.submitted_at,
    };

    await audit
      .logSelect({
        tableName: 'care.pending_admissions',
        recordId: id,
        req: getRequestContext(request, user),
      })

    return Response.json({ data: formData });
  } catch (err) {
    return handleError(err);
  }
}

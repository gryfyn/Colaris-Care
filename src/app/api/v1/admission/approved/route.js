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
 * GET /api/v1/admission/approved
 *
 * Lists completed pre-screenings that are ready to be admitted into nursing.
 * Used to populate the "Admit Resident" dropdown in the Residents section.
 *
 * Returns:
 *   { data: [{ id, full_name (decrypted), date_of_birth, submitted_at, reviewed_at }] }
 *   ordered by reviewed_at DESC
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantKey = getTenantKey();

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, client_full_name, date_of_birth, submitted_at, reviewed_at, screening_outcome
           FROM care.pre_admission_screenings
          WHERE tenant_id = $1
            AND deleted_at IS NULL
            AND status IN ('submitted', 'approved')
          ORDER BY COALESCE(reviewed_at, submitted_at, created_at) DESC`,
        [user.tenantId]
      );
      return rows;
    });

    const tenantKey_local = getTenantKey();
    const data = rows.map(row => {
      const decrypted = decryptFields(
        { client_full_name: row.client_full_name },
        ['client_full_name'],
        tenantKey_local
      );
      return {
        id: row.id,
        full_name: decrypted.client_full_name,
        date_of_birth: row.date_of_birth,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        screening_outcome: row.screening_outcome,
      };
    });

    await audit.logSelect({
      tableName: 'care.pre_admission_screenings',
      req: getRequestContext(request, user),
    });

    return Response.json({
      data,
    });
  } catch (err) {
    return handleError(err);
  }
}

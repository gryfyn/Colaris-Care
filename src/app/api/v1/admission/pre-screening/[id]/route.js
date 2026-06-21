import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

/**
 * GET /api/v1/admission/pre-screening/[id]
 * Load a single screening so the wizard can rehydrate every step (the lossless
 * form_data blob, including its __steps buckets, is returned as
 * pre_screening_data — the shape the wizard's bucketsFromBlob expects).
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

    const row = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, status, client_full_name, contact_phone,
                form_data, submitted_at, created_at, updated_at, review_notes,
                screening_outcome
           FROM care.pre_admission_screenings
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );
      return rows[0];
    });

    if (!row) return Response.json({ error: 'Screening not found' }, { status: 404 });

    const dec = decryptFields(
      { client_full_name: row.client_full_name, contact_phone: row.contact_phone },
      ['client_full_name', 'contact_phone'],
      tenantKey
    );

    await audit.logSelect({
      tableName: 'care.pre_admission_screenings',
      recordId: id,
      req: getRequestContext(request, user),
    });

    return Response.json({
      data: {
        id: row.id,
        screeningId: row.id,
        status: row.status,
        full_name: dec.client_full_name,
        contact_phone: dec.contact_phone,
        // The wizard reads pre_screening_data and rebuilds buckets from __steps.
        pre_screening_data: row.form_data || {},
        screening_outcome: row.screening_outcome,
        review_notes: row.review_notes,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

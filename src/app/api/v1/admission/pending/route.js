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

// Map the standalone-screening lifecycle to the status vocabulary the existing
// admin UI (Badge / notification counts / review PATCH) already understands.
//   submitted -> pending   (awaiting an Approve/Decline decision)
//   approved  -> approved
//   declined  -> rejected
const DB_TO_UI_STATUS = { submitted: 'pending', approved: 'approved', declined: 'rejected', deferred: 'pending', admitted: 'approved' };

/**
 * GET /api/v1/admission/pending
 * List submitted pre-admission screenings awaiting an admin decision.
 *
 * Pre-screening is now a fully standalone form (care.pre_admission_screenings);
 * the nursing assessment + advance directive are completed only AFTER approval,
 * so this queue is purely the pre-screening review list.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS, PERMISSIONS.ADMISSION_FORMS_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    const offset = (page - 1) * limit;
    const includeAll = searchParams.get('include_all') === '1';

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
      const params = [user.tenantId];
      if (!includeAll) {
        // Only screenings the staff has actually submitted for review.
        conditions.push(`submitted_at IS NOT NULL`);
        conditions.push(`status IN ('submitted','approved','declined','deferred')`);
      }
      params.push(limit, offset);
      const { rows } = await client.query(
        `SELECT id, status, client_full_name, contact_phone, date_of_birth,
                referring_agency, county_of_residence, primary_dsm5_diagnosis,
                screening_outcome, completed_by_name, review_notes,
                submitted_at, created_at, reviewed_at,
                COUNT(*) OVER() AS total_count
           FROM care.pre_admission_screenings
          WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(submitted_at, created_at) ASC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);
    const tenantKey = getTenantKey();

    const admissions = rows.map((row) => {
      const dec = decryptFields(
        { client_full_name: row.client_full_name, contact_phone: row.contact_phone },
        ['client_full_name', 'contact_phone'],
        tenantKey
      );
      return {
        id: row.id,
        resident_id: null,
        status: DB_TO_UI_STATUS[row.status] || 'pending',
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        approved_at: row.reviewed_at,
        rejection_reason: row.review_notes,
        pre_screening_complete: true,
        nursing_assessment_complete: false,
        advance_directive_complete: false,
        // The admin table + review modal read the pre_screening summary object.
        pre_screening: {
          full_name: dec.client_full_name,
          date_of_birth: row.date_of_birth,
          contact_phone: dec.contact_phone,
          referring_agency: row.referring_agency,
          county: row.county_of_residence,
          primary_diagnosis: row.primary_dsm5_diagnosis,
          screening_outcome: row.screening_outcome,
          completed_by_name: row.completed_by_name,
        },
        nursing_assessment: null,
        advance_directive: null,
      };
    });

    audit.logSelect({ tableName: 'care.pre_admission_screenings', req: getRequestContext(request, user) });

    return Response.json({
      admissions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      count: admissions.length,
    });
  } catch (err) {
    return handleError(err);
  }
}

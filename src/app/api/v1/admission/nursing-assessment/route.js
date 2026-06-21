import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

// ---------------------------------------------------------------------------
// Nursing Assessment — STANDALONE form (migration 0029), in its own table
// care.nursing_admissions, chained off the approved pre-screening via
// pre_screening_id. Resident demographics captured in the pre-screening are
// carried forward (the wizard pre-fills them), so they are stored here only in
// the lossless form_data blob — no resident row exists yet (it is created when
// the advance directive is finalized).
// ---------------------------------------------------------------------------

const isEmpty = (v) =>
  v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// Robust validation: block ONLY on a missing core field (proper emptiness check,
// so a legitimate "0" vital is not treated as missing). Date/phone *format* is
// never a blocker — that was the "Validation failed" bug. Drafts skip validation.
const NURSING_REQUIRED = ['name', 'dob', 'reasonForAdmission'];
function validate(data) {
  const errors = {};
  for (const f of NURSING_REQUIRED) if (isEmpty(data[f])) errors[f] = `${f} is required`;
  return errors;
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    const { user } = authResult;
    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_WRITE)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { formData, markComplete, submit } = body;
    const nursingId = body.nursingId || body.admissionId || null;
    const preScreeningId = body.preScreeningId || body.screeningId || null;

    if (!formData || typeof formData !== 'object') return Response.json({ error: 'formData (object) is required' }, { status: 400 });

    if (markComplete === true || submit === true) {
      const errs = validate(formData);
      if (Object.keys(errs).length) return Response.json({ error: 'Validation failed', validationErrors: errs }, { status: 422 });
    }

    const blob = JSON.stringify(formData);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      if (nursingId) {
        const { rows: prior } = await client.query(
          `SELECT id FROM care.nursing_admissions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [nursingId, user.tenantId]
        );
        if (!prior.length) throw { status: 404, message: 'Nursing assessment not found' };

        const params = [blob, nursingId];
        const setClauses = [
          `form_data = COALESCE(form_data, '{}'::jsonb) || $1::jsonb`,
          `updated_at = NOW()`,
        ];
        if (preScreeningId) { params.push(preScreeningId); setClauses.push(`pre_screening_id = COALESCE(pre_screening_id, $${params.length})`); }
        if (submit) {
          params.push(user.staffId);
          const subIdx = params.length;
          setClauses.push(`status = 'submitted'`, `submitted_at = COALESCE(submitted_at, NOW())`, `submitted_by = $${subIdx}`, `completed_at = COALESCE(completed_at, NOW())`);
        }
        params.push(user.tenantId);
        const tenantIdx = params.length;
        const { rows } = await client.query(
          `UPDATE care.nursing_admissions SET ${setClauses.join(', ')}
            WHERE id = $2 AND tenant_id = $${tenantIdx}
        RETURNING id, status, submitted_at, created_at`,
          params
        );
        if (!rows.length) throw { status: 404, message: 'Nursing assessment not found' };
        return rows[0];
      }

      const cols = ['tenant_id', 'created_by', 'status', 'form_data', 'is_encrypted'];
      const vals = [user.tenantId, user.staffId, submit ? 'submitted' : 'draft', blob, false];
      if (preScreeningId) { cols.push('pre_screening_id'); vals.push(preScreeningId); }
      if (submit) { cols.push('submitted_at', 'submitted_by', 'completed_at'); vals.push(new Date(), user.staffId, new Date()); }
      const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await client.query(
        `INSERT INTO care.nursing_admissions (${cols.join(', ')}) VALUES (${ph})
         RETURNING id, status, submitted_at, created_at`,
        vals
      );
      return rows[0];
    });

    await audit[nursingId ? 'logUpdate' : 'logInsert']({
      tableName: 'care.nursing_admissions',
      recordId: result.id,
      newValues: { id: result.id, status: result.status },
      req: getRequestContext(request, user),
    });

    return Response.json(
      { data: { id: result.id, nursingId: result.id, admissionId: result.id, status: result.status, submittedAt: result.submitted_at, createdAt: result.created_at } },
      { status: nursingId ? 200 : 201 }
    );
  } catch (err) {
    if (err && err.status) return Response.json({ error: err.message }, { status: err.status });
    return handleError(err);
  }
}

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    const { user } = authResult;
    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_READ)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeAll = searchParams.get('include_all') === '1';
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
      const params = [user.tenantId];
      if (!includeAll) { params.push(status || 'submitted'); conditions.push(`status = $${params.length}`); conditions.push('submitted_at IS NOT NULL'); }
      params.push(limit, offset);
      const { rows } = await client.query(
        `SELECT id, status, pre_screening_id, resident_id, submitted_at, created_at,
                COUNT(*) OVER() AS total_count
           FROM care.nursing_admissions WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(submitted_at, created_at) DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });
    const total = parseInt(rows[0]?.total_count || 0);
    audit.logSelect({ tableName: 'care.nursing_admissions', req: getRequestContext(request, user) });
    return Response.json({
      data: rows.map((r) => ({ id: r.id, status: r.status, pre_screening_id: r.pre_screening_id, resident_id: r.resident_id, submitted_at: r.submitted_at, created_at: r.created_at })),
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

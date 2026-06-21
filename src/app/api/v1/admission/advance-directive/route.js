import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { encryptPHI, decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { generatePassword } from '@/lib/credential-generator.js';
import bcrypt from 'bcryptjs';

const audit = new AuditLogger();

// ---------------------------------------------------------------------------
// Advance Directive — STANDALONE form (migration 0029), in its own table
// care.advance_directives, chained off the nursing assessment + pre-screening.
//
// On submit it FINALIZES the admission: the resident demographics captured in
// the pre-screening (encrypted) are decrypted, a care.residents row + portal
// account are created, and the whole chain (pre_screening -> nursing ->
// advance_directive) is marked 'admitted' with the new resident_id.
// ---------------------------------------------------------------------------

const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// Robust validation: block ONLY on the core legal fields, never on date/phone
// FORMAT (that was the "Validation failed" bug). Drafts skip validation.
const AD_REQUIRED = ['resident_name', 'resident_signature', 'resident_signature_date', 'witness1_name'];
function validate(data) {
  const errors = {};
  for (const f of AD_REQUIRED) if (isEmpty(data[f])) errors[f] = `${f} is required`;
  return errors;
}

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

function splitName(name) {
  if (!name) return { first: 'Unknown', last: '' };
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

const enc = (v, key) => (v == null || v === '' ? null : encryptPHI(String(v), key));

// Create the resident + portal account from the linked pre-screening, then mark
// the chain admitted. Returns { residentId, residentName, credentials }.
async function finalize(client, { advanceId, screeningId, nursingId, tenantKey, user }) {
  // Pull the encrypted PHI source of truth from the pre-screening.
  let demo = { full_name: null, date_of_birth: null, contact_phone: null, email: null, gender: null, pronoun: null };
  if (screeningId) {
    const { rows } = await client.query(
      `SELECT client_full_name, ssn, contact_phone, contact_email, date_of_birth, form_data
         FROM care.pre_admission_screenings WHERE id = $1 AND tenant_id = $2`,
      [screeningId, user.tenantId]
    );
    if (rows.length) {
      const s = rows[0];
      const d = decryptFields(
        { client_full_name: s.client_full_name, contact_phone: s.contact_phone, contact_email: s.contact_email },
        ['client_full_name', 'contact_phone', 'contact_email'],
        tenantKey
      );
      const fd = s.form_data || {};
      demo = {
        full_name: d.client_full_name || fd.clientFullName || null,
        date_of_birth: s.date_of_birth || (typeof fd.dateOfBirth === 'string' ? fd.dateOfBirth.slice(0, 10) : null),
        contact_phone: d.contact_phone || fd.contactPhone || null,
        email: d.contact_email || fd.contactEmail || null,
        gender: fd.gender || null,
        pronoun: fd.pronouns || null,
      };
    }
  }

  const { first, last } = splitName(demo.full_name);
  const { rows: residentRows } = await client.query(
    `INSERT INTO care.residents (
        tenant_id, first_name, last_name, date_of_birth, gender, pronoun,
        phone, email, intake_date, has_advance_directive,
        consent_to_treatment, consent_date, status, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, CURRENT_DATE, 'yes',
        'pending', CURRENT_DATE, 'active', $9, $9
      ) RETURNING id`,
    [
      user.tenantId, enc(first, tenantKey), enc(last, tenantKey), demo.date_of_birth, demo.gender, demo.pronoun,
      enc(demo.contact_phone, tenantKey), enc(demo.email, tenantKey), user.staffId,
    ]
  );
  const residentId = residentRows[0].id;
  const residentName = `${first} ${last}`.trim() || 'New resident';

  // Portal account with temporary password.
  const plaintextPassword = generatePassword(14);
  const passwordHash = await bcrypt.hash(plaintextPassword, 12);
  const portalEmail = demo.email || `${(first || 'resident').toLowerCase().replace(/[^a-z]/g, '')}.${(last || residentId.slice(0, 8)).toLowerCase().replace(/[^a-z]/g, '')}@dependablecare.local`;

  let accountId = null;
  try {
    const { rows: acctRows } = await client.query(
      `INSERT INTO care.user_accounts (tenant_id, resident_id, email, username, password_hash, role, is_active, password_changed_required)
       VALUES ($1, $2, $3, $3, $4, 'resident_care_of', TRUE, TRUE)
       ON CONFLICT (email) DO UPDATE SET resident_id = EXCLUDED.resident_id, username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash, password_changed_required = TRUE, is_active = TRUE,
         failed_attempts = 0, locked_until = NULL, updated_at = NOW()
       RETURNING id`,
      [user.tenantId, residentId, portalEmail, passwordHash]
    );
    accountId = acctRows[0]?.id;
    await client.query(
      `INSERT INTO audit_log.credential_history (tenant_id, user_account_id, staff_id, resident_id, credential_type, username, password_hash, was_temporary, generated_by, reason, generated_at)
       VALUES ($1, $2, NULL, $3, 'resident', $4, $5, TRUE, $6, $7, NOW())`,
      [user.tenantId, accountId, residentId, portalEmail, passwordHash, user.staffId, 'Auto-provisioned on admission finalization']
    );
  } catch { /* account creation must not block finalization */ }

  // "Care plan due" notification (admin/manager).
  await client.query(
    `INSERT INTO care.notifications (tenant_id, role_filter, type, notification_type, category, title, body, action_url, resident_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [user.tenantId, 'manager,admin,superadmin', 'care_plan_due', 'care_plan_due', 'workflow',
     'Care plan due', `New resident ${residentName} was just admitted. A care plan is due within 7 days.`,
     `/admin?view=care_plans&resident_id=${residentId}`, residentId]
  );
  if (accountId) {
    await client.query(
      `INSERT INTO care.notifications (tenant_id, role_filter, type, notification_type, category, title, body, action_url, resident_id, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [user.tenantId, 'admin,superadmin', 'credentials', 'new_credentials', 'account',
       `New resident account: ${residentName}`,
       JSON.stringify({ accountType: 'resident', residentName, email: portalEmail, password: plaintextPassword, mustChangeOnLogin: true, oneTimeView: true }),
       '/admin?view=account_management', residentId, accountId]
    );
  }

  // Mark the whole chain admitted + attach the resident.
  await client.query(`UPDATE care.advance_directives SET status = 'admitted', resident_id = $1 WHERE id = $2`, [residentId, advanceId]);
  if (nursingId) await client.query(`UPDATE care.nursing_admissions SET status = 'admitted', resident_id = $1 WHERE id = $2 AND tenant_id = $3`, [residentId, nursingId, user.tenantId]);
  if (screeningId) await client.query(`UPDATE care.pre_admission_screenings SET status = 'admitted', resident_id = $1 WHERE id = $2 AND tenant_id = $3`, [residentId, screeningId, user.tenantId]);

  return { residentId, residentName, credentials: accountId ? { email: portalEmail, password: plaintextPassword } : null };
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    const { user } = authResult;
    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_WRITE)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { formData, markComplete, submit } = body;
    const advanceId = body.advanceId || body.admissionId || null;
    const nursingId = body.nursingId || null;
    const preScreeningId = body.preScreeningId || body.screeningId || null;

    if (!formData || typeof formData !== 'object') return Response.json({ error: 'formData (object) is required' }, { status: 400 });
    if (markComplete === true || submit === true) {
      const errs = validate(formData);
      if (Object.keys(errs).length) return Response.json({ error: 'Validation failed', validationErrors: errs }, { status: 422 });
    }

    const tenantKey = getTenantKey();
    const blob = JSON.stringify(formData);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      let id = advanceId;

      // The admission chain may reach the advance directive without screening_id
      // in the URL. As long as we have the nursing assessment, inherit its
      // pre_screening_id so the form links to the pre-screening and finalize can
      // pull the resident's demographics.
      let effPreScreeningId = preScreeningId;
      if (!effPreScreeningId && nursingId) {
        const { rows: nrows } = await client.query(
          `SELECT pre_screening_id FROM care.nursing_admissions WHERE id = $1 AND tenant_id = $2`,
          [nursingId, user.tenantId]
        );
        effPreScreeningId = nrows[0]?.pre_screening_id || null;
      }

      if (id) {
        const { rows: prior } = await client.query(
          `SELECT id, pre_screening_id, nursing_admission_id FROM care.advance_directives WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [id, user.tenantId]
        );
        if (!prior.length) throw { status: 404, message: 'Advance directive not found' };
        const params = [blob, id];
        const setClauses = [`form_data = COALESCE(form_data, '{}'::jsonb) || $1::jsonb`, `updated_at = NOW()`];
        if (effPreScreeningId) { params.push(effPreScreeningId); setClauses.push(`pre_screening_id = COALESCE(pre_screening_id, $${params.length})`); }
        if (nursingId) { params.push(nursingId); setClauses.push(`nursing_admission_id = COALESCE(nursing_admission_id, $${params.length})`); }
        if (submit) {
          params.push(user.staffId); const subIdx = params.length;
          setClauses.push(`status = 'submitted'`, `submitted_at = COALESCE(submitted_at, NOW())`, `submitted_by = $${subIdx}`);
        }
        params.push(user.tenantId); const tenantIdx = params.length;
        await client.query(`UPDATE care.advance_directives SET ${setClauses.join(', ')} WHERE id = $2 AND tenant_id = $${tenantIdx}`, params);
      } else {
        const cols = ['tenant_id', 'created_by', 'status', 'form_data', 'is_encrypted'];
        const vals = [user.tenantId, user.staffId, submit ? 'submitted' : 'draft', blob, false];
        if (effPreScreeningId) { cols.push('pre_screening_id'); vals.push(effPreScreeningId); }
        if (nursingId) { cols.push('nursing_admission_id'); vals.push(nursingId); }
        if (submit) { cols.push('submitted_at', 'submitted_by'); vals.push(new Date(), user.staffId); }
        const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
        const { rows } = await client.query(`INSERT INTO care.advance_directives (${cols.join(', ')}) VALUES (${ph}) RETURNING id`, vals);
        id = rows[0].id;
      }

      // FINALIZE on submit: create resident + account, mark chain admitted.
      let finalizeResult = null;
      if (submit) {
        // Resolve the chain links (use provided ids, else the row's stored links).
        const { rows: linkRows } = await client.query(
          `SELECT pre_screening_id, nursing_admission_id, resident_id, status FROM care.advance_directives WHERE id = $1`, [id]
        );
        const link = linkRows[0] || {};
        if (!link.resident_id) {
          finalizeResult = await finalize(client, {
            advanceId: id,
            screeningId: effPreScreeningId || link.pre_screening_id || null,
            nursingId: nursingId || link.nursing_admission_id || null,
            tenantKey, user,
          });
        }
      }

      const { rows: out } = await client.query(`SELECT id, status, submitted_at, created_at, resident_id FROM care.advance_directives WHERE id = $1`, [id]);
      return { ...out[0], finalize: finalizeResult };
    });

    await audit[advanceId ? 'logUpdate' : 'logInsert']({
      tableName: 'care.advance_directives',
      recordId: result.id,
      newValues: { id: result.id, status: result.status },
      req: getRequestContext(request, user),
    });

    const data = {
      id: result.id, advanceId: result.id, admissionId: result.id,
      status: result.status, submittedAt: result.submitted_at, createdAt: result.created_at,
    };
    if (result.finalize) {
      data.residentId = result.finalize.residentId;
      data.residentName = result.finalize.residentName;
      data.credentials = result.finalize.credentials;
    }
    return Response.json({ data }, { status: advanceId ? 200 : 201 });
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
        `SELECT id, status, pre_screening_id, nursing_admission_id, resident_id, submitted_at, created_at,
                COUNT(*) OVER() AS total_count
           FROM care.advance_directives WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(submitted_at, created_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });
    const total = parseInt(rows[0]?.total_count || 0);
    audit.logSelect({ tableName: 'care.advance_directives', req: getRequestContext(request, user) });
    return Response.json({
      data: rows.map((r) => ({ id: r.id, status: r.status, pre_screening_id: r.pre_screening_id, nursing_admission_id: r.nursing_admission_id, resident_id: r.resident_id, submitted_at: r.submitted_at, created_at: r.created_at })),
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

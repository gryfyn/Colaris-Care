import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { encryptFields, decryptFields } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

// ---------------------------------------------------------------------------
// Pre-Admission Screening — STANDALONE form.
//
// As of migration 0028 the pre-screening no longer shares care.pending_admissions
// with the nursing assessment / advance directive. It lives entirely in
// care.pre_admission_screenings with its own lifecycle:
//   draft -> submitted -> approved | declined | deferred
//
// Storage strategy (mirrors the proven pending_admissions pattern):
//   - The ENTIRE wizard payload (typed fields + the per-step buckets under
//     __steps) is written to the form_data JSONB blob, so every collected field
//     is preserved end-to-end and the wizard can rehydrate every step on resume.
//   - A coerced subset is also written to typed columns to power the admin
//     queue + dedup. Each typed value is coerced defensively so a single
//     malformed field can never 500 the whole insert.
// ---------------------------------------------------------------------------

// PHI columns encrypted at rest on care.pre_admission_screenings.
const PRESCREEN_ENCRYPTED_FIELDS = ['client_full_name', 'ssn', 'contact_phone', 'contact_email'];

const SCREENING_OUTCOMES = ['approved', 'not_appropriate', 'deferred_waitlisted'];

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

// Coerce any incoming date-ish value to a bare YYYY-MM-DD that Postgres DATE
// columns accept. Accepts "2026-06-07" and "2026-06-07T00:00:00.000Z" alike.
// Returns null for anything that isn't a recognisable date (so the column is
// simply left unset rather than throwing "invalid input syntax for type date").
function toDateOnly(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  return Number.isNaN(Date.parse(m[1])) ? null : m[1];
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (['yes', 'true', '1'].includes(s)) return true;
  if (['no', 'false', '0'].includes(s)) return false;
  return null;
}

function asText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function asJson(v) {
  return v == null ? null : JSON.stringify(v);
}

// Build the coerced typed-column map from the flat wizard field names.
// Anything not listed here still flows through losslessly in form_data.
function mapTyped(d) {
  const out = {
    client_full_name:          asText(d.clientFullName || d.full_name),
    date_of_birth:             toDateOnly(d.dateOfBirth || d.date_of_birth),
    preferred_pronouns:        asText(d.pronouns),
    referring_agency:          asText(d.referringAgency),
    referral_date:             toDateOnly(d.referralDate),
    contact_person:            asText(d.contactPerson),
    contact_phone:             asText(d.contactPhone),
    contact_email:             asText(d.contactEmail),
    ssn:                       asText(d.ssn),
    ohp_id:                    asText(d.ohpId),
    other_insurance:           asText(d.otherInsurance),
    other_insurance_id:        asText(d.otherInsuranceId),
    current_living_situation:  asText(d.livingSituation),
    county_of_residence:       asText(d.county),
    presenting_problem:        asText(d.presentingProblem),
    primary_dsm5_diagnosis:    asText(d.primaryDiagnosis),
    primary_diagnosis_date:    toDateOnly(d.diagnosisDate),
    secondary_diagnoses:       asText(d.secondaryDiagnoses),
    psychotropic_medications:  asJson(d.psychMeds),
    psych_hospitalization_hx:  toBool(d.psychHx),
    psych_hospitalization_recent_date: toDateOnly(d.psychHxDate),
    psych_hospitalization_reason: asText(d.psychHxReason),
    outpatient_therapist:      asText(d.therapistName),
    outpatient_therapist_phone: asText(d.therapistPhone),
    outpatient_psychiatrist:   asText(d.psychiatristName),
    outpatient_psychiatrist_phone: asText(d.psychiatristPhone),
    outpatient_case_manager:   asText(d.caseManagerName),
    outpatient_case_manager_phone: asText(d.caseManagerPhone),
    pcp_name:                  asText(d.pcpName),
    pcp_phone:                 asText(d.pcpPhone),
    pcp_fax:                   asText(d.pcpFax),
    medical_diagnoses:         asText(d.medicalDiagnoses),
    non_psych_medications:     asJson(d.nonPsychMeds),
    tb_test_result:            asText(d.tbResult),
    tb_test_date:              toDateOnly(d.tbTestDate),
    covid_vaccination_status:  asText(d.covidVaxStatus),
    other_communicable_disease: asText(d.otherCommunicable),
    primary_substance:         asText(d.primarySubstance),
    secondary_substances:      asText(d.secondarySubstances),
    last_use_date:             toDateOnly(d.lastUseDate),
    withdrawal_hx:             toBool(d.withdrawalHx),
    withdrawal_details:        asText(d.withdrawalDetails),
    previous_treatment_episodes: asText(d.previousTreatment),
    income_source:             asText(d.incomeSource),
    legal_status:              asText(d.legalStatus),
    probation_parole_officer:  asText(d.poName),
    probation_officer_phone:   asText(d.poPhone),
    willing_to_discuss_trauma: toBool(d.willingToDiscussTrauma),
    strengths_interests:       asText(d.clientStrengths),
    lmha_connected:            toBool(d.lmhaConnected),
    lmha_agency_name:          asText(d.lmhaAgency),
    lmha_contact:              asText(d.lmhaContact),
    waitlist_other_services:   asText(d.waitlistServices),
    client_strengths_summary:  asText(d.strengthsSummary),
    barriers_to_placement:     asText(d.barriersToPlacement),
    assessor_recommendation:   asText(d.assessorRecommendation),
    screening_outcome:         SCREENING_OUTCOMES.includes(d.screeningOutcome) ? d.screeningOutcome : null,
    conditions_prior_admission: asText(d.conditionsPriorAdmission),
    completed_by_name:         asText(d.assessorName),
  };
  // Drop nulls so an UPDATE never clobbers a previously-set value with NULL.
  for (const k of Object.keys(out)) if (out[k] === null || out[k] === undefined) delete out[k];
  return out;
}

// Only block submission on genuinely-required fields (trimmed). Optional
// phone/email/date *format* problems no longer reject the whole submission —
// dates are coerced and free-text is stored as-is.
const REQUIRED = ['referringAgency', 'referralDate', 'contactPerson', 'ssn', 'livingSituation', 'county', 'presentingProblem'];
function validate(data) {
  const errors = {};
  for (const field of REQUIRED) {
    const v = data[field];
    if (v == null || String(v).trim() === '') errors[field] = `${field} is required`;
  }
  return errors;
}

/**
 * POST /api/v1/admission/pre-screening
 * Create / update / submit a standalone pre-admission screening.
 *
 * Body:
 *   screeningId? | admissionId?  - update an existing row when present
 *   formData: object             - all collected wizard fields (+ __steps)
 *   markComplete?: boolean
 *   submit?: boolean             - flips status to 'submitted' for admin review
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.ADMISSION_FORMS_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { formData, markComplete, submit } = body;
    const screeningId = body.screeningId || body.admissionId || null;

    if (!formData || typeof formData !== 'object') {
      return Response.json({ error: 'formData (object) is required' }, { status: 400 });
    }

    // Validate ONLY when finalising. Drafts persist incomplete data on purpose.
    const isFinal = markComplete === true || submit === true;
    if (isFinal) {
      const validationErrors = validate(formData);
      if (Object.keys(validationErrors).length > 0) {
        return Response.json({ error: 'Validation failed', validationErrors }, { status: 422 });
      }
    }

    const tenantKey = getTenantKey();
    const typed = mapTyped(formData);
    const encrypted = encryptFields(typed, PRESCREEN_ENCRYPTED_FIELDS, tenantKey);
    const blob = JSON.stringify(formData);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const colNames = Object.keys(encrypted);
      const colValues = colNames.map((k) => encrypted[k]);

      if (screeningId) {
        // Confirm ownership first.
        const { rows: prior } = await client.query(
          `SELECT id, status FROM care.pre_admission_screenings
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [screeningId, user.tenantId]
        );
        if (!prior.length) throw { status: 404, message: 'Screening not found' };

        // $1 = blob, $2 = screeningId, $3..$(2+N) = colValues, then dynamic.
        const params = [blob, screeningId, ...colValues];
        const setClauses = [
          `form_data = COALESCE(form_data, '{}'::jsonb) || $1::jsonb`,
          `is_encrypted = TRUE`,
          `encrypted_at = COALESCE(encrypted_at, NOW())`,
          `updated_at = NOW()`,
          ...colNames.map((k, i) => `${k} = $${i + 3}`),
        ];
        if (submit) {
          params.push(user.staffId);
          const subIdx = params.length;
          setClauses.push(
            `status = 'submitted'`,
            `submitted_at = COALESCE(submitted_at, NOW())`,
            `submitted_by = $${subIdx}`,
            `completed_at = COALESCE(completed_at, NOW())`
          );
        }
        params.push(user.tenantId);
        const tenantIdx = params.length;

        const sql = `
          UPDATE care.pre_admission_screenings
             SET ${setClauses.join(', ')}
           WHERE id = $2 AND tenant_id = $${tenantIdx}
        RETURNING id, status, submitted_at, created_at`;
        const { rows } = await client.query(sql, params);
        if (!rows.length) throw { status: 404, message: 'Screening not found' };
        return rows[0];
      }

      // INSERT new screening.
      const baseCols = ['tenant_id', 'created_by', 'status', 'form_data', 'is_encrypted', 'encrypted_at'];
      const baseVals = [user.tenantId, user.staffId, submit ? 'submitted' : 'draft', blob, true, new Date()];
      if (submit) {
        baseCols.push('submitted_at', 'submitted_by', 'completed_at');
        baseVals.push(new Date(), user.staffId, new Date());
      }
      const allCols = [...baseCols, ...colNames];
      const allVals = [...baseVals, ...colValues];
      const placeholders = allCols.map((_, i) => `$${i + 1}`).join(', ');

      const { rows } = await client.query(
        `INSERT INTO care.pre_admission_screenings (${allCols.join(', ')})
         VALUES (${placeholders})
         RETURNING id, status, submitted_at, created_at`,
        allVals
      );
      return rows[0];
    });

    await audit[screeningId ? 'logUpdate' : 'logInsert']({
      tableName: 'care.pre_admission_screenings',
      recordId: result.id,
      newValues: { id: result.id, status: result.status },
      req: getRequestContext(request, user),
    });

    return Response.json(
      {
        data: {
          id: result.id,
          screeningId: result.id,
          admissionId: result.id, // back-compat alias for the wizard
          status: result.status,
          submittedAt: result.submitted_at,
          createdAt: result.created_at,
        },
      },
      { status: screeningId ? 200 : 201 }
    );
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * GET /api/v1/admission/pre-screening
 * List screenings for the admin queue (defaults to submitted, newest first).
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeAll = searchParams.get('include_all') === '1';
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const tenantKey = getTenantKey();

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
      const params = [user.tenantId];
      if (!includeAll) {
        params.push(status || 'submitted');
        conditions.push(`status = $${params.length}`);
        conditions.push('submitted_at IS NOT NULL');
      }
      params.push(limit, offset);
      const { rows } = await client.query(
        `SELECT id, status, client_full_name, contact_phone, date_of_birth,
                referring_agency, county_of_residence, primary_dsm5_diagnosis,
                screening_outcome, completed_by_name, review_notes,
                submitted_at, created_at, updated_at,
                COUNT(*) OVER() AS total_count
           FROM care.pre_admission_screenings
          WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(submitted_at, created_at) DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);
    const data = rows.map((row) => {
      const dec = decryptFields(
        { client_full_name: row.client_full_name, contact_phone: row.contact_phone },
        ['client_full_name', 'contact_phone'],
        tenantKey
      );
      return {
        id: row.id,
        status: row.status,
        full_name: dec.client_full_name,
        contact_phone: dec.contact_phone,
        date_of_birth: row.date_of_birth,
        referring_agency: row.referring_agency,
        county: row.county_of_residence,
        primary_diagnosis: row.primary_dsm5_diagnosis,
        screening_outcome: row.screening_outcome,
        completed_by_name: row.completed_by_name,
        review_notes: row.review_notes,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
      };
    });

    audit.logSelect({ tableName: 'care.pre_admission_screenings', req: getRequestContext(request, user) });

    return Response.json({ data, pagination: { limit, offset, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    return handleError(err);
  }
}

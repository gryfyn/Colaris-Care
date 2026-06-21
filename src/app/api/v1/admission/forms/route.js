import { authenticate, authorize, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { encryptFields, decryptFields, encryptPHI } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { staffAssignmentRequired } from '@/lib/staff-access.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { validateRequired, validateEnum, validateDateFormat, validatePhoneNumber, validateEmail } from '@/lib/request-validator.js';
import { generatePassword } from '@/lib/credential-generator.js';
import bcrypt from 'bcryptjs';

const audit = new AuditLogger();

// Top-level encrypted PHI columns on care.pending_admissions.
// The full JSONB form payload is kept in pre_screening_data /
// nursing_assessment_data / advance_directive_data so any field the form
// collects is preserved end-to-end even when no typed column matches.
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

// Validation rules per form type
const FORM_VALIDATORS = {
  'pre-screening': (data) => {
    const errors = {};
    // Required fields for all pre-screening submissions
    const required = ['referringAgency', 'referralDate', 'contactPerson', 'ssn', 'livingSituation', 'county', 'presentingProblem'];
    for (const field of required) {
      if (!data[field]) errors[field] = `${field} is required`;
    }
    if (data.referralDate && !validateDateFormat(data.referralDate)) {
      errors.referralDate = 'referralDate must be YYYY-MM-DD format';
    }
    if (data.contactPhone && !validatePhoneNumber(data.contactPhone)) {
      errors.contactPhone = 'contactPhone must be valid';
    }
    if (data.contactEmail && !validateEmail(data.contactEmail)) {
      errors.contactEmail = 'contactEmail must be valid';
    }
    if (data.pcpPhone && !validatePhoneNumber(data.pcpPhone)) {
      errors.pcpPhone = 'pcpPhone must be valid';
    }
    if (data.primarySubstance && !['Alcohol','Opioids (heroin, fentanyl)','Opioids (prescription)','Methamphetamine','Cocaine/Crack','Benzodiazepines','Cannabis/Marijuana','Hallucinogens','Inhalants','Barbiturates','Other'].includes(data.primarySubstance)) {
      errors.primarySubstance = 'primarySubstance not recognized';
    }
    if (data.incomeSource && !['SSI (Supplemental Security Income)','SSDI (Social Security Disability)','Employment (full-time)','Employment (part-time)','SNAP / Food Stamps','No Income','Family Support','Other'].includes(data.incomeSource)) {
      errors.incomeSource = 'incomeSource not recognized';
    }
    if (data.legalStatus && !['None','Probation','Parole','Outstanding Warrants','Civil Commitment','Guardianship','Pre-Trial','Other'].includes(data.legalStatus)) {
      errors.legalStatus = 'legalStatus not recognized';
    }
    return errors;
  },
  'nursing-assessment': (data) => {
    const errors = {};
    // Required fields for nursing assessment
    const required = ['name', 'dob', 'age', 'gender', 'pronouns', 'language', 'emergencyName', 'emergencyPhone', 'emergencyRelationship', 'reasonForAdmission', 'temperature', 'pulse', 'respirations', 'o2Sat', 'height', 'weightActual', 'noKnownAllergies', 'scalpInspected'];
    for (const field of required) {
      if (!data[field]) errors[field] = `${field} is required`;
    }
    if (data.dob && !validateDateFormat(data.dob)) {
      errors.dob = 'dob must be YYYY-MM-DD format';
    }
    if (data.emergencyPhone && !validatePhoneNumber(data.emergencyPhone)) {
      errors.emergencyPhone = 'emergencyPhone must be valid';
    }
    if (data.therapistPhone && !validatePhoneNumber(data.therapistPhone)) {
      errors.therapistPhone = 'therapistPhone must be valid';
    }
    if (data.psychiatristPhone && !validatePhoneNumber(data.psychiatristPhone)) {
      errors.psychiatristPhone = 'psychiatristPhone must be valid';
    }
    if (data.caseManagerPhone && !validatePhoneNumber(data.caseManagerPhone)) {
      errors.caseManagerPhone = 'caseManagerPhone must be valid';
    }
    return errors;
  },
  'advance-directive': (data) => {
    const errors = {};
    // Required signature/witness fields
    const required = ['healthcare_agent_name', 'healthcare_agent_phone', 'cpr_preference', 'nutrition_preference', 'ventilation_preference', 'end_of_life_wishes', 'resident_name', 'resident_signature', 'resident_signature_date', 'witness1_name', 'witness1_signature', 'witness1_signature_date', 'witness2_name', 'witness2_signature', 'witness2_signature_date'];
    for (const field of required) {
      if (!data[field]) errors[field] = `${field} is required`;
    }
    if (data.healthcare_agent_phone && !validatePhoneNumber(data.healthcare_agent_phone)) {
      errors.healthcare_agent_phone = 'healthcare_agent_phone must be valid';
    }
    if (data.alternate_agent_phone && !validatePhoneNumber(data.alternate_agent_phone)) {
      errors.alternate_agent_phone = 'alternate_agent_phone must be valid';
    }
    if (data.resident_signature_date && !validateDateFormat(data.resident_signature_date)) {
      errors.resident_signature_date = 'resident_signature_date must be YYYY-MM-DD format';
    }
    if (data.witness1_signature_date && !validateDateFormat(data.witness1_signature_date)) {
      errors.witness1_signature_date = 'witness1_signature_date must be YYYY-MM-DD format';
    }
    if (data.witness2_signature_date && !validateDateFormat(data.witness2_signature_date)) {
      errors.witness2_signature_date = 'witness2_signature_date must be YYYY-MM-DD format';
    }
    return errors;
  },
};

function getTenantKey() {
  const keyStr =
    process.env.NODE_ENV !== 'production'
      ? process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!'
      : process.env.TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

function splitName(name) {
  if (!name) return { first: 'Unknown', last: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// Map a flat formData object onto known typed columns on pending_admissions.
// Anything unmapped is preserved in the JSONB blob automatically because the
// caller passes formData both as the typed map AND the blob.
const TYPED_COLUMNS = [
  'full_name', 'preferred_name', 'date_of_birth', 'gender', 'pronoun',
  'contact_phone', 'email', 'address_line1', 'address_line2', 'city',
  'state', 'postal_code', 'language_preference', 'tribal_affiliation',
  'spiritual_religious',
  'emergency_contact', 'emergency_contact_phone', 'emergency_contact_relationship',
  'primary_physician', 'primary_physician_phone', 'primary_diagnosis',
  'allergies', 'current_medications', 'medical_conditions',
  'vision_hearing', 'mobility_aids',
  'legal_status', 'has_guardian', 'guardian_representative',
  'insurance_type', 'insurance_member_id', 'insurance_group_number',
  'insurance_provider', 'insurance_contact_phone', 'medicaid_id', 'ssn_last4',
  'assessment_date', 'vital_temperature', 'vital_bp_systolic',
  'vital_bp_diastolic', 'vital_pulse', 'vital_respiration', 'vital_oxygen',
  'weight_lbs', 'height_inches',
  'skin_assessment', 'sleep_history', 'pain_level', 'pain_location',
  'functional_mobility', 'fall_risk', 'suicide_risk', 'sexual_history_risk',
  'violence_risk', 'substance_abuse_history', 'substance_use_flag',
  'legal_risk_flag', 'mental_health_assessment', 'opioid_sedation_scale',
  'nursing_assessment_notes',
  'has_advance_directive', 'healthcare_agent_name', 'healthcare_agent_phone',
  'healthcare_agent_relationship', 'alternate_agent_name', 'alternate_agent_phone',
  'mental_health_preferences', 'psychiatric_med_preferences',
  'hospitalization_preference', 'emergency_interventions',
  'specific_treatment_preferences', 'personal_values',
  'religious_cultural_preferences', 'end_of_life_wishes',
  'resident_signature', 'resident_signature_date',
  'witness1_name', 'witness1_signature', 'witness1_date',
  'witness2_name', 'witness2_signature', 'witness2_date',
];

export function pickTyped(formData, formType) {
  const out = {};

  // 1. Direct pass-through for typed columns the client already mapped AND
  //    coerced to the correct type (numbers via toNum / parseHeightToInches,
  //    dates, etc.). These MUST take precedence over the raw field aliases
  //    below — otherwise a free-text field like height ("5'8\"") would clobber
  //    the parsed numeric height_inches and Postgres rejects the value
  //    ("invalid input syntax for type numeric"). Same hazard for the INT
  //    vitals and pain_level columns.
  for (const col of TYPED_COLUMNS) {
    if (col in formData && formData[col] !== undefined) {
      out[col] = formData[col];
    }
  }

  // Field mapping: form field name -> db column name. Applied ONLY for columns
  // the client did not already provide as a typed value (see guard below).
  const fieldMap = {
    // Pre-screening: identity fields now collected here (NOT from referringAgency)
    'clientFullName': 'full_name',
    'dateOfBirth': 'date_of_birth',
    'pronouns': 'pronoun',
    // Remaining pre-screening fields
    'contactPerson': 'emergency_contact',
    'contactPhone': 'contact_phone',
    'contactEmail': 'email',
    'county': 'address_line2', // temporary: county in address2
    'primaryDiagnosis': 'primary_diagnosis',
    'pcpName': 'primary_physician',
    'pcpPhone': 'primary_physician_phone',
    'medicalDiagnoses': 'medical_conditions',
    'otherInsurance': 'insurance_type',
    'otherInsuranceId': 'insurance_member_id',
    'legalStatus': 'legal_status',
    'primarySubstance': 'substance_abuse_history',
    'incomeSource': 'spiritual_religious', // placeholder
    // NOTE: referringAgency is NOT mapped to full_name; it stays only in JSONB blob

    // Nursing assessment
    'name': 'full_name',
    'dob': 'date_of_birth',
    'gender': 'gender',
    'pronouns': 'pronoun',
    'language': 'language_preference',
    'emergencyName': 'emergency_contact',
    'emergencyPhone': 'emergency_contact_phone',
    'emergencyRelationship': 'emergency_contact_relationship',
    'temperature': 'vital_temperature',
    'pulse': 'vital_pulse',
    'respirations': 'vital_respiration',
    'o2Sat': 'vital_oxygen',
    'weightActual': 'weight_lbs',
    'height': 'height_inches',
    'noKnownAllergies': 'allergies',
    'painPresent': 'pain_level',
    'painLocation': 'pain_location',
    'sleepHours': 'sleep_history',
    'mobilityStatus': 'functional_mobility',

    // Advance directive
    'resident_name': 'full_name',
    'witness1_name': 'witness1_name',
    'witness2_name': 'witness2_name',
  };

  // Apply field-alias mapping — but never override a typed column the client
  // already supplied (and coerced) in the pass-through above.
  for (const [formField, dbCol] of Object.entries(fieldMap)) {
    if (formField in formData && formData[formField] !== undefined && !(dbCol in out)) {
      out[dbCol] = formData[formField];
    }
  }

  return out;
}

/**
 * POST /api/v1/admission/forms
 * Create or update a pending admission. Each of the 3 form pages can call
 * this — the response includes the admissionId which the form persists
 * locally so subsequent step submissions update the same record.
 *
 * Body:
 *   admissionId?: string         - if present, PATCH the existing row
 *   formType: 'pre-screening' | 'nursing-assessment' | 'advance-directive'
 *   formData: object             - all collected fields for this form
 *   markComplete?: boolean       - true on the last step of this form
 *   submit?: boolean             - true when ALL three forms are done; flips
 *                                   status to 'pending' so admin can see it
 *
 * Special case: when formType='advance-directive' AND submit=true AND status='approved',
 * finalizes the admission: creates care.residents row + resident_care_of portal account +
 * notifications, then sets status='admitted' and resident_id.
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
    const { admissionId, formType, formData, markComplete, submit } = body;

    if (!formType || !['pre-screening', 'nursing-assessment', 'advance-directive'].includes(formType)) {
      return Response.json({ error: 'formType must be pre-screening, nursing-assessment, or advance-directive' }, { status: 400 });
    }
    if (!formData || typeof formData !== 'object') {
      return Response.json({ error: 'formData (object) is required' }, { status: 400 });
    }

    // Run form-type-specific validation ONLY when the form is being completed
    // or submitted. Drafts (Save Draft / partial step progress) must be allowed
    // to persist incomplete data — that's the whole point of the completion
    // flags and JSONB blobs. Enforcing all required fields on every save made
    // "Save Draft" fail with a 422 until every step was filled.
    const isFinal = markComplete === true || submit === true;
    const validator = FORM_VALIDATORS[formType];
    if (isFinal && validator) {
      const validationErrors = validator(formData);
      if (Object.keys(validationErrors).length > 0) {
        return Response.json({ error: 'Validation failed', validationErrors }, { status: 422 });
      }
    }

    const tenantKey = getTenantKey();
    const typed = pickTyped(formData, formType);
    const encrypted = encryptFields(typed, ADMISSION_ENCRYPTED_FIELDS, tenantKey);

    const blobColumn =
      formType === 'pre-screening'    ? 'pre_screening_data' :
      formType === 'nursing-assessment' ? 'nursing_assessment_data' :
      'advance_directive_data';
    const completeFlag =
      formType === 'pre-screening'    ? 'pre_screening_complete' :
      formType === 'nursing-assessment' ? 'nursing_assessment_complete' :
      'advance_directive_complete';

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const id = admissionId || null;

      if (id) {
        // Capture status BEFORE this update. The submit branch below sets
        // status='pending', which would otherwise mask the 'approved' state the
        // finalize step keys off of (advance-directive submit creates the resident).
        const { rows: priorRows } = await client.query(
          `SELECT status FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2`,
          [id, user.tenantId]
        );
        if (!priorRows.length) throw { status: 404, message: 'Admission not found' };
        const priorStatus = priorRows[0].status;
        const isFinalize = submit === true && formType === 'advance-directive' && priorStatus === 'approved';

        // UPDATE: merge typed columns + JSONB blob into existing row
        const colAssignments = Object.keys(encrypted)
          .filter(k => encrypted[k] !== undefined)
          .map((k, i) => `${k} = $${i + 4}`);
        const colValues = Object.keys(encrypted)
          .filter(k => encrypted[k] !== undefined)
          .map(k => encrypted[k]);

        const setClauses = [
          `${blobColumn} = COALESCE(${blobColumn}, '{}'::jsonb) || $1::jsonb`,
          `${completeFlag} = COALESCE(${completeFlag}, FALSE) OR $2`,
          'is_encrypted = TRUE',
          'encrypted_at = COALESCE(encrypted_at, NOW())',
          ...colAssignments,
        ];

        // If submit=true, flip status. A normal pre-screening submit goes to
        // 'pending'; finalizing the advance directive on an approved admission
        // leaves status alone so the finalize step below can set it to 'admitted'.
        if (submit) {
          if (!isFinalize) setClauses.push(`status = 'pending'`);
          setClauses.push(`submitted_at = COALESCE(submitted_at, NOW())`);
        }

        const query = `
          UPDATE care.pending_admissions
             SET ${setClauses.join(', ')}
           WHERE id = $3 AND tenant_id = $${4 + colValues.length}
        RETURNING id, status, pre_screening_complete, nursing_assessment_complete, advance_directive_complete, submitted_at, created_at, full_name, date_of_birth, contact_phone, email, address_line1, address_line2, gender, pronoun, city, state, postal_code, primary_diagnosis, language_preference, tribal_affiliation, spiritual_religious, has_advance_directive, has_guardian, guardian_representative, substance_use_flag, legal_risk_flag, preferred_name, medicaid_id, ssn_last4`;

        const params = [
          JSON.stringify(formData),
          !!markComplete,
          id,
          ...colValues,
          user.tenantId,
        ];

        const { rows } = await client.query(query, params);
        if (!rows.length) throw { status: 404, message: 'Admission not found' };

        const admission = rows[0];

        // FINALIZE: if advance-directive submit on an approved admission, create resident + account + notifications
        if (isFinalize) {
          // Fetch the admission again to get all encrypted fields for decryption
          const { rows: fullAdmissionRows } = await client.query(
            `SELECT * FROM care.pending_admissions WHERE id = $1`,
            [id]
          );
          const fullAdmission = fullAdmissionRows[0];

          // Decrypt PHI for resident creation
          const decrypted = decryptFields(
            {
              full_name: fullAdmission.full_name,
              contact_phone: fullAdmission.contact_phone,
              email: fullAdmission.email,
              address_line1: fullAdmission.address_line1,
              address_line2: fullAdmission.address_line2,
              medicaid_id: fullAdmission.medicaid_id,
              ssn_last4: fullAdmission.ssn_last4,
              preferred_name: fullAdmission.preferred_name,
            },
            ['full_name', 'contact_phone', 'email', 'address_line1', 'address_line2', 'medicaid_id', 'ssn_last4', 'preferred_name'],
            tenantKey
          );

          const { first, last } = splitName(decrypted.full_name);

          // Re-encrypt for residents table
          const encFirst = encryptPHI(first, tenantKey);
          const encLast = encryptPHI(last, tenantKey);
          const encPhone = decrypted.contact_phone ? encryptPHI(decrypted.contact_phone, tenantKey) : null;
          const encEmail = decrypted.email ? encryptPHI(decrypted.email, tenantKey) : null;
          const encAddr1 = decrypted.address_line1 ? encryptPHI(decrypted.address_line1, tenantKey) : null;
          const encAddr2 = decrypted.address_line2 ? encryptPHI(decrypted.address_line2, tenantKey) : null;
          const encMedicaid = decrypted.medicaid_id ? encryptPHI(decrypted.medicaid_id, tenantKey) : null;
          const encSsn4 = decrypted.ssn_last4 ? encryptPHI(decrypted.ssn_last4, tenantKey) : null;

          // Create resident row
          const { rows: residentRows } = await client.query(
            `INSERT INTO care.residents (
                tenant_id, first_name, last_name, preferred_name, date_of_birth, gender, pronoun,
                phone, email, address_line1, address_line2, city, state, postal_code,
                medicaid_id, ssn_last4, primary_diagnosis,
                language_preference, tribal_affiliation, spiritual_religious,
                intake_date, has_advance_directive, has_guardian, guardian_representative,
                substance_use_flag, legal_risk_flag,
                consent_to_treatment, consent_date, status, created_by, updated_by
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17,
                $18, $19, $20,
                CURRENT_DATE, $21, $22, $23,
                $24, $25,
                'pending', CURRENT_DATE, 'active', $26, $26
              )
            RETURNING id`,
            [
              user.tenantId,
              encFirst, encLast, decrypted.preferred_name || null,
              fullAdmission.date_of_birth, fullAdmission.gender || null, fullAdmission.pronoun || null,
              encPhone, encEmail, encAddr1, encAddr2,
              fullAdmission.city || 'Unknown', fullAdmission.state || 'OR', fullAdmission.postal_code || '00000',
              encMedicaid, encSsn4, fullAdmission.primary_diagnosis || null,
              fullAdmission.language_preference || null, fullAdmission.tribal_affiliation || null,
              fullAdmission.spiritual_religious || null,
              fullAdmission.has_advance_directive ? 'yes' : 'no',
              fullAdmission.has_guardian || false,
              fullAdmission.guardian_representative || null,
              fullAdmission.substance_use_flag || false,
              fullAdmission.legal_risk_flag || false,
              user.staffId,
            ]
          );
          const residentId = residentRows[0].id;
          const residentDisplayName = `${first} ${last}`.trim() || 'New resident';

          // Create portal account with temporary password
          const plaintextPassword = generatePassword(14);
          const passwordHash = await bcrypt.hash(plaintextPassword, 12);
          const portalEmail = decrypted.email
            || `${first.toLowerCase().replace(/[^a-z]/g, '') || 'resident'}.${last.toLowerCase().replace(/[^a-z]/g, '') || residentId.slice(0, 8)}@dependablecare.local`;

          let accountId = null;
          try {
            const { rows: acctRows } = await client.query(
              `INSERT INTO care.user_accounts (
                 tenant_id, resident_id, email, username, password_hash, role, is_active, password_changed_required
               ) VALUES ($1, $2, $3, $3, $4, 'resident_care_of', TRUE, TRUE)
               ON CONFLICT (email) DO UPDATE
                  SET resident_id   = EXCLUDED.resident_id,
                      username      = EXCLUDED.username,
                      password_hash = EXCLUDED.password_hash,
                      password_changed_required = TRUE,
                      is_active     = TRUE,
                      failed_attempts = 0,
                      locked_until    = NULL,
                      updated_at      = NOW()
               RETURNING id`,
              [user.tenantId, residentId, portalEmail, passwordHash]
            );
            accountId = acctRows[0]?.id;

            // Audit the credential generation
            await client.query(
              `INSERT INTO audit_log.credential_history (
                 tenant_id, user_account_id, staff_id, resident_id, credential_type,
                 username, password_hash, was_temporary, generated_by, reason, generated_at
               ) VALUES ($1, $2, NULL, $3, 'resident', $4, $5, TRUE, $6, $7, NOW())`,
              [user.tenantId, accountId, residentId, portalEmail, passwordHash, user.staffId, 'Auto-provisioned on admission finalization']
            );
          } catch (err) {
            // Account creation should not block finalization — log and continue.
          }

          // Emit "care plan due" notification
          await client.query(
            `INSERT INTO care.notifications (
               tenant_id, role_filter, type, notification_type, category,
               title, body, action_url, resident_id, related_admission_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              user.tenantId,
              'manager,admin,superadmin',
              'care_plan_due',
              'care_plan_due',
              'workflow',
              'Care plan due',
              `New resident ${residentDisplayName} was just admitted. A care plan is due within 7 days.`,
              `/admin?view=care_plans&resident_id=${residentId}`,
              residentId,
              id,
            ]
          );

          // Emit one-time credentials notification (admin-only)
          if (accountId) {
            await client.query(
              `INSERT INTO care.notifications (
                 tenant_id, role_filter, type, notification_type, category,
                 title, body, action_url, resident_id, reference_id, related_admission_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                user.tenantId,
                'admin,superadmin',
                'credentials',
                'new_credentials',
                'account',
                `New resident account: ${residentDisplayName}`,
                JSON.stringify({
                  accountType: 'resident',
                  residentName: residentDisplayName,
                  email: portalEmail,
                  password: plaintextPassword,
                  mustChangeOnLogin: true,
                  oneTimeView: true,
                }),
                '/admin?view=account_management',
                residentId,
                accountId,
                id,
              ]
            );

            await client.query(
              `INSERT INTO care.notifications (
                 tenant_id, user_id, type, notification_type, category,
                 title, body, action_url, resident_id, reference_id, related_admission_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                user.tenantId,
                accountId,
                'credentials',
                'new_credentials',
                'account',
                'Your resident portal account is ready',
                JSON.stringify({
                  email: portalEmail,
                  temporaryPasswordIssued: true,
                  mustChangeOnLogin: true,
                }),
                '/auth/change-password-required',
                residentId,
                accountId,
                id,
              ]
            );
          }

          // Update pending_admissions to admitted status with resident_id
          await client.query(
            `UPDATE care.pending_admissions SET resident_id = $1, status = 'admitted' WHERE id = $2`,
            [residentId, id]
          );

          return {
            id,
            status: 'admitted',
            admissionId: id,
            pre_screening_complete: admission.pre_screening_complete,
            nursing_assessment_complete: admission.nursing_assessment_complete,
            advance_directive_complete: admission.advance_directive_complete,
            submitted_at: admission.submitted_at,
            created_at: admission.created_at,
            residentId,
            residentName: residentDisplayName,
            credentials: accountId ? { email: portalEmail, password: plaintextPassword } : null,
          };
        }

        return {
          id: admission.id,
          status: admission.status,
          admissionId: admission.id,
          pre_screening_complete: admission.pre_screening_complete,
          nursing_assessment_complete: admission.nursing_assessment_complete,
          advance_directive_complete: admission.advance_directive_complete,
          submitted_at: admission.submitted_at,
          created_at: admission.created_at,
        };
      }

      // INSERT new row. Status starts as 'pending' on pre-screening submit.
      const columnNames = Object.keys(encrypted).filter(k => encrypted[k] !== undefined);
      const columnValues = columnNames.map(k => encrypted[k]);

      const cols = [
        'tenant_id', 'created_by', 'status',
        blobColumn, completeFlag,
        'is_encrypted', 'encrypted_at',
        ...(submit ? ['submitted_at'] : []),
        ...columnNames,
      ];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const params = [
        user.tenantId,
        user.staffId,
        submit ? 'pending' : 'pending', // always pending — draft state tracked by completion flags
        JSON.stringify(formData),
        !!markComplete,
        true,
        new Date(),
        ...(submit ? [new Date()] : []),
        ...columnValues,
      ];

      const { rows } = await client.query(
        `INSERT INTO care.pending_admissions (${cols.join(', ')})
         VALUES (${placeholders})
         RETURNING id, status, pre_screening_complete, nursing_assessment_complete, advance_directive_complete, submitted_at, created_at`,
        params
      );

      return {
        id: rows[0].id,
        status: rows[0].status,
        admissionId: rows[0].id,
        pre_screening_complete: rows[0].pre_screening_complete,
        nursing_assessment_complete: rows[0].nursing_assessment_complete,
        advance_directive_complete: rows[0].advance_directive_complete,
        submitted_at: rows[0].submitted_at,
        created_at: rows[0].created_at,
      };
    });

    await audit[admissionId ? 'logUpdate' : 'logInsert']({
      tableName: 'care.pending_admissions',
      recordId: result.id,
      newValues: { id: result.id, formType, status: result.status },
      req: getRequestContext(request, user),
    });

    const responseData = {
      id: result.id,
      admissionId: result.admissionId,
      status: result.status,
      preScreeningComplete: result.pre_screening_complete,
      nursingAssessmentComplete: result.nursing_assessment_complete,
      advanceDirectiveComplete: result.advance_directive_complete,
      submittedAt: result.submitted_at,
      createdAt: result.created_at,
    };

    // If finalized, include resident credentials
    if (result.residentId) {
      responseData.residentId = result.residentId;
      responseData.residentName = result.residentName;
      responseData.credentials = result.credentials;
    }

    return Response.json({
      data: responseData,
    }, { status: admissionId ? 200 : 201 });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}

/**
 * GET /api/v1/admission/forms
 * List admissions (defaults to status=pending for admin review).
 * Staff users may only see pending admissions for residents they're assigned to.
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
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const submittedOnly = searchParams.get('submitted_only') === '1';

    const tenantKey = getTenantKey();

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['pa.tenant_id = $1'];
      const params = [user.tenantId];

      // Per-resident assignment gate (disabled under facility-wide staff policy)
      if (staffAssignmentRequired(user)) {
        conditions.push(
          `EXISTS (
            SELECT 1 FROM care.staff_assignments
            WHERE tenant_id = $${params.length + 1}
              AND staff_id = $${params.length + 2}
              AND resident_id = pa.resident_id
              AND is_active = TRUE
          )`
        );
        params.push(user.tenantId, user.staffId);
      }

      if (status) {
        params.push(status);
        conditions.push(`pa.status = $${params.length}`);
      }
      if (submittedOnly) {
        conditions.push('pa.submitted_at IS NOT NULL');
      }
      params.push(limit, offset);

      const { rows } = await client.query(
        `SELECT pa.id, pa.resident_id, pa.status, pa.full_name, pa.date_of_birth, pa.contact_phone,
                pa.emergency_contact, pa.created_by, pa.approved_by, pa.created_at, pa.updated_at,
                pa.approved_at, pa.submitted_at, pa.rejection_reason,
                pa.pre_screening_complete, pa.nursing_assessment_complete, pa.advance_directive_complete,
                COUNT(*) OVER() AS total_count
           FROM care.pending_admissions pa
          WHERE ${conditions.join(' AND ')}
          ORDER BY COALESCE(pa.submitted_at, pa.created_at) DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    const total = parseInt(rows[0]?.total_count || 0);
    const data = rows.map(row => {
      const decrypted = decryptFields(
        { full_name: row.full_name, contact_phone: row.contact_phone, emergency_contact: row.emergency_contact },
        ['full_name', 'contact_phone', 'emergency_contact'],
        tenantKey
      );
      return {
        id: row.id,
        resident_id: row.resident_id,
        status: row.status,
        full_name: decrypted.full_name,
        date_of_birth: row.date_of_birth,
        contact_phone: decrypted.contact_phone,
        emergency_contact: decrypted.emergency_contact,
        pre_screening_complete: row.pre_screening_complete,
        nursing_assessment_complete: row.nursing_assessment_complete,
        advance_directive_complete: row.advance_directive_complete,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        approved_at: row.approved_at,
        rejection_reason: row.rejection_reason,
      };
    });

    audit
      .logSelect({ tableName: 'care.pending_admissions', req: getRequestContext(request, user) })

    return Response.json({
      data,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

// Single source of truth for the Resident Face Sheet, mirroring the
// "Dependable Care Resident Face Sheet" document. Drives both the editable
// form and the read-only display, in admin and staff views.
//
// Field shape: { key, label, type?, options?, sensitive?, autofill? }
//   type:      'text' (default) | 'date' | 'textarea' | 'select'
//   sensitive: true  -> PHI masked for non-privileged roles, encrypted at rest
//   autofill:  key on the resident record used to pre-fill when empty

export const FACE_SHEET_SECTIONS = [
  {
    id: 'identification',
    title: 'Resident Identification',
    fields: [
      { key: 'legal_name',           label: 'Resident Legal Name',  autofill: 'full_name' },
      { key: 'preferred_name',       label: 'Chosen / Preferred Name', autofill: ['preferred_name', 'preferredName'] },
      { key: 'pronouns',             label: 'Pronouns',             autofill: ['pronoun', 'preferred_pronouns'] },
      { key: 'gender_identity',      label: 'Gender Identity',      autofill: ['gender', 'sex'] },
      { key: 'date_of_birth',        label: 'Date of Birth',        type: 'date', autofill: ['date_of_birth', 'dateOfBirth', 'dob'] },
      { key: 'age',                  label: 'Age',                  computed: 'age' },
      { key: 'marital_status',       label: 'Marital Status' },
      { key: 'religious_preference', label: 'Religious Preference', autofill: ['spiritual_religious', 'religious_preference'] },
      { key: 'ssn',                  label: 'Social Security #',    sensitive: true },
      { key: 'resident_id',          label: 'Resident ID #',        autofill: ['resident_code', 'resident_number', 'id'] },
      { key: 'previous_address',     label: 'Previous Address',     type: 'textarea' },
      { key: 'date_of_admission',    label: 'Date of Admission',    type: 'date', autofill: ['intake_date', 'submitted_at'] },
      { key: 'admitted_from',        label: 'Admitted From',        autofill: ['current_living_situation', 'livingSituation'] },
    ],
  },
  {
    id: 'legal_status',
    title: 'Legal Status & Capability',
    fields: [
      { key: 'legal_status',            label: 'Legal Status',           type: 'select', options: ['Voluntary', 'Involuntary', 'Court-Ordered', 'Other'], autofill: ['legal_status', 'legalStatus'] },
      { key: 'capability',              label: 'Capability',             type: 'select', options: ['Capable', 'Limited Capability', 'Incapable', 'Pending Determination'] },
      { key: 'advance_directive_status', label: 'Advance Directive Status', type: 'select', options: ['On File', 'Not on File', 'Declined', 'N/A'], autofill: ['advance_directive_status', 'has_advance_directive'] },
      { key: 'polst_dnr',               label: 'POLST / DNR on File',    type: 'select', options: ['Yes', 'No'], autofill: ['has_advance_directive', 'advance_directive_status', 'cpr_preference'] },
      { key: 'polst_dnr_date',          label: 'Date Signed',            type: 'date', autofill: ['resident_signature_date', 'form_completed_date', 'submitted_at'] },
      { key: 'evacuation_capability',   label: 'Evacuation Capability',  type: 'select', options: ['Independent', 'Requires Assistance', 'Non-Ambulatory', 'Total Assist'], autofill: ['evacuation_capability', 'mobilityStatus', 'mobility_status'] },
      { key: 'mobility_aids',           label: 'Mobility Aids / Notes',  type: 'textarea', autofill: ['mobility_aids', 'assistiveDevice', 'assist_devices'] },
    ],
  },
  {
    id: 'insurance',
    title: 'Insurance Information',
    fields: [
      { key: 'primary_insurance',     label: 'Primary Insurance', autofill: ['insurance_type', 'otherInsurance'] },
      { key: 'primary_policy_id',     label: 'Policy / ID #', autofill: ['insurance_member_id', 'otherInsuranceId', 'medicaid_id'] },
      { key: 'primary_group',         label: 'Group #' },
      { key: 'primary_effective_date', label: 'Effective Date', type: 'date' },
      { key: 'secondary_insurance',   label: 'Secondary Insurance', autofill: ['secondary_insurance', 'otherInsurance'] },
      { key: 'secondary_policy_id',   label: 'Policy / ID #', autofill: ['secondary_policy_id', 'otherInsuranceId'] },
      { key: 'medicare_number',       label: 'Medicare #',  sensitive: true },
      { key: 'medicaid_number',       label: 'Medicaid #',  sensitive: true, autofill: 'medicaid_id' },
      { key: 'insurance_phone',       label: 'Insurance Phone', autofill: ['insurance_contact_phone', 'contactPhone'] },
      { key: 'subscriber',            label: 'Subscriber (if not resident)', autofill: ['contactPerson', 'emergency_contact'] },
    ],
  },
  {
    id: 'diagnoses_allergies',
    title: 'Diagnoses & Allergies',
    fields: [
      { key: 'dsm_primary',              label: 'DSM Diagnosis (Primary)',      autofill: ['primary_diagnosis', 'primaryDiagnosis', 'primary_dsm5_diagnosis'] },
      { key: 'dsm_secondary',            label: 'DSM Diagnosis (Secondary)',    autofill: ['secondary_diagnoses', 'secondaryDiagnoses'] },
      { key: 'additional_behavioral_dx', label: 'Additional Behavioral Health Dx', type: 'textarea', autofill: ['mental_health_assessment', 'nursing_assessment_notes'] },
      { key: 'physical_dx',              label: 'Physical Health Diagnosis',    type: 'textarea', autofill: ['medicalDiagnoses', 'medical_conditions', 'physical_diagnosis'] },
      { key: 'additional_medical',       label: 'Additional Medical Conditions', type: 'textarea', autofill: ['medicalDiagnoses', 'medical_conditions', 'additionalMedicalConditions'] },
      { key: 'allergies_medication',     label: 'Allergies (Medication)',       type: 'textarea', autofill: ['allergyMedication', 'allergy_medication'] },
      { key: 'allergies_food_env',       label: 'Allergies (Food / Environmental)', type: 'textarea', autofill: ['allergyFood', 'allergyEnvironmental', 'allergyLatex', 'allergyOther'] },
      { key: 'allergy_severity',         label: 'Allergy Reaction / Severity',  type: 'textarea', autofill: ['allergySeverity', 'allergy_reaction', 'allergyReaction'] },
    ],
  },
  {
    id: 'providers',
    title: 'Medical & Behavioral Health Providers',
    fields: [
      { key: 'pcp_name',           label: 'Primary Care Physician (PCP)', autofill: 'primary_physician' },
      { key: 'pcp_clinic',         label: 'PCP Clinic / Address' },
      { key: 'pcp_phone',          label: 'PCP Phone', autofill: 'primary_physician_phone' },
      { key: 'psychiatrist_name',  label: 'Psychiatrist', autofill: 'outpatient_psychiatrist' },
      { key: 'psychiatrist_clinic', label: 'Psychiatrist Clinic / Address' },
      { key: 'psychiatrist_phone', label: 'Psychiatrist Phone', autofill: 'outpatient_psychiatrist_phone' },
      { key: 'therapist_name',     label: 'Therapist / Counselor', autofill: 'outpatient_therapist' },
      { key: 'therapist_phone',    label: 'Therapist Phone', autofill: 'outpatient_therapist_phone' },
      { key: 'dentist_name',       label: 'Dentist' },
      { key: 'dentist_phone',      label: 'Dentist Phone' },
      { key: 'specialist_type',    label: 'Specialist (Type)' },
      { key: 'specialist_name',    label: 'Specialist Name' },
      { key: 'specialist_phone',   label: 'Specialist Phone' },
      { key: 'specialist_address', label: 'Specialist Address' },
      { key: 'additional_specialist', label: 'Additional Specialist', type: 'textarea' },
    ],
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy Information',
    fields: [
      { key: 'preferred_pharmacy', label: 'Preferred Pharmacy' },
      { key: 'pharmacy_address',   label: 'Pharmacy Address' },
      { key: 'pharmacy_phone',     label: 'Pharmacy Phone' },
      { key: 'pharmacy_fax',       label: 'Pharmacy Fax' },
      { key: 'backup_pharmacy',    label: 'After-Hours / Backup Pharmacy' },
    ],
  },
  {
    id: 'emergency_contacts',
    title: 'Emergency Contacts',
    fields: [
      { key: 'primary_name',         label: 'Primary Emergency Contact', autofill: ['emergency_contact', 'emergencyName', 'contactPerson'] },
      { key: 'primary_relationship', label: 'Relationship', autofill: ['emergency_contact_relationship', 'emergencyRelationship', 'contactPersonRelationship'] },
      { key: 'primary_phone_home',   label: 'Phone (Home)' },
      { key: 'primary_phone_cell',   label: 'Phone (Cell)', autofill: ['emergency_contact_phone', 'emergencyPhone', 'contactPhone'] },
      { key: 'primary_address',      label: 'Address', type: 'textarea' },
      { key: 'primary_email',        label: 'Email', autofill: ['emergency_contact_email', 'contactEmail'] },
      { key: 'secondary_name',         label: 'Secondary Emergency Contact' },
      { key: 'secondary_relationship', label: 'Relationship' },
      { key: 'secondary_phone',        label: 'Phone' },
      { key: 'secondary_email',        label: 'Email' },
    ],
  },
  {
    id: 'legal_reps',
    title: 'Legal Representatives, Guardian & Family',
    fields: [
      { key: 'legal_rep_name',      label: 'Legal Representative', autofill: ['guardian_representative', 'agent_name', 'healthcare_agent_name'] },
      { key: 'legal_rep_authority', label: 'Type / Authority', autofill: ['healthcare_agent_relationship', 'legal_status'] },
      { key: 'legal_rep_phone',     label: 'Legal Rep Phone', autofill: ['healthcare_agent_phone', 'agent_phone'] },
      { key: 'legal_rep_email',     label: 'Legal Rep Email', autofill: ['healthcare_agent_email', 'agent_email'] },
      { key: 'legal_rep_address',   label: 'Legal Rep Address', type: 'textarea', autofill: ['healthcare_agent_address', 'agent_address'] },
      { key: 'guardian_name',       label: 'Guardian', autofill: ['guardian_representative', 'agent_name', 'healthcare_agent_name'] },
      { key: 'guardian_phone',      label: 'Guardian Phone', autofill: ['healthcare_agent_phone', 'agent_phone'] },
      { key: 'guardian_address',    label: 'Guardian Address', type: 'textarea', autofill: ['healthcare_agent_address', 'agent_address'] },
      { key: 'conservator_name',    label: 'Conservator' },
      { key: 'conservator_phone',   label: 'Conservator Phone' },
      { key: 'conservator_address', label: 'Conservator Address', type: 'textarea' },
      { key: 'nok_name',            label: 'Parent(s) / Next of Kin' },
      { key: 'nok_relationship',    label: 'Relationship' },
      { key: 'nok_phone',           label: 'Parent / NOK Phone' },
      { key: 'nok_email',           label: 'Parent / NOK Email' },
      { key: 'nok_address',         label: 'Parent / NOK Address', type: 'textarea' },
    ],
  },
  {
    id: 'service_coordination',
    title: 'Service Coordination',
    fields: [
      { key: 'case_manager',          label: 'Case Manager', autofill: 'outpatient_case_manager' },
      { key: 'agency',                label: 'Agency' },
      { key: 'case_manager_phone',    label: 'Case Manager Phone', autofill: 'outpatient_case_manager_phone' },
      { key: 'case_manager_email',    label: 'Case Manager Email' },
      { key: 'therapist_primary',     label: 'Therapist (Primary)', autofill: 'outpatient_therapist' },
      { key: 'therapist_contact',     label: 'Phone / Email' },
      { key: 'additional_therapist',  label: 'Additional Therapist / Modality' },
      { key: 'day_program',           label: 'Day Program' },
      { key: 'day_program_phone',     label: 'Day Program Phone' },
      { key: 'day_program_address',   label: 'Day Program Address', type: 'textarea' },
      { key: 'day_program_schedule',  label: 'Day Program Schedule' },
      { key: 'transportation_provider', label: 'Transportation Provider' },
      { key: 'transportation_phone',  label: 'Transportation Phone' },
    ],
  },
  {
    id: 'signatures',
    title: 'Signatures',
    fields: [
      { key: 'form_completed_date',    label: 'Date Form Completed', type: 'date' },
      { key: 'form_updated_date',      label: 'Form Updated',        type: 'date' },
      { key: 'resident_signature',     label: 'Resident / Representative Signature' },
      { key: 'resident_signature_date', label: 'Signature Date',     type: 'date' },
      { key: 'staff_name_title',       label: 'Staff Completing Form (Print Name & Title)' },
      { key: 'staff_signature_date',   label: 'Staff Date',          type: 'date' },
    ],
  },
];

// Keys whose values are PHI requiring encryption at rest + masking on read.
export const FACE_SHEET_SENSITIVE_KEYS = FACE_SHEET_SECTIONS
  .flatMap((s) => s.fields)
  .filter((f) => f.sensitive)
  .map((f) => f.key);

function asSources(input) {
  const expand = (source) => {
    if (!source || typeof source !== 'object') return source;
    const nested = [
      source.form_data,
      source.face_sheet_autofill,
      source.pre_screening_data,
      source.nursing_assessment_data,
      source.advance_directive_data,
    ].filter((value) => value && typeof value === 'object' && !Array.isArray(value));
    return nested.length ? Object.assign({}, source, ...nested) : source;
  };
  if (Array.isArray(input)) return input.filter(Boolean).map(expand);
  return input ? [expand(input)] : [];
}

function sourceValue(source, key) {
  if (!source || !key) return undefined;
  if (key in source && source[key] != null && source[key] !== '') return source[key];
  const wanted = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
  for (const [candidateKey, candidateValue] of Object.entries(source)) {
    if (candidateValue == null || candidateValue === '') continue;
    const normalized = String(candidateKey)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
    if (normalized === wanted) return candidateValue;
  }
  return undefined;
}

function firstValue(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      const value = sourceValue(source, key);
      if (value != null) return value;
    }
  }
  return undefined;
}

// Build the auto-fill values from one or more source records for fields left blank.
export function faceSheetAutofill(sourceInput = {}) {
  const sources = asSources(sourceInput);
  const out = {};
  if (!sources.length) return out;
  const fullName =
    firstValue(sources, ['full_name', 'client_full_name', 'legal_name', 'name']) ||
    [firstValue(sources, ['first_name']), firstValue(sources, ['last_name'])].filter(Boolean).join(' ').trim();
  for (const section of FACE_SHEET_SECTIONS) {
    for (const f of section.fields) {
      if (!f.autofill) continue;
      const aliases = Array.isArray(f.autofill) ? f.autofill : [f.autofill];
      if (aliases.includes('full_name')) {
        if (fullName) out[f.key] = fullName;
        continue;
      }
      const value = firstValue(sources, [
        ...aliases,
        aliases[0] === 'pronoun' ? 'pronouns' : null,
        aliases[0] === 'gender' ? 'sex' : null,
        aliases[0] === 'date_of_birth' ? 'dob' : null,
        aliases[0] === 'primary_physician' ? 'pcp_name' : null,
        aliases[0] === 'primary_physician_phone' ? 'pcp_phone' : null,
        aliases[0] === 'outpatient_therapist' ? 'therapist_name' : null,
        aliases[0] === 'outpatient_therapist_phone' ? 'therapist_phone' : null,
        aliases[0] === 'outpatient_psychiatrist' ? 'psychiatrist_name' : null,
        aliases[0] === 'outpatient_psychiatrist_phone' ? 'psychiatrist_phone' : null,
        aliases[0] === 'outpatient_case_manager' ? 'case_manager' : null,
        aliases[0] === 'outpatient_case_manager_phone' ? 'case_manager_phone' : null,
        aliases[0] === 'emergency_contact' ? 'emergency_contact_name' : null,
        aliases[0] === 'emergency_contact_relationship' ? 'emergency_contact_relation' : null,
        aliases[0] === 'emergency_contact_phone' ? 'rep_phone' : null,
        aliases[0] === 'guardian_representative' ? 'agent_name' : null,
        aliases[0] === 'resident_code' ? 'resident_number' : null,
      ].filter(Boolean));
      if (value != null) {
        out[f.key] = f.type === 'date' && typeof value === 'string' && value.length > 10
          ? value.slice(0, 10)
          : value;
      }
    }
  }
  return out;
}

export function computeAge(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d)) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 150 ? String(age) : '';
}

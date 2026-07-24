import { RESTRICTED_VALUE } from '@/lib/roles.js';

// Face-sheet upload schema helpers.
// Keep these fields aligned to the existing residents PATCH endpoint.

export const FACE_SHEET_SECTIONS = [
  {
    title: 'Overview',
    fields: [
      { key: 'room', label: 'Room', type: 'text' },
      { key: 'care_level', label: 'Care Level', type: 'text' },
      { key: 'status', label: 'Status', type: 'select' },
    ],
  },
  {
    title: 'Resident Identification',
    fields: [
      { key: 'legal_name', label: 'Resident Legal Name', type: 'text' },
      { key: 'preferred_name', label: 'Chosen / Preferred Name', type: 'text' },
      { key: 'pronouns', label: 'Pronouns', type: 'text' },
      { key: 'gender_identity', label: 'Gender Identity', type: 'text' },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'age', label: 'Age', type: 'text' },
      { key: 'marital_status', label: 'Marital Status', type: 'text' },
      { key: 'religious_preference', label: 'Religious Preference', type: 'text' },
      { key: 'ssn', label: 'Social Security #', type: 'text' },
      { key: 'resident_id', label: 'Resident ID #', type: 'text' },
      { key: 'previous_address', label: 'Previous Address', type: 'textarea' },
      { key: 'date_of_admission', label: 'Date of Admission', type: 'date' },
      { key: 'admitted_from', label: 'Admitted From', type: 'text' },
    ],
  },
  {
    title: 'Legal Status & Capability',
    fields: [
      { key: 'legal_status', label: 'Legal Status', type: 'text' },
      { key: 'capability', label: 'Capability', type: 'text' },
      { key: 'advance_directive_status', label: 'Advance Directive Status', type: 'text' },
      { key: 'polst_dnr', label: 'POLST / DNR on File', type: 'text' },
      { key: 'polst_dnr_date', label: 'Date Signed', type: 'date' },
      { key: 'evacuation_capability', label: 'Evacuation Capability', type: 'text' },
      { key: 'mobility_aids', label: 'Mobility Aids / Notes', type: 'textarea' },
    ],
  },
  {
    title: 'Insurance',
    fields: [
      { key: 'primary_insurance', label: 'Primary Insurance', type: 'text' },
      { key: 'primary_policy_id', label: 'Policy / ID #', type: 'text' },
      { key: 'primary_group', label: 'Group #', type: 'text' },
      { key: 'primary_effective_date', label: 'Effective Date', type: 'date' },
      { key: 'secondary_insurance', label: 'Secondary Insurance', type: 'text' },
      { key: 'secondary_policy_id', label: 'Policy / ID #', type: 'text' },
      { key: 'medicare_number', label: 'Medicare #', type: 'text' },
      { key: 'medicaid_number', label: 'Medicaid #', type: 'text' },
      { key: 'insurance_phone', label: 'Insurance Phone', type: 'text' },
      { key: 'subscriber', label: 'Subscriber', type: 'text' },
    ],
  },
  {
    title: 'Diagnoses & Allergies',
    fields: [
      { key: 'dsm_primary', label: 'DSM Diagnosis (Primary)', type: 'textarea' },
      { key: 'dsm_secondary', label: 'DSM Diagnosis (Secondary)', type: 'textarea' },
      { key: 'additional_behavioral_dx', label: 'Additional Behavioral Health Dx', type: 'textarea' },
      { key: 'physical_dx', label: 'Physical Health Diagnosis', type: 'textarea' },
      { key: 'additional_medical', label: 'Additional Medical Conditions', type: 'textarea' },
      { key: 'allergies_medication', label: 'Allergies (Medication)', type: 'textarea' },
      { key: 'allergies_food_env', label: 'Allergies (Food / Environmental)', type: 'textarea' },
      { key: 'allergy_severity', label: 'Allergy Reaction / Severity', type: 'textarea' },
    ],
  },
  {
    title: 'Medical/Behavioral Providers',
    fields: [
      { key: 'pcp_name', label: 'Primary Care Physician (PCP)', type: 'text' },
      { key: 'pcp_clinic', label: 'PCP Clinic / Address', type: 'text' },
      { key: 'pcp_phone', label: 'PCP Phone', type: 'text' },
      { key: 'psychiatrist_name', label: 'Psychiatrist', type: 'text' },
      { key: 'psychiatrist_clinic', label: 'Psychiatrist Clinic / Address', type: 'text' },
      { key: 'psychiatrist_phone', label: 'Psychiatrist Phone', type: 'text' },
      { key: 'therapist_name', label: 'Therapist / Counselor', type: 'text' },
      { key: 'therapist_phone', label: 'Therapist Phone', type: 'text' },
      { key: 'dentist_name', label: 'Dentist', type: 'text' },
      { key: 'dentist_phone', label: 'Dentist Phone', type: 'text' },
      { key: 'specialist_type', label: 'Specialist (Type)', type: 'text' },
      { key: 'specialist_name', label: 'Specialist Name', type: 'text' },
      { key: 'specialist_phone', label: 'Specialist Phone', type: 'text' },
      { key: 'specialist_address', label: 'Specialist Address', type: 'textarea' },
      { key: 'additional_specialist', label: 'Additional Specialist', type: 'textarea' },
    ],
  },
  {
    title: 'Pharmacy',
    fields: [
      { key: 'preferred_pharmacy', label: 'Preferred Pharmacy', type: 'text' },
      { key: 'pharmacy_address', label: 'Pharmacy Address', type: 'textarea' },
      { key: 'pharmacy_phone', label: 'Pharmacy Phone', type: 'text' },
      { key: 'pharmacy_fax', label: 'Pharmacy Fax', type: 'text' },
      { key: 'backup_pharmacy', label: 'After-Hours / Backup Pharmacy', type: 'text' },
    ],
  },
  {
    title: 'Emergency Contacts',
    fields: [
      { key: 'primary_name', label: 'Primary Emergency Contact', type: 'text' },
      { key: 'primary_relationship', label: 'Relationship', type: 'text' },
      { key: 'primary_phone_home', label: 'Phone (Home)', type: 'text' },
      { key: 'primary_phone_cell', label: 'Phone (Cell)', type: 'text' },
      { key: 'primary_address', label: 'Address', type: 'textarea' },
      { key: 'primary_email', label: 'Email', type: 'text' },
      { key: 'secondary_name', label: 'Secondary Emergency Contact', type: 'text' },
      { key: 'secondary_relationship', label: 'Relationship', type: 'text' },
      { key: 'secondary_phone', label: 'Phone', type: 'text' },
      { key: 'secondary_email', label: 'Email', type: 'text' },
    ],
  },
  {
    title: 'Legal Representatives/Guardian/Family',
    fields: [
      { key: 'legal_rep_name', label: 'Legal Representative', type: 'text' },
      { key: 'legal_rep_authority', label: 'Type / Authority', type: 'text' },
      { key: 'legal_rep_phone', label: 'Legal Rep Phone', type: 'text' },
      { key: 'legal_rep_email', label: 'Legal Rep Email', type: 'text' },
      { key: 'legal_rep_address', label: 'Legal Rep Address', type: 'textarea' },
      { key: 'guardian_name', label: 'Guardian', type: 'text' },
      { key: 'guardian_phone', label: 'Guardian Phone', type: 'text' },
      { key: 'guardian_address', label: 'Guardian Address', type: 'textarea' },
      { key: 'conservator_name', label: 'Conservator', type: 'text' },
      { key: 'conservator_phone', label: 'Conservator Phone', type: 'text' },
      { key: 'conservator_address', label: 'Conservator Address', type: 'textarea' },
      { key: 'nok_name', label: 'Parent(s) / Next of Kin', type: 'text' },
      { key: 'nok_relationship', label: 'Relationship', type: 'text' },
      { key: 'nok_phone', label: 'Parent / NOK Phone', type: 'text' },
      { key: 'nok_email', label: 'Parent / NOK Email', type: 'text' },
      { key: 'nok_address', label: 'Parent / NOK Address', type: 'textarea' },
    ],
  },
  {
    title: 'Service Coordination',
    fields: [
      { key: 'case_manager', label: 'Case Manager', type: 'text' },
      { key: 'agency', label: 'Agency', type: 'text' },
      { key: 'case_manager_phone', label: 'Case Manager Phone', type: 'text' },
      { key: 'case_manager_email', label: 'Case Manager Email', type: 'text' },
      { key: 'therapist_primary', label: 'Therapist (Primary)', type: 'text' },
      { key: 'therapist_contact', label: 'Phone / Email', type: 'text' },
      { key: 'additional_therapist', label: 'Additional Therapist / Modality', type: 'textarea' },
      { key: 'day_program', label: 'Day Program', type: 'text' },
      { key: 'day_program_phone', label: 'Day Program Phone', type: 'text' },
      { key: 'day_program_address', label: 'Day Program Address', type: 'textarea' },
      { key: 'day_program_schedule', label: 'Day Program Schedule', type: 'textarea' },
      { key: 'transportation_provider', label: 'Transportation Provider', type: 'text' },
      { key: 'transportation_phone', label: 'Transportation Phone', type: 'text' },
    ],
  },
  {
    title: 'Signatures',
    fields: [
      { key: 'form_completed_date', label: 'Date Form Completed', type: 'date' },
      { key: 'form_updated_date', label: 'Form Updated', type: 'date' },
      { key: 'resident_signature', label: 'Resident / Representative Signature', type: 'textarea' },
      { key: 'resident_signature_date', label: 'Signature Date', type: 'date' },
      { key: 'staff_name_title', label: 'Staff Completing Form (Print Name & Title)', type: 'text' },
      { key: 'staff_signature_date', label: 'Staff Date', type: 'date' },
    ],
  },
];

export const FACE_SHEET_FIELDS = FACE_SHEET_SECTIONS.flatMap((section) =>
  section.fields.map((field) => field.key)
);

export const FACE_SHEET_ENCRYPTED_FIELDS = [
  'ssn',
  'previous_address',
  'polst_dnr_date',
  'primary_policy_id',
  'secondary_policy_id',
  'medicare_number',
  'medicaid_number',
  'insurance_phone',
  'pcp_clinic',
  'pcp_phone',
  'psychiatrist_clinic',
  'psychiatrist_phone',
  'therapist_phone',
  'dentist_phone',
  'specialist_phone',
  'specialist_address',
  'pharmacy_address',
  'pharmacy_phone',
  'primary_phone_home',
  'primary_phone_cell',
  'primary_address',
  'primary_email',
  'secondary_phone',
  'secondary_email',
  'legal_rep_phone',
  'legal_rep_email',
  'legal_rep_address',
  'guardian_phone',
  'guardian_address',
  'conservator_phone',
  'conservator_address',
  'nok_phone',
  'nok_email',
  'nok_address',
  'case_manager_phone',
  'case_manager_email',
  'day_program_phone',
  'day_program_address',
  'transportation_phone',
  'resident_signature',
  'resident_signature_date',
];

export function maskFaceSheetPHI(data) {
  if (!data || typeof data !== 'object') return data;
  const masked = { ...data };
  for (const field of FACE_SHEET_ENCRYPTED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(masked, field)) {
      masked[field] = RESTRICTED_VALUE;
    }
  }
  return masked;
}

export const FACE_SHEET_PARSE_FIELDS = FACE_SHEET_FIELDS;

export function buildFaceSheetSchema(z) {
  const fieldTypes = new Map(
    FACE_SHEET_SECTIONS.flatMap((section) => section.fields.map((field) => [field.key, field.type]))
  );
  const shape = Object.fromEntries(
    FACE_SHEET_FIELDS.map((key) => {
      const schema = z.string();
      return [key, fieldTypes.get(key) === 'date' ? schema.describe('YYYY-MM-DD').nullish() : schema.nullish()];
    })
  );
  return z.object(shape);
}

const str = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());

const LEGACY_PARSE_FIELD_ALIASES = {
  firstName: 'firstName',
  lastName: 'lastName',
  roomAssignment: 'room',
};

export function mergeParsedFaceSheet(current, parsed) {
  if (!parsed || typeof parsed !== 'object') return current;
  const next = { ...current };

  for (const [key, value] of Object.entries(parsed)) {
    const parsedValue = str(value);
    if (!parsedValue) continue;
    next[key] = parsedValue;

    const legacyKey = LEGACY_PARSE_FIELD_ALIASES[key];
    if (legacyKey) next[legacyKey] = parsedValue;
  }

  return next;
}

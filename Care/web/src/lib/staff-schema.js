// Shared option lists + parsed-payload merge for the add-staff form.
// Framework-agnostic (no React/zod); imported by AddStaffPage and the staff
// upload parser (/api/v1/staff/parse).

export const STAFF_ROLES = [
  'Registered nurse',
  'Licensed practical nurse',
  'Caregiver',
  'Medication aide',
  'Care manager',
  'Administrator',
  'Director',
  'Other',
];

export const CREDENTIAL_OPTIONS = [
  'Certified Nursing Assistant (CNA)',
  'CPR / First Aid',
  'Registered Nurse license',
  'Medication aide credential',
  'Dementia care training',
  'Fire & evacuation safety',
  'Mandatory reporter training',
  'Mental health first aid',
];

export const PRONOUN_OPTIONS = ['She / her', 'He / him', 'They / them', 'Other / not specified'];
export const STAFF_STATUS_OPTIONS = ['Active', 'Inactive', 'On leave'];
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Per diem', 'Contract', 'Temporary'];
export const STAFF_SHIFTS = ['Day shift', 'Evening shift', 'Night shift', 'Swing shift', 'Variable'];
export const RELATION_OPTIONS = ['Spouse / partner', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'];
export const CREDENTIAL_STATUS = ['Current', 'Renewal due', 'Expired', 'Pending'];

const str = (val) => (typeof val === 'string' ? val.trim() : val == null ? '' : String(val).trim());
const isDate = (val) => /^\d{4}-\d{2}-\d{2}$/.test(str(val));

// Merge an AI-parsed staff payload into the current form state. Only overwrites a
// field when the parser supplied a usable value, so a partial extraction never
// wipes what the user already has. Credentials are handled separately (they live
// in their own state) via parsedStaffCredentials().
export function mergeParsedStaff(current, fields) {
  if (!fields || typeof fields !== 'object') return current;
  const out = { ...current };

  const setStr = (key, val) => { const s = str(val); if (s) out[key] = s; };
  const setEnum = (key, val, allowed) => { const s = str(val); if (s && allowed.includes(s)) out[key] = s; };
  const setDate = (key, val) => { if (isDate(val)) out[key] = str(val); };

  setStr('firstName', fields.firstName);
  setStr('lastName', fields.lastName);
  setStr('preferredName', fields.preferredName);
  setEnum('pronouns', fields.pronouns, PRONOUN_OPTIONS);
  setEnum('role', fields.role, STAFF_ROLES);
  setStr('employeeId', fields.employeeId);
  setEnum('status', fields.status, STAFF_STATUS_OPTIONS);

  setStr('organizationName', fields.organizationName);
  setStr('organizationId', fields.organizationId);
  setStr('facilityName', fields.facilityName);
  setStr('facilityId', fields.facilityId);
  setStr('primaryArea', fields.primaryArea);
  setStr('reportsTo', fields.reportsTo);

  setStr('email', fields.email);
  setStr('phone', fields.phone);
  setEnum('employmentType', fields.employmentType, EMPLOYMENT_TYPES);
  setEnum('shift', fields.shift, STAFF_SHIFTS);
  setDate('startDate', fields.startDate);

  setStr('emergencyContactName', fields.emergencyContactName);
  setStr('emergencyContactPhone', fields.emergencyContactPhone);
  setEnum('emergencyContactRelation', fields.emergencyContactRelation, RELATION_OPTIONS);

  setStr('notes', fields.notes);

  return out;
}

// Map parsed credentials into the credential-card shape used by the form.
export function parsedStaffCredentials(fields) {
  if (!Array.isArray(fields?.credentials)) return [];
  return fields.credentials
    .map((c) => ({
      label: str(c?.label),
      detail: str(c?.detail),
      expiresOn: isDate(c?.expiresOn) ? str(c?.expiresOn) : '',
      status: CREDENTIAL_STATUS.includes(str(c?.status)) ? str(c?.status) : 'Current',
      custom: !CREDENTIAL_OPTIONS.includes(str(c?.label)),
    }))
    .filter((c) => c.label);
}

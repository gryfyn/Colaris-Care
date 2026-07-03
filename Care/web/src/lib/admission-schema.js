// Shared option lists + parsed-payload merge for the admission wizard.
// Single source of truth used by both AdmissionForm (UI) and the admission
// upload parser (/api/v1/admissions/parse). Framework-agnostic (no React/zod).

export const CONDITION_OPTIONS = [
  'Diabetes', 'Hypertension', 'COPD', 'Depression', 'Fall history',
  'Seizure disorder', 'CHF', 'Chronic pain',
];

export const BEHAVIORAL_CONCERNS = [
  'Aggression', 'Wandering', 'Elopement Risk', 'Self Harm Risk',
  'Suicide Risk', 'Property Destruction', 'Fall Risk',
];

export const ADL_ITEMS = ['Eating', 'Bathing', 'Dressing', 'Grooming', 'Toileting', 'Transfers', 'Walking'];
export const ADL_LEVELS = ['Independent', 'Needs Assistance', 'Dependent'];

export const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say'];
export const MOBILITY_OPTIONS = ['Independent', 'Supervision', 'Walker', 'Wheelchair', 'Bedbound'];
export const COMMUNICATION_OPTIONS = ['Verbal', 'Non-verbal', 'Interpreter Required'];
export const OBSERVATION_LEVELS = ['Routine', 'Every 30 Minutes', 'Every 15 Minutes', '1:1 Observation'];
export const REFERRAL_SOURCES = ['Family', 'Hospital', 'Physician', 'Self', 'Case manager', 'Other facility', 'Other'];
export const DNR_OPTIONS = ['Full Code', 'DNR', 'DNI', 'Comfort Measures Only', 'Unknown'];
export const YES_NO_UNKNOWN = ['Yes', 'No', 'Unknown'];
export const DIRECTIVE_UPLOADED = ['Yes', 'No', 'Pending'];
export const ALLERGY_SEVERITY = ['Mild', 'Moderate', 'Severe', 'Life-threatening'];

const str = (val) => (typeof val === 'string' ? val.trim() : val == null ? '' : String(val).trim());
const isDate = (val) => /^\d{4}-\d{2}-\d{2}$/.test(str(val));
const textRows = (arr) => (Array.isArray(arr) ? arr.map(str).filter(Boolean).map((text) => ({ text })) : []);

// Merge an AI-parsed admission payload into the current wizard state. Only
// overwrites a field when the parser supplied a usable value, so a partial or
// imperfect extraction never wipes out what the user already has. The caller
// (AdmissionForm) then reviews everything before submitting.
export function mergeParsedAdmission(current, parsed) {
  if (!parsed || typeof parsed !== 'object') return current;
  const out = { ...current };

  const setStr = (key, val) => { const s = str(val); if (s) out[key] = s; };
  const setEnum = (key, val, allowed) => { const s = str(val); if (s && allowed.includes(s)) out[key] = s; };
  const setDate = (key, val) => { if (isDate(val)) out[key] = str(val); };
  const setRows = (key, arr) => { const rows = textRows(arr); if (rows.length) out[key] = rows; };

  // Demographics + contact
  setStr('firstName', parsed.firstName);
  setStr('middleName', parsed.middleName);
  setStr('lastName', parsed.lastName);
  setStr('preferredName', parsed.preferredName);
  setDate('dob', parsed.dob);
  setEnum('gender', parsed.gender, GENDER_OPTIONS);
  setStr('pronouns', parsed.pronouns);
  setStr('phone', parsed.phone);
  setStr('email', parsed.email);
  setStr('currentAddress', parsed.currentAddress);

  // Emergency contact
  setStr('emergencyName', parsed.emergencyName);
  setStr('emergencyRelationship', parsed.emergencyRelationship);
  setStr('emergencyPhone', parsed.emergencyPhone);
  setStr('emergencyEmail', parsed.emergencyEmail);

  // Admission placement
  setDate('admissionDate', parsed.admissionDate);
  setDate('expectedDischarge', parsed.expectedDischarge);
  setStr('facility', parsed.facility);
  setStr('roomAssignment', parsed.roomAssignment);
  setEnum('referralSource', parsed.referralSource, REFERRAL_SOURCES);
  setStr('caseManager', parsed.caseManager);

  // Clinical overview
  setRows('primaryDiagnoses', parsed.primaryDiagnoses);
  setRows('secondaryDiagnoses', parsed.secondaryDiagnoses);
  setRows('mentalHealthDiagnoses', parsed.mentalHealthDiagnoses);

  if (Array.isArray(parsed.allergies)) {
    const rows = parsed.allergies
      .map((a) => ({
        allergen: str(a?.allergen),
        reaction: str(a?.reaction),
        severity: ALLERGY_SEVERITY.includes(str(a?.severity)) ? str(a?.severity) : '',
      }))
      .filter((a) => a.allergen);
    if (rows.length) out.allergies = rows;
  }

  if (Array.isArray(parsed.medications)) {
    const rows = parsed.medications
      .map((m) => ({
        medication: str(m?.medication),
        dose: str(m?.dose),
        frequency: str(m?.frequency),
        route: str(m?.route),
        startDate: isDate(m?.startDate) ? str(m?.startDate) : '',
      }))
      .filter((m) => m.medication);
    if (rows.length) out.medications = rows;
  }

  if (Array.isArray(parsed.conditions)) {
    const list = parsed.conditions.map(str).filter((c) => CONDITION_OPTIONS.includes(c));
    if (list.length) out.conditions = Array.from(new Set(list));
  }
  if (Array.isArray(parsed.behavioralConcerns)) {
    const list = parsed.behavioralConcerns.map(str).filter((c) => BEHAVIORAL_CONCERNS.includes(c));
    if (list.length) out.behavioralConcerns = Array.from(new Set(list));
  }

  // Functional assessment
  setEnum('mobility', parsed.mobility, MOBILITY_OPTIONS);
  setEnum('communication', parsed.communication, COMMUNICATION_OPTIONS);
  setEnum('observationLevel', parsed.observationLevel, OBSERVATION_LEVELS);
  if (parsed.adls && typeof parsed.adls === 'object' && !Array.isArray(parsed.adls)) {
    const adls = { ...out.adls };
    for (const item of ADL_ITEMS) {
      const level = str(parsed.adls[item]);
      if (ADL_LEVELS.includes(level)) adls[item] = level;
    }
    out.adls = adls;
  }

  // Care plan
  setRows('goals', parsed.goals);
  setRows('interventions', parsed.interventions);
  setRows('restrictions', parsed.restrictions);

  // Advance directives
  setEnum('advanceDirectiveExists', parsed.advanceDirectiveExists, YES_NO_UNKNOWN);
  setEnum('dnrStatus', parsed.dnrStatus, DNR_OPTIONS);
  setStr('healthCareAgent', parsed.healthCareAgent);
  setStr('healthCareAgentPhone', parsed.healthCareAgentPhone);
  setStr('preferredHospital', parsed.preferredHospital);
  setEnum('advanceDirectiveUploaded', parsed.advanceDirectiveUploaded, DIRECTIVE_UPLOADED);

  return out;
}

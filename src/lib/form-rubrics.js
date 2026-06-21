/**
 * Field entry rubrics for the admission wizards.
 *
 * The validators in `form-validation.js` tell the user WHAT is wrong
 * ("SSN must be in format 123-45-6789"). A rubric tells them what the
 * CORRECT / recommended entry looks like — an `expected` description and a
 * concrete `example` — so the right-side ValidationGuide can coach the fix.
 *
 * Keys are the wizard field names (shared across all three admission forms;
 * the names are distinct enough not to collide). `getFieldRubric` first looks
 * up the explicit map, then falls back to a name-based heuristic so fields we
 * did not enumerate (e.g. any `*Phone` / `*Date`) still get sensible guidance.
 */

export const FIELD_RUBRICS = {
  // ── Identifiers ────────────────────────────────────────────────
  ssn: { expected: 'Nine digits as XXX-XX-XXXX', example: '123-45-6789' },
  medicaidId: { expected: '10+ letters/numbers, no spaces', example: 'AB12345678' },

  // ── Pre-screening narrative / coded fields ─────────────────────
  referringAgency: { expected: 'At least 3 characters', example: 'Cascadia Behavioral Health' },
  presentingProblem: { expected: 'At least 10 characters — describe the crisis', example: 'Acute psychosis with escalating self-neglect over 2 weeks…' },
  primaryDiagnosis: { expected: 'At least 5 characters; add the DSM-5 code if known', example: 'Schizophrenia, F20.9' },
  medicalDiagnoses: { expected: 'At least 5 characters; list each condition', example: 'Type 2 Diabetes, Hypertension' },
  strengthsSummary: { expected: 'At least 20 characters — the assessor’s clinical summary', example: 'Strong family support, motivated for treatment, engages well in groups…' },

  // ── Nursing assessment ─────────────────────────────────────────
  name: { expected: 'At least 3 characters — full legal name', example: 'Jordan A. Rivera' },
  age: { expected: 'A number from 0 to 130', example: '47' },
  reasonForAdmission: { expected: 'At least 10 characters', example: 'Referred for residential stabilization after inpatient discharge…' },
  temperature: { expected: '95–106 °F', example: '98.6' },
  pulse: { expected: '40–200 bpm', example: '72' },
  respirations: { expected: '8–40 breaths/min', example: '16' },
  o2Sat: { expected: '70–100 %', example: '98' },
  weightActual: { expected: '40–500 lbs', example: '165' },
  sleepHours: { expected: '0–24 hours', example: '7' },
  narrativeSummary: { expected: 'At least 20 characters', example: 'Client alert and oriented x4, cooperative, no acute distress noted…' },

  // ── Advance directive ──────────────────────────────────────────
  healthcare_agent_name: { expected: 'At least 3 characters — full name', example: 'Maria Gonzalez' },
  end_of_life_wishes: { expected: 'At least 10 characters', example: 'Prioritize comfort and dignity; no aggressive intervention…' },
};

const PHONE_RUBRIC = { expected: '10-digit US phone', example: '(503) 555-1234' };
const EMAIL_RUBRIC = { expected: 'name@domain.com', example: 'contact@agency.org' };
const DATE_RUBRIC = { expected: 'A real calendar date, today or earlier', example: 'Not a future date' };

/**
 * Resolve the rubric for a field. Explicit entries win; otherwise infer from
 * the field name so phones, emails, and dates are always covered.
 */
export function getFieldRubric(fieldKey = '') {
  if (FIELD_RUBRICS[fieldKey]) return FIELD_RUBRICS[fieldKey];

  const key = String(fieldKey).toLowerCase();
  if (key.includes('phone')) return PHONE_RUBRIC;
  if (key.includes('email')) return EMAIL_RUBRIC;
  if (key.includes('date') || key.endsWith('dob') || key === 'dob') return DATE_RUBRIC;
  return null;
}

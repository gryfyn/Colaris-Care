/**
 * Form validation utilities for admission forms
 * Includes HIPAA-compliant error messaging and field-level validation
 * Healthcare-focused with user-friendly error messages
 */

export const ValidationRules = {
  // PHI field validators
  ssn: (value) => {
    if (!value) return null;
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
    return !ssnRegex.test(value) ? 'SSN must be in format 123-45-6789' : null;
  },

  phone: (value) => {
    if (!value) return null;
    const phoneRegex = /^(\+1)?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
    return !phoneRegex.test(value) ? 'Please enter phone as (503) 555-1234' : null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !emailRegex.test(value) ? 'Please enter a valid email address' : null;
  },

  date: (value) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? 'Please enter a valid date' : null;
  },

  dateNotFuture: (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Please enter a valid date';
    return date > new Date() ? 'Date cannot be in the future' : null;
  },

  required: (value, fieldLabel = 'This field') => {
    if (value === null || value === undefined || value === '') {
      return `${fieldLabel} is required for medical records`;
    }
    if (Array.isArray(value) && value.length === 0) return 'At least one selection required';
    return null;
  },

  minLength: (min) => (value, fieldLabel) => {
    if (!value) return null;
    return String(value).length < min ? `Please enter at least ${min} characters` : null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    return String(value).length > max ? `Maximum ${max} characters allowed` : null;
  },

  numericRange: (min, max) => (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return 'Please enter a valid number';
    if (num < min) return `Must be at least ${min}`;
    if (num > max) return `Cannot exceed ${max}`;
    return null;
  },

  medicaidId: (value) => {
    if (!value) return null;
    const medicaidRegex = /^[A-Z0-9]{10,}$/;
    return !medicaidRegex.test(value) ? 'Invalid Medicaid ID format' : null;
  },

  dsmDiagnosis: (value) => {
    if (!value) return null;
    const dsmRegex = /^(F|G)[0-9]{2}\.[0-9A-Z]{1,2}|[A-Z\s]+/;
    return !dsmRegex.test(value) ? 'Enter valid DSM-5 code or diagnosis name' : null;
  },

  dateRange: (startDateField, endDateField) => (formData) => {
    if (!formData[startDateField] || !formData[endDateField]) return null;
    const start = new Date(formData[startDateField]);
    const end = new Date(formData[endDateField]);
    return end >= start ? null : 'End date must be after start date';
  },
};

/**
 * Validate a single field against rules
 */
export function validateField(value, rules = [], fieldLabel = 'Field') {
  for (const rule of rules) {
    let error = null;
    if (typeof rule === 'function') {
      error = rule(value, fieldLabel);
    }
    if (error) return error;
  }
  return null;
}

/**
 * Validate entire form step
 */
export function validateStep(stepData, stepRules, fieldLabels = {}) {
  const errors = {};
  let hasErrors = false;

  Object.entries(stepRules || {}).forEach(([fieldName, rules]) => {
    const value = stepData[fieldName];
    const label = fieldLabels[fieldName] || fieldName;
    const error = validateField(value, Array.isArray(rules) ? rules : [rules], label);
    if (error) {
      errors[fieldName] = error;
      hasErrors = true;
    }
  });

  return { errors, isValid: !hasErrors };
}

/**
 * Validate a step's fields against a rule set, returning a { field: message }
 * map of only the fields that fail.
 *
 * Used for live, format-level validation (e.g. malformed SSN, future date) on
 * top of the existing required-field checks. Options:
 *   - only:      array of field names to limit validation to (e.g. touched only)
 *   - skipEmpty: ignore fields with no value, so we surface "entered wrongly"
 *                problems without double-reporting empties that the dedicated
 *                required-field pass already covers.
 */
export function validateRuleSet(stepData = {}, stepRules = {}, fieldLabels = {}, opts = {}) {
  const { only = null, skipEmpty = false } = opts;
  const errors = {};

  Object.entries(stepRules || {}).forEach(([fieldName, rules]) => {
    if (only && !only.includes(fieldName)) return;

    const value = stepData[fieldName];
    if (skipEmpty) {
      const isEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) return;
    }

    const label = fieldLabels[fieldName] || fieldName;
    const error = validateField(value, Array.isArray(rules) ? rules : [rules], label);
    if (error) errors[fieldName] = error;
  });

  return errors;
}

/**
 * Get all missing required fields in a form
 */
export function getMissingFields(formData, requiredFields) {
  return requiredFields.filter(field => {
    const val = formData[field];
    if (!val) return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });
}

/**
 * Count completed required fields
 */
export function countCompletedFields(formData, requiredFields) {
  return requiredFields.filter(field => {
    const val = formData[field];
    if (!val) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;
}

/**
 * Pre-Admission Screening Validation Rules
 */
export const PRE_SCREENING_RULES = {
  1: {
    // Step 1: Referral & Funding
    referringAgency: [ValidationRules.required, ValidationRules.minLength(3)],
    referralDate: [ValidationRules.required, ValidationRules.dateNotFuture],
    contactPerson: [ValidationRules.required],
    ssn: [ValidationRules.ssn], // Optional but validate if provided
    livingSituation: [ValidationRules.required],
    county: [ValidationRules.required],
    presentingProblem: [ValidationRules.required, ValidationRules.minLength(10)],
  },
  2: {
    // Step 2: Mental Health History
    primaryDiagnosis: [ValidationRules.required, ValidationRules.minLength(5)],
    diagnosisDate: [ValidationRules.required, ValidationRules.dateNotFuture],
  },
  3: {
    // Step 3: Medical History
    pcpName: [ValidationRules.required],
    medicalDiagnoses: [ValidationRules.required, ValidationRules.minLength(5)],
  },
  4: {
    // Step 4: Substance Use
    primarySubstance: [ValidationRules.required],
  },
  5: {
    // Step 5: Psychosocial
    incomeSource: [ValidationRules.required],
    legalStatus: [ValidationRules.required],
  },
  6: {
    // Step 6: Summary & Sign-off
    levelOfCareNeeds: [ValidationRules.required],
    strengthsSummary: [ValidationRules.required, ValidationRules.minLength(20)],
    assessorName: [ValidationRules.required],
    assessorSignature: [ValidationRules.required],
    assessorDate: [ValidationRules.required, ValidationRules.dateNotFuture],
  },
};

/**
 * Nursing Assessment Validation Rules
 */
export const NURSING_RULES = {
  1: {
    // Step 1: Demographics
    name: [ValidationRules.required, ValidationRules.minLength(3)],
    dob: [ValidationRules.required, ValidationRules.dateNotFuture],
    age: [ValidationRules.numericRange(0, 130)],
    gender: [ValidationRules.required],
    pronouns: [ValidationRules.required],
    language: [ValidationRules.required],
    emergencyName: [ValidationRules.required],
    emergencyPhone: [ValidationRules.required, ValidationRules.phone],
    emergencyRelationship: [ValidationRules.required],
    reasonForAdmission: [ValidationRules.required, ValidationRules.minLength(10)],
  },
  2: {
    // Step 2: Vital Signs
    temperature: [ValidationRules.numericRange(95, 106)],
    pulse: [ValidationRules.numericRange(40, 200)],
    respirations: [ValidationRules.numericRange(8, 40)],
    o2Sat: [ValidationRules.numericRange(70, 100)],
    height: [ValidationRules.required],
    weightActual: [ValidationRules.numericRange(40, 500)],
    noKnownAllergies: [ValidationRules.required],
    scalpInspected: [ValidationRules.required],
  },
  3: {
    // Step 3: Systems Review
    fluVaxConsent: [ValidationRules.required],
  },
  4: {
    // Step 4: Pain, Sleep, Nutrition
    painPresent: [ValidationRules.required],
    sleepHours: [ValidationRules.numericRange(0, 24)],
    sleepMedication: [ValidationRules.required],
  },
  5: {
    // Step 5: Substance & Mental Status
    auditC1: [ValidationRules.required],
    auditC2: [ValidationRules.required],
    auditC3: [ValidationRules.required],
    loc: [ValidationRules.required],
    insight: [ValidationRules.required],
    judgment: [ValidationRules.required],
  },
  6: {
    // Step 6: Risk Assessments
    violenceHcw: [ValidationRules.required],
    restraintSexualAbuse: [ValidationRules.required],
    restraintPhysicalAbuse: [ValidationRules.required],
  },
  7: {
    // Step 7: Suicide Risk
    csrs1: [ValidationRules.required],
    csrs2: [ValidationRules.required],
    csrs3: [ValidationRules.required],
    csrs4: [ValidationRules.required],
    csrs5: [ValidationRules.required],
    csrs6: [ValidationRules.required],
  },
  8: {
    // Step 8: Summary & Sign-off
    narrativeSummary: [ValidationRules.required, ValidationRules.minLength(20)],
    rnName: [ValidationRules.required],
    staffNumber: [ValidationRules.required],
  },
};

/**
 * Advance Directive Validation Rules
 */
export const ADVANCE_DIRECTIVE_RULES = {
  1: {
    // Step 1: Healthcare Agent
    healthcare_agent_name: [ValidationRules.required, ValidationRules.minLength(3)],
    healthcare_agent_phone: [ValidationRules.required, ValidationRules.phone],
  },
  2: {
    // Step 2: Treatment Preferences
    cpr_preference: [ValidationRules.required],
    nutrition_preference: [ValidationRules.required],
    ventilation_preference: [ValidationRules.required],
  },
  3: {
    // Step 3: Values & Beliefs
    end_of_life_wishes: [ValidationRules.required, ValidationRules.minLength(10)],
  },
  4: {
    // Step 4: Signatures
    resident_name: [ValidationRules.required],
    resident_signature: [ValidationRules.required],
    resident_signature_date: [ValidationRules.required, ValidationRules.dateNotFuture],
    witness1_name: [ValidationRules.required],
    witness1_signature: [ValidationRules.required],
    witness1_signature_date: [ValidationRules.required, ValidationRules.dateNotFuture],
    witness2_name: [ValidationRules.required],
    witness2_signature: [ValidationRules.required],
    witness2_signature_date: [ValidationRules.required, ValidationRules.dateNotFuture],
  },
};

/**
 * Check if two witnesses are different people
 */
export function validateWitnessesDifferent(witness1Name, witness2Name) {
  if (!witness1Name || !witness2Name) return true; // Will be caught by required rule
  return witness1Name.toLowerCase().trim() !== witness2Name.toLowerCase().trim()
    ? null
    : 'Witness 1 and Witness 2 must be different people';
}

/**
 * Check if signatures are in valid order (date signed >= creation date)
 */
export function validateSignatureSequence(createdDate, signedDate) {
  if (!createdDate || !signedDate) return null;
  const created = new Date(createdDate);
  const signed = new Date(signedDate);
  return signed >= created ? null : 'Signature date cannot be before form creation';
}

/**
 * HIPAA-aware error message (don't leak sensitive info in client-side errors)
 */
export function getHIPAAErrorMessage(fieldName, error) {
  const sensitiveFields = ['ssn', 'healthcare_agent_phone', 'medicaid_id', 'diagnosis'];

  if (sensitiveFields.some(f => fieldName.includes(f))) {
    return 'Invalid format for this field';
  }

  return error;
}

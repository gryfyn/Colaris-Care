/**
 * Admission review config — the source of truth for rendering a complete,
 * read-only view of everything a resident entered in the three admission
 * wizards (pre-screening, nursing assessment, advance directive).
 *
 * Labels, section titles, and step order mirror the wizards exactly. Fields
 * with coded option values carry an `options` map so the reviewer sees the
 * human label (e.g. "full" -> "Full CPR including intubation…") rather than
 * the raw code.
 *
 * The wizard answers live flat (camelCase for pre-screening/nursing, snake_case
 * for advance directive) inside each form's JSONB blob, with a `__steps`
 * mirror. `getFormFlatData` normalizes either shape into one flat object that
 * the renderer reads, and `getUnmappedEntries` guarantees any entered field we
 * did NOT curate still shows up — so nothing is ever hidden.
 */

import { STEP_BUCKETS_KEY } from '@/lib/admission-draft';

// ── Coded option maps ──────────────────────────────────────────────────────
const LOC_NEEDS = {
  '24hr_supervision': '24-Hour Staff Supervision',
  med_admin: 'Medication Administration & Monitoring',
  adl_assist: 'Assistance with ADLs',
  dementia: "Specialized Dementia / Alzheimer's Care",
  cbt_dbt: 'CBT or DBT Skills Groups',
  sud_programming: 'Substance Use Disorder (SUD) Programming',
  wheelchair: 'Wheelchair Accessible Facility',
  secure: 'Secure Facility (Elopement Risk)',
  dietary: 'Specialized Dietary Needs (Diabetic, Pureed)',
  other: 'Other',
};
const SCREENING_OUTCOME = {
  approved: 'Approved — Appropriate for Placement',
  not_appropriate: 'Not Appropriate — Declined',
  deferred_waitlisted: 'Deferred / Waitlisted',
};
const NO_KNOWN_ALLERGIES = { yes: 'No Known Allergies', no: 'Allergies Present' };
const SKIN_FINDINGS = {
  pediculosis: 'Pediculosis (Head Lice)', scabies: 'Scabies', abrasion: 'Abrasion (A)',
  burn: 'Burn (B)', bruise: 'Bruise (BR)', decubiti: 'Decubiti (D)', laceration: 'Laceration (L)',
  rash: 'Rash (R)', scar: 'Scar (S)', skinTear: 'Skin Tear (ST)', tattoo: 'Tattoo (T)',
  blister: 'Blister (BL)', other: 'Other',
};
const AUDIT_C1 = { 0: 'Never', 1: 'Monthly or less', 2: '2–4 times/month', 3: '2–3 times/week', 4: '4+ times/week' };
const AUDIT_C2 = { 0: '1 or 2', 1: '3 or 4', 2: '5 or 6', 3: '7 to 9', 4: '10 or more' };
const AUDIT_C3 = { 0: 'Never', 1: 'Less than monthly', 2: 'Monthly', 3: 'Weekly', 4: 'Daily or almost daily' };
const CPR = { full: 'Full CPR including intubation and mechanical ventilation', limited: 'Limited CPR (no intubation)', comfort_only: 'Comfort measures only (DNR)' };
const NUTRITION = { full: 'Full artificial nutrition and hydration (tube feeding, IV)', comfort: 'Limited: only for comfort', none: 'No artificial nutrition or hydration' };
const VENTILATION = { yes: 'Yes, use mechanical ventilation if needed', limited: 'Only if reversible condition', no: 'No mechanical ventilation' };
const HOSPITALIZATION = { yes: 'Yes, admit to hospital/ICU for treatment', limited: 'Only if condition is reversible', no: 'No hospitalization (home or facility only)' };
const PAIN_RELIEF = { always: 'Always use pain relief', as_needed: 'Use only when necessary', minimal: 'Minimize medication use' };
const DONATION = { yes: 'Yes, donate organs and tissues', no: 'No donation', decide_later: 'Let family decide' };

// Shorthand field builders
const f = (key, label, type = 'text', options) => ({ key, label, type, ...(options ? { options } : {}) });

// ── PRE-SCREENING ──────────────────────────────────────────────────────────
const PRE_SCREENING = {
  label: 'Pre-Screening',
  steps: [
    {
      title: 'Referral & Funding',
      sections: [
        { title: 'Referral Information', fields: [
          f('referringAgency', 'Referring Agency / Professional'),
          f('referralDate', 'Date of Referral', 'date'),
          f('contactPerson', 'Contact Person'),
          f('contactPhone', 'Contact Phone'),
          f('contactEmail', 'Contact Email'),
        ]},
        { title: 'Funding & Insurance', fields: [
          f('ssn', 'Social Security Number (SSN)'),
          f('ohpId', 'Oregon Health Plan (OHP) ID'),
          f('otherInsurance', 'Other Insurance'),
          f('otherInsuranceId', 'Other Insurance ID #'),
        ]},
        { title: 'Current Living Situation', fields: [
          f('livingSituation', 'Living Situation'),
          f('county', 'County of Residence'),
        ]},
        { title: 'Presenting Problem', fields: [
          f('presentingProblem', 'Current crisis, symptoms, and primary reasons residential treatment is being sought', 'textarea'),
        ]},
      ],
    },
    {
      title: 'Mental Health History',
      sections: [
        { title: 'Psychiatric Diagnosis', fields: [
          f('primaryDiagnosis', 'Primary DSM-5 Diagnosis'),
          f('diagnosisDate', 'Date Diagnosed', 'date'),
          f('secondaryDiagnoses', 'Secondary Diagnoses'),
        ]},
        { title: 'Current Prescribed Psychotropic Medications', fields: [
          f('psychMeds', 'Psychotropic Medications', 'meds'),
        ]},
        { title: 'Psychiatric History', fields: [
          f('psychHx', 'History of Psychiatric Hospitalizations?'),
          f('psychHxDate', 'Most Recent Hospitalization Date', 'date'),
          f('psychHxReason', 'Reason for Most Recent Hospitalization'),
        ]},
        { title: 'Current Outpatient Support Team', fields: [
          f('therapistName', 'Outpatient Therapist'),
          f('therapistPhone', 'Therapist Phone'),
          f('psychiatristName', 'Psychiatrist / Prescriber'),
          f('psychiatristPhone', 'Psychiatrist Phone'),
          f('caseManagerName', 'Case Manager'),
          f('caseManagerPhone', 'Case Manager Phone'),
        ]},
      ],
    },
    {
      title: 'Medical History & Needs',
      sections: [
        { title: 'Primary Care Physician', fields: [
          f('pcpName', 'PCP Name'),
          f('pcpPhone', 'PCP Phone'),
          f('pcpFax', 'PCP Fax'),
        ]},
        { title: 'Significant Medical Diagnoses', fields: [
          f('medicalDiagnoses', 'Significant Medical Diagnoses', 'textarea'),
        ]},
        { title: 'Current Non-Psychiatric Medications', fields: [
          f('nonPsychMeds', 'Non-Psychiatric Medications', 'meds'),
        ]},
        { title: 'Mobility & Physical Functioning', fields: [
          f('mobilityStatus', 'Mobility Status'),
          f('assistiveDevice', 'Assistive Device Type'),
          f('adlNotes', 'ADL Assistance Needs — Additional Notes', 'textarea'),
        ]},
        { title: 'Communicable Disease Status', fields: [
          f('tbResult', 'TB Test Result'),
          f('tbTestDate', 'Date of Last TB Test', 'date'),
          f('covidVaxStatus', 'COVID-19 Vaccination Status'),
          f('otherCommunicable', 'Other Communicable Disease Status (Hep, HIV)'),
        ]},
      ],
    },
    {
      title: 'Substance Use History',
      sections: [
        { title: 'Primary Substance of Concern', fields: [
          f('primarySubstance', 'Primary Substance'),
          f('secondarySubstances', 'Secondary Substance(s)'),
          f('lastUseDate', 'Date of Last Use', 'date'),
          f('routeOfUse', 'Route of Use (Primary Substance)'),
        ]},
        { title: 'Withdrawal History', fields: [
          f('withdrawalHx', 'History of Withdrawal Symptoms?'),
          f('withdrawalDetails', 'Withdrawal Details'),
        ]},
        { title: 'Previous Treatment Episodes', fields: [
          f('previousTreatment', 'Prior Treatment (Detox, Residential, Outpatient, MAT, etc.)', 'textarea'),
        ]},
      ],
    },
    {
      title: 'Psychosocial & Legal',
      sections: [
        { title: 'Income & Financial', fields: [
          f('incomeSource', 'Primary Income Source'),
          f('incomeDetails', 'Additional Income Details'),
        ]},
        { title: 'Legal Status', fields: [
          f('legalStatus', 'Legal Status'),
          f('poName', 'Probation / Parole Officer Name'),
          f('poPhone', 'Officer Phone'),
          f('legalConditions', 'Legal Conditions of Supervision', 'textarea'),
        ]},
        { title: 'Trauma Context', fields: [
          f('willingToDiscussTrauma', 'Willing to Discuss Trauma in Treatment?'),
        ]},
        { title: 'Client Strengths & Interests', fields: [
          f('clientStrengths', 'Personal strengths, hobbies, interests, and goals', 'textarea'),
        ]},
        { title: 'Oregon Resources & Community Connections', fields: [
          f('abhAssessed', 'Assessed for ABH (Adult Behavioral Health) Home?'),
          f('lmhaConnected', 'Connected to LMHA or Certified Agency?'),
          f('lmhaAgency', 'Agency Name'),
          f('lmhaContact', 'Agency Contact'),
          f('waitlistServices', 'On Waitlist for Other Services?'),
        ]},
      ],
    },
    {
      title: 'Level of Care & Summary',
      sections: [
        { title: 'Level of Care Needs', fields: [
          f('levelOfCareNeeds', 'Level of Care Needs', 'list', LOC_NEEDS),
          f('levelOfCareOther', 'Other Level of Care Needs'),
        ]},
        { title: 'Assessor Summary & Recommendation', fields: [
          f('strengthsSummary', "Client's Strengths Summary (Assessor's clinical perspective)", 'textarea'),
          f('barriersToPlacement', 'Barriers to Placement', 'textarea'),
          f('assessorRecommendation', 'Assessor Recommendation', 'textarea'),
          f('screeningOutcome', 'Screening Outcome', 'text', SCREENING_OUTCOME),
          f('conditionsPriorAdmission', 'Conditions Prior to Admission', 'textarea'),
        ]},
        { title: 'Assessor Sign-Off', fields: [
          f('assessorName', 'Assessor Printed Name'),
          f('assessorTitle', 'Title / Credentials'),
          f('assessorSignature', 'Signature'),
          f('assessorDate', 'Date', 'date'),
          f('localCrisisLine', 'Local County Mental Health Crisis Line'),
        ]},
      ],
    },
  ],
};

// ── NURSING ASSESSMENT ─────────────────────────────────────────────────────
const NURSING = {
  label: 'Nursing Assessment',
  steps: [
    {
      title: 'Demographics',
      sections: [
        { title: 'Patient Identity', fields: [
          f('name', 'Patient Full Name'),
          f('dob', 'Date of Birth', 'date'),
          f('age', 'Age', 'number'),
          f('gender', 'Gender'),
          f('preferredName', 'Preferred Name (if Transgender/Other)'),
          f('pronouns', 'Preferred Pronouns'),
          f('language', 'Preferred Language'),
          f('interpreterNeeded', 'Interpreter Needed?'),
        ]},
        { title: 'Ethnicity & Race', fields: [
          f('ethnicity', 'Primary Ethnicity'),
          f('race', 'Race', 'list'),
        ]},
        { title: 'Method of Arrival & Source', fields: [
          f('arrivalMethod', 'Method of Arrival'),
          f('infoSource', 'Source of Information', 'list'),
        ]},
        { title: 'Spiritual & Cultural', fields: [
          f('spiritualPractices', 'Any Spiritual/Religious/Cultural Practices Impacting Care?'),
          f('spiritualDetails', 'Please Explain'),
        ]},
        { title: 'Emergency Contact', fields: [
          f('emergencyName', 'Contact Name'),
          f('emergencyPhone', 'Phone Number'),
          f('emergencyRelationship', 'Relationship'),
        ]},
        { title: 'Reason for Admission', fields: [
          f('reasonForAdmission', 'Patient/Family Description (direct quotation)', 'textarea'),
          f('presentIllnessHistory', 'History of Present Illness', 'textarea'),
        ]},
        { title: 'Orientation Checklist', fields: [
          f('orientationItems', 'Patient Orientation Completed Including', 'list'),
        ]},
      ],
    },
    {
      title: 'Vital Signs & Allergies',
      sections: [
        { title: 'Admitting Vital Signs', fields: [
          f('temperature', 'Temperature (°F)'),
          f('pulse', 'Pulse (bpm)'),
          f('respirations', 'Respirations (/min)'),
          f('o2Sat', 'O₂ Saturation (%)'),
          f('bpSystolic', 'BP Systolic (mmHg)'),
          f('bpDiastolic', 'BP Diastolic (mmHg)'),
          f('height', 'Height'),
          f('weightActual', 'Weight — Actual (lbs)'),
          f('weightStated', 'Weight — Stated (if scale unavailable)'),
        ]},
        { title: 'Allergies', fields: [
          f('noKnownAllergies', 'Allergy Status', 'text', NO_KNOWN_ALLERGIES),
          f('allergyMedication', 'Medication(s)'),
          f('allergyFood', 'Food/Additives/Preservatives'),
          f('allergyEnvironmental', 'Environmental'),
          f('allergyLatex', 'Latex'),
          f('allergyOther', 'Other'),
        ]},
        { title: 'Skin Assessment', fields: [
          f('scalpInspected', 'Hair/Scalp Inspected?'),
          f('scalpNotInspectedReason', 'If No, Reason'),
          f('skinFindings', 'Skin Findings', 'list', SKIN_FINDINGS),
          f('skinFindingsOther', 'Describe Other Skin Findings', 'textarea'),
          f('skinStaff1', 'Staff #1 Printed Name'),
        ]},
      ],
    },
    {
      title: 'Review of Systems',
      sections: [
        { title: 'Review of Systems', fields: [
          f('neuro', 'Neurological', 'list'),
          f('cardio', 'Cardiovascular', 'list'),
          f('respiratory', 'Respiratory', 'list'),
          f('gi', 'Gastrointestinal/Endocrine', 'list'),
          f('renal', 'Renal', 'list'),
          f('musculo', 'Musculoskeletal', 'list'),
          f('eent', 'EENT (Eyes, Ears, Nose, Throat)', 'list'),
          f('skin', 'Skin Integrity', 'list'),
        ]},
        { title: 'Infectious Disease Screening', fields: [
          f('tbSymptoms', 'Tuberculosis', 'list'),
          f('hepatitisSymptoms', 'Hepatitis', 'list'),
          f('hivSymptoms', 'HIV/AIDS', 'list'),
          f('fluSymptoms', 'Influenza', 'list'),
          f('mrsaSymptoms', 'MRSA', 'list'),
          f('fluVaxConsent', 'Flu Vaccination Consent'),
          f('medSurgHistory', 'Medical/Surgical History Notes', 'textarea'),
        ]},
        { title: 'Reproductive History', fields: [
          f('reproFemale', 'Female — Applicable', 'list'),
          f('reproMale', 'Male — Applicable', 'list'),
        ]},
      ],
    },
    {
      title: 'Pain, Sleep & Nutrition',
      sections: [
        { title: 'Pain Assessment', fields: [
          f('painPresent', 'Current Report of Pain?'),
          f('painScale', 'Pain Scale (0–10)', 'number'),
          f('painLocation', 'Pain Location'),
          f('painComfortGoal', 'Comfort Goal Score', 'number'),
          f('painOnset', 'Onset'),
          f('painDuration', 'Duration'),
          f('painDescription', 'Pain Description', 'list'),
          f('painRelief', 'What Helps Alleviate Pain?', 'list'),
        ]},
        { title: 'Sleep History', fields: [
          f('sleepHours', 'Average Hours of Sleep per Night', 'number'),
          f('sleepMedication', 'Currently Taking Sleep Medication?'),
          f('sleepMedicationDetail', 'Specify Sleep Medications'),
          f('sleepPattern', 'Sleep Pattern Past Week', 'list'),
        ]},
        { title: 'Sleep Apnea & CPAP', fields: [
          f('sleepApnea', 'Diagnosed with Sleep Apnea?'),
          f('cpapUse', 'Uses CPAP?'),
          f('cpapBrought', 'Brought CPAP Machine?'),
        ]},
        { title: 'Tobacco Screening', fields: [
          f('tobaccoStatus', 'Tobacco Use Status'),
          f('tobaccoType', 'Type of Product', 'list'),
        ]},
        { title: 'Nutritional Screen', fields: [
          f('specialDiet', 'Special Diet?'),
          f('foodAllergies', 'Food Allergies?'),
          f('lastMeal', 'Last Meal Consumed'),
          f('nutritionConcerns', 'Nutritional Concerns', 'list'),
        ]},
        { title: 'Functional Assessment (ADLs)', fields: [
          f('adlEating', 'Eating'),
          f('adlBathing', 'Bathing'),
          f('adlDressing', 'Dressing/Grooming'),
          f('adlToileting', 'Toileting'),
          f('adlAmbulation', 'Ambulation'),
          f('adlTransferring', 'Transferring'),
          f('assistDevices', 'Assistive Devices', 'list'),
        ]},
        { title: 'Learning Readiness', fields: [
          f('canRead', 'Can Patient Read?'),
          f('canWrite', 'Can Patient Write?'),
          f('learningChallenges', 'Learning Challenges', 'list'),
          f('learningPreferences', 'Learning Preferences', 'list'),
        ]},
      ],
    },
    {
      title: 'Substance & Mental Status',
      sections: [
        { title: 'Substance Abuse Assessment (AUDIT-C)', fields: [
          f('auditC1', 'How often do you have a drink containing alcohol?', 'text', AUDIT_C1),
          f('auditC2', 'How many drinks on a typical drinking day?', 'text', AUDIT_C2),
          f('auditC3', 'How often do you have 6 or more drinks on one occasion?', 'text', AUDIT_C3),
        ]},
        { title: 'Substance Use History', fields: [
          f('substanceUse12mo', 'Used Substances in Past 12 Months?'),
          f('sobrietyPeriod', 'Longest Period of Sobriety'),
          f('familySAHx', 'Family History of Substance Abuse?'),
          f('selfHelpGroups', 'Attends Self-Help Group Meetings?', 'list'),
          f('treatmentReason', 'Why Seeking Treatment Now?', 'textarea'),
          f('useTriggers', 'Triggers for Use'),
          f('useConsequences', 'Consequences of Use', 'list'),
          f('alcoholDetoxHx', 'History of Alcohol Detox?'),
          f('alcoholSeizureHx', 'History of Alcohol-Related Seizures?'),
        ]},
        { title: 'Mental Status Assessment', fields: [
          f('loc', 'Level of Consciousness'),
          f('orientation', 'Orientation', 'list'),
          f('attention', 'Attention', 'list'),
          f('appearance', 'General Appearance', 'list'),
          f('behavior', 'General Behavior', 'list'),
          f('interactions', 'Interactions', 'list'),
          f('psychomotor', 'Psychomotor Activity', 'list'),
          f('speech', 'Speech', 'list'),
          f('mood', 'Mood', 'list'),
          f('affect', 'Affect', 'list'),
          f('thoughtProcess', 'Thought Process', 'list'),
          f('thoughtContent', 'Thought Content', 'list'),
          f('hallucinations', 'Hallucinations', 'list'),
          f('insight', 'Insight'),
          f('judgment', 'Judgment'),
          f('mseComments', 'Additional MSE Comments', 'textarea'),
        ]},
      ],
    },
    {
      title: 'Risk Assessments',
      sections: [
        { title: 'Elopement Risk', fields: [
          f('elopementRisk', 'Elopement Risk Factors', 'list'),
        ]},
        { title: 'Violence / Homicide Risk', fields: [
          f('violenceHcw', 'History of Assault/Threats Towards Healthcare Workers?'),
          f('violenceHistory', 'History of Violence/Threats Towards Others?'),
          f('violenceRiskFactors', 'Risk Factors for Violence/Aggression', 'list'),
          f('violenceComments', 'Violence Risk Comments', 'textarea'),
        ]},
        { title: 'Psychological Trauma History', fields: [
          f('traumaHistory', 'History of trauma including', 'list'),
        ]},
        { title: 'Sexual Victimization Risk', fields: [
          f('sexualVictimization6mo', 'Sexual Victimization in Last 6 Months?'),
          f('sexualVictimizationLifetime', 'Lifetime History of Sexual Victimization?'),
          f('sexualVictimizationIndicators', 'Vulnerability Indicators', 'list'),
        ]},
        { title: 'Sexual Aggression Risk', fields: [
          f('sexualAggression6mo', 'Sexual Aggression in Last 6 Months?'),
          f('sexualAggressionLifetime', 'Lifetime History of Sexual Aggression?'),
          f('sexualAggressionIndicators', 'Aggression Indicators', 'list'),
        ]},
        { title: 'Restraint/Seclusion Risk', fields: [
          f('restraintSexualAbuse', 'History of Sexual Abuse (emotional risk with intervention)?'),
          f('restraintPhysicalAbuse', 'History of Physical Abuse (emotional risk)?'),
          f('restraintMedicalIssues', 'Medical/Physical Issues (physical risk)?'),
          f('restraintNotify', 'Who to Notify if Restraint/Seclusion Used'),
        ]},
      ],
    },
    {
      title: 'Suicide Risk',
      sections: [
        { title: 'Protective vs. Risk Factors', fields: [
          f('suicideProtective', 'Protective Factors', 'list'),
          f('suicideRisk', 'Risk Factors', 'list'),
        ]},
        { title: 'Columbia-Suicide Severity Rating Scale (Past Month)', fields: [
          f('csrs1', '1. Wished you were dead or could go to sleep and not wake up?'),
          f('csrs2', '2. Had any thoughts of killing yourself?'),
          f('csrs3', '3. Been thinking about how you might do this?'),
          f('csrs4', '4. Had these thoughts and some intention of acting on them?'),
          f('csrs5', '5. Started to work out the details of how to kill yourself?'),
          f('csrs6', '6. Ever done, started, or prepared to do anything to end your life?'),
        ]},
        { title: 'Summary Risk Assessment', fields: [
          f('summaryRiskSuicide', 'Suicide/Self Injury Risk'),
          f('summaryRiskFall', 'Fall Risk'),
          f('summaryRiskAssault', 'Assault/Homicide Risk'),
          f('summaryRiskSeizure', 'Seizure Risk'),
          f('summaryRiskMedical', 'Medically Compromised'),
          f('summaryRiskElopement', 'Elopement Risk'),
          f('summaryRiskSexualV', 'Sexual Victimization Risk'),
          f('summaryRiskSexualA', 'Sexual Aggression Risk'),
          f('observationLevel', 'Level of Observation at Admission'),
        ]},
      ],
    },
    {
      title: 'Summary & Sign-Off',
      sections: [
        { title: 'RN Sign-Off', fields: [
          f('narrativeSummary', 'Nursing Assessment Summary', 'textarea'),
          f('rnName', 'RN Printed Name & Credentials'),
          f('staffNumber', 'Staff Number'),
          f('rnSignedAt', 'Date & Time', 'datetime'),
          f('rnSignature', 'RN Signature'),
        ]},
      ],
    },
  ],
};

// ── ADVANCE DIRECTIVE ──────────────────────────────────────────────────────
const ADVANCE_DIRECTIVE = {
  label: 'Advance Directive',
  steps: [
    {
      title: 'Healthcare Agent',
      sections: [
        { title: 'Healthcare Agent Information', fields: [
          f('healthcare_agent_name', 'Healthcare Agent Full Name'),
          f('healthcare_agent_relationship', 'Relationship to Resident'),
          f('healthcare_agent_phone', 'Phone Number'),
          f('healthcare_agent_email', 'Email Address'),
          f('healthcare_agent_address', 'Address'),
        ]},
        { title: 'Alternate Healthcare Agent', fields: [
          f('alternate_agent_name', 'Alternate Agent Name'),
          f('alternate_agent_phone', 'Phone Number'),
        ]},
      ],
    },
    {
      title: 'Treatment Preferences',
      sections: [
        { title: 'Treatment Preferences', fields: [
          f('cpr_preference', 'Cardiopulmonary Resuscitation (CPR)', 'text', CPR),
          f('nutrition_preference', 'Artificial Nutrition and Hydration', 'text', NUTRITION),
          f('ventilation_preference', 'Mechanical Ventilation / Breathing Support', 'text', VENTILATION),
          f('hospitalization_preference', 'Hospitalization and Intensive Care', 'text', HOSPITALIZATION),
          f('pain_relief_preference', 'Pain Management and Comfort', 'text', PAIN_RELIEF),
          f('donation_preference', 'Organ and Tissue Donation', 'text', DONATION),
        ]},
      ],
    },
    {
      title: 'Values & Beliefs',
      sections: [
        { title: 'Personal Values & Beliefs', fields: [
          f('end_of_life_wishes', 'What is most important to you at the end of life?', 'textarea'),
          f('cultural_religious_practices', 'Religious or Cultural Practices to Honor', 'textarea'),
          f('unacceptable_quality_of_life', 'What would you consider an unacceptable quality of life?', 'textarea'),
        ]},
        { title: 'Additional Instructions', fields: [
          f('additional_instructions', 'Other wishes, preferences, or instructions', 'textarea'),
        ]},
      ],
    },
    {
      title: 'Signatures',
      sections: [
        { title: 'Resident Signature', fields: [
          f('resident_name', 'Resident Printed Name'),
          f('resident_signature', 'Resident Signature'),
          f('resident_signature_date', 'Date Signed', 'date'),
        ]},
        { title: 'Witness #1 Information', fields: [
          f('witness1_name', 'Witness #1 Printed Name'),
          f('witness1_address', 'Address'),
          f('witness1_phone', 'Phone'),
          f('witness1_signature', 'Witness #1 Signature'),
          f('witness1_signature_date', 'Date Signed', 'date'),
        ]},
        { title: 'Witness #2 Information', fields: [
          f('witness2_name', 'Witness #2 Printed Name'),
          f('witness2_address', 'Address'),
          f('witness2_phone', 'Phone'),
          f('witness2_signature', 'Witness #2 Signature'),
          f('witness2_signature_date', 'Date Signed', 'date'),
        ]},
      ],
    },
  ],
};

export const ADMISSION_REVIEW_CONFIG = {
  pre_screening: PRE_SCREENING,
  nursing_assessment: NURSING,
  advance_directive: ADVANCE_DIRECTIVE,
};

// Snake_case typed-column duplicates the wizard also writes into the flat blob;
// hidden from the "Other entered fields" catch-all so it isn't shown twice.
const CATCHALL_NOISE = new Set([
  STEP_BUCKETS_KEY,
  'full_name', 'preferred_name', 'date_of_birth', 'contact_phone', 'email',
  'address_line1', 'address_line2', 'city', 'state', 'postal_code',
  'primary_physician', 'primary_physician_phone', 'primary_diagnosis',
  'allergies', 'current_medications', 'medical_conditions',
  'emergency_contact', 'emergency_contact_phone', 'emergency_contact_relationship',
  'legal_status', 'has_guardian', 'guardian_representative',
  'insurance_type', 'insurance_member_id', 'insurance_group_number',
  'insurance_provider', 'insurance_contact_phone', 'medicaid_id', 'ssn_last4',
  'substance_use_flag', 'legal_risk_flag', 'spiritual_religious', 'language_preference',
  'assessment_date',
]);

/**
 * Normalize a form's JSONB blob into one flat answer object. Prefers the
 * `__steps` mirror (clean wizard keys) and falls back to the raw blob for
 * legacy drafts saved before per-step buckets existed.
 */
export function getFormFlatData(blob) {
  if (!blob || typeof blob !== 'object') return {};
  const steps = blob[STEP_BUCKETS_KEY];
  if (steps && typeof steps === 'object') {
    return Object.assign({}, ...Object.values(steps));
  }
  return blob;
}

/**
 * Any entered key not covered by the curated config — so a value can never be
 * silently dropped from the reviewer's view. Returns [key, value] pairs.
 */
export function getUnmappedEntries(formKey, flatData) {
  const cfg = ADMISSION_REVIEW_CONFIG[formKey];
  if (!cfg) return [];
  const known = new Set();
  cfg.steps.forEach(step => step.sections.forEach(sec => sec.fields.forEach(fld => known.add(fld.key))));
  return Object.entries(flatData || {}).filter(([k, v]) => {
    if (known.has(k) || CATCHALL_NOISE.has(k)) return false;
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}

const isEmpty = (v) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Format a stored value for display, applying the field's option map + type. */
export function formatReviewValue(field, value) {
  if (isEmpty(value)) return '—';
  const { type, options } = field || {};
  const translate = (v) => (options && options[v] != null ? options[v] : v);

  if (type === 'meds') return value; // rendered specially by the component
  if (type === 'list' || Array.isArray(value)) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(translate).join(', ');
  }
  if (type === 'date') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  if (type === 'datetime') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return translate(value);
}

export { isEmpty as isReviewValueEmpty };

/** Humanize an unmapped key for the catch-all section. */
export function humanizeKey(key = '') {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

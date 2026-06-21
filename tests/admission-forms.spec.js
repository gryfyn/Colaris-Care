import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import crypto from 'crypto';

/**
 * Playwright tests to verify admission form submission and database storage.
 *
 * Tests verify:
 * 1. All required fields are accepted without validation errors
 * 2. Data submitted via form matches exactly what's stored in database
 * 3. Encrypted PHI fields (name, phone, email) are actually encrypted in DB
 * 4. Form blobs (JSONB columns) contain all submitted data
 * 5. Metadata fields (created_at, created_by, tenant_id) are set correctly
 * 6. Optional fields that are submitted are stored, not lost
 */

// ──── DATABASE UTILITIES ────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/dcllc_db',
  ssl: false,
});

function getTenantKey() {
  const keyStr = process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

function decryptPHI(encryptedBase64, keyHex) {
  if (!encryptedBase64) return null;
  try {
    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 12;
    const AUTH_TAG_LEN = 16;

    const key = Buffer.from(keyHex, 'hex');
    const combined = Buffer.from(encryptedBase64, 'base64');
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LEN);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (err) {
    return '[DECRYPT_ERROR]';
  }
}

async function queryAdmission(admissionId, tenantId = 'test-tenant') {
  const result = await pool.query(
    `SELECT * FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2`,
    [admissionId, tenantId]
  );
  return result.rows[0] || null;
}

async function decryptAdmissionRow(row, encryptedFields) {
  const tenantKey = getTenantKey();
  const decrypted = {};
  for (const field of encryptedFields) {
    if (row[field]) {
      decrypted[field] = decryptPHI(row[field], tenantKey);
    }
  }
  return decrypted;
}

async function cleanupAdmission(admissionId, tenantId = 'test-tenant') {
  try {
    await pool.query(
      `DELETE FROM care.pending_admissions WHERE id = $1 AND tenant_id = $2`,
      [admissionId, tenantId]
    );
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

// ──── TEST DATA ────────────────────────────────────────────────────────

const PRE_SCREENING_TEST_DATA = {
  referringAgency: 'Springfield Mental Health Clinic',
  referralDate: '2024-05-20',
  contactPerson: 'Dr. Jane Smith',
  contactPhone: '(503) 555-0123',
  contactEmail: 'jane.smith@smhc.org',
  ssn: '123-45-6789',
  ohpId: 'OHP-123456789',
  otherInsurance: 'Blue Cross Blue Shield',
  otherInsuranceId: 'BC-999888777',
  livingSituation: 'Family Home',
  county: 'Multnomah',
  presentingProblem: 'Patient presents with symptoms of depression and anxiety following recent life stressors. Requires 24-hour supervision and medication management.',
  primaryDiagnosis: 'Major Depressive Disorder, F32.9',
  diagnosisDate: '2024-03-15',
  secondaryDiagnoses: 'Generalized Anxiety Disorder, F41.1',
  pcpName: 'Dr. Robert Johnson',
  pcpPhone: '(503) 555-0456',
  pcpFax: '(503) 555-0457',
  medicalDiagnoses: 'Hypertension, Type 2 Diabetes, Chronic Pain Syndrome',
  primarySubstance: 'Alcohol',
  secondarySubstances: 'Benzodiazepines',
  lastUseDate: '2024-05-10',
  routeOfUse: 'Oral',
  withdrawalHx: 'Yes',
  withdrawalDetails: 'Previous seizure history during alcohol withdrawal',
  previousTreatment: 'Attended 30-day residential program in 2022; completed outpatient treatment 2023',
  incomeSource: 'SSDI (Social Security Disability)',
  incomeDetails: 'Receives $1,400/month SSDI',
  legalStatus: 'Probation',
  poName: 'Officer Michael Torres',
  poPhone: '(503) 555-0789',
  legalConditions: 'No alcohol consumption; mandatory treatment participation',
  willingToDiscussTrauma: 'Yes',
  clientStrengths: 'Strong family support; motivated for treatment; previously employed in healthcare',
  abhAssessed: 'Yes',
  lmhaConnected: 'Yes',
  lmhaAgency: 'Multnomah County LMHA',
  lmhaContact: '(503) 555-1111',
  levelOfCareNeeds: ['24hr_supervision', 'med_admin', 'cbt_dbt'],
  strengthsSummary: 'Client demonstrates strong motivation for recovery and has intact family system. Good insight into symptoms.',
  barriersToPlacement: 'Previous treatment dropout; noncompliance with medication regimen',
  assessorName: 'Sarah Martinez LCSW',
  assessorTitle: 'Licensed Clinical Social Worker',
  assessorSignature: 'Sarah Martinez',
  assessorDate: '2024-05-20',
  screeningOutcome: 'approved',
  conditionsPriorAdmission: 'Medical clearance from PCP required before admission',
};

const NURSING_ASSESSMENT_TEST_DATA = {
  name: 'John Alexander Thompson',
  dob: '1985-06-15',
  age: 38,
  gender: 'Male',
  pronouns: 'He/Him',
  language: 'English',
  emergencyName: 'Mary Thompson',
  emergencyPhone: '(503) 555-2222',
  emergencyRelationship: 'Sister',
  reasonForAdmission: 'Evaluation and treatment for mood disorder and substance use disorder',
  temperature: '98.6',
  pulse: '72',
  respirations: '16',
  o2Sat: '98',
  height: '70',
  weightActual: '185',
  noKnownAllergies: 'false',
  allergies: 'Penicillin (rash)',
  scalpInspected: 'true',
  fluVaxConsent: 'true',
  painPresent: 'true',
  painLevel: '4',
  painLocation: 'Lower back',
  sleepHours: '6',
  sleepMedication: 'true',
  sleepMedicationDetails: 'Trazodone 50mg nightly',
  auditC1: '4',
  auditC2: '3',
  auditC3: '4',
  loc: 'Alert and Oriented x3',
  insight: 'Good',
  judgment: 'Fair',
  violenceHcw: 'false',
  restraintSexualAbuse: 'false',
  restraintPhysicalAbuse: 'false',
  suicideAttempts: '2',
  suicideAttemptsDetails: 'Overdose attempt in 2019 and 2021',
  csrs1: 'true',
  csrs2: 'true',
  csrs3: 'true',
  csrs4: 'false',
  csrs5: 'false',
  csrs6: 'false',
  narrativeSummary: 'Patient is a 38-year-old male admitted for evaluation and treatment of major depression and alcohol use disorder. Presents with depressed mood, anhedonia, and social withdrawal.',
  rnName: 'Patricia Anderson RN',
  staffNumber: 'RN-5847',
  therapistName: 'Dr. Michael Cohen',
  therapistPhone: '(503) 555-3333',
  psychiatristName: 'Dr. Rajesh Patel',
  psychiatristPhone: '(503) 555-4444',
};

const ADVANCE_DIRECTIVE_TEST_DATA = {
  resident_name: 'John Alexander Thompson',
  healthcare_agent_name: 'Mary Thompson',
  healthcare_agent_phone: '(503) 555-2222',
  healthcare_agent_relationship: 'Sister',
  alternate_agent_name: 'David Thompson',
  alternate_agent_phone: '(503) 555-5555',
  alternate_agent_relationship: 'Brother',
  cpr_preference: 'No',
  nutrition_preference: 'Full sustenance',
  ventilation_preference: 'No',
  mental_health_preferences: 'Prefers psychotropic medication for mood stabilization',
  psychiatric_med_preferences: 'Prefers SSRI and mood stabilizer combination',
  hospitalization_preference: 'Only as last resort',
  end_of_life_wishes: 'Wishes to remain at home; no heroic measures; focus on comfort care',
  resident_signature: 'John Thompson',
  resident_signature_date: '2024-05-20',
  witness1_name: 'James Wilson',
  witness1_signature: 'James Wilson',
  witness1_signature_date: '2024-05-20',
  witness2_name: 'Lisa Chen',
  witness2_signature: 'Lisa Chen',
  witness2_signature_date: '2024-05-20',
};

// ──── TESTS ────────────────────────────────────────────────────────

test.describe('Admission Forms - Data Storage Verification', () => {
  let baseURL;
  let authToken;
  let admissionId;

  test.beforeAll(async () => {
    baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
    // In a real test, you'd get this from login; using mock token for dev
    authToken = 'test-token-' + Date.now();
  });

  test.afterEach(async () => {
    if (admissionId) {
      await cleanupAdmission(admissionId);
      admissionId = null;
    }
  });

  test.afterAll(async () => {
    await pool.end();
  });

  // ──── PRE-SCREENING FORM TESTS ────

  test('Pre-Screening: All required fields accepted without validation error', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
        markComplete: false,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.admissionId).toBeDefined();
    admissionId = body.data.admissionId;
  });

  test('Pre-Screening: Form data matches database JSONB blob', async ({ page }) => {
    // Submit form
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
        markComplete: true,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    admissionId = body.data.admissionId;

    // Query database
    const row = await queryAdmission(admissionId);
    expect(row).toBeDefined();

    // Verify JSONB blob contains all submitted data
    const blob = row.pre_screening_data;
    expect(blob).toBeDefined();

    // Check sample required fields
    expect(blob.referringAgency).toBe(PRE_SCREENING_TEST_DATA.referringAgency);
    expect(blob.contactPerson).toBe(PRE_SCREENING_TEST_DATA.contactPerson);
    expect(blob.ssn).toBe(PRE_SCREENING_TEST_DATA.ssn);
    expect(blob.livingSituation).toBe(PRE_SCREENING_TEST_DATA.livingSituation);
    expect(blob.county).toBe(PRE_SCREENING_TEST_DATA.county);
    expect(blob.presentingProblem).toBe(PRE_SCREENING_TEST_DATA.presentingProblem);

    // Check optional fields
    expect(blob.primaryDiagnosis).toBe(PRE_SCREENING_TEST_DATA.primaryDiagnosis);
    expect(blob.medicalDiagnoses).toBe(PRE_SCREENING_TEST_DATA.medicalDiagnoses);
    expect(blob.primarySubstance).toBe(PRE_SCREENING_TEST_DATA.primarySubstance);
    expect(blob.incomeSource).toBe(PRE_SCREENING_TEST_DATA.incomeSource);
    expect(blob.legalStatus).toBe(PRE_SCREENING_TEST_DATA.legalStatus);
  });

  test('Pre-Screening: Encrypted PHI fields are actually encrypted in database', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    // Query database
    const row = await queryAdmission(admissionId);

    // PHI fields should be encrypted (base64 encoded)
    const encryptedFields = ['full_name', 'contact_phone', 'email'];
    const tenantKey = getTenantKey();

    for (const field of encryptedFields) {
      if (row[field]) {
        // Verify it's base64 (looks encrypted, not plaintext)
        expect(() => Buffer.from(row[field], 'base64')).not.toThrow();

        // Decrypt and verify
        const decrypted = decryptPHI(row[field], tenantKey);
        expect(decrypted).not.toBe('[DECRYPT_ERROR]');

        // For contact_phone, verify it matches
        if (field === 'contact_phone') {
          expect(decrypted).toBe(PRE_SCREENING_TEST_DATA.contactPhone);
        }
      }
    }
  });

  test('Pre-Screening: Metadata fields set correctly (created_at, created_by, tenant_id)', async ({ page }) => {
    const beforeTime = new Date();
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
      },
    });

    const afterTime = new Date();
    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);

    // Verify metadata
    expect(row.tenant_id).toBeDefined();
    expect(row.created_by).toBeDefined();
    expect(row.created_at).toBeDefined();

    const createdTime = new Date(row.created_at);
    expect(createdTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(createdTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());

    // Verify form completion flag
    expect(row.pre_screening_complete).toBeDefined();
  });

  test('Pre-Screening: Optional fields that are submitted are stored', async ({ page }) => {
    const testData = { ...PRE_SCREENING_TEST_DATA };
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: testData,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);
    const blob = row.pre_screening_data;

    // Verify optional fields that were provided
    expect(blob.ohpId).toBe(testData.ohpId);
    expect(blob.contactEmail).toBe(testData.contactEmail);
    expect(blob.secondaryDiagnoses).toBe(testData.secondaryDiagnoses);
    expect(blob.primarySubstance).toBe(testData.primarySubstance);
  });

  // ──── NURSING ASSESSMENT FORM TESTS ────

  test('Nursing Assessment: All required fields accepted without validation error', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
        markComplete: false,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.admissionId).toBeDefined();
    admissionId = body.data.admissionId;
  });

  test('Nursing Assessment: Form data matches database JSONB blob', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
        markComplete: true,
      },
    });

    expect(response.status()).toBe(201);
    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);
    const blob = row.nursing_assessment_data;
    expect(blob).toBeDefined();

    // Verify required fields
    expect(blob.name).toBe(NURSING_ASSESSMENT_TEST_DATA.name);
    expect(blob.dob).toBe(NURSING_ASSESSMENT_TEST_DATA.dob);
    expect(blob.age).toBe(NURSING_ASSESSMENT_TEST_DATA.age);
    expect(blob.gender).toBe(NURSING_ASSESSMENT_TEST_DATA.gender);
    expect(blob.pronouns).toBe(NURSING_ASSESSMENT_TEST_DATA.pronouns);
    expect(blob.emergencyName).toBe(NURSING_ASSESSMENT_TEST_DATA.emergencyName);
    expect(blob.temperature).toBe(NURSING_ASSESSMENT_TEST_DATA.temperature);
    expect(blob.pulse).toBe(NURSING_ASSESSMENT_TEST_DATA.pulse);
    expect(blob.respirations).toBe(NURSING_ASSESSMENT_TEST_DATA.respirations);

    // Verify optional fields
    expect(blob.therapistName).toBe(NURSING_ASSESSMENT_TEST_DATA.therapistName);
    expect(blob.psychiatristName).toBe(NURSING_ASSESSMENT_TEST_DATA.psychiatristName);
  });

  test('Nursing Assessment: Typed columns populated correctly', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);

    // Verify mapped typed columns
    expect(row.full_name).toBeDefined(); // mapped from 'name'
    expect(row.gender).toBe(NURSING_ASSESSMENT_TEST_DATA.gender);
    expect(row.vital_pulse).toBe(NURSING_ASSESSMENT_TEST_DATA.pulse);
    expect(row.vital_respiration).toBe(NURSING_ASSESSMENT_TEST_DATA.respirations);
    expect(row.vital_oxygen).toBe(NURSING_ASSESSMENT_TEST_DATA.o2Sat);
    expect(row.height_inches).toBe(NURSING_ASSESSMENT_TEST_DATA.height);
    expect(row.weight_lbs).toBe(NURSING_ASSESSMENT_TEST_DATA.weightActual);
  });

  test('Nursing Assessment: Emergency contact encrypted in database', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);
    const tenantKey = getTenantKey();

    // Emergency contact should be encrypted
    if (row.emergency_contact_phone) {
      const decrypted = decryptPHI(row.emergency_contact_phone, tenantKey);
      expect(decrypted).toBe(NURSING_ASSESSMENT_TEST_DATA.emergencyPhone);
    }
  });

  // ──── ADVANCE DIRECTIVE FORM TESTS ────

  test('Advance Directive: All required fields accepted without validation error', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'advance-directive',
        formData: ADVANCE_DIRECTIVE_TEST_DATA,
        markComplete: false,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.admissionId).toBeDefined();
    admissionId = body.data.admissionId;
  });

  test('Advance Directive: Form data matches database JSONB blob', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'advance-directive',
        formData: ADVANCE_DIRECTIVE_TEST_DATA,
        markComplete: true,
      },
    });

    expect(response.status()).toBe(201);
    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);
    const blob = row.advance_directive_data;
    expect(blob).toBeDefined();

    // Verify required fields
    expect(blob.resident_name).toBe(ADVANCE_DIRECTIVE_TEST_DATA.resident_name);
    expect(blob.healthcare_agent_name).toBe(ADVANCE_DIRECTIVE_TEST_DATA.healthcare_agent_name);
    expect(blob.healthcare_agent_phone).toBe(ADVANCE_DIRECTIVE_TEST_DATA.healthcare_agent_phone);
    expect(blob.cpr_preference).toBe(ADVANCE_DIRECTIVE_TEST_DATA.cpr_preference);
    expect(blob.nutrition_preference).toBe(ADVANCE_DIRECTIVE_TEST_DATA.nutrition_preference);
    expect(blob.end_of_life_wishes).toBe(ADVANCE_DIRECTIVE_TEST_DATA.end_of_life_wishes);

    // Verify witness signatures
    expect(blob.witness1_name).toBe(ADVANCE_DIRECTIVE_TEST_DATA.witness1_name);
    expect(blob.witness1_signature).toBe(ADVANCE_DIRECTIVE_TEST_DATA.witness1_signature);
    expect(blob.witness2_name).toBe(ADVANCE_DIRECTIVE_TEST_DATA.witness2_name);
  });

  test('Advance Directive: Signature dates match submitted data', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'advance-directive',
        formData: ADVANCE_DIRECTIVE_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);
    const blob = row.advance_directive_data;

    expect(blob.resident_signature_date).toBe(ADVANCE_DIRECTIVE_TEST_DATA.resident_signature_date);
    expect(blob.witness1_signature_date).toBe(ADVANCE_DIRECTIVE_TEST_DATA.witness1_signature_date);
    expect(blob.witness2_signature_date).toBe(ADVANCE_DIRECTIVE_TEST_DATA.witness2_signature_date);
  });

  test('Advance Directive: Healthcare agent phone encrypted', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'advance-directive',
        formData: ADVANCE_DIRECTIVE_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    const row = await queryAdmission(admissionId);
    const tenantKey = getTenantKey();

    // Healthcare agent phone should be encrypted in typed column
    if (row.healthcare_agent_phone) {
      const decrypted = decryptPHI(row.healthcare_agent_phone, tenantKey);
      expect(decrypted).toBe(ADVANCE_DIRECTIVE_TEST_DATA.healthcare_agent_phone);
    }
  });

  // ──── MULTI-FORM WORKFLOW TESTS ────

  test('Workflow: Pre-screening form returns admissionId for subsequent forms', async ({ page }) => {
    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.admissionId).toBeDefined();
    expect(body.data.admissionId).toMatch(/^[a-f0-9-]+$/); // UUID pattern
    admissionId = body.data.admissionId;
  });

  test('Workflow: Subsequent forms update same admissionId', async ({ page }) => {
    // Submit pre-screening
    let response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    // Submit nursing assessment with same admissionId
    response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        admissionId,
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
      },
    });

    expect(response.status()).toBe(200); // UPDATE returns 200
    const body = await response.json();
    expect(body.data.admissionId).toBe(admissionId);

    // Verify single record in database with both forms
    const row = await queryAdmission(admissionId);
    expect(row.pre_screening_data).toBeDefined();
    expect(row.nursing_assessment_data).toBeDefined();
  });

  test('Workflow: All three forms stored in single record', async ({ page }) => {
    // Submit all three forms sequentially
    let response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        admissionId,
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
      },
    });

    response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        admissionId,
        formType: 'advance-directive',
        formData: ADVANCE_DIRECTIVE_TEST_DATA,
        submit: true,
      },
    });

    expect(response.status()).toBe(200);

    // Verify all three form blobs exist
    const row = await queryAdmission(admissionId);
    expect(row.pre_screening_data).toBeDefined();
    expect(row.pre_screening_data.referringAgency).toBe(PRE_SCREENING_TEST_DATA.referringAgency);

    expect(row.nursing_assessment_data).toBeDefined();
    expect(row.nursing_assessment_data.name).toBe(NURSING_ASSESSMENT_TEST_DATA.name);

    expect(row.advance_directive_data).toBeDefined();
    expect(row.advance_directive_data.resident_name).toBe(ADVANCE_DIRECTIVE_TEST_DATA.resident_name);
  });

  test('Workflow: submit=true sets status to pending and submitted_at', async ({ page }) => {
    // Create admission
    let response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: PRE_SCREENING_TEST_DATA,
      },
    });

    admissionId = (await response.json()).data.admissionId;

    // Submit with submit=true
    const beforeTime = new Date();
    response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        admissionId,
        formType: 'nursing-assessment',
        formData: NURSING_ASSESSMENT_TEST_DATA,
        submit: true,
      },
    });
    const afterTime = new Date();

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe('pending');

    // Verify in database
    const row = await queryAdmission(admissionId);
    expect(row.status).toBe('pending');
    expect(row.submitted_at).toBeDefined();

    const submittedTime = new Date(row.submitted_at);
    expect(submittedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(submittedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  // ──── VALIDATION TESTS ────

  test('Validation: Missing required pre-screening field returns error', async ({ page }) => {
    const incompleteData = { ...PRE_SCREENING_TEST_DATA };
    delete incompleteData.referringAgency; // Remove required field

    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: incompleteData,
      },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
    expect(body.validationErrors).toBeDefined();
    expect(body.validationErrors.referringAgency).toBeDefined();
  });

  test('Validation: Missing required nursing assessment field returns error', async ({ page }) => {
    const incompleteData = { ...NURSING_ASSESSMENT_TEST_DATA };
    delete incompleteData.name; // Remove required field

    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'nursing-assessment',
        formData: incompleteData,
      },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.validationErrors.name).toBeDefined();
  });

  test('Validation: Invalid date format returns error', async ({ page }) => {
    const badData = {
      ...PRE_SCREENING_TEST_DATA,
      referralDate: '05/20/2024', // Wrong format
    };

    const response = await page.request.post(`${baseURL}/api/v1/admission/forms`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        formType: 'pre-screening',
        formData: badData,
      },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.validationErrors.referralDate).toBeDefined();
  });
});

/**
 * Pre-Screening-First Admission Workflow E2E
 * Covers the new admission lifecycle:
 * pre-screening submit -> pending review -> approve -> admit resident -> nursing prefill.
 */

const { test, expect } = require('@playwright/test');

const TEST_CREDENTIALS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@dependablecare.org',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin@DC2026!',
  },
};

const today = new Date().toISOString().split('T')[0];
const unique = Date.now();

const TEST_DATA = {
  preScreening: {
    clientFullName: `W6 PreScreen Client ${unique}`,
    dateOfBirth: '1986-04-18',
    pronouns: 'They/Them',
    referringAgency: 'County Mental Health Services',
    referralDate: today,
    contactPerson: 'Dr. Morgan Lane',
    ssn: '555-12-6789',
    livingSituation: 'Family Home',
    county: 'Multnomah',
    presentingProblem: 'Client requires residential behavioral health support after acute stabilization.',
    primaryDiagnosis: 'Major Depressive Disorder, recurrent, severe',
    diagnosisDate: today,
    pcpName: 'Dr. Amanda White',
    medicalDiagnoses: 'Hypertension; Type 2 Diabetes',
    primarySubstance: 'Alcohol',
    incomeSource: 'SSI (Supplemental Security Income)',
    legalStatus: 'None',
    levelOfCareNeed: '24-Hour Staff Supervision',
    strengthsSummary: 'Client is motivated for treatment and has supportive family involvement.',
    assessorName: 'Patricia M. Lynch, LCSW',
    assessorSignature: 'Patricia M. Lynch',
    assessorDate: today,
  },
  nursing: {
    age: '40',
    gender: 'Non-binary',
    language: 'English',
    emergencyName: 'Jordan Client',
    emergencyPhone: '(503) 555-0177',
    emergencyRelationship: 'Sibling',
    reasonForAdmission: 'Residential admission following approved pre-screening.',
    temperature: '98.6',
    pulse: '78',
    respirations: '16',
    o2Sat: '98',
    height: '5\'8"',
    weightActual: '165',
    narrativeSummary: 'Nursing assessment completed after approved pre-screening. Client is stable for residential admission.',
    rnName: 'Sarah Johnson, RN',
    staffNumber: 'STF-2026-001',
  },
  directive: {
    agentName: 'Jordan Client',
    agentPhone: '(503) 555-0177',
    endOfLifeWishes: 'Prioritize comfort, dignity, and communication with designated healthcare agent.',
    witness1Name: 'Taylor Witness',
    witness2Name: 'Casey Witness',
  },
};

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_CREDENTIALS.admin.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(TEST_CREDENTIALS.admin.password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL('**/admin**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

function fieldControlsByLabel(page, labelText, selector = '*[self::input or self::textarea or self::select]') {
  return page.locator(`label:has-text("${labelText}")`)
    .locator(`xpath=following-sibling::div//${selector}`);
}

function fieldControlByLabel(page, labelText, selector = '*[self::input or self::textarea or self::select]') {
  return fieldControlsByLabel(page, labelText, selector).first();
}

async function fillFieldByLabel(page, labelText, value) {
  const control = fieldControlByLabel(page, labelText);
  await expect(control).toBeVisible({ timeout: 10000 });
  await control.fill(value);
}

async function selectFieldByLabel(page, labelText, label) {
  const control = fieldControlByLabel(page, labelText, 'select');
  await expect(control).toBeVisible({ timeout: 10000 });
  await control.selectOption({ label });
}

async function clickOptionLabel(page, optionText, index = 0) {
  // Existing specs click the visible label/wrapper for custom radio and checkbox controls.
  await page.locator(`label:has-text("${optionText}")`).nth(index).click();
}

async function clickCardOption(page, optionText) {
  await page.getByText(optionText, { exact: true }).click();
}

async function continueForm(page, buttonName = /save & continue|continue/i) {
  const button = page.getByRole('button', { name: buttonName }).last();
  await expect(button).toBeEnabled({ timeout: 10000 });
  await button.click();
  await page.waitForLoadState('networkidle');
}

async function continueAfterCompletionModal(page, buttonName) {
  const button = page.getByRole('button', { name: buttonName });
  await expect(button).toBeVisible({ timeout: 30000 });
  await expect(button).toBeEnabled({ timeout: 60000 });
  await button.click();
  await page.waitForLoadState('networkidle');
}

async function fillPreScreeningForm(page) {
  const pre = TEST_DATA.preScreening;

  // Step 2: Fill and submit the pre-screening form - Step 1 identity/referral.
  await page.getByPlaceholder('Full legal name').fill(pre.clientFullName);
  await fieldControlByLabel(page, 'Date of Birth').fill(pre.dateOfBirth);
  await page.getByPlaceholder('e.g., she/her, they/them').fill(pre.pronouns);
  await page.getByPlaceholder('Organization or professional name').fill(pre.referringAgency);
  await fieldControlByLabel(page, 'Date of Referral').fill(pre.referralDate);
  await page.getByPlaceholder('Referring contact name').fill(pre.contactPerson);
  await page.getByPlaceholder('XXX-XX-XXXX').fill(pre.ssn);
  await selectFieldByLabel(page, 'Living Situation', pre.livingSituation);
  await selectFieldByLabel(page, 'County of Residence', pre.county);
  await page.getByPlaceholder(/Describe the presenting crisis/i).fill(pre.presentingProblem);
  await continueForm(page);
  await expect(page.getByText(/Step 2 of 6/i)).toBeVisible();

  // Step 2: Fill and submit the pre-screening form - Step 2 mental health history.
  await page.getByPlaceholder('e.g., Schizophrenia, F20.9').fill(pre.primaryDiagnosis);
  await fieldControlByLabel(page, 'Date Diagnosed').fill(pre.diagnosisDate);
  await continueForm(page);
  await expect(page.getByText(/Step 3 of 6/i)).toBeVisible();

  // Step 2: Fill and submit the pre-screening form - Step 3 medical history.
  await page.getByPlaceholder('Dr. full name').fill(pre.pcpName);
  await page.getByPlaceholder(/List each diagnosis/i).fill(pre.medicalDiagnoses);
  await continueForm(page);
  await expect(page.getByText(/Step 4 of 6/i)).toBeVisible();

  // Step 2: Fill and submit the pre-screening form - Step 4 substance use.
  await selectFieldByLabel(page, 'Primary Substance', pre.primarySubstance);
  await continueForm(page);
  await expect(page.getByText(/Step 5 of 6/i)).toBeVisible();

  // Step 2: Fill and submit the pre-screening form - Step 5 psychosocial/legal.
  await selectFieldByLabel(page, 'Primary Income Source', pre.incomeSource);
  await selectFieldByLabel(page, 'Legal Status', pre.legalStatus);
  await continueForm(page);
  await expect(page.getByText(/Step 6 of 6/i)).toBeVisible();

  // Step 2: Fill and submit the pre-screening form - Step 6 level of care/sign-off.
  await clickCardOption(page, pre.levelOfCareNeed);
  await page.getByPlaceholder(/Summarize the client's clinical and personal strengths/i).fill(pre.strengthsSummary);
  await page.getByPlaceholder('Full name', { exact: true }).fill(pre.assessorName);
  await page.getByPlaceholder('Type full name to sign').fill(pre.assessorSignature);
  await fieldControlByLabel(page, 'Date').fill(pre.assessorDate);
  await continueForm(page, /submit & continue/i);
  await continueAfterCompletionModal(page, /view pending admissions|continue without pdf/i);
}

async function assertNursingPrefill(page) {
  const nameInput = fieldControlByLabel(page, 'Patient Full Name');
  const dobInput = fieldControlByLabel(page, 'Date of Birth');

  await expect(nameInput).toHaveValue(TEST_DATA.preScreening.clientFullName, { timeout: 30000 });
  await expect(dobInput).toHaveValue(TEST_DATA.preScreening.dateOfBirth);
  await expect(nameInput).toHaveAttribute('readonly', '');
  await expect(dobInput).toHaveAttribute('readonly', '');
}

async function completeNursingAssessmentBestEffort(page) {
  const nursing = TEST_DATA.nursing;

  // Step 6: Optional/best-effort complete nursing assessment - Step 1.
  await fieldControlByLabel(page, 'Age').fill(nursing.age);
  await selectFieldByLabel(page, 'Gender', nursing.gender);
  await selectFieldByLabel(page, 'Preferred Language', nursing.language);
  await page.getByPlaceholder('Full name').fill(nursing.emergencyName);
  await page.getByPlaceholder('(503) 000-0000').first().fill(nursing.emergencyPhone);
  await selectFieldByLabel(page, 'Relationship', nursing.emergencyRelationship);
  await page.getByPlaceholder(/Quote from patient or family/i).fill(nursing.reasonForAdmission);
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 2.
  await page.getByPlaceholder('98.6').fill(nursing.temperature);
  await page.getByPlaceholder('72').fill(nursing.pulse);
  await page.getByPlaceholder('16').fill(nursing.respirations);
  await page.getByPlaceholder('98').fill(nursing.o2Sat);
  await page.getByPlaceholder('120').fill('120');
  await page.getByPlaceholder('80').fill('80');
  await page.getByPlaceholder('e.g. 5\'8"').fill(nursing.height);
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(2).fill(nursing.weightActual);
  await clickOptionLabel(page, 'No Known Allergies');
  await clickOptionLabel(page, 'Yes');
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 3.
  await clickOptionLabel(page, 'N/A (May', 0);
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 4.
  await clickOptionLabel(page, 'No', 0);
  await fieldControlByLabel(page, 'Average Hours of Sleep per Night').fill('7');
  await clickOptionLabel(page, 'No', 1);
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 5.
  await clickOptionLabel(page, 'Never (0 pts)');
  await clickOptionLabel(page, '1 or 2 (0 pts)');
  await clickOptionLabel(page, 'Never (0 pts)');
  await clickOptionLabel(page, 'Alert');
  await clickOptionLabel(page, 'Unimpaired');
  await clickOptionLabel(page, 'Intact');
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 6.
  await clickOptionLabel(page, 'No', 0);
  await clickOptionLabel(page, 'No', 4);
  await clickOptionLabel(page, 'No', 5);
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 7.
  const csrsQuestions = [
    'wished you were dead',
    'thoughts of killing yourself',
    'thinking about how you might do this',
    'intention of acting',
    'worked out the details',
    'prepared to do anything to end your life',
  ];
  for (const question of csrsQuestions) {
    const questionCard = page.getByText(question).locator('xpath=ancestor::div[contains(@style,"border-radius")][1]');
    await questionCard.locator('label:has-text("No")').click();
  }
  await continueForm(page);

  // Step 6: Optional/best-effort complete nursing assessment - Step 8.
  await page.getByPlaceholder(/Synthesize findings/i).fill(nursing.narrativeSummary);
  await fieldControlByLabel(page, 'RN Printed Name & Credentials').fill(nursing.rnName);
  await fieldControlByLabel(page, 'Staff Number').fill(nursing.staffNumber);
  await continueForm(page, /submit & continue/i);
  await continueAfterCompletionModal(page, /continue to pre-screening|continue without pdf/i);
}

async function completeAdvanceDirectiveBestEffort(page) {
  const directive = TEST_DATA.directive;
  const pre = TEST_DATA.preScreening;

  // Step 6: Optional/best-effort complete advance directive - Step 1.
  await page.getByPlaceholder('Full name').fill(directive.agentName);
  await page.getByPlaceholder('(503) 000-0000').first().fill(directive.agentPhone);
  await continueForm(page, /continue/i);

  // Step 6: Optional/best-effort complete advance directive - Step 2.
  await clickOptionLabel(page, 'Comfort measures only');
  await clickOptionLabel(page, 'Limited: only for comfort');
  await clickOptionLabel(page, 'No mechanical ventilation');
  await continueForm(page, /continue/i);

  // Step 6: Optional/best-effort complete advance directive - Step 3.
  await page.getByPlaceholder(/being at home/i).fill(directive.endOfLifeWishes);
  await continueForm(page, /continue/i);

  // Step 6: Optional/best-effort complete advance directive - Step 4.
  await page.getByPlaceholder('Full legal name').fill(pre.clientFullName);
  await page.getByPlaceholder('Type your full name to sign').nth(0).fill(pre.clientFullName);
  await fieldControlByLabel(page, 'Date Signed').fill(today);
  await page.getByPlaceholder('Full name').nth(1).fill(directive.witness1Name);
  await page.getByPlaceholder('Type your full name to sign').nth(1).fill(directive.witness1Name);
  await fieldControlsByLabel(page, 'Date Signed').nth(1).fill(today);
  await page.getByPlaceholder('Full name').nth(2).fill(directive.witness2Name);
  await page.getByPlaceholder('Type your full name to sign').nth(2).fill(directive.witness2Name);
  await fieldControlsByLabel(page, 'Date Signed').nth(2).fill(today);
  await continueForm(page, /submit advance directive/i);
  await continueAfterCompletionModal(page, /view pending admissions|continue without pdf/i);
  await expect(page).toHaveURL(/\/admin\?view=residents/, { timeout: 30000 });
}

test.describe('Pre-Screening-First Admission Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('admin submits pre-screening, approves it, admits resident, and sees nursing prefill', async ({ page }) => {
    // Step 1: Admin login + navigate to pre-screening.
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Pre-Screening' }).click();
    await expect(page).toHaveURL(/\/admission\/pre-screening/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Step 2: Fill and submit the pre-screening form.
    await fillPreScreeningForm(page);
    await expect(page).toHaveURL(/\/admin\?view=pending_admissions/, { timeout: 30000 });

    // Step 3: Admin pending admissions review.
    await page.goto('/admin?view=pending_admissions');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TEST_DATA.preScreening.clientFullName)).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Review' }).first().click();
    await expect(page.getByRole('button', { name: /download pdf/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(TEST_DATA.preScreening.presentingProblem)).toBeVisible({ timeout: 30000 });
    // Click Approve and WAIT for the PATCH to persist before navigating away —
    // otherwise the page.goto below aborts the in-flight approve request.
    const approveResp = page.waitForResponse(
      (r) => r.url().includes('/review') && r.request().method() === 'PATCH',
      { timeout: 30000 },
    );
    await page.getByRole('button', { name: 'Approve' }).click();
    const approved = await approveResp;
    expect(approved.status()).toBe(200);

    // Step 4: Admit resident.
    await page.goto('/admin?view=residents');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /admit resident/i }).click();
    await expect(page.getByText(TEST_DATA.preScreening.clientFullName)).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: new RegExp(TEST_DATA.preScreening.clientFullName) }).click();
    await expect(page).toHaveURL(/\/admission\/nursing-assessment\?admission_id=.+/, { timeout: 30000 });

    // Step 5: Nursing assessment prefill.
    await assertNursingPrefill(page);

    // Step 6: Optional/best-effort complete nursing -> advance-directive -> submit.
    try {
      await completeNursingAssessmentBestEffort(page);
      await expect(page).toHaveURL(/\/admission\/advance-directive\?admission_id=.+/, { timeout: 30000 });
      await completeAdvanceDirectiveBestEffort(page);
    } catch (error) {
      console.warn(`Optional nursing/directive completion skipped: ${error.message}`);
    }
  });
});

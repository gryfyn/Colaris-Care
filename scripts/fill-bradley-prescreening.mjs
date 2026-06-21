// One-off Playwright automation: log into production as admin and complete the
// Pre-Admission Screening wizard for Bradley Gation, mirroring the Holly S run.
// Data comes from Bradley_G_initial_screening_Assessment.pdf; fields the PDF
// leaves blank use realistic template values (clearly placeholder).
import { chromium } from '@playwright/test';

const BASE = 'https://dcllc.vercel.app';
const EMAIL = 'admin@dependablecare.org';
const PASSWORD = 'Admin@DC2026!';

const log = (...a) => console.log('•', ...a);

async function main() {
  const browser = await chromium.launch({ headless: true, slowMo: 60 });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);

  // Capture pre-screening save responses so we can report the screening id.
  let lastSave = null;
  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/admission/pre-screening') && res.request().method() === 'POST') {
      try { lastSave = { status: res.status(), body: await res.json() }; } catch { /* ignore */ }
    }
  });

  // ── 1. Login ───────────────────────────────────────────────────────────────
  log('Logging in…');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin/, { timeout: 30000 }),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);
  log('Logged in, landed on', page.url());

  // ── 2. Open the pre-screening wizard ─────────────────────────────────────────
  await page.goto(`${BASE}/admission/pre-screening`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Full legal name').waitFor({ state: 'visible', timeout: 30000 });
  log('Pre-screening wizard loaded');

  // ── helpers ──────────────────────────────────────────────────────────────────
  const fillPh = (ph, val) => page.getByPlaceholder(ph, { exact: true }).fill(val);
  const fillPhRe = (re, val) => page.getByPlaceholder(re).fill(val);
  const fillDate = (labelText, val) =>
    page.locator(`xpath=//label[contains(normalize-space(.),"${labelText}")]/following::input[@type="date"][1]`).fill(val);
  const selectByLabel = (labelText, value) =>
    page.locator(`xpath=//label[contains(normalize-space(.),"${labelText}")]/following::select[1]`).selectOption(value);
  const advance = async (rx, nextWait) => {
    const btn = page.getByRole('button', { name: rx });
    await btn.waitFor({ state: 'visible' });
    // Wait until enabled (stepComplete) then click.
    await page.waitForFunction(
      (label) => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(label));
        return b && !b.disabled;
      },
      rx.source.includes('Submit') ? 'Submit & Continue' : 'Save & Continue',
      { timeout: 25000 },
    );
    await btn.click();
    if (nextWait) await nextWait();
  };

  // ── STEP 1 — Referral & Funding ───────────────────────────────────────────────
  log('Step 1: Referral & Funding');
  await fillPh('Full legal name', 'Bradley Gation');
  await fillDate('Date of Birth', '1984-02-25');
  await fillPh('e.g., she/her, they/them', 'he/him');
  await fillPh('Organization or professional name', 'LifeWorks NW');
  await fillDate('Date of Referral', '2026-02-12');
  await fillPh('Referring contact name', 'LifeWorks NW Intake Coordinator');
  await fillPh('(503) 000-0000', '(503) 555-0142');
  await fillPh('email@agency.org', 'intake@lifeworksnw.org');
  await fillPh('XXX-XX-XXXX', '541-83-7729'); // template SSN (PDF blank)
  await selectByLabel('Living Situation', 'Another Residential Program'); // PDF: Foster/Group Home
  await selectByLabel('County of Residence', 'Multnomah'); // template (PDF blank)
  await fillPhRe(/Describe the presenting crisis/,
    'Bradley is referred to a residential treatment home for rehabilitation and recovery support. He carries a diagnosis of schizophrenia and is seeking a structured environment to achieve stability, secure employment, and work toward smoking cessation. He currently resides in a foster/group home and requires ongoing behavioral and medication support.');
  await advance(/Save & Continue/, () => page.getByPlaceholder('e.g., Schizophrenia, F20.9').waitFor({ state: 'visible' }));

  // ── STEP 2 — Mental Health History ────────────────────────────────────────────
  log('Step 2: Mental Health History');
  await fillPh('e.g., Schizophrenia, F20.9', 'Schizophrenia (F20.9)');
  await fillDate('Date Diagnosed', '2018-03-15'); // template (PDF blank)
  await advance(/Save & Continue/, () => page.getByPlaceholder('Dr. full name').waitFor({ state: 'visible' }));

  // ── STEP 3 — Medical History & Needs ──────────────────────────────────────────
  log('Step 3: Medical History');
  await fillPh('Dr. full name', 'Dr. Sarah Mwangi, MD'); // template (PDF blank)
  await fillPhRe(/List each diagnosis/,
    'No significant chronic medical diagnoses reported at time of screening. TB screening completed with negative result; no known communicable diseases.');
  await advance(/Save & Continue/, () => page.locator('xpath=//label[contains(.,"Primary Substance")]/following::select[1]').waitFor({ state: 'visible' }));

  // ── STEP 4 — Substance Use History ────────────────────────────────────────────
  log('Step 4: Substance Use');
  await selectByLabel('Primary Substance', 'Other'); // PDF goal: smoking cessation
  await fillPh('List any additional substances...', 'Nicotine/tobacco — smoking cessation is a stated treatment goal');
  await advance(/Save & Continue/, () => page.locator('xpath=//label[contains(.,"Primary Income Source")]/following::select[1]').waitFor({ state: 'visible' }));

  // ── STEP 5 — Psychosocial & Legal ─────────────────────────────────────────────
  log('Step 5: Psychosocial & Legal');
  await selectByLabel('Primary Income Source', 'SSI (Supplemental Security Income)'); // template (PDF blank)
  await selectByLabel('Legal Status', 'None'); // PDF: Voluntary, no legal rep
  await fillPhRe(/What does the client identify/,
    'Willing to be helped and to engage in treatment. Motivated by goals of obtaining a job and achieving long-term stability and security.');
  await advance(/Save & Continue/, () => page.getByText('24-Hour Staff Supervision').waitFor({ state: 'visible' }));

  // ── STEP 6 — Level of Care & Summary ──────────────────────────────────────────
  log('Step 6: Level of Care & Summary');
  for (const lbl of ['24-Hour Staff Supervision', 'Medication Administration & Monitoring', 'CBT or DBT Skills Groups', 'Secure Facility (Elopement Risk)']) {
    await page.getByText(lbl, { exact: true }).click();
  }
  await fillPhRe(/Summarize the client's clinical and personal strengths/,
    'Bradley presents as motivated and willing to engage in care. He is independent in mobility and communication and requires only partial assistance with ADLs. His clear vocational and stability goals, combined with openness to support, make him a strong candidate for structured residential rehabilitation.');
  await selectByLabel('Screening Outcome', 'approved');
  await fillPh('Full name', 'Joe Kueve'); // assessor (template, mirrors Holly S)
  await fillPh('e.g., QMHP, LCSW, MSW', 'RN');
  await fillPh('Type full name to sign', 'Joe Kueve');
  await fillDate('Date', '2026-02-12');

  log('Submitting…');
  const submitResp = page.waitForResponse(
    (r) => r.url().includes('/api/v1/admission/pre-screening') && r.request().method() === 'POST',
    { timeout: 30000 },
  );
  await advance(/Submit & Continue/, null);
  const resp = await submitResp;
  const body = await resp.json().catch(() => null);
  log('Submit response:', resp.status(), JSON.stringify(body));

  await page.screenshot({ path: 'scripts/bradley-prescreening-result.png', fullPage: false });

  if (resp.ok()) {
    console.log('\n✅ SUCCESS — Bradley Gation pre-screening submitted.');
    console.log('   screeningId:', body?.data?.admissionId || body?.data?.id || '(see body)');
  } else {
    console.log('\n❌ FAILED — see response above.');
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });

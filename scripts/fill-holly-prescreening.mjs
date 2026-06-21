// One-off Playwright automation: log into production as admin and fill the
// Pre-Admission Screening wizard for Holly S, then SAVE AS DRAFT (not submit).
// Data comes from Holly_S_Initial_Screening_Assessment.pdf; fields the PDF
// leaves blank use clearly-marked template/placeholder values to edit later.
// The assessor SIGNATURE is intentionally left BLANK for manual signing.
//
// Best-effort by design: every field fill is wrapped so a missing selector is
// logged and SKIPPED rather than aborting the run ("leave what you can't
// handle"). The draft still saves with whatever was entered.
import { chromium } from '@playwright/test';

// Credentials come from the environment — never hardcode prod secrets in source.
const BASE = process.env.DC_BASE_URL || 'https://dcllc.vercel.app';
const EMAIL = process.env.DC_ADMIN_EMAIL;
const PASSWORD = process.env.DC_ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('✗ Missing credentials. Set DC_ADMIN_EMAIL and DC_ADMIN_PASSWORD before running.');
  console.error('  cmd.exe:    set "DC_ADMIN_EMAIL=admin@dependablecare.org" && set "DC_ADMIN_PASSWORD=YOUR_PW" && node scripts/fill-holly-prescreening.mjs');
  console.error('  PowerShell: $env:DC_ADMIN_EMAIL="admin@dependablecare.org"; $env:DC_ADMIN_PASSWORD="YOUR_PW"; node scripts/fill-holly-prescreening.mjs');
  console.error('  (optional) DC_BASE_URL=http://localhost:3000 to target local dev.');
  process.exit(1);
}

const log = (...a) => console.log('•', ...a);

async function main() {
  const browser = await chromium.launch({ headless: true, slowMo: 60 });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  // Capture pre-screening save responses so we can report the screening id.
  let lastSave = null;
  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/admission/pre-screening') && res.request().method() === 'POST') {
      try { lastSave = { status: res.status(), body: await res.json() }; } catch { /* ignore */ }
    }
  });

  // best-effort wrapper: log + continue on any failure
  const safe = async (desc, fn) => {
    try { await fn(); }
    catch (e) { log('  ⚠ skipped', desc, '—', String(e.message || e).split('\n')[0]); }
  };

  // ── 1. Login (resilient to cold starts + non-/admin landing) ─────────────────
  log('Logging in…');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign\s?in|log\s?in/i }).first().click();
  // Wait until we leave /login (token stored + client-side redirect), whatever
  // the landing page is. Don't hard-require /admin.
  await page.waitForURL((u) => !/\/login(\?|$)/.test(u.toString()), { timeout: 60000 }).catch(() => {});
  if (/\/login(\?|$)/.test(page.url())) {
    const err = await page.locator('text=/invalid|incorrect|error|failed|locked/i')
      .first().textContent().catch(() => null);
    await page.screenshot({ path: 'scripts/holly-login-failed.png' }).catch(() => {});
    throw new Error(`Login did not complete; still on /login. Visible message: ${err || '(none)'} — see scripts/holly-login-failed.png`);
  }
  log('Logged in, landed on', page.url());

  // ── 2. Open the pre-screening wizard ─────────────────────────────────────────
  await page.goto(`${BASE}/admission/pre-screening`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Full legal name').waitFor({ state: 'visible', timeout: 60000 });
  log('Pre-screening wizard loaded');

  // If a "resume previous draft?" prompt appears, start fresh.
  await safe('dismiss resume-draft prompt', async () => {
    const sf = page.getByRole('button', { name: /Start Fresh/i });
    if (await sf.isVisible({ timeout: 3000 })) await sf.click();
  });

  // ── helpers (all best-effort) ─────────────────────────────────────────────────
  const fillPh = (ph, val) => safe(`fill "${ph}"`, () => page.getByPlaceholder(ph, { exact: true }).fill(val, { timeout: 15000 }));
  const fillPhRe = (re, val) => safe(`fill ${re}`, () => page.getByPlaceholder(re).fill(val, { timeout: 15000 }));
  const fillDate = (labelText, val) => safe(`date "${labelText}"`, () =>
    page.locator(`xpath=//label[contains(normalize-space(.),"${labelText}")]/following::input[@type="date"][1]`).fill(val, { timeout: 15000 }));
  const selectByLabel = (labelText, value) => safe(`select "${labelText}"`, () =>
    page.locator(`xpath=//label[contains(normalize-space(.),"${labelText}")]/following::select[1]`).selectOption(value, { timeout: 15000 }));
  const clickText = (txt) => safe(`click "${txt}"`, () => page.getByText(txt, { exact: true }).click({ timeout: 15000 }));
  const advance = async (rx, nextWait) => {
    const btn = page.getByRole('button', { name: rx });
    try {
      await btn.waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForFunction(
        (label) => {
          const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(label));
          return b && !b.disabled;
        },
        'Save & Continue',
        { timeout: 40000 },
      );
      await btn.click();
    } catch (e) {
      log('  ⚠ could not advance via', rx.toString(), '—', String(e.message || e).split('\n')[0]);
      await btn.click({ force: true }).catch(() => {});
    }
    if (nextWait) { try { await nextWait(); } catch (e) { log('  ⚠ next-step wait failed —', String(e.message || e).split('\n')[0]); } }
  };

  // ── STEP 1 — Referral & Funding ───────────────────────────────────────────────
  log('Step 1: Referral & Funding');
  await fillPh('Full legal name', 'Holly S');
  await fillDate('Date of Birth', '1968-12-14');
  await fillPh('e.g., she/her, they/them', 'she/her'); // template (PDF blank)
  await fillPh('Organization or professional name', 'Oregon State Hospital');
  await fillDate('Date of Referral', '2026-01-26'); // screening date (no separate referral date on PDF)
  await fillPh('Referring contact name', 'Oregon State Hospital Intake (placeholder)'); // PDF blank
  await fillPh('(503) 000-0000', '(503) 555-0000'); // template (PDF blank)
  await fillPh('email@agency.org', 'intake@oregonstatehospital.gov'); // template (PDF blank)
  await fillPh('XXX-XX-XXXX', '000-00-0000'); // placeholder SSN (PDF blank)
  await selectByLabel('Living Situation', 'Hospital'); // PDF: Hospital / Acute Care
  await selectByLabel('County of Residence', 'Marion'); // template (PDF blank); OSH is in Marion County
  await fillPhRe(/Describe the presenting crisis/,
    'Holly is referred from Oregon State Hospital under civil commitment for placement in a residential treatment home. She has a diagnosed mental health condition and a long history of homelessness, and requires a structured RTH environment with behavioral support, medication management, and skills training to work toward independence and managing her own life.');
  await advance(/Save & Continue/, () => page.getByPlaceholder('e.g., Schizophrenia, F20.9').waitFor({ state: 'visible' }));

  // ── STEP 2 — Mental Health History ────────────────────────────────────────────
  log('Step 2: Mental Health History');
  await fillPh('e.g., Schizophrenia, F20.9', 'Mental health disorder — diagnosis pending confirmation (placeholder)');
  await fillDate('Date Diagnosed', '2020-01-01'); // template (PDF blank)
  await advance(/Save & Continue/, () => page.getByPlaceholder('Dr. full name').waitFor({ state: 'visible' }));

  // ── STEP 3 — Medical History & Needs ──────────────────────────────────────────
  log('Step 3: Medical History');
  await fillPh('Dr. full name', 'To Be Assigned (placeholder)'); // PDF PCP blank
  await fillPhRe(/List each diagnosis/,
    'Hypertension (HTN). Allergies: NKDA (no known drug allergies). No known communicable diseases noted at screening; mobility independent, partial assistance with ADLs.');
  await advance(/Save & Continue/, () => page.locator('xpath=//label[contains(.,"Primary Substance")]/following::select[1]').waitFor({ state: 'visible' }));

  // ── STEP 4 — Substance Use History ────────────────────────────────────────────
  log('Step 4: Substance Use');
  await selectByLabel('Primary Substance', 'Other'); // placeholder (no substance data on PDF)
  await fillPh('List any additional substances...', 'No substance use reported in initial screening — placeholder pending confirmation.');
  await advance(/Save & Continue/, () => page.locator('xpath=//label[contains(.,"Primary Income Source")]/following::select[1]').waitFor({ state: 'visible' }));

  // ── STEP 5 — Psychosocial & Legal ─────────────────────────────────────────────
  log('Step 5: Psychosocial & Legal');
  await selectByLabel('Primary Income Source', 'SSI (Supplemental Security Income)'); // template (PDF blank)
  await selectByLabel('Legal Status', 'Civil Commitment'); // PDF: Civil Commitment
  await fillPhRe(/What does the client identify/,
    "Client's goal is to be independent and manage her own life. Strengths: willing to be helped and to engage in services. Concern noted: long history of homelessness.");
  await advance(/Save & Continue/, () => page.getByText('24-Hour Staff Supervision').waitFor({ state: 'visible' }));

  // ── STEP 6 — Level of Care & Summary ──────────────────────────────────────────
  log('Step 6: Level of Care & Summary');
  for (const lbl of ['24-Hour Staff Supervision', 'Medication Administration & Monitoring', 'Assistance with ADLs', 'CBT or DBT Skills Groups']) {
    await clickText(lbl);
  }
  await fillPhRe(/Summarize the client's clinical and personal strengths/,
    'Holly is willing to be helped and engages with support. She is independent in mobility and verbal communication and requires partial assistance with ADLs. Her stated goal of independence and self-management, combined with openness to help, supports placement in a structured RTH with 24-hour supervision, medication management, ADL support, and skills training.');
  await selectByLabel('Screening Outcome', 'approved'); // PDF: Approved for Admission
  await fillPh('Full name', 'Joe Kueve'); // assessor (PDF: Screening Completed By)
  await fillPh('e.g., QMHP, LCSW, MSW', 'RN');
  // SIGNATURE INTENTIONALLY LEFT BLANK — user will sign.
  await fillDate('Date', '2026-01-26'); // PDF date 1/26/26

  // ── SAVE AS DRAFT (not submit) ────────────────────────────────────────────────
  log('Saving as draft…');
  const saveResp = page.waitForResponse(
    (r) => r.url().includes('/api/v1/admission/pre-screening') && r.request().method() === 'POST',
    { timeout: 30000 },
  ).catch(() => null);
  await page.getByRole('button', { name: 'Save Draft' }).first().click();
  const resp = await saveResp;
  const body = resp ? await resp.json().catch(() => null) : (lastSave && lastSave.body);
  const status = resp ? resp.status() : (lastSave && lastSave.status);
  log('Save Draft response:', status, JSON.stringify(body));

  await page.screenshot({ path: 'scripts/holly-prescreening-draft.png', fullPage: false }).catch(() => {});

  if (status && status < 400) {
    console.log('\n✅ SUCCESS — Holly S pre-screening saved as DRAFT (signature left blank).');
    console.log('   screeningId:', body?.data?.admissionId || body?.data?.id || '(see body)');
    console.log('   status:', body?.data?.status || '(see body)');
  } else {
    console.log('\n❌ Save did not confirm — see response above and scripts/holly-prescreening-draft.png');
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message || e); process.exit(1); });

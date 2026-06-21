/**
 * End-to-end admission + care-plan exerciser against PRODUCTION.
 * - Logs in as admin
 * - Walks nursing-assessment -> pre-screening -> advance-directive (final submit)
 * - Logs EVERY /api request/response (status + body) so we see where a DB write fails
 * - Saves a screenshot after every step
 *
 * Usage: node scripts/e2e-admission-prod.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'https://dcllc.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@dependablecare.org';
const PASSWORD = process.env.ADMIN_PASSWORD; // set ADMIN_PASSWORD in the env — never hardcode credentials
if (!PASSWORD) { console.error('Set ADMIN_PASSWORD env var.'); process.exit(1); }
const SHOTS = path.join(__dirname, '_e2e_shots');
fs.mkdirSync(SHOTS, { recursive: true });

const RUN_TAG = 'E2E' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const RESIDENT_FIRST = 'Playwright';
const RESIDENT_LAST = 'Tester' + RUN_TAG.slice(-6);

let shot = 0;
const apiLog = [];
let capturedAdmissionId = null;
let admissionPostCount = 0;

function log(...a) { console.log(...a); }

async function snap(page, name) {
  shot += 1;
  const file = path.join(SHOTS, `${String(shot).padStart(2, '0')}-${name}.png`);
  try { await page.screenshot({ path: file, fullPage: true }); } catch {}
}

function attachNetwork(page) {
  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    const req = resp.request();
    const method = req.method();
    const status = resp.status();
    let body = '';
    try {
      const ct = resp.headers()['content-type'] || '';
      if (ct.includes('json') || status >= 400) body = (await resp.text()).slice(0, 1200);
    } catch {}
    const entry = { method, status, url: url.replace(BASE, ''), body };
    apiLog.push(entry);
    const flag = status >= 400 ? ' <<< ERROR' : '';
    log(`  [api] ${method} ${status} ${entry.url}${flag}`);
    if (status >= 400 && body) log(`        body: ${body}`);
    if (method === 'POST' && url.includes('/api/v1/admission/forms')) admissionPostCount += 1;
    // Capture admissionId from any admission/forms POST
    if (method === 'POST' && url.includes('/api/v1/admission/forms') && status < 400) {
      try {
        const j = JSON.parse(body);
        const id = j?.data?.admissionId || j?.data?.id;
        if (id) { capturedAdmissionId = id; log(`        >>> admissionId = ${id}`); }
      } catch {}
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') log(`  [console.error] ${msg.text().slice(0, 300)}`);
  });
}

/** Generic, type-aware filler. Fills every visible text/select/textarea and clicks
 *  one option in every custom radio/checkbox group. Runs two passes to catch
 *  conditionally-revealed fields. */
async function fillEverything(page, { firstName, lastName } = {}) {
  const result = await page.evaluate(({ firstName, lastName }) => {
    const out = { text: 0, select: 0, textarea: 0, radio: 0 };

    function reactSet(el, value) {
      const tag = el.tagName;
      const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype
        : tag === 'SELECT' ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function visible(el) {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function labelTextFor(el) {
      // climb up to 5 ancestors, look for a child <label> or a preceding label text
      let node = el;
      for (let i = 0; i < 5 && node; i++) {
        const lab = node.querySelector ? node.querySelector(':scope > label, label') : null;
        if (lab && lab.textContent) return lab.textContent.toLowerCase();
        node = node.parentElement;
      }
      return (el.getAttribute('placeholder') || '').toLowerCase();
    }

    function valueForText(el) {
      const t = (el.type || 'text').toLowerCase();
      const lab = labelTextFor(el) + ' ' + (el.getAttribute('placeholder') || '').toLowerCase()
        + ' ' + (el.id || '').toLowerCase() + ' ' + (el.name || '').toLowerCase();
      // DOB/age must be self-consistent: 1980-01-15 -> age 46 as of 2026.
      if (t === 'date') {
        if (/dob|birth/.test(lab)) return '1980-01-15';
        return '2024-01-15';
      }
      if (t === 'email') return 'playwright.test@example.com';
      if (t === 'number') {
        if (/weight/.test(lab)) return '170';
        if (/height/.test(lab)) return '70';
        if (/temp/.test(lab)) return '98';
        if (/systolic/.test(lab)) return '120';
        if (/diastolic/.test(lab)) return '80';
        if (/pulse|heart/.test(lab)) return '72';
        if (/resp/.test(lab)) return '16';
        if (/oxygen|o2|sat/.test(lab)) return '98';
        if (/pain/.test(lab)) return '2';
        if (/age/.test(lab)) return '46';
        if (/sleep/.test(lab)) return '7';
        return '5';
      }
      if (t === 'tel' || /phone|mobile|cell/.test(lab)) return '(503) 555-1234';
      // text fields — context aware
      if (/ssn|social security/.test(lab)) return '999-99-9999';
      if (/dob|birth/.test(lab)) return '1980-01-15';
      if (/\bdate\b/.test(lab)) return '2024-01-15';
      // witnesses MUST differ from each other and from resident
      if (/witness/.test(lab)) return /2|two|second/.test(lab) ? 'Wanda Witness-Two' : 'Walter Witness-One';
      if (/first name|firstname/.test(lab)) return firstName;
      if (/last name|lastname|surname/.test(lab)) return lastName;
      if (/full name|resident name|client name|patient name|\bname\b/.test(lab)) return firstName + ' ' + lastName;
      if (/email/.test(lab)) return 'playwright.test@example.com';
      if (/zip|postal/.test(lab)) return '97201';
      if (/state/.test(lab)) return 'OR';
      if (/city/.test(lab)) return 'Portland';
      if (/county/.test(lab)) return 'Multnomah';
      if (/address|street/.test(lab)) return '123 Test St';
      if (/signature|printed name|assessor|agent|physician|pcp|provider|contact|referr/.test(lab)) return firstName + ' ' + lastName;
      if (/diagnos|problem|reason|summary|notes|history|describe|comment|strength|plan|goal/.test(lab)) return 'Automated end-to-end test entry for QA verification of the admission workflow.';
      return 'Test ' + (lab.trim().split(/\s+/)[0] || 'value');
    }

    // 1) Click one option in each custom radio/checkbox group (first option)
    const groups = new Map();
    document.querySelectorAll('label > span:first-child').forEach((span) => {
      // only the small circle/box spans (no nested inputs)
      if (span.querySelector('input,select,textarea')) return;
      const label = span.parentElement;
      const parent = label.parentElement;
      if (!parent) return;
      if (!visible(span)) return;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(span);
    });
    groups.forEach((spans) => { try { spans[0].click(); out.radio += 1; } catch {} });

    // 1b) Custom option "cards": <div cursor:pointer> with a small leading
    //     box/circle <span> + short label (e.g. Level of Care Needs grid).
    //     Click the first UNCHECKED card per parent group.
    const cardGroups = new Map();
    document.querySelectorAll('div').forEach((div) => {
      if (!visible(div)) return;
      let cs;
      try { cs = getComputedStyle(div); } catch { return; }
      if (cs.cursor !== 'pointer') return;
      const box = div.querySelector(':scope > span');
      if (!box) return;
      const br = box.getBoundingClientRect();
      if (br.width < 12 || br.width > 26 || br.height < 12 || br.height > 26) return;
      const txt = (div.textContent || '').trim();
      if (!txt || txt.length > 60) return;
      if (box.children.length > 0) return; // already checked
      const parent = div.parentElement;
      if (!parent) return;
      if (!cardGroups.has(parent)) cardGroups.set(parent, []);
      cardGroups.get(parent).push(div);
    });
    cardGroups.forEach((cards) => { try { cards[0].click(); out.radio += 1; } catch {} });

    // 2) Selects
    document.querySelectorAll('select').forEach((el) => {
      if (!visible(el)) return;
      const opts = Array.from(el.options).filter((o) => o.value !== '');
      if (opts.length) { reactSet(el, opts[0].value); out.select += 1; }
    });

    // 3) Text inputs + textareas
    document.querySelectorAll('input').forEach((el) => {
      const t = (el.type || 'text').toLowerCase();
      if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'range'].includes(t)) return;
      if (!visible(el) || el.disabled || el.readOnly) return;
      if (el.value && el.value.trim() !== '') return; // don't clobber existing
      reactSet(el, valueForText(el));
      out.text += 1;
    });
    document.querySelectorAll('textarea').forEach((el) => {
      if (!visible(el) || el.disabled || el.readOnly) return;
      if (el.value && el.value.trim() !== '') return;
      reactSet(el, 'Automated end-to-end test entry. ' + new Date().toISOString());
      out.textarea += 1;
    });

    return out;
  }, { firstName, lastName });
  return result;
}

async function clickAdvance(page) {
  // Find the footer's primary forward button (Continue / Submit / Complete / Next),
  // excluding Save Draft / Previous. Prefer enabled ones.
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const fwd = btns.filter((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      if (!txt) return false;
      if (/save draft|previous|back|cancel|close/.test(txt)) return false;
      return /continue|submit|complete|finish|next|→/.test(txt);
    });
    // prefer an enabled one, else the last matching (footer)
    const enabled = fwd.filter((b) => !b.disabled);
    const target = (enabled[enabled.length - 1] || fwd[fwd.length - 1]);
    if (!target) return { ok: false, reason: 'no forward button found' };
    if (target.disabled) return { ok: false, reason: 'forward button disabled: ' + target.textContent.trim() };
    target.click();
    return { ok: true, label: target.textContent.trim() };
  });
  return clicked;
}

async function waitForPost(before, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (admissionPostCount > before) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function dumpErrors(page) {
  const errs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length === 0) {
        const t = (el.textContent || '').trim();
        if (/^•/.test(t) || (/is required|doesn't match|must be|need attention|missing|invalid|at least \d+ characters|format/i.test(t) && t.length < 120)) out.push(t);
      }
    });
    return [...new Set(out)].slice(0, 25);
  });
  if (errs.length) log(`     on-page validation messages: ${JSON.stringify(errs)}`);
  else log('     (no recognizable validation messages found on page)');
}

// Signature of the current step's content (heading + field labels) so we can
// detect step changes for forms (advance-directive) that don't POST per step.
async function contentSig(page) {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label')).map((l) => (l.textContent || '').trim()).filter(Boolean);
    return labels.join('|').slice(0, 600);
  });
}

async function runForm(page, urlPath, formName, maxSteps, opts = {}) {
  log(`\n=== FORM: ${formName} ===`);
  const url = `${BASE}${urlPath}${capturedAdmissionId ? `?admission_id=${capturedAdmissionId}` : ''}`;
  log(`navigate -> ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // dismiss any resume-draft dialog by discarding
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /discard|start (over|fresh)|no, /i.test(x.textContent || ''));
    if (b) b.click();
  });

  for (let step = 1; step <= maxSteps; step++) {
    const counts = await fillEverything(page, opts);
    await page.waitForTimeout(400);
    // second pass for revealed conditional fields
    const counts2 = await fillEverything(page, opts);
    await page.waitForTimeout(300);
    log(`  step ${step}: filled text=${counts.text + counts2.text} select=${counts.select + counts2.select} textarea=${counts.textarea + counts2.textarea} radioGroups=${counts.radio}`);
    await snap(page, `${formName}-step${step}`);

    const before = admissionPostCount;
    const sigBefore = await contentSig(page);
    const adv = await clickAdvance(page);
    if (!adv.ok) {
      log(`  !! could not click forward on step ${step}: ${adv.reason}`);
      await snap(page, `${formName}-step${step}-STUCK`);
      await dumpErrors(page);
      return { ok: false, step };
    }
    log(`  -> clicked "${adv.label}"`);
    // Advancement signal: a save POST fired (nursing/pre-screening) OR the step
    // content changed (advance-directive doesn't POST on intermediate steps).
    let advanced = false;
    const deadline = Date.now() + 9000;
    while (Date.now() < deadline) {
      if (admissionPostCount > before) { advanced = true; break; }
      const sigNow = await contentSig(page);
      if (sigNow && sigNow !== sigBefore) { advanced = true; break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1200);
    if (!advanced) {
      log(`  !! step ${step} did NOT advance — client validation blocked it.`);
      await snap(page, `${formName}-step${step}-BLOCKED`);
      await dumpErrors(page);
      return { ok: false, step };
    }
  }
  await snap(page, `${formName}-after-submit`);
  return { ok: true };
}

async function fetchToken() {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await res.json();
  if (!j.accessToken) throw new Error('No accessToken from login: ' + JSON.stringify(j));
  return j.accessToken;
}

let BEARER = null;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  // The prod /auth/refresh bug drops the in-memory access token on every hard
  // navigation, so the forms omit the Authorization header. Work around it by
  // injecting a valid admin Bearer token into every authenticated API call.
  BEARER = await fetchToken();
  log('Fetched admin Bearer token for header injection (len ' + BEARER.length + ')');
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/api\/v1\/auth\//.test(url)) return route.continue(); // don't touch auth flows
    const headers = { ...req.headers(), authorization: `Bearer ${BEARER}` };
    return route.continue({ headers });
  });

  const page = await context.newPage();
  attachNetwork(page);

  try {
    // ---- LOGIN ----
    log(`\n=== LOGIN as ${EMAIL} ===`);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await snap(page, 'login');
    await page.click('button[type=submit]');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    log(`  after login, url = ${page.url()}`);
    await snap(page, 'after-login');

    const opts = { firstName: RESIDENT_FIRST, lastName: RESIDENT_LAST };
    log(`\n>>> Test resident name: ${RESIDENT_FIRST} ${RESIDENT_LAST}`);

    // ---- ADMISSION FORMS ----  (step counts: nursing=8, pre-screening=6, advance-directive=4)
    if (process.env.ADMISSION_ID) {
      capturedAdmissionId = process.env.ADMISSION_ID;
      log(`\n>>> Resuming existing admissionId=${capturedAdmissionId} (skipping nursing)`);
    } else {
      const r1 = await runForm(page, '/admission/nursing-assessment', 'nursing', 8, opts);
      log(`nursing result: ${JSON.stringify(r1)}  admissionId=${capturedAdmissionId}`);
    }

    if (capturedAdmissionId) {
      const r2 = await runForm(page, '/admission/pre-screening', 'pre-screening', 6, opts);
      log(`pre-screening result: ${JSON.stringify(r2)}`);

      const r3 = await runForm(page, '/admission/advance-directive', 'advance-directive', 4, opts);
      log(`advance-directive result: ${JSON.stringify(r3)}`);
    } else {
      log('!! No admissionId captured — nursing-assessment did not create an admission. Stopping.');
    }

    log(`\n=== DONE. admissionId=${capturedAdmissionId} ===`);
  } catch (e) {
    log('FATAL: ' + (e.stack || e.message));
    await snap(page, 'FATAL');
  } finally {
    // write api log summary
    const errors = apiLog.filter((e) => e.status >= 400);
    log(`\n===== API ERROR SUMMARY (${errors.length}) =====`);
    errors.forEach((e) => log(`  ${e.method} ${e.status} ${e.url}\n      ${e.body}`));
    fs.writeFileSync(path.join(SHOTS, 'api-log.json'), JSON.stringify(apiLog, null, 2));
    log(`\nadmissionId=${capturedAdmissionId}`);
    log(`Screenshots in ${SHOTS}`);
    await browser.close();
  }
})();

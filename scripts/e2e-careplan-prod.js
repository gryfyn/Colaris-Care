/**
 * Phase 3: create a FULLY-filled care plan for the admitted resident via the
 * /care-plan wizard on PRODUCTION. Selects the resident, fills every field on
 * all 7 steps, submits, and logs all /api traffic to surface DB errors.
 *
 * Usage: RESIDENT_NAME="Playwright Tester123207" node scripts/e2e-careplan-prod.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'https://dcllc.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@dependablecare.org';
const PASSWORD = process.env.ADMIN_PASSWORD; // set ADMIN_PASSWORD in the env — never hardcode credentials
if (!PASSWORD) { console.error('Set ADMIN_PASSWORD env var.'); process.exit(1); }
const RESIDENT_NAME = process.env.RESIDENT_NAME || 'Playwright Tester123207';
const SHOTS = path.join(__dirname, '_e2e_shots');
fs.mkdirSync(SHOTS, { recursive: true });

let shot = 0;
const apiLog = [];
let BEARER = null;
let wizardPostCount = 0;
const log = (...a) => console.log(...a);

async function snap(page, name) {
  shot += 1;
  try { await page.screenshot({ path: path.join(SHOTS, `cp${String(shot).padStart(2, '0')}-${name}.png`), fullPage: true }); } catch {}
}

function attachNetwork(page) {
  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    const method = resp.request().method();
    const status = resp.status();
    let body = '';
    try { const ct = resp.headers()['content-type'] || ''; if (ct.includes('json') || status >= 400) body = (await resp.text()).slice(0, 1500); } catch {}
    apiLog.push({ method, status, url: url.replace(BASE, ''), body });
    const flag = status >= 400 ? ' <<< ERROR' : '';
    log(`  [api] ${method} ${status} ${url.replace(BASE, '')}${flag}`);
    if (status >= 400 && body) log(`        body: ${body}`);
    if (/care-plans-wizard/.test(url)) {
      wizardPostCount += 1;
      if (status >= 400) {
        let pd = ''; try { pd = resp.request().postData() || ''; } catch {}
        log(`        >>> FAILED REQUEST keys: ${pd ? Object.keys(JSON.parse(pd).data || {}).join(', ') : '(none)'}`);
        log(`        >>> payload: ${pd.slice(0, 700)}`);
      }
    }
  });
  page.on('console', (m) => { if (m.type() === 'error') log(`  [console.error] ${m.text().slice(0, 200)}`); });
}

async function fetchToken() {
  const res = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const j = await res.json();
  if (!j.accessToken) throw new Error('no token: ' + JSON.stringify(j));
  return j.accessToken;
}

// Generic, type-aware filler (same approach as the admission script).
async function fillEverything(page) {
  return page.evaluate(() => {
    const out = { text: 0, select: 0, textarea: 0, radio: 0 };
    function reactSet(el, value) {
      const tag = el.tagName;
      const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : tag === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function labelFor(el) {
      let n = el;
      for (let i = 0; i < 5 && n; i++) { const l = n.querySelector ? n.querySelector(':scope > label, label') : null; if (l && l.textContent) return l.textContent.toLowerCase(); n = n.parentElement; }
      return (el.getAttribute('placeholder') || '').toLowerCase();
    }
    function val(el) {
      const t = (el.type || 'text').toLowerCase();
      const lab = labelFor(el) + ' ' + (el.getAttribute('placeholder') || '').toLowerCase();
      if (t === 'date') return '2026-06-10';
      if (t === 'number') return '5';
      if (t === 'tel' || /phone/.test(lab)) return '(503) 555-1234';
      if (t === 'email' || /email/.test(lab)) return 'careplan.test@example.com';
      if (/signature/.test(lab)) return 'Playwright Tester123207';
      if (/date/.test(lab)) return '2026-06-10';
      if (/name/.test(lab)) return 'Playwright Tester123207';
      if (/org|cmhp|cco|agency/.test(lab)) return 'Dependable Care Wellness Centre';
      return 'Automated end-to-end care plan QA entry covering this required field in full detail.';
    }
    // radios/checkboxes rendered as label > span
    const groups = new Map();
    document.querySelectorAll('label > span:first-child').forEach((sp) => {
      if (sp.querySelector('input,select,textarea') || !visible(sp)) return;
      const p = sp.parentElement.parentElement; if (!p) return;
      if (!groups.has(p)) groups.set(p, []); groups.get(p).push(sp);
    });
    groups.forEach((s) => { try { s[0].click(); out.radio++; } catch {} });
    // option cards: div cursor:pointer with a small leading box span (domains, etc.)
    const cardGroups = new Map();
    document.querySelectorAll('div').forEach((div) => {
      if (!visible(div)) return; let cs; try { cs = getComputedStyle(div); } catch { return; }
      if (cs.cursor !== 'pointer') return;
      const box = div.querySelector(':scope > span'); if (!box) return;
      const br = box.getBoundingClientRect();
      if (br.width < 12 || br.width > 28 || br.height < 12 || br.height > 28) return;
      const txt = (div.textContent || '').trim(); if (!txt || txt.length > 70) return;
      if (box.children.length > 0) return; // checked
      const p = div.parentElement; if (!p) return;
      if (!cardGroups.has(p)) cardGroups.set(p, []); cardGroups.get(p).push(div);
    });
    cardGroups.forEach((c) => { try { c[0].click(); out.radio++; } catch {} });
    // selects
    document.querySelectorAll('select').forEach((el) => { if (!visible(el)) return; const o = Array.from(el.options).filter((x) => x.value !== ''); if (o.length) { reactSet(el, o[0].value); out.select++; } });
    // text inputs
    document.querySelectorAll('input').forEach((el) => {
      const t = (el.type || 'text').toLowerCase();
      if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'range'].includes(t)) return;
      if (!visible(el) || el.disabled || el.readOnly) return;
      if (el.value && el.value.trim() !== '') return;
      reactSet(el, val(el)); out.text++;
    });
    document.querySelectorAll('textarea').forEach((el) => { if (!visible(el) || el.disabled || el.readOnly) return; if (el.value && el.value.trim() !== '') return; reactSet(el, 'Automated end-to-end care plan QA entry with full detail for this section.'); out.textarea++; });
    return out;
  });
}

async function clickAdvance(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const fwd = btns.filter((b) => { const t = (b.textContent || '').trim().toLowerCase(); if (!t) return false; if (/save draft|previous|back|cancel|close|print|clear|✕/.test(t)) return false; return /continue|submit|finish|next|→|sign/.test(t); });
    const enabled = fwd.filter((b) => !b.disabled);
    const target = enabled[enabled.length - 1] || fwd[fwd.length - 1];
    if (!target) return { ok: false, reason: 'no forward button' };
    if (target.disabled) return { ok: false, reason: 'forward disabled: ' + target.textContent.trim() };
    target.click();
    return { ok: true, label: target.textContent.trim() };
  });
}

async function dumpErrors(page) {
  const errs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el) => { if (el.children.length === 0) { const t = (el.textContent || '').trim(); if (/required|complete|missing|select|must|need/i.test(t) && t.length < 120) out.push(t); } });
    return [...new Set(out)].slice(0, 25);
  });
  log(`     on-page hints: ${JSON.stringify(errs)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  BEARER = await fetchToken();
  await context.route('**/api/v1/**', (r) => /\/api\/v1\/auth\//.test(r.request().url()) ? r.continue() : r.continue({ headers: { ...r.request().headers(), authorization: `Bearer ${BEARER}` } }));
  const page = await context.newPage();
  attachNetwork(page);

  async function clickByText(texts) {
    return page.evaluate((arr) => {
      const els = Array.from(document.querySelectorAll('a,button,div,span,li'));
      for (const t of arr) {
        const e = els.find((x) => (x.textContent || '').trim() === t && x.offsetParent !== null)
          || els.find((x) => (x.textContent || '').trim().includes(t) && x.offsetParent !== null && (x.tagName === 'BUTTON' || x.getAttribute('role') === 'button'));
        if (e) { e.click(); return t; }
      }
      return null;
    }, texts);
  }

  try {
    log('=== LOGIN ===');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', EMAIL); await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForTimeout(3500);
    log(`  url=${page.url()}`);

    // Reach the wizard via CLIENT navigation (keeps the in-memory token alive;
    // a hard load of /care-plan redirects to /login due to the prod refresh bug).
    log('\n=== ADMIN > CARE PLANS (sidebar) ===');
    log(`  sidebar: ${await clickByText(['Care Plans'])}`);
    await page.waitForTimeout(3000);
    await snap(page, 'careplans-section');

    log(`  new plan btn: ${await clickByText(['+ New Care Plan', 'New Care Plan'])}`);
    await page.waitForTimeout(1500);
    await snap(page, 'resident-selector');

    // Select the resident in the modal's <select>, then click Create Plan
    const selOk = await page.evaluate((name) => {
      const sel = Array.from(document.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => (o.textContent || '').includes(name)));
      if (!sel) return false;
      const opt = Array.from(sel.options).find((o) => (o.textContent || '').includes(name));
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, RESIDENT_NAME);
    log(`  selected resident in modal: ${selOk}`);
    await page.waitForTimeout(1200);
    log(`  create plan btn: ${await clickByText(['Create Plan'])}`);
    await page.waitForTimeout(3500);
    await snap(page, 'wizard-loaded');
    log(`  wizard url=${page.url()}`);

    // ---- STEP 1: ensure the resident is selected in PatientSearch ----
    const needPick = await page.evaluate(() => !/✓ Resident selected/i.test(document.body.innerText));
    if (needPick) {
      log('  resident not pre-selected — using PatientSearch');
      const input = await page.$('input[placeholder*="name or Medicaid" i], input[placeholder*="search" i]');
      if (input) {
        await input.click();
        await input.type(RESIDENT_NAME.split(/\s+/)[0], { delay: 30 });
        await page.waitForTimeout(1500);
        const picked = await page.evaluate((name) => {
          const items = Array.from(document.querySelectorAll('div')).filter((d) => (d.textContent || '').includes(name) && getComputedStyle(d).cursor === 'pointer');
          const target = items.sort((a, b) => a.textContent.length - b.textContent.length)[0];
          if (target) { target.click(); return target.textContent.trim().slice(0, 60); }
          return null;
        }, RESIDENT_NAME);
        log(`  picked dropdown item: ${picked}`);
      } else {
        log('  !! PatientSearch input not found');
      }
    } else {
      log('  resident pre-selected via residentId param');
    }
    await page.waitForTimeout(1500);
    await snap(page, 'patient-selected');

    // ---- Walk all 7 steps ----
    for (let step = 1; step <= 7; step++) {
      const c1 = await fillEverything(page); await page.waitForTimeout(400);
      const c2 = await fillEverything(page); await page.waitForTimeout(300);
      log(`  step ${step}: text=${c1.text + c2.text} select=${c1.select + c2.select} textarea=${c1.textarea + c2.textarea} options=${c1.radio}`);
      await snap(page, `step${step}`);

      const before = wizardPostCount;
      const adv = await clickAdvance(page);
      if (!adv.ok) { log(`  !! step ${step} cannot advance: ${adv.reason}`); await snap(page, `step${step}-STUCK`); await dumpErrors(page); break; }
      log(`  -> clicked "${adv.label}"`);
      // wait for a wizard POST (each step saves on advance; final step submits)
      let advanced = false; const deadline = Date.now() + 9000;
      while (Date.now() < deadline) { if (wizardPostCount > before) { advanced = true; break; } await page.waitForTimeout(300); }
      await page.waitForTimeout(1500);
      if (!advanced && step < 7) { log(`  !! step ${step} did not advance (no wizard POST).`); await snap(page, `step${step}-BLOCKED`); await dumpErrors(page); break; }
    }
    await snap(page, 'final');
    await page.waitForTimeout(2000);
    log('\n=== DONE ===');
  } catch (e) {
    log('FATAL: ' + (e.stack || e.message));
    await snap(page, 'FATAL');
  } finally {
    const errors = apiLog.filter((e) => e.status >= 400 && !/\/auth\/refresh/.test(e.url));
    log(`\n===== API ERRORS (excl. auth/refresh) (${errors.length}) =====`);
    errors.forEach((e) => log(`  ${e.method} ${e.status} ${e.url}\n      ${e.body}`));
    const wiz = apiLog.filter((e) => /care-plans-wizard/.test(e.url));
    log(`\nwizard POSTs: ${wiz.map((w) => w.method + ' ' + w.status).join(', ')}`);
    fs.writeFileSync(path.join(SHOTS, 'careplan-api-log.json'), JSON.stringify(apiLog, null, 2));
    await browser.close();
  }
})();

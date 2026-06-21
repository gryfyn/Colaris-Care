/**
 * Phase 2: approve a pending admission via the admin UI, then verify the new
 * resident appears in /residents. Logs all /api traffic to surface DB errors.
 *
 * Usage: RESIDENT_NAME="Playwright Tester123207" node scripts/e2e-approve-prod.js
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
const log = (...a) => console.log(...a);

async function snap(page, name) {
  shot += 1;
  try { await page.screenshot({ path: path.join(SHOTS, `ap${String(shot).padStart(2, '0')}-${name}.png`), fullPage: true }); } catch {}
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
    if (/\/review|\/approve/.test(url) && status < 400 && body) log(`        review resp: ${body}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') log(`  [console.error] ${m.text().slice(0, 200)}`); });
}

async function fetchToken() {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await res.json();
  if (!j.accessToken) throw new Error('no token: ' + JSON.stringify(j));
  return j.accessToken;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  BEARER = await fetchToken();
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request();
    if (/\/api\/v1\/auth\//.test(req.url())) return route.continue();
    return route.continue({ headers: { ...req.headers(), authorization: `Bearer ${BEARER}` } });
  });
  const page = await context.newPage();
  attachNetwork(page);

  try {
    // Click a sidebar nav item by its visible text (client-side nav keeps the
    // in-memory access token alive — avoids the flaky prod /auth/refresh).
    async function clickSidebar(label) {
      const ok = await page.evaluate((text) => {
        const els = Array.from(document.querySelectorAll('a, button, [role="button"], li, div, span'));
        const t = els.find((e) => (e.textContent || '').trim() === text && e.offsetParent !== null);
        if (t) { t.click(); return true; }
        // fallback: element whose own text (no deep children) matches
        const t2 = els.find((e) => (e.textContent || '').trim().startsWith(text) && e.offsetParent !== null);
        if (t2) { t2.click(); return true; }
        return false;
      }, label);
      return ok;
    }

    log(`=== LOGIN ===`);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForTimeout(3500);
    log(`  after login url=${page.url()}`);

    log(`\n=== PENDING ADMISSIONS (via sidebar) ===`);
    const navOk = await clickSidebar('Pending Admissions');
    log(`  clicked sidebar "Pending Admissions": ${navOk}`);
    await page.waitForTimeout(3000);
    await snap(page, 'pending-list');

    // Click the "Review" button in the row matching the resident name
    const clickedRow = await page.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const target = rows.find((r) => (r.textContent || '').includes(name));
      if (!target) return false;
      const btn = Array.from(target.querySelectorAll('button')).find((b) => /review/i.test(b.textContent || '')) || target.querySelector('button');
      if (btn) { btn.click(); return true; }
      target.click();
      return true;
    }, RESIDENT_NAME);
    log(`  clicked Review for "${RESIDENT_NAME}": ${clickedRow}`);
    if (!clickedRow) {
      const names = await page.evaluate(() => Array.from(document.querySelectorAll('tr')).map((r) => (r.textContent || '').trim().slice(0, 80)).filter(Boolean).slice(0, 20));
      log(`  available rows: ${JSON.stringify(names, null, 1)}`);
      throw new Error('pending row not found');
    }
    await page.waitForTimeout(2000);
    await snap(page, 'review-modal');

    // Click the Approve button in the modal (exact "Approve", not "Approved")
    const approveClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((x) => /^\s*approve\s*$/i.test(x.textContent || '') || /processing/i.test(x.textContent || ''));
      if (!b || b.disabled) return false;
      b.click();
      return true;
    });
    log(`  clicked Approve: ${approveClicked}`);
    await page.waitForTimeout(4000);
    await snap(page, 'after-approve');

    log(`\n=== VERIFY RESIDENTS (via sidebar) ===`);
    const resNav = await clickSidebar('Residents');
    log(`  clicked sidebar "Residents": ${resNav}`);
    await page.waitForTimeout(3500);
    await snap(page, 'residents-list');

    // Try typing into a search box if present, then check the page text
    const firstName = RESIDENT_NAME.split(/\s+/)[0];
    const found = await page.evaluate((name) => document.body.innerText.includes(name) || document.body.innerText.includes(name.split(/\s+/)[0]), RESIDENT_NAME);
    log(`  resident "${RESIDENT_NAME}" visible on /residents page: ${found}`);

    // Also confirm via the residents API (decrypted names)
    const apiCheck = await page.evaluate(async (base) => {
      const r = await fetch(`${base}/api/v1/admin/residents?limit=200`, { credentials: 'same-origin' });
      const j = await r.json();
      const list = j.data || j.residents || j || [];
      return (Array.isArray(list) ? list : []).map((x) => `${x.first_name || ''} ${x.last_name || ''}`.trim()).filter(Boolean).slice(0, 40);
    }, BASE);
    log(`  residents via API (${apiCheck.length}): ${JSON.stringify(apiCheck)}`);
    log(`  match in API: ${apiCheck.some((n) => n.includes(firstName))}`);

    log(`\n=== DONE ===`);
  } catch (e) {
    log('FATAL: ' + (e.stack || e.message));
    await snap(page, 'FATAL');
  } finally {
    const errors = apiLog.filter((e) => e.status >= 400 && !/\/auth\/refresh/.test(e.url));
    log(`\n===== API ERRORS (excl. auth/refresh) (${errors.length}) =====`);
    errors.forEach((e) => log(`  ${e.method} ${e.status} ${e.url}\n      ${e.body}`));
    fs.writeFileSync(path.join(SHOTS, 'approve-api-log.json'), JSON.stringify(apiLog, null, 2));
    await browser.close();
  }
})();

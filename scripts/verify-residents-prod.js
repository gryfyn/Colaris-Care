const { chromium } = require('playwright');
const path = require('path');
const BASE = 'https://dcllc.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@dependablecare.org';
const PASSWORD = process.env.ADMIN_PASSWORD; // set ADMIN_PASSWORD in the env — never hardcode credentials
if (!PASSWORD) { console.error('Set ADMIN_PASSWORD env var.'); process.exit(1); }
const NAME = process.env.RESIDENT_NAME || 'Playwright Tester123207';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const tokRes = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const BEARER = (await tokRes.json()).accessToken;
  await ctx.route('**/api/v1/**', (r) => /\/auth\//.test(r.request().url()) ? r.continue() : r.continue({ headers: { ...r.request().headers(), authorization: `Bearer ${BEARER}` } }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL); await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForTimeout(4000);
  // click Residents sidebar
  await page.evaluate(() => { const e = Array.from(document.querySelectorAll('a,button,div,span,li')).find(x => (x.textContent || '').trim() === 'Residents' && x.offsetParent !== null); if (e) e.click(); });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(__dirname, '_e2e_shots', 'verify-residents.png'), fullPage: true });
  const visible = await page.evaluate((n) => document.body.innerText.includes(n) || document.body.innerText.includes(n.split(/\s+/)[0]), NAME);
  const total = await page.evaluate(() => { const m = document.body.innerText.match(/TOTAL\s+(\d+)/i); return m ? m[1] : '?'; });
  console.log(`Resident "${NAME}" visible on Residents page: ${visible}`);
  console.log(`TOTAL count shown: ${total}`);
  await browser.close();
})();

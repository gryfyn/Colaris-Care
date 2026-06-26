import { test as setup } from '@playwright/test';

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL || 'admin@maplegrove.example', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!' };
const STAFF = { email: process.env.E2E_STAFF_EMAIL || 'amara.koch@maplegrove.example', password: process.env.E2E_STAFF_PASSWORD || 'ChangeMeStaff123!' };

async function authenticate(page, creds, next, file) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL(new RegExp(next.replace(/\//g, '\\/')), { timeout: 20000 });
  // Dismiss the first-run onboarding dialog so the saved state skips it everywhere.
  const gs = page.getByRole('button', { name: /get started/i });
  try { await gs.waitFor({ state: 'visible', timeout: 4000 }); await gs.click(); } catch { /* not shown */ }
  await page.context().storageState({ path: file });
}

setup('authenticate as admin', async ({ page }) => {
  await authenticate(page, ADMIN, '/admin/dashboard', 'playwright/.auth/admin.json');
});

setup('authenticate as staff', async ({ page }) => {
  await authenticate(page, STAFF, '/staff/dashboard', 'playwright/.auth/staff.json');
});

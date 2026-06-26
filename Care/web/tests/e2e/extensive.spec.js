import { expect, test, request as apiRequest } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://colaris-care.vercel.app';
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL || 'admin@maplegrove.example', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!' };

const RUN = Date.now().toString().slice(-7);
const ADMIN_STATE = 'playwright/.auth/admin.json';
const STAFF_STATE = 'playwright/.auth/staff.json';

// Shared fixtures seeded via API in beforeAll.
const fixture = { residentId: null, residentName: `E2EFix${RUN}`, requestId: null, requestDetail: `E2E request ${RUN}`, staffId: null };

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${new URL(page.url()).pathname} :: pageerror: ${e.message.split(';')[0]}`));
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`5xx: ${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`); });
  return errors;
}

test.beforeAll(async () => {
  const ctx = await apiRequest.newContext({ baseURL: BASE });
  const lr = await ctx.post('/api/auth/login', { data: ADMIN });
  const token = (await lr.json()).accessToken;
  expect(token, 'admin api login').toBeTruthy();
  const auth = { Authorization: `Bearer ${token}` };

  const ar = await ctx.post('/api/v1/admissions', { headers: auth, data: {
    firstName: 'Fixture', lastName: fixture.residentName, email: `fix${RUN}@example.com`,
    dob: '1947-05-05', admissionDate: new Date().toISOString().slice(0, 10),
    roomAssignment: 'Room E1', facility: 'Maple Grove Care', observationLevel: 'Routine',
    emergencyName: 'Fixture Kin', emergencyRelationship: 'Daughter', emergencyPhone: '555-9000',
    conditions: ['Diabetes'], medications: [{ medication: 'Metformin', dose: '500mg' }],
  } });
  fixture.residentId = (await ar.json()).data?.resident?.id;

  const rr = await ctx.post('/api/v1/resident-requests', { headers: auth, data: {
    residentId: fixture.residentId, requestType: 'Maintenance', detail: fixture.requestDetail, priority: 'routine', status: 'new',
  } });
  fixture.requestId = (await rr.json()).data?.id;

  const sr = await ctx.get('/api/v1/staff', { headers: auth });
  fixture.staffId = (await sr.json()).data?.[0]?.id;

  await ctx.dispose();
  expect(fixture.residentId, 'fixture resident created').toBeTruthy();
});

// ----------------------------- ACCESS CONTROL (signed out) -----------------------------
test.describe('access control (signed out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('signed-out admin route redirects to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('signed-out staff route redirects to login', async ({ page }) => {
    await page.goto('/staff/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ----------------------------- ADMIN PORTAL -----------------------------
test.describe('admin portal', () => {
  test.use({ storageState: ADMIN_STATE });

  const ADMIN_PAGES = [
    '/admin/dashboard', '/admin/residents', '/admin/staff', '/admin/care-plans',
    '/admin/medications', '/admin/progress-notes', '/admin/incidents', '/admin/drug-disposal',
    '/admin/evacuation-drills', '/admin/reports', '/admin/compliance', '/admin/face-sheets',
    '/admin/appointments', '/admin/announcements', '/admin/notifications', '/admin/calendar',
    '/admin/settings', '/admin/admission',
  ];

  test('every admin page loads without server/page errors', async ({ page }) => {
    const errors = trackErrors(page);
    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('admission form submits and creates a resident', async ({ page }) => {
    await page.goto('/admin/admission');
    await page.getByLabel('First Name').fill('Eve');
    await page.getByLabel('Last Name').fill(`E2EAdm${RUN}`);
    await page.getByLabel('Email').first().fill(`eve${RUN}@example.com`);
    await page.getByLabel('Date of Birth').fill('1946-06-06');
    await page.getByLabel('Gender').selectOption('Female');
    await page.getByLabel('Full Name').fill('Eve Kin');
    await page.getByLabel('Phone Number').last().fill('555-7000');
    await page.getByLabel('Admission Date').fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel('Facility').fill('Maple Grove Care');
    await page.getByLabel('Room Assignment').fill('Room E9');
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await expect(page.getByText('Admission submitted')).toBeVisible({ timeout: 15000 });
  });

  test('resident detail shows emergency contact + admission download', async ({ page }) => {
    await page.goto(`/admin/residents/${fixture.residentId}`);
    await expect(page.getByRole('heading', { name: 'Emergency contact' })).toBeVisible();
    await expect(page.getByText('Fixture Kin').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /download admission form/i }).first()).toBeVisible();
  });

  test('care plan creation flow end-to-end', async ({ page }) => {
    await page.goto('/admin/care-plans');
    await page.getByRole('button', { name: /add care plan/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /select a resident/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').fill(fixture.residentName);
    await dialog.getByRole('button', { name: new RegExp(fixture.residentName) }).first().click();
    await expect(page).toHaveURL(/\/admin\/care-plans\/new/);
    await page.getByLabel('Plan focus / title').fill(`E2E Plan ${RUN}`);
    await page.getByRole('button', { name: /create care plan/i }).click();
    await expect(page).toHaveURL(/\/admin\/care-plans\/[0-9a-f-]{36}/, { timeout: 15000 });
    await expect(page.getByRole('button', { name: /download care plan/i })).toBeVisible();
  });

  test('staff member detail loads from the database', async ({ page }) => {
    test.skip(!fixture.staffId, 'no staff profile available');
    await page.goto(`/admin/staff/${fixture.staffId}`);
    await expect(page.getByRole('heading', { name: 'Work overview' })).toBeVisible();
  });
});

// ----------------------------- STAFF PORTAL -----------------------------
test.describe('staff portal', () => {
  test.use({ storageState: STAFF_STATE });

  const STAFF_PAGES = [
    '/staff/dashboard', '/staff/residents', '/staff/care-plan', '/staff/appointments',
    '/staff/progress-notes', '/staff/medications', '/staff/face-sheet', '/staff/incidents',
    '/staff/drug-disposal', '/staff/evacuation', '/staff/announcements', '/staff/notifications',
    '/staff/resident-requests', '/staff/calendar', '/staff/profile', '/staff/settings',
  ];

  test('every staff page loads without server/page errors', async ({ page }) => {
    const errors = trackErrors(page);
    for (const path of STAFF_PAGES) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('staff cannot enter admin workspace', async ({ page }) => {
    await page.goto('/admin/compliance');
    await expect(page).toHaveURL(/\/login/);
  });

  test('staff can advance a resident request (RBAC)', async ({ page }) => {
    await page.goto('/staff/resident-requests');
    await page.getByRole('textbox', { name: /search resident requests/i }).fill(fixture.requestDetail);
    const startBtn = page.getByRole('button', { name: /^Start$/ });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.getByRole('button', { name: /^Complete$/ })).toBeVisible({ timeout: 10000 });
  });

  test('staff resident detail loads real data', async ({ page }) => {
    await page.goto(`/staff/residents/${fixture.residentId}`);
    await expect(page.getByRole('heading', { name: 'Key contacts' })).toBeVisible();
  });
});

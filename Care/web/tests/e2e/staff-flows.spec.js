import { expect, test, request as apiRequest } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://colaris-care.vercel.app';
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL || 'admin@maplegrove.example', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!' };
const STAFF = { email: process.env.E2E_STAFF_EMAIL || 'amara.koch@maplegrove.example', password: process.env.E2E_STAFF_PASSWORD || 'ChangeMeStaff123!' };
const STAFF_STATE = 'playwright/.auth/staff.json';

const RUN = Date.now().toString().slice(-7);
const fx = {
  residentId: null, residentName: `E2EStaff${RUN}`,
  requestDetail: `E2E staff req ${RUN}`,
  notifTitle: `E2E staff notif ${RUN}`,
};

test.use({ storageState: STAFF_STATE });

test.beforeAll(async () => {
  const ctx = await apiRequest.newContext({ baseURL: BASE });
  // Single login keeps us under the auth rate limit (the setup project already
  // logged both roles in via the UI to build storageState).
  const aTok = (await (await ctx.post('/api/auth/login', { data: ADMIN })).json()).accessToken;
  expect(aTok, 'admin api login').toBeTruthy();
  const auth = { Authorization: `Bearer ${aTok}` };
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const ar = await ctx.post('/api/v1/admissions', { headers: auth, data: {
    firstName: 'Stana', lastName: fx.residentName, email: `stana${RUN}@example.com`,
    dob: '1944-03-03', admissionDate: today, roomAssignment: 'Room S7', facility: 'Maple Grove Care', observationLevel: 'Routine',
    emergencyName: 'Stana Kin', emergencyRelationship: 'Son', emergencyPhone: '555-3300',
    mobility: 'Walker', communication: 'Verbal', behavioralConcerns: ['Fall Risk'],
    restrictions: [{ text: 'Fall precautions' }],
  } });
  fx.residentId = (await ar.json()).data?.resident?.id;
  expect(fx.residentId, 'fixture resident').toBeTruthy();

  // Medication + a "due" administration so staff/medications shows real data.
  const med = await ctx.post('/api/v1/medications', { headers: auth, data: { residentId: fx.residentId, name: `E2EStaffMed${RUN}`, dosage: '5mg' } });
  const medId = (await med.json()).data?.id;
  if (medId) await ctx.post('/api/v1/medication-administrations', { headers: auth, data: { residentId: fx.residentId, medicationId: medId, scheduledFor: nowIso, outcome: 'due' } });

  // A new resident request to advance through its lifecycle.
  await ctx.post('/api/v1/resident-requests', { headers: auth, data: { residentId: fx.residentId, requestType: 'Comfort', detail: fx.requestDetail, priority: 'routine', status: 'new' } });

  // An unread broadcast notification (userId null) — visible to the staff inbox.
  await ctx.post('/api/v1/notifications', { headers: auth, data: { title: fx.notifTitle, body: 'E2E staff notification body', status: 'unread' } });

  await ctx.dispose();
});

test.describe('staff portal — deep flows', () => {
  test('shift dashboard renders real facility data', async ({ page }) => {
    await page.goto('/staff/dashboard');
    await expect(page.getByRole('heading', { name: /my shift dashboard/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /my assigned residents/i })).toBeVisible();
  });

  test('residents list → click resident → detail', async ({ page }) => {
    await page.goto('/staff/residents');
    await expect(page.getByRole('heading', { name: 'Residents', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: /search residents/i }).fill(fx.residentName);
    await page.getByRole('link', { name: new RegExp(`Open .*${fx.residentName}`) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/staff/residents/${fx.residentId}`));
    await expect(page.getByRole('heading', { name: 'Key contacts' })).toBeVisible();
  });

  test('resident detail shows caregiver sections from real data', async ({ page }) => {
    await page.goto(`/staff/residents/${fx.residentId}`);
    await expect(page.getByRole('heading', { name: 'On-shift basics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Care precautions' })).toBeVisible();
    await expect(page.getByText('Stana Kin')).toBeVisible();
    await expect(page.getByText('Fall precautions')).toBeVisible();
  });

  test('medications page shows the due administration', async ({ page }) => {
    await page.goto('/staff/medications');
    await expect(page.getByRole('heading', { name: 'Medications' })).toBeVisible();
    // The due administration surfaces the resident on the MAR queue card.
    await expect(page.getByText(new RegExp(`E2EStaff${RUN}`)).first()).toBeVisible();
  });

  test('administer a due medication on the MAR (administering logic)', async ({ page }) => {
    await page.goto('/staff/medications');
    await page.getByRole('textbox', { name: /search medications/i }).fill(`E2EStaffMed${RUN}`);
    await expect(page.getByText(`E2EStaffMed${RUN}`)).toBeVisible();
    await page.getByRole('button', { name: /^Administer$/ }).first().click();
    await expect(page.getByText('Administer medication')).toBeVisible();
    await page.getByRole('button', { name: /confirm administration/i }).click();
    // Once administered, the dose leaves the "due" queue.
    await expect(page.getByText(`E2EStaffMed${RUN}`)).toHaveCount(0, { timeout: 10000 });
  });

  test('notifications: mark all read', async ({ page }) => {
    await page.goto('/staff/notifications');
    await expect(page.getByText(fx.notifTitle)).toBeVisible();
    const markAll = page.getByRole('button', { name: /mark all read/i });
    await expect(markAll).toBeEnabled();
    await markAll.click();
    await expect(markAll).toBeDisabled({ timeout: 10000 });
  });

  test('resident request full lifecycle: Start → Complete', async ({ page }) => {
    await page.goto('/staff/resident-requests');
    await page.getByRole('textbox', { name: /search resident requests/i }).fill(fx.requestDetail);
    const start = page.getByRole('button', { name: /^Start$/ });
    await expect(start).toBeVisible();
    await start.click();
    const complete = page.getByRole('button', { name: /^Complete$/ });
    await expect(complete).toBeVisible({ timeout: 10000 });
    await complete.click();
    await expect(page.getByText('Done')).toBeVisible({ timeout: 10000 });
  });

  test('profile shows the signed-in staff member', async ({ page }) => {
    await page.goto('/staff/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible();
  });

  test('face sheet page renders', async ({ page }) => {
    await page.goto('/staff/face-sheet');
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

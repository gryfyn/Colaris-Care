import { test, expect } from '@playwright/test';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/dcllc_db',
});

const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@dependablecare.org';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'Admin@DC2026!';
const staffEmail = process.env.E2E_STAFF_EMAIL || 'jessica@dcllc.com';
const staffPassword = process.env.E2E_STAFF_PASSWORD || 'TempPassword123!';

test.describe('Resident data capture, credentials, and display payloads', () => {
  let createdResidentId;
  let createdAccountId;
  let faceSheetId;
  let accessToken;
  let residentCredentials;

  test.afterAll(async () => {
    await pool.end();
  });

  test('admin creates resident account, notifications display credentials, resident changes password, and core records are retrievable', async ({ page, request }) => {
    const browserLogin = await page.request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(browserLogin.status()).toBe(200);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/, { timeout: 30000 });

    const login = await request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(login.status()).toBe(200);
    const loginBody = await login.json();
    accessToken = loginBody.accessToken;
    expect(accessToken).toBeTruthy();

    const unique = Date.now();
    const residentPayload = {
      first_name: 'Avery',
      last_name: `Morgan ${unique}`,
      preferred_name: 'Avery',
      date_of_birth: '1988-04-12',
      gender: 'Female',
      preferred_pronouns: 'She/Her',
      medicaid_id: `MED-${unique}`,
      phone: '(503) 555-0198',
      email: `avery.morgan.${unique}@example.test`,
      address: '742 Evergreen Terrace',
      city: 'Portland',
      state: 'Oregon',
      zip: '97205',
      admission_date: '2026-06-05',
      primary_diagnosis: 'Major depressive disorder, recurrent',
      legal_status: 'Voluntary',
      createUserAccount: true,
    };

    const createResident = await request.post('/api/v1/residents/create', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: residentPayload,
    });
    expect(createResident.status()).toBe(201);
    const created = await createResident.json();
    createdResidentId = created.resident.id;
    createdAccountId = created.user_account.id;
    residentCredentials = created.credentials;
    expect(residentCredentials.username).toBeTruthy();
    expect(residentCredentials.password).toBeTruthy();

    const accountRows = await pool.query(
      `SELECT email, username, role, password_changed_required
         FROM care.user_accounts
        WHERE id = $1`,
      [createdAccountId]
    );
    const residentAccount = accountRows.rows[0];
    expect(accountRows.rows[0]).toMatchObject({
      role: 'resident_care_of',
      password_changed_required: true,
    });

    const adminNotifications = await request.get('/api/v1/notifications?page=1&pageSize=20', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(adminNotifications.status()).toBe(200);
    const adminNotifBody = await adminNotifications.json();
    const credentialNotif = (adminNotifBody.data || []).find((item) =>
      item.relatedResidentId === createdResidentId && item.credentials?.password === residentCredentials.password
    );
    expect(credentialNotif).toBeTruthy();
    expect(credentialNotif.credentials.username).toBe(residentCredentials.username);

    const residentLogin = await request.post('/api/v1/auth/login', {
      data: { email: residentAccount.email, password: residentCredentials.password },
    });
    expect(residentLogin.status()).toBe(200);
    const residentLoginBody = await residentLogin.json();
    expect(residentLoginBody.user.passwordChangedRequired).toBe(true);
    const residentToken = residentLoginBody.accessToken;

    const residentNotifications = await request.get('/api/v1/notifications?page=1&pageSize=10', {
      headers: { Authorization: `Bearer ${residentToken}` },
    });
    expect(residentNotifications.status()).toBe(200);
    const residentNotifBody = await residentNotifications.json();
    const residentNotif = (residentNotifBody.data || []).find((item) => item.relatedResidentId === createdResidentId);
    expect(residentNotif).toBeTruthy();
    expect(residentNotif.credentials?.password).toBeUndefined();
    expect(residentNotif.message).toContain('Temporary account issued');

    const newResidentPassword = `ResidentChanged${unique}!`;
    const changePassword = await request.post('/api/v1/auth/change-password-required', {
      headers: { Authorization: `Bearer ${residentToken}` },
      data: {
        currentPassword: residentCredentials.password,
        newPassword: newResidentPassword,
        confirmPassword: newResidentPassword,
      },
    });
    expect(changePassword.status()).toBe(200);

    const changedAccount = await pool.query(
      `SELECT password_changed_required, password_changed_at
         FROM care.user_accounts
        WHERE id = $1`,
      [createdAccountId]
    );
    expect(changedAccount.rows[0].password_changed_required).toBe(false);
    expect(changedAccount.rows[0].password_changed_at).toBeTruthy();

    const residentBrowserLogin = await page.request.post('/api/v1/auth/login', {
      data: { email: residentAccount.email, password: newResidentPassword },
    });
    expect(residentBrowserLogin.status()).toBe(200);
    await page.goto('/residents');
    await expect(page).toHaveURL(/\/residents/, { timeout: 30000 });
    await expect(page.getByText(/Account access/i)).toBeVisible({ timeout: 30000 });
    const residentColors = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        adminInk: styles.getPropertyValue('--admin-ink').trim(),
        residentInk: styles.getPropertyValue('--resident-ink').trim(),
        adminAccent: styles.getPropertyValue('--admin-accent').trim(),
        residentAccent: styles.getPropertyValue('--resident-accent').trim(),
      };
    });
    expect(residentColors.residentInk).toBe(residentColors.adminInk);
    expect(residentColors.residentAccent).toBe(residentColors.adminAccent);

    const staffBrowserLogin = await page.request.post('/api/v1/auth/login', {
      data: { email: staffEmail, password: staffPassword },
    });
    expect(staffBrowserLogin.status()).toBe(200);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/staff/, { timeout: 30000 });
    const staffColors = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        adminInk: styles.getPropertyValue('--admin-ink').trim(),
        staffInk: styles.getPropertyValue('--staff-ink').trim(),
        adminAccent: styles.getPropertyValue('--admin-accent').trim(),
        staffAccent: styles.getPropertyValue('--staff-accent').trim(),
      };
    });
    expect(staffColors.staffInk).toBe(staffColors.adminInk);
    expect(staffColors.staffAccent).toBe(staffColors.adminAccent);

    const faceSheet = await request.post('/api/v1/face-sheets', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        resident_id: createdResidentId,
        form_data: {
          resident_name: `${residentPayload.first_name} ${residentPayload.last_name}`,
          preferred_name: residentPayload.preferred_name,
          dob: residentPayload.date_of_birth,
          address: residentPayload.address,
          phone: residentPayload.phone,
          emergency_contact_name: 'Jordan Morgan',
          emergency_contact_phone: '(503) 555-0135',
          ssn: '123-45-6789',
          medicaid_number: residentPayload.medicaid_id,
        },
      },
    });
    expect([201, 409]).toContain(faceSheet.status());
    if (faceSheet.status() === 201) {
      const faceSheetBody = await faceSheet.json();
      faceSheetId = faceSheetBody.data.id;
    } else {
      const existing = await request.get(`/api/v1/face-sheets?resident_id=${createdResidentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const existingBody = await existing.json();
      faceSheetId = existingBody.data[0].id;
    }

    const faceSheetList = await request.get(`/api/v1/face-sheets?resident_id=${createdResidentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(faceSheetList.status()).toBe(200);
    const faceSheetListBody = await faceSheetList.json();
    expect(faceSheetListBody.data[0].form_data.resident_name).toContain('Avery');

    const carePlan = await request.post('/api/v1/care-plans-wizard', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        resident_id: createdResidentId,
        step: 'overview',
        status: 'draft',
        data: {
          plan_type: 'initial',
          primary_diagnosis: residentPayload.primary_diagnosis,
          strengths: 'Motivated, cooperative, family support available',
          discharge_criteria: 'Stable mood and medication adherence',
        },
      },
    });
    expect(carePlan.status()).toBe(200);

    const carePlanList = await request.get(`/api/v1/care-plans?resident_id=${createdResidentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(carePlanList.status()).toBe(200);
    const carePlanBody = await carePlanList.json();
    expect(carePlanBody.data.length).toBeGreaterThan(0);

    const dbSummary = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM care.residents WHERE id = $1) AS residents,
         (SELECT COUNT(*)::int FROM care.resident_face_sheets WHERE id = $2) AS face_sheets,
         (SELECT COUNT(*)::int FROM care.care_plans WHERE resident_id = $1) AS care_plans,
         (SELECT COUNT(*)::int FROM care.notifications WHERE resident_id = $1 AND type = 'credentials') AS credential_notifications`,
      [createdResidentId, faceSheetId]
    );
    expect(dbSummary.rows[0]).toMatchObject({
      residents: 1,
      face_sheets: 1,
      care_plans: 1,
      credential_notifications: 2,
    });
  });
});

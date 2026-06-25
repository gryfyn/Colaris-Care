import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@maplegrove.example';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'amara.koch@maplegrove.example';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'ChangeMeStaff123!';

async function login(page, email, password, next = '') {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /continue/i }).click();
}

test.describe('production smoke', () => {
  test('redirects protected admin page to login when signed out', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin can sign in and view core admin pages', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, '/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    for (const path of [
      '/admin/residents',
      '/admin/staff',
      '/admin/care-plans',
      '/admin/medications',
      '/admin/compliance',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('staff can sign in and view staff workspace', async ({ page }) => {
    await login(page, STAFF_EMAIL, STAFF_PASSWORD, '/staff/dashboard');
    await expect(page).toHaveURL(/\/staff\/dashboard/);

    for (const path of [
      '/staff/residents',
      '/staff/medications',
      '/staff/notifications',
      '/staff/announcements',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('staff cannot enter admin workspace', async ({ page }) => {
    await login(page, STAFF_EMAIL, STAFF_PASSWORD, '/staff/dashboard');
    await page.goto('/admin/compliance');
    await expect(page).toHaveURL(/\/login/);
  });
});

import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };
const PUBLIC_ROUTES = [
  '/', '/about', '/care', '/contact', '/platform', '/pricing', '/privacy',
  '/request-demo', '/solutions', '/suite', '/terms', '/vision', '/websites',
  '/who-its-for', '/login', '/signup', '/verify', '/onboarding',
];
const ADMIN_ROUTES = [
  '/admin/dashboard', '/admin/admission', '/admin/announcements', '/admin/appointments',
  '/admin/calendar', '/admin/care-plans', '/admin/compliance', '/admin/daily-records',
  '/admin/drug-disposal', '/admin/evacuation-drills', '/admin/face-sheets', '/admin/incidents',
  '/admin/medications', '/admin/notifications', '/admin/progress-notes', '/admin/reports',
  '/admin/residents', '/admin/settings', '/admin/staff', '/admin/staff/new',
];
const STAFF_ROUTES = [
  '/staff/announcements', '/staff/appointments', '/staff/calendar', '/staff/care-plan',
  '/staff/dashboard', '/staff/drug-disposal', '/staff/evacuation', '/staff/face-sheet',
  '/staff/incidents', '/staff/medications', '/staff/notifications', '/staff/profile',
  '/staff/progress-notes', '/staff/resident-requests', '/staff/residents', '/staff/settings',
];

async function expectNoViewportOverflow(page, route) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body?.scrollWidth || 0,
  }));
  expect(dimensions.document, `${route} document overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `${route} body overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('mobile responsive routes', () => {
  test.describe.configure({ timeout: 180000 });
  test.use({ viewport: PHONE });

  test('every public and authentication route fits the viewport', async ({ page }) => {
    for (const route of PUBLIC_ROUTES) await expectNoViewportOverflow(page, route);
  });

  test('public mobile navigation remains available and usable', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByLabel('Open navigation');
    await expect(toggle).toBeVisible();
    await toggle.click();
    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Client sign in' })).toBeVisible();
  });

  test('protected route loading states remain constrained on mobile', async ({ page }) => {
    await expectNoViewportOverflow(page, '/admin/dashboard');
    await expectNoViewportOverflow(page, '/staff/dashboard');
  });
});

test.describe('authenticated admin mobile routes', () => {
  test.describe.configure({ timeout: 240000 });
  test.skip(!existsSync('playwright/.auth/admin.json'), 'Admin session state is not available');
  test.use({ viewport: PHONE, storageState: 'playwright/.auth/admin.json' });

  test('all static admin routes fit the viewport', async ({ page }) => {
    for (const route of ADMIN_ROUTES) await expectNoViewportOverflow(page, route);
  });
});

test.describe('authenticated staff mobile routes', () => {
  test.describe.configure({ timeout: 240000 });
  test.skip(!existsSync('playwright/.auth/staff.json'), 'Staff session state is not available');
  test.use({ viewport: PHONE, storageState: 'playwright/.auth/staff.json' });

  test('all static staff routes fit the viewport', async ({ page }) => {
    for (const route of STAFF_ROUTES) await expectNoViewportOverflow(page, route);
  });
});

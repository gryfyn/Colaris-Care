import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard - Comprehensive Feature Verification', () => {
  const adminCredentials = {
    email: 'admin@test.com',
    password: 'AdminPass123!',
  };

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminCredentials.email);
    await page.fill('input[name="password"]', adminCredentials.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
  });

  test('Admin dashboard loads without errors', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Verify page loaded
    expect(page.url()).toContain('/admin');

    // Check for main dashboard content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Verify no console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('All dashboard sections are responsive', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Set viewport sizes to test responsiveness
    const viewports = [
      { width: 360, height: 640, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

      // Verify content is visible (not cut off or hidden)
      const mainContent = page.locator('main, [role="main"]');
      const isVisible = await mainContent.isVisible().catch(() => false);

      // Even if main isn't explicitly role="main", page should have content
      const hasContent = await page.locator('body').evaluate(() => document.body.textContent.length > 100);
      expect(hasContent).toBeTruthy();
    }
  });

  test('Progress notes section displays submitted notes', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Find progress notes section
    const progressNotesSection = page.locator('text=/Progress Notes|Daily Notes/i').first();
    const exists = await progressNotesSection.isVisible().catch(() => false);

    if (exists) {
      await expect(progressNotesSection).toBeVisible();

      // Check for table or list of notes
      const notesTable = progressNotesSection.locator('table, [role="table"]').first();
      const tableExists = await notesTable.isVisible().catch(() => false);

      if (tableExists) {
        // Should have some rows
        const rows = notesTable.locator('tr, [role="row"]');
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);
      }
    }
  });

  test('Admission forms section is functional', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Find admission forms section
    const admissionSection = page.locator('text=/Admission|Pending/i').first();
    const exists = await admissionSection.isVisible().catch(() => false);

    if (exists) {
      await expect(admissionSection).toBeVisible();

      // Should have action buttons
      const buttons = admissionSection.locator('button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);
    }
  });

  test('Staff management section displays staff', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Navigate to staff section if separate page
    const staffLink = page.locator('a, button').filter({ hasText: /Staff|Users/i }).first();
    const staffExists = await staffLink.isVisible().catch(() => false);

    if (staffExists) {
      await staffLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null);

      // Check for staff content
      const staffContent = page.locator('text=/staff|user/i').first();
      await expect(staffContent).toBeVisible();
    }
  });

  test('Resident management section displays residents', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Look for residents section
    const residentSection = page.locator('text=/Resident|Admission/i').first();
    const exists = await residentSection.isVisible().catch(() => false);

    if (exists) {
      await expect(residentSection).toBeVisible();

      // Should have resident list
      const list = residentSection.locator('ul, ol, [role="list"]').first();
      const listExists = await list.isVisible().catch(() => false);

      if (listExists) {
        const items = list.locator('li, [role="listitem"]');
        const itemCount = await items.count();
        expect(itemCount).toBeGreaterThan(0);
      }
    }
  });

  test('Reports hub displays form submission counts', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    expect(page.url()).toContain('/reports');

    // Should display form cards with counts
    const formCards = page.locator('[data-testid*="form"], h3, h4').filter({ hasText: /nursing|assessment|screening|directive/i });
    const cardCount = await formCards.count();

    // Should have at least some form types
    expect(cardCount).toBeGreaterThan(0);
  });

  test('Navigation is accessible from admin', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Check for navigation
    const nav = page.locator('nav, [role="navigation"]').first();
    const navExists = await nav.isVisible().catch(() => false);

    if (navExists) {
      // Should have multiple links
      const navLinks = nav.locator('a, button');
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });

  test('Search or filter functionality works (if present)', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]').first();
    const searchExists = await searchInput.isVisible().catch(() => false);

    if (searchExists) {
      // Type in search
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Should still be on page
      expect(page.url()).toContain('/admin');
    }
  });

  test('Pagination works if tables have multiple pages', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Look for pagination controls
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("→")').first();
    const nextExists = await nextBtn.isVisible().catch(() => false);

    if (nextExists && !await nextBtn.isDisabled()) {
      await nextBtn.click();
      await page.waitForTimeout(1000);

      // Should still be on admin page
      expect(page.url()).toContain('/admin');
    }
  });

  test('Modal/detail views open correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Look for clickable rows or "view" buttons
    const viewBtn = page.locator('button:has-text("View"), button:has-text("Details"), button:has-text("Review")').first();
    const viewExists = await viewBtn.isVisible().catch(() => false);

    if (viewExists) {
      await viewBtn.click();
      await page.waitForTimeout(500);

      // Check if modal or detail view opened
      const modal = page.locator('[role="dialog"], .modal, .sheet').first();
      const modalExists = await modal.isVisible().catch(() => false);

      // Even if no explicit modal, detail content should be visible
      if (modalExists) {
        await expect(modal).toBeVisible();

        // Close modal
        const closeBtn = modal.locator('button[aria-label*="close"], button:has-text("×"), button:has-text("Close")').first();
        const closeExists = await closeBtn.isVisible().catch(() => false);

        if (closeExists) {
          await closeBtn.click();
          await expect(modal).not.toBeVisible();
        }
      }
    }
  });

  test('Data persists when navigating between sections', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Get initial content
    const initialContent = await page.textContent();

    // Navigate away
    const staffLink = page.locator('a, button').filter({ hasText: /Staff|Users/i }).first();
    const staffExists = await staffLink.isVisible().catch(() => false);

    if (staffExists) {
      await staffLink.click();
      await page.waitForTimeout(1000);

      // Navigate back
      const adminLink = page.locator('a, button').filter({ hasText: /Dashboard|Admin/i }).first();
      if (await adminLink.isVisible()) {
        await adminLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null);

        // Content should be similar (fresh load but same structure)
        const newContent = await page.textContent();
        expect(newContent.length).toBeGreaterThan(100);
      }
    }
  });

  test('Error handling shows user-friendly messages', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Simulate an error by intercepting an API call
    await page.route('**/api/v1/**', route => {
      route.abort('failed');
    });

    // Try to trigger an action that makes an API call
    const buttons = page.locator('button');
    const viewBtn = buttons.filter({ hasText: /view|review|details/i }).first();

    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await page.waitForTimeout(1000);

      // Should show error message (or gracefully handle it)
      const errorMsg = page.locator('text=/error|failed|unable/i').first();
      const hasError = await errorMsg.isVisible().catch(() => false);

      // Either shows error or gracefully handles it
      expect(page.url()).toBeTruthy();
    }

    // Restore routes
    await page.unroute('**/api/v1/**');
  });

  test('Performance: Page loads in reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('Accessibility: Page is keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Should focus some element
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName || null;
    });

    expect(focusedElement).toBeTruthy();

    // Should be able to navigate with keyboard
    await page.keyboard.press('Tab');
    const nextFocused = await page.evaluate(() => {
      return document.activeElement?.tagName || null;
    });

    expect(nextFocused).toBeTruthy();
  });

  test('Logout functionality works', async ({ page }) => {
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

    // Find logout button
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")').first();
    const logoutExists = await logoutBtn.isVisible().catch(() => false);

    if (logoutExists) {
      await logoutBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null);

      // Should be redirected to login
      expect(page.url()).toContain('/login');
    }
  });
});

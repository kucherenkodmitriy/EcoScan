import { test, expect } from '../../fixtures/base';
import { LandingPage } from '../../pages/landing.page';

test.describe('Demo Request Modal', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
  });

  test('opens on button click', async () => {
    await landing.demoButton.click();
    await expect(landing.demoModal).toBeVisible();
  });

  test('closes on X button', async ({ page }) => {
    await landing.demoButton.click();
    await expect(landing.demoModal).toBeVisible();
    const closeButton = page.locator('.modal-close');
    await closeButton.click();
    await expect(landing.demoModal).not.toBeVisible();
  });

  test('closes on backdrop click', async ({ page }) => {
    await landing.demoButton.click();
    await expect(landing.demoModal).toBeVisible();
    // Click on the backdrop directly (outside modal-content)
    await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(landing.demoModal).not.toBeVisible();
  });

  test('shows validation on empty submit', async ({ page }) => {
    await landing.demoButton.click();
    const modalSubmit = page.locator('.modal-backdrop button[type=submit]');
    await modalSubmit.click();
    // Should not close the modal
    await expect(landing.demoModal).toBeVisible();
  });

  test('successfully submits demo request', async ({ page }) => {
    // Mock the contact API
    await page.route('**/api/contact', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await landing.demoButton.click();
    await page.locator('input#companyName').fill('Test Corp');
    await page.locator('.modal-backdrop input#email').fill('demo@example.com');
    await page.locator('.modal-backdrop button[type=submit]').click();

    // Should show success message
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });
});

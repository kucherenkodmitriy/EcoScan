import { test, expect } from '../../fixtures/base';
import { LandingPage } from '../../pages/landing.page';

test.describe('Contact Form', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
    await landing.contactForm.scrollIntoViewIfNeeded();
  });

  test('displays all form fields', async () => {
    await expect(landing.nameInput).toBeVisible();
    await expect(landing.emailInput).toBeVisible();
    await expect(landing.messageTextarea).toBeVisible();
    await expect(landing.contactSubmitButton).toBeVisible();
  });

  test('successfully submits contact form', async ({ page }) => {
    // Mock the contact API endpoint
    await page.route('**/api/contact', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await landing.nameInput.fill('Test User');
    await landing.emailInput.fill('test@example.com');
    await landing.messageTextarea.fill('This is a test message');
    await landing.contactSubmitButton.click();

    await expect(landing.contactSuccessMessage).toBeVisible({ timeout: 10000 });
  });

  test('shows required field validation', async ({ page }) => {
    await landing.contactSubmitButton.click();
    // HTML5 required validation should prevent submit
    await expect(page).toHaveURL('/');
  });

  test('shows reCAPTCHA notice', async () => {
    await expect(landing.recaptchaNotice).toBeVisible();
  });
});

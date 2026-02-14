import { test, expect } from '../../fixtures/base';
import { ForgotPasswordPage } from '../../pages/forgot-password.page';

test.describe('Forgot Password', () => {
  let forgotPage: ForgotPasswordPage;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    forgotPage = new ForgotPasswordPage(page);
    await forgotPage.goto();
  });

  test('displays forgot password form', async () => {
    await expect(forgotPage.emailInput).toBeVisible();
    await expect(forgotPage.submitButton).toBeVisible();
  });

  test('shows validation on empty email submit', async ({ page }) => {
    await forgotPage.submitButton.click();
    // Should stay on the same page (HTML5 validation prevents submit)
    await expect(page).toHaveURL('/forgot-password');
  });

  test('shows success message on submit', async () => {
    await forgotPage.submitEmail('admin@ecoscan.local');
    await expect(forgotPage.successMessage).toBeVisible();
  });

  test('shows success even for non-existent email (anti-enumeration)', async () => {
    await forgotPage.submitEmail('nonexistent@example.com');
    await expect(forgotPage.successMessage).toBeVisible();
  });

  test('has back to login link', async () => {
    await expect(forgotPage.backToLoginLink).toBeVisible();
  });
});

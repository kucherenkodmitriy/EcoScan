import { test, expect } from '../../fixtures/base';
import { ResetPasswordPage } from '../../pages/reset-password.page';

// Valid 64-hex-char token format for URL validation (not a real token)
const VALID_TEST_TOKEN = 'a'.repeat(64);

test.describe('Reset Password', () => {
  let resetPage: ResetPasswordPage;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    resetPage = new ResetPasswordPage(page);
  });

  test('shows error when accessed without params', async () => {
    await resetPage.gotoWithoutParams();
    await expect(resetPage.invalidLinkMessage).toBeVisible();
  });

  test('shows error when email param is missing', async ({ page }) => {
    await page.goto('/reset-password?token=some-token');
    await expect(resetPage.invalidLinkMessage).toBeVisible();
  });

  test('displays form with valid params', async () => {
    await resetPage.goto(VALID_TEST_TOKEN, 'admin@ecoscan.local');
    await expect(resetPage.newPasswordInput).toBeVisible();
    await expect(resetPage.confirmPasswordInput).toBeVisible();
    await expect(resetPage.submitButton).toBeVisible();
  });

  test('shows error for short password', async () => {
    await resetPage.goto(VALID_TEST_TOKEN, 'admin@ecoscan.local');
    await resetPage.resetPassword('short', 'short');
    await expect(resetPage.errorMessage).toBeVisible();
  });

  test('shows error for password mismatch', async () => {
    await resetPage.goto(VALID_TEST_TOKEN, 'admin@ecoscan.local');
    await resetPage.resetPassword('validpassword123', 'differentpassword');
    await expect(resetPage.errorMessage).toBeVisible();
  });

  test('has back to login link in invalid state', async () => {
    await resetPage.gotoWithoutParams();
    await expect(resetPage.backToLoginLink).toBeVisible();
  });
});

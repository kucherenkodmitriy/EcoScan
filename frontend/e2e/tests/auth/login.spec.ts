import { test, expect } from '../../fixtures/base';
import { LoginPage } from '../../pages/login.page';
import { TEST_CREDENTIALS } from '../../fixtures/test-data';

test.describe('Login Page', () => {
  let loginPage: LoginPage;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('displays login form with email and password fields', async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('shows validation on empty submit', async ({ page }) => {
    await loginPage.submitButton.click();
    // HTML5 validation prevents submit — should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('shows error for invalid credentials', async () => {
    await loginPage.login('wrong@email.com', 'wrongpassword');
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('logs in successfully with valid credentials', async ({ page }) => {
    await loginPage.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password);
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows loading state during login', async () => {
    await loginPage.emailInput.fill(TEST_CREDENTIALS.email);
    await loginPage.passwordInput.fill(TEST_CREDENTIALS.password);
    await loginPage.submitButton.click();
    // Button should show loading text
    await expect(loginPage.submitButton).toContainText(/signing in|loading/i);
  });

  test('redirects to dashboard if already authenticated', async ({ page }) => {
    await loginPage.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password);
    await page.waitForURL('/dashboard');
    await page.goto('/login');
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('has forgot password link', async () => {
    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  test('has language switcher', async ({ page }) => {
    // LanguageSwitcher uses CSS modules; find by its trigger button role
    const langTrigger = page.locator('[class*="container"] [class*="trigger"]');
    await expect(langTrigger.first()).toBeVisible();
  });
});

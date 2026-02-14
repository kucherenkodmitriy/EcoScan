import { type Page, type Locator } from '@playwright/test';

export class ResetPasswordPage {
  readonly page: Page;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly invalidLinkMessage: Locator;
  readonly successMessage: Locator;
  readonly backToLoginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPasswordInput = page.locator('input#newPassword');
    this.confirmPasswordInput = page.locator('input#confirmPassword');
    this.submitButton = page.locator('button[type=submit]');
    this.errorMessage = page.locator('.error-message');
    // Invalid link state uses inline red-colored <p>
    this.invalidLinkMessage = page.getByText(/invalid or has expired/i);
    this.successMessage = page.getByText(/password has been reset successfully/i);
    this.backToLoginLink = page.getByRole('link', { name: /back to login|sign in/i });
  }

  async goto(token: string, email: string) {
    await this.page.goto(`/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
  }

  async gotoWithoutParams() {
    await this.page.goto('/reset-password');
  }

  async resetPassword(newPassword: string, confirmPassword: string) {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }
}

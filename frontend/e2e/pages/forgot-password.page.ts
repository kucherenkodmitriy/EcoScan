import { type Page, type Locator } from '@playwright/test';

export class ForgotPasswordPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly backToLoginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input#email');
    this.submitButton = page.locator('button[type=submit]');
    this.backToLoginLink = page.getByRole('link', { name: /back to login|login/i });
  }

  async goto() {
    await this.page.goto('/forgot-password');
  }

  async submitEmail(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  /** Success message is a <p> with inline green style, not a CSS class */
  get successMessage() {
    return this.page.getByText(/password reset link has been sent/i);
  }
}

import { type Page, type Locator } from '@playwright/test';

export class ReportPage {
  readonly page: Page;
  readonly binName: Locator;
  readonly binType: Locator;
  readonly slider: Locator;
  readonly statusText: Locator;
  readonly statusPercent: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorTitle: Locator;
  readonly errorText: Locator;
  readonly thankYouHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.binName = page.locator('h2, h3').first();
    this.binType = page.locator('[class*="badge"]').first();
    this.slider = page.locator('input[type=range]');
    this.statusText = page.locator('[class*="statusText"]');
    this.statusPercent = page.locator('[class*="statusPercent"]');
    this.submitButton = page.locator('[class*="submitBtn"]');
    this.successMessage = page.locator('[class*="successTitle"]');
    this.errorTitle = page.locator('[class*="errorTitle"]');
    this.errorText = page.locator('[class*="errorText"]');
    this.thankYouHeading = page.getByText(/thank you/i);
  }

  async goto(binId: string) {
    await this.page.goto(`/report?bin=${binId}`);
  }

  async gotoWithoutBin() {
    await this.page.goto('/report');
  }

  async setSliderValue(value: number) {
    await this.slider.fill(String(value));
  }

  async submit() {
    await this.submitButton.click();
  }
}

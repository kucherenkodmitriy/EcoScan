import { type Page, type Locator } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly apiKeysNav: Locator;
  readonly webhooksNav: Locator;
  readonly exportNav: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.apiKeysNav = page.getByRole('link', { name: /api keys/i });
    this.webhooksNav = page.getByRole('link', { name: /webhooks/i });
    this.exportNav = page.getByRole('link', { name: /data export|export/i });
    this.heading = page.locator('h1, h2').first();
  }

  async goto() {
    await this.page.goto('/settings/api-keys');
  }

  // API Keys tab
  get apiKeyTable() { return this.page.locator('table'); }
  get apiKeyRows() { return this.page.locator('table tbody tr'); }
  get createApiKeyLink() { return this.page.getByRole('link', { name: /create.*api.*key|new.*api.*key/i }); }

  // Webhooks tab
  get webhookTable() { return this.page.locator('table'); }
  get webhookRows() { return this.page.locator('table tbody tr'); }
  get createWebhookLink() { return this.page.getByRole('link', { name: /create.*webhook|new.*webhook/i }); }

  // Export tab
  get downloadCsvButton() { return this.page.getByRole('button', { name: /download csv|export/i }); }
  get exportSuccessMessage() { return this.page.locator('[class*="success"]'); }
}

import { type Page, type Locator } from '@playwright/test';

export class ApiKeyDetailPage {
  readonly page: Page;
  readonly name: Locator;
  readonly statusBadge: Locator;
  readonly keyPrefix: Locator;
  readonly scopes: Locator;
  readonly keyId: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.name = page.locator('h1, h2').first();
    this.statusBadge = page.locator('[class*="badge"]').first();
    this.keyPrefix = page.getByText(/^[a-zA-Z0-9]+\.\.\./);
    this.scopes = page.locator('[class*="scope"], [class*="badge"]');
    this.keyId = page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}/);
    this.deleteButton = page.getByRole('button', { name: /delete/i });
  }

  async goto(keyId: string) {
    await this.page.goto(`/api-keys/${keyId}`);
  }
}

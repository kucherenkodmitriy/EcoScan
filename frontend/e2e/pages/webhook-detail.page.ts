import { type Page, type Locator } from '@playwright/test';

export class WebhookDetailPage {
  readonly page: Page;
  readonly name: Locator;
  readonly statusBadge: Locator;
  readonly url: Locator;
  readonly authType: Locator;
  readonly events: Locator;
  readonly editLink: Locator;
  readonly deleteButton: Locator;
  readonly successCount: Locator;
  readonly failureCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.name = page.locator('h1, h2').first();
    this.statusBadge = page.locator('[class*="badge"]').first();
    this.url = page.getByText(/https?:\/\//);
    this.authType = page.getByText(/none|api_key|bearer/i);
    this.events = page.locator('[class*="event"], [class*="badge"]');
    this.editLink = page.getByRole('link', { name: /edit/i });
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    this.successCount = page.getByText(/successful|success.*\d+/i);
    this.failureCount = page.getByText(/failed|failure.*\d+/i);
  }

  async goto(webhookId: string) {
    await this.page.goto(`/webhooks/${webhookId}`);
  }
}

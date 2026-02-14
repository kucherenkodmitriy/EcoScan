import { type Page, type Locator } from '@playwright/test';

export class WebhookFormPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly urlInput: Locator;
  readonly authTypeSelect: Locator;
  readonly authHeaderInput: Locator;
  readonly authValueInput: Locator;
  readonly eventCheckbox: Locator;
  readonly isActiveCheckbox: Locator;
  readonly submitButton: Locator;
  readonly cancelLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input#name');
    this.urlInput = page.locator('input#url');
    this.authTypeSelect = page.locator('select#authType');
    this.authHeaderInput = page.locator('input#authHeader');
    this.authValueInput = page.locator('input#authValue');
    this.eventCheckbox = page.getByLabel(/bin\.status\.updated/i);
    this.isActiveCheckbox = page.locator('input[type=checkbox]').filter({ hasText: /active/i });
    this.submitButton = page.locator('button[type=submit]');
    this.cancelLink = page.getByRole('link', { name: /cancel/i });
    this.errorMessage = page.locator('.error-message');
  }

  async gotoCreate() {
    await this.page.goto('/webhooks/new');
  }

  async gotoEdit(webhookId: string) {
    await this.page.goto(`/webhooks/${webhookId}/edit`);
  }

  async fillForm(data: {
    name?: string;
    url?: string;
    authType?: string;
    authHeader?: string;
    authValue?: string;
  }) {
    if (data.name !== undefined) await this.nameInput.fill(data.name);
    if (data.url !== undefined) await this.urlInput.fill(data.url);
    if (data.authType !== undefined) await this.authTypeSelect.selectOption(data.authType);
    if (data.authHeader !== undefined) await this.authHeaderInput.fill(data.authHeader);
    if (data.authValue !== undefined) await this.authValueInput.fill(data.authValue);
  }
}

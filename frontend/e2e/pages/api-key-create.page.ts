import { type Page, type Locator } from '@playwright/test';

export class ApiKeyCreatePage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly binsReadCheckbox: Locator;
  readonly binsWriteCheckbox: Locator;
  readonly expiresSelect: Locator;
  readonly submitButton: Locator;
  readonly generatedKey: Locator;
  readonly copyButton: Locator;
  readonly doneButton: Locator;
  readonly warningMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input#name');
    this.binsReadCheckbox = page.getByLabel(/bins:read/i);
    this.binsWriteCheckbox = page.getByLabel(/bins:write/i);
    this.expiresSelect = page.locator('select#expiresIn');
    this.submitButton = page.getByRole('button', { name: /generate/i });
    this.generatedKey = page.locator('[class*="keyValue"]');
    this.copyButton = page.getByRole('button', { name: /copy/i });
    this.doneButton = page.getByRole('link', { name: /done/i });
    this.warningMessage = page.locator('[class*="warning"]');
  }

  async goto() {
    await this.page.goto('/api-keys/new');
  }

  async createKey(name: string, scopes: { read?: boolean; write?: boolean } = {}) {
    await this.nameInput.fill(name);
    if (scopes.read) await this.binsReadCheckbox.check();
    if (scopes.write) await this.binsWriteCheckbox.check();
    await this.submitButton.click();
  }
}

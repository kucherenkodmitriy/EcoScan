import { type Page, type Locator } from '@playwright/test';

export class QrPrintPage {
  readonly page: Page;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly activeFilter: Locator;
  readonly selectAllButton: Locator;
  readonly deselectAllButton: Locator;
  readonly binCheckboxes: Locator;
  readonly printButton: Locator;
  readonly binItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.typeFilter = page.locator('select#typeFilter');
    this.statusFilter = page.locator('select#statusFilter');
    this.activeFilter = page.locator('select#activeFilter');
    // "Select All (N)" vs "Deselect All" — use exact text pattern to avoid strict mode violation
    this.selectAllButton = page.getByRole('button', { name: /^Select All/i });
    this.deselectAllButton = page.getByRole('button', { name: /^Deselect All$/i });
    // Scope bin checkboxes to the bin list area only (exclude "Full A4 page" checkbox)
    this.binCheckboxes = page.locator('[class*="checkboxLabel"] input[type=checkbox]');
    this.printButton = page.getByRole('button', { name: /print selected/i });
    this.binItems = page.locator('[class*="binItem"]');
  }

  async goto() {
    await this.page.goto('/print');
  }
}

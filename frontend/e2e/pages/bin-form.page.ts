import { type Page, type Locator } from '@playwright/test';

export class BinFormPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly binTypeSelect: Locator;
  readonly addressInput: Locator;
  readonly latitudeInput: Locator;
  readonly longitudeInput: Locator;
  readonly isActiveCheckbox: Locator;
  readonly submitButton: Locator;
  readonly cancelLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input#name');
    this.binTypeSelect = page.locator('select#binType');
    this.addressInput = page.locator('#address');
    this.latitudeInput = page.locator('input#latitude');
    this.longitudeInput = page.locator('input#longitude');
    this.isActiveCheckbox = page.locator('input[type=checkbox]');
    this.submitButton = page.locator('button[type=submit]');
    this.cancelLink = page.getByRole('link', { name: /cancel/i });
    this.errorMessage = page.locator('.error-message');
  }

  async gotoCreate() {
    await this.page.goto('/bins/new');
  }

  async gotoEdit(binId: string) {
    await this.page.goto(`/bins/${binId}/edit`);
  }

  async fillForm(data: {
    name?: string;
    binType?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
  }) {
    if (data.name !== undefined) await this.nameInput.fill(data.name);
    if (data.binType !== undefined) await this.binTypeSelect.selectOption(data.binType);
    if (data.address !== undefined) await this.addressInput.fill(data.address);
    if (data.latitude !== undefined) await this.latitudeInput.fill(data.latitude);
    if (data.longitude !== undefined) await this.longitudeInput.fill(data.longitude);
  }

  async submit() {
    await this.submitButton.click();
  }
}

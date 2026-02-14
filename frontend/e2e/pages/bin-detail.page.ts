import { type Page, type Locator } from '@playwright/test';

export class BinDetailPage {
  readonly page: Page;
  readonly binName: Locator;
  readonly binType: Locator;
  readonly binId: Locator;
  readonly statusBar: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly backLink: Locator;
  readonly qrPreviewButton: Locator;
  readonly copyLinkButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.binName = page.locator('h1, h2').first();
    this.binType = page.locator('[class*="badge"]').first();
    this.binId = page.locator('dd code').first();
    this.statusBar = page.locator('[class*="statusBar"], [class*="progressBar"], [class*="fullness"]');
    this.editButton = page.getByRole('link', { name: /edit/i });
    this.deleteButton = page.getByRole('button', { name: /delete/i }).first();
    this.backLink = page.getByRole('link', { name: /back|dashboard/i });
    this.qrPreviewButton = page.getByRole('button', { name: /preview.*qr|qr/i });
    this.copyLinkButton = page.getByRole('button', { name: /copy link/i });
    // Modal identified by its unique heading (only visible when modal is open)
    this.deleteModal = page.getByRole('heading', { name: /delete bin/i });
    // Modal Delete button is always the last "Delete" button on the page (after header's Delete)
    this.deleteConfirmButton = page.getByRole('button', { name: /^delete$/i }).last();
    this.deleteCancelButton = page.getByRole('button', { name: /^cancel$/i });
    // Error state uses CSS module class and contains "not found" text
    this.errorMessage = page.getByText(/bin not found/i);
  }

  async goto(binId: string) {
    await this.page.goto(`/bins/${binId}`);
  }
}

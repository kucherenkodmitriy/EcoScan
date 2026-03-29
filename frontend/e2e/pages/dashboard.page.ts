import { type Page, type Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly logoutButton: Locator;
  readonly refreshButton: Locator;
  readonly newBinLink: Locator;
  readonly printQrLink: Locator;
  readonly settingsLink: Locator;
  readonly mapViewButton: Locator;
  readonly listViewButton: Locator;
  readonly binTable: Locator;
  readonly binTableRows: Locator;
  readonly statCards: Locator;
  readonly fabAddButton: Locator;
  readonly fullnessSlider: Locator;
  readonly createRouteButton: Locator;

  // Bulk selection
  readonly selectAllCheckbox: Locator;
  readonly bulkBar: Locator;
  readonly resetSelectedButton: Locator;
  readonly deselectAllButton: Locator;
  readonly bulkResetConfirmModal: Locator;
  readonly bulkResetConfirmButton: Locator;
  readonly bulkResetCancelButton: Locator;
  readonly successBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logoutButton = page.getByRole('button', { name: /logout/i });
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.newBinLink = page.getByRole('link', { name: /new bin/i });
    this.printQrLink = page.getByRole('link', { name: /print qr/i });
    this.settingsLink = page.locator('a[href="/settings"]');
    this.mapViewButton = page.getByRole('button', { name: /map view/i });
    this.listViewButton = page.getByRole('button', { name: /show as list|list view/i });
    this.binTable = page.locator('table');
    this.binTableRows = page.locator('table tbody tr');
    this.statCards = page.locator('[class*="statCard"]');
    this.fabAddButton = page.locator('[class*="fabAdd"]');
    this.fullnessSlider = page.locator('[class*="fullnessSlider"], [class*="sliderContainer"]');
    this.createRouteButton = page.getByRole('button', { name: /create route/i });

    // Bulk selection locators
    this.selectAllCheckbox = page.locator('table thead input[type="checkbox"]');
    this.bulkBar = page.locator('[class*="bulkBar"]');
    this.resetSelectedButton = page.getByRole('button', { name: /reset reports/i });
    this.deselectAllButton = page.locator('[class*="deselectBtn"]');
    this.bulkResetConfirmModal = page.locator('[class*="modalOverlay"]');
    this.bulkResetConfirmButton = page.locator('[class*="modalContent"] button', { hasText: /reset reports/i });
    this.bulkResetCancelButton = page.locator('[class*="modalContent"] button', { hasText: /cancel/i });
    this.successBanner = page.locator('[class*="successBanner"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async switchToListView() {
    await this.listViewButton.click();
  }

  async switchToMapView() {
    await this.mapViewButton.click();
  }

  getBinRowByName(name: string): Locator {
    return this.binTableRows.filter({ hasText: name });
  }

  getRowCheckbox(name: string): Locator {
    return this.getBinRowByName(name).locator('input[type="checkbox"]');
  }

  getSelectedRows(): Locator {
    return this.page.locator('table tbody tr[class*="selectedRow"]');
  }
}

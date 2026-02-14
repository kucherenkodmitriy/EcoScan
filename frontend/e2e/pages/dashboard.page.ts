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
  }

  async goto() {
    await this.page.goto('/dashboard');
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
}

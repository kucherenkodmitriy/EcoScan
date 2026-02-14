import { test, expect } from '../../fixtures/base';
import { DashboardPage } from '../../pages/dashboard.page';
import { SEEDED_BINS } from '../../fixtures/test-data';

test.describe('Dashboard List View', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.switchToListView();
  });

  test('displays table headers', async ({ page }) => {
    const headers = page.locator('table th');
    await expect(headers).toHaveCount(8);
    await expect(page.locator('table th', { hasText: /name/i })).toBeVisible();
    await expect(page.locator('table th', { hasText: /type/i })).toBeVisible();
  });

  test('displays seeded bins', async () => {
    for (const bin of SEEDED_BINS) {
      const row = dashboard.getBinRowByName(bin.name);
      await expect(row).toBeVisible();
    }
  });

  test('shows type badges for bins', async ({ page }) => {
    const badges = page.locator('table [class*="badge"]');
    await expect(badges.first()).toBeVisible();
  });

  test('shows fullness indicators', async ({ page }) => {
    const fullness = page.locator('[class*="fullness"], [class*="progress"], [class*="statusBar"]');
    await expect(fullness.first()).toBeVisible();
  });

  test('clicking bin name navigates to detail', async ({ page }) => {
    const firstBin = SEEDED_BINS[0];
    const row = dashboard.getBinRowByName(firstBin.name);
    await row.getByRole('link', { name: /view/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/bins/${firstBin.id}`));
  });

  test('clicking edit navigates to edit page', async ({ page }) => {
    const firstBin = SEEDED_BINS[0];
    const row = dashboard.getBinRowByName(firstBin.name);
    await row.getByRole('link', { name: /edit/i }).click();
    await expect(page).toHaveURL(new RegExp(`/bins/${firstBin.id}/edit`));
  });

  test('shows active/inactive badges', async ({ page }) => {
    const statusBadges = page.locator('[class*="badge-active"], [class*="badge-inactive"], [class*="active"], [class*="inactive"]');
    await expect(statusBadges.first()).toBeVisible();
  });

  test('has New Bin button', async ({ page }) => {
    // The "+ New Bin" link is only rendered in list view
    const newBinLink = page.getByRole('link', { name: /new bin/i });
    await expect(newBinLink).toBeVisible({ timeout: 10000 });
  });
});

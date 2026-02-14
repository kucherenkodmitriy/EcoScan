import { test, expect } from '../../fixtures/base';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('Dashboard Stats', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test('displays four stat cards', async ({ page }) => {
    const statCards = page.locator('[class*="statCard"]');
    await expect(statCards).toHaveCount(4);
  });

  test('shows correct total bins count', async ({ page }) => {
    // Wait for the bins API to return data before checking stats
    await page.waitForResponse(
      (r) => r.url().includes('/admin/bins') && r.status() === 200,
      { timeout: 10000 },
    );
    // Find the "Total Bins" heading and get the stat value from its sibling
    const totalHeading = page.getByRole('heading', { name: /total bins/i });
    await expect(totalHeading).toBeVisible();
    // The stat value is the next sibling element after the heading
    const value = await totalHeading.evaluate((el) => el.nextElementSibling?.textContent);
    expect(Number(value?.trim())).toBeGreaterThanOrEqual(3);
  });

  test('shows full count stat', async ({ page }) => {
    const fullCard = page.locator('[class*="statCard"]').filter({ hasText: /full/i });
    await expect(fullCard).toBeVisible();
  });

  test('shows available count stat', async ({ page }) => {
    const availableCard = page.locator('[class*="statCard"]').filter({ hasText: /available/i });
    await expect(availableCard).toBeVisible();
  });

  test('refresh button reloads data', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/admin/bins') && response.status() === 200,
    );
    await dashboard.refreshButton.click();
    await responsePromise;
  });
});

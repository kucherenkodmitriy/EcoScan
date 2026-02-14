import { test, expect } from '../../fixtures/base';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('Dashboard Map View', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test('defaults to map view', async ({ page }) => {
    // Map container should be visible by default
    const mapContainer = page.locator('[class*="map"], #map');
    await expect(mapContainer.first()).toBeVisible();
  });

  test('fullness slider is present in map view', async ({ page }) => {
    const slider = page.locator('[class*="slider"], [class*="Slider"]');
    await expect(slider.first()).toBeVisible();
  });

  test('slider is hidden in list view', async ({ page }) => {
    await dashboard.switchToListView();
    const slider = page.locator('[class*="fullnessSlider"], [class*="FullnessSlider"]');
    await expect(slider).not.toBeVisible();
  });

  test('Create Route button is visible', async () => {
    await expect(dashboard.createRouteButton).toBeVisible();
  });

  test('FAB add button is visible in map view', async ({ page }) => {
    // FAB button: title="Create New Bin", text "+"
    const fab = page.getByTitle(/create new bin/i);
    await expect(fab).toBeVisible();
  });
});

import { test, expect } from '../../fixtures/base';
import { DashboardPage } from '../../pages/dashboard.page';
import { SEEDED_BINS } from '../../fixtures/test-data';

test.describe('Dashboard Bulk Reset Reports', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.switchToListView();
  });

  test('each row has a checkbox', async () => {
    for (const bin of SEEDED_BINS) {
      const checkbox = dashboard.getRowCheckbox(bin.name);
      await expect(checkbox).toBeVisible();
      await expect(checkbox).not.toBeChecked();
    }
  });

  test('select all header checkbox exists', async () => {
    await expect(dashboard.selectAllCheckbox).toBeVisible();
    await expect(dashboard.selectAllCheckbox).not.toBeChecked();
  });

  test('bulk bar is hidden when nothing selected', async () => {
    await expect(dashboard.bulkBar).not.toBeVisible();
  });

  test('selecting a row shows bulk action bar', async () => {
    await dashboard.getRowCheckbox(SEEDED_BINS[0].name).check();
    await expect(dashboard.bulkBar).toBeVisible();
    await expect(dashboard.bulkBar).toContainText('1');
  });

  test('selecting a row highlights it', async () => {
    await dashboard.getRowCheckbox(SEEDED_BINS[0].name).check();
    await expect(dashboard.getSelectedRows()).toHaveCount(1);
  });

  test('select all checks every row', async () => {
    // Wait for rows to load
    await expect(dashboard.binTableRows.first()).toBeVisible();
    const totalRows = await dashboard.binTableRows.count();

    await dashboard.selectAllCheckbox.check();
    await expect(dashboard.getSelectedRows()).toHaveCount(totalRows);
    await expect(dashboard.bulkBar).toContainText(`${totalRows}`);
  });

  test('deselect all clears selection', async () => {
    await dashboard.selectAllCheckbox.check();
    await expect(dashboard.bulkBar).toBeVisible();

    await dashboard.deselectAllButton.click();
    await expect(dashboard.bulkBar).not.toBeVisible();
    await expect(dashboard.getSelectedRows()).toHaveCount(0);
  });

  test('unchecking select-all clears selection', async () => {
    await dashboard.selectAllCheckbox.check();
    await dashboard.selectAllCheckbox.uncheck();
    await expect(dashboard.bulkBar).not.toBeVisible();
    await expect(dashboard.getSelectedRows()).toHaveCount(0);
  });

  test('reset button opens confirmation modal', async () => {
    await dashboard.getRowCheckbox(SEEDED_BINS[0].name).check();
    await dashboard.resetSelectedButton.click();
    await expect(dashboard.bulkResetConfirmModal).toBeVisible();
  });

  test('cancel in confirmation modal dismisses it', async () => {
    await dashboard.getRowCheckbox(SEEDED_BINS[0].name).check();
    await dashboard.resetSelectedButton.click();
    await expect(dashboard.bulkResetConfirmModal).toBeVisible();

    await dashboard.bulkResetCancelButton.click();
    await expect(dashboard.bulkResetConfirmModal).not.toBeVisible();
    // Selection should still be active
    await expect(dashboard.bulkBar).toBeVisible();
  });

  test('confirming bulk reset sends correct API request and shows success', async ({ page }) => {
    // Mock the batch reset API to return a success response
    await page.route('**/admin/bins/reset-reports', async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: body.bin_ids.map((id: string) => ({
            bin_id: id,
            archived_count: 2,
            archive_batch_id: 'test-batch',
          })),
          total_archived: body.bin_ids.length * 2,
          message: `Successfully reset ${body.bin_ids.length} bins`,
        }),
      });
    });

    // Intercept the request to verify payload
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/admin/bins/reset-reports') && req.method() === 'POST'
    );

    await dashboard.getRowCheckbox(SEEDED_BINS[0].name).check();
    await dashboard.getRowCheckbox(SEEDED_BINS[1].name).check();
    await dashboard.resetSelectedButton.click();
    await dashboard.bulkResetConfirmButton.click();

    const request = await requestPromise;
    const body = request.postDataJSON();
    expect(body.bin_ids).toHaveLength(2);
    expect(body.bin_ids).toContain(SEEDED_BINS[0].id);
    expect(body.bin_ids).toContain(SEEDED_BINS[1].id);

    // After completion, bulk bar should disappear and success banner should show
    await expect(dashboard.bulkBar).not.toBeVisible({ timeout: 10000 });
    await expect(dashboard.successBanner).toBeVisible();
  });

  test('switching to map view clears selection', async () => {
    await dashboard.getRowCheckbox(SEEDED_BINS[0].name).check();
    await expect(dashboard.bulkBar).toBeVisible();

    await dashboard.switchToMapView();
    await dashboard.switchToListView();

    await expect(dashboard.bulkBar).not.toBeVisible();
    await expect(dashboard.getSelectedRows()).toHaveCount(0);
  });
});

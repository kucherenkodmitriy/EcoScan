import { test, expect } from '../../fixtures/base';
import { QrPrintPage } from '../../pages/qr-print.page';

test.describe('QR Print Page', () => {
  let qrPrint: QrPrintPage;

  test.beforeEach(async ({ page }) => {
    qrPrint = new QrPrintPage(page);
    await qrPrint.goto();
  });

  test('filter controls are displayed', async () => {
    await expect(qrPrint.typeFilter).toBeVisible();
    await expect(qrPrint.activeFilter).toBeVisible();
  });

  test('seeded bins are listed', async ({ page }) => {
    await expect(page.getByText('Old Town Square Bin')).toBeVisible();
    await expect(page.getByText('Charles Bridge Bin')).toBeVisible();
    await expect(page.getByText('Prague Castle Bin')).toBeVisible();
  });

  test('select all and deselect all work', async ({ page }) => {
    // Wait for bins to fully load and React to settle
    await expect(qrPrint.binCheckboxes.first()).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click Select All and verify the print button reflects the count
    await qrPrint.selectAllButton.click();
    await expect(page.getByText(/\d+ bins selected/)).toBeVisible({ timeout: 5000 });

    // Click Deselect All and verify selection is cleared
    await qrPrint.deselectAllButton.click();
    await expect(page.getByText(/0 bins selected/)).toBeVisible({ timeout: 5000 });
  });

  test('can filter by type', async ({ page }) => {
    // Wait for the page and bins to load
    await expect(page.getByRole('heading', { name: /print qr codes/i })).toBeVisible({ timeout: 10000 });
    await expect(qrPrint.typeFilter).toBeVisible();
    await qrPrint.typeFilter.selectOption({ index: 1 });
    // Filtered list should still show bins (index 1 = "Mixed")
    await expect(qrPrint.binCheckboxes.first()).toBeVisible({ timeout: 10000 });
  });

  test('can filter by active status', async () => {
    await qrPrint.activeFilter.selectOption({ index: 1 });
    await expect(qrPrint.binCheckboxes.first()).toBeVisible();
  });

  test('shows selected count', async () => {
    await qrPrint.selectAllButton.click();
    await expect(qrPrint.printButton).toContainText(/\d+/);
  });

  test('print button shows count of selected', async () => {
    await qrPrint.selectAllButton.click();
    // Button text is "Print Selected (N)" where N matches filtered bin count
    await expect(qrPrint.printButton).toContainText(/Print Selected \(\d+\)/);
  });
});

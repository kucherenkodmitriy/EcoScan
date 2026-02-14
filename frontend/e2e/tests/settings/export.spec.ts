import { test, expect } from '../../fixtures/base';

test.describe('Data Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/export');
  });

  test('export section is displayed', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /data export/i })).toBeVisible();
  });

  test('CSV download triggers', async ({ page }) => {
    const downloadBtn = page.getByRole('button', { name: /download csv/i });
    await expect(downloadBtn).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/ecoscan.*\.csv/);
  });

  test('shows success message after export', async ({ page }) => {
    const downloadBtn = page.getByRole('button', { name: /download csv/i });
    await downloadBtn.click();
    const success = page.locator('[class*="success"]');
    await expect(success).toBeVisible({ timeout: 5000 });
  });
});

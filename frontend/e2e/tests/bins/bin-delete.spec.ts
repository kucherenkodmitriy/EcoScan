import { test, expect } from '../../fixtures/base';
import { BinDetailPage } from '../../pages/bin-detail.page';
import { loginAndGetToken, createBinViaApi, deleteBinViaApi } from '../../helpers/api';

test.describe('Bin Delete', () => {
  let detail: BinDetailPage;
  let testBinId: string;
  const createdBinIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Create a temporary bin for delete testing
    const token = await loginAndGetToken();
    testBinId = await createBinViaApi(token, { name: `Delete Test ${Date.now()}` });
    createdBinIds.push(testBinId);
    detail = new BinDetailPage(page);
    await detail.goto(testBinId);
  });

  test.afterAll(async () => {
    if (createdBinIds.length > 0) {
      const token = await loginAndGetToken();
      for (const id of createdBinIds) {
        await deleteBinViaApi(token, id).catch(() => {});
      }
    }
  });

  test('shows confirmation modal on delete', async () => {
    await detail.deleteButton.click();
    await expect(detail.deleteModal).toBeVisible();
  });

  test('cancel keeps bin', async ({ page }) => {
    await detail.deleteButton.click();
    await detail.deleteCancelButton.click();
    await expect(detail.deleteModal).not.toBeVisible();
    // Should still be on detail page
    await expect(page).toHaveURL(new RegExp(`/bins/${testBinId}`));
  });

  test('delete redirects to dashboard', async ({ page }) => {
    await detail.deleteButton.click();
    await detail.deleteConfirmButton.click();
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('shows bin name in modal', async () => {
    await detail.deleteButton.click();
    await expect(detail.deleteModal).toContainText(/delete/i);
  });

  test('buttons are disabled during delete', async ({ page }) => {
    // Open the delete modal first
    await detail.deleteButton.click();
    await expect(detail.deleteModal).toBeVisible();
    // Now set up route interception to slow down the DELETE request
    await page.route('**/admin/bins/**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.continue();
      } else {
        await route.continue();
      }
    });
    await detail.deleteConfirmButton.click();
    // During the delay, the confirm button should be disabled
    await expect(detail.deleteConfirmButton).toBeDisabled();
  });
});

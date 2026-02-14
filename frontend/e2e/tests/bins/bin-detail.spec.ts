import { test, expect } from '../../fixtures/base';
import { BinDetailPage } from '../../pages/bin-detail.page';
import { SEEDED_BINS, INVALID_BIN_ID } from '../../fixtures/test-data';

test.describe('Bin Detail', () => {
  let detail: BinDetailPage;
  const bin = SEEDED_BINS[0];

  test.beforeEach(async ({ page }) => {
    detail = new BinDetailPage(page);
    await detail.goto(bin.id);
  });

  test('displays bin name', async ({ page }) => {
    await expect(page.locator('h2').first()).toContainText(bin.name);
  });

  test('shows bin ID in code element', async ({ page }) => {
    await expect(page.locator('dd code').first()).toContainText(bin.id, { timeout: 10000 });
  });

  test('shows status percentage', async ({ page }) => {
    await expect(page.getByText(/%/)).toBeVisible();
  });

  test('has QR section', async () => {
    await expect(detail.qrPreviewButton).toBeVisible();
  });

  test('QR link contains bin ID', async () => {
    await expect(detail.copyLinkButton).toBeVisible();
  });

  test('edit button navigates to edit page', async ({ page }) => {
    await detail.editButton.click();
    await expect(page).toHaveURL(new RegExp(`/bins/${bin.id}/edit`));
  });

  test('back link navigates to dashboard', async ({ page }) => {
    await detail.backLink.click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows error for non-existent bin', async ({ page }) => {
    await detail.goto(INVALID_BIN_ID);
    await expect(page.getByText(/bin not found/i)).toBeVisible({ timeout: 10000 });
  });
});

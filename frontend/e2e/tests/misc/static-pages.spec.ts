import { test, expect } from '../../fixtures/base';

test.describe('Static Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('privacy policy page displays', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.getByText(/privacy/i).first()).toBeVisible();
  });

  test('terms page displays', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.getByText(/terms/i).first()).toBeVisible();
  });

  test('privacy page has back link', async ({ page }) => {
    await page.goto('/privacy');
    const backLink = page.getByRole('link', { name: /back|home/i });
    await expect(backLink).toBeVisible();
  });

  test('terms page has back link', async ({ page }) => {
    await page.goto('/terms');
    const backLink = page.getByRole('link', { name: /back|home/i });
    await expect(backLink).toBeVisible();
  });
});

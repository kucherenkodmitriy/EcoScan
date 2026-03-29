import { test, expect } from '../../fixtures/base';
import { SEEDED_BINS } from '../../fixtures/test-data';

test.describe('Navigation', () => {
  test('dashboard to bin detail', async ({ page }) => {
    await page.goto('/dashboard');
    // Switch to list view and click a bin
    await page.getByRole('button', { name: /show as list|list view/i }).click();
    await page.getByRole('link', { name: /view/i }).first().click();
    await expect(page).toHaveURL(/\/bins\//);
  });

  test('detail to edit', async ({ page }) => {
    await page.goto(`/bins/${SEEDED_BINS[0].id}`);
    await page.getByRole('link', { name: /edit/i }).click();
    await expect(page).toHaveURL(new RegExp(`/bins/${SEEDED_BINS[0].id}/edit`));
  });

  test('dashboard to settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('a[href*="/settings"]').first().click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('between settings tabs', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await page.getByRole('link', { name: /webhooks/i }).click();
    await expect(page).toHaveURL('/settings/webhooks');
    await page.getByRole('link', { name: /export/i }).click();
    await expect(page).toHaveURL('/settings/export');
    await page.getByRole('link', { name: /api keys/i }).click();
    await expect(page).toHaveURL('/settings/api-keys');
  });

  test('settings to dashboard', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await page.getByRole('link', { name: /dashboard|back/i }).first().click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/nonexistent-route');
    await expect(page.getByText('404')).toBeVisible();
  });

  test('landing privacy link works', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer a[href="/privacy"]').click();
    await expect(page).toHaveURL('/privacy');
  });
});

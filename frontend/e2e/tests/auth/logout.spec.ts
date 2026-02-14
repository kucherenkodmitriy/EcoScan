import { test, expect } from '../../fixtures/base';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('Logout', () => {
  test('logout button redirects to login', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.logoutButton.click();
    await expect(page).toHaveURL('/login');
  });

  test('clears localStorage on logout', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.logoutButton.click();
    const token = await page.evaluate(() => localStorage.getItem('ecoscan_token'));
    const user = await page.evaluate(() => localStorage.getItem('ecoscan_user'));
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  test('protected routes are inaccessible after logout', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.logoutButton.click();
    await page.waitForURL('/login');
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});

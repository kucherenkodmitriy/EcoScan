import { test, expect } from '../../fixtures/base';

test.describe('Cookie Consent', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookie consent to trigger banner
    await page.addInitScript(() => {
      localStorage.removeItem('ecoscan_cookie_consent');
    });
  });

  test('banner appears for new visitors', async ({ page }) => {
    await page.goto('/');
    // CookieConsent uses CSS modules — find by button text inside it
    const acceptBtn = page.getByRole('button', { name: /^Accept$/i });
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });
  });

  test('accept hides the banner', async ({ page }) => {
    await page.goto('/');
    const acceptBtn = page.getByRole('button', { name: /^Accept$/i });
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });
    await acceptBtn.click();
    await expect(acceptBtn).not.toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('ecoscan_cookie_consent'));
    expect(stored).toBe('accepted');
  });

  test('decline hides the banner', async ({ page }) => {
    await page.goto('/');
    const declineBtn = page.getByRole('button', { name: /^Decline$/i });
    await expect(declineBtn).toBeVisible({ timeout: 5000 });
    await declineBtn.click();
    await expect(declineBtn).not.toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('ecoscan_cookie_consent'));
    expect(stored).toBe('declined');
  });

  test('no banner if already consented', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ecoscan_cookie_consent', 'accepted');
    });
    await page.goto('/');
    const acceptBtn = page.getByRole('button', { name: /^Accept$/i });
    // Wait past the 1s delay for banner appearance
    await page.waitForTimeout(2000);
    await expect(acceptBtn).not.toBeVisible();
  });
});

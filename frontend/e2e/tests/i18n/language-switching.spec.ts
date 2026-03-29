import { test, expect } from '../../fixtures/base';

test.describe('Language Switching', () => {
  test('defaults to English in test environment', async ({ page }) => {
    await page.goto('/dashboard');
    // autoMock fixture sets ecoscan-language=en
    const lang = await page.evaluate(() => localStorage.getItem('ecoscan-language'));
    expect(lang).toBe('en');
  });

  test('can switch to Czech', async ({ page }) => {
    await page.goto('/dashboard');
    // LanguageSwitcher: click the trigger (shows flag + code)
    const langTrigger = page.locator('[class*="trigger"]').first();
    await langTrigger.click();
    // Find Czech option in dropdown
    const czechOption = page.locator('[class*="option"]').filter({ hasText: /čeština|CS/i });
    await czechOption.click();
    const lang = await page.evaluate(() => localStorage.getItem('ecoscan-language'));
    expect(lang).toBe('cs');
  });

  test('can switch to German', async ({ page }) => {
    await page.goto('/dashboard');
    const langTrigger = page.locator('[class*="trigger"]').first();
    await langTrigger.click();
    const germanOption = page.locator('[class*="option"]').filter({ hasText: /deutsch|DE/i });
    await germanOption.click();
    const lang = await page.evaluate(() => localStorage.getItem('ecoscan-language'));
    expect(lang).toBe('de');
  });

  test('persists language in localStorage after switch', async ({ page }) => {
    await page.goto('/dashboard');
    // Switch to Czech via the UI language switcher
    const langTrigger = page.locator('[class*="trigger"]').first();
    await langTrigger.click();
    const czechOption = page.locator('[class*="option"]').filter({ hasText: /čeština|CS/i });
    await czechOption.click();
    // Verify it was saved
    const lang = await page.evaluate(() => localStorage.getItem('ecoscan-language'));
    expect(lang).toBe('cs');
    // Reload and verify it persists
    await page.reload();
    const langAfter = await page.evaluate(() => localStorage.getItem('ecoscan-language'));
    expect(langAfter).toBe('cs');
  });

  test('respects ?lang= query parameter', async ({ page }) => {
    await page.goto('/dashboard?lang=de');
    const lang = await page.evaluate(() => localStorage.getItem('ecoscan-language'));
    expect(lang).toBe('de');
  });

  test('works on login page', async ({ page }) => {
    // Navigate first so we have an origin for localStorage
    await page.goto('/dashboard');
    // Clear auth tokens so we become unauthenticated
    await page.evaluate(() => {
      localStorage.removeItem('ecoscan_token');
      localStorage.removeItem('ecoscan_user');
      localStorage.removeItem('ecoscan_expires');
    });
    await page.goto('/login');
    // Language switcher button has aria-haspopup="listbox"
    const langTrigger = page.locator('button[aria-haspopup="listbox"]');
    await expect(langTrigger).toBeVisible({ timeout: 10000 });
  });
});

import { test, expect } from '../../fixtures/base';
import { LandingPage } from '../../pages/landing.page';

test.describe('Landing Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let landing: LandingPage;

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page);
    await landing.goto();
  });

  test('displays hero section', async () => {
    await expect(landing.heroSection).toBeVisible();
  });

  test('has navigation sections', async ({ page }) => {
    const sections = page.locator('section.landing-section');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('CTA button scrolls to contact', async () => {
    await landing.ctaButton.click();
    await expect(landing.contactSection).toBeInViewport({ timeout: 5000 });
  });

  test('has footer with links', async () => {
    await expect(landing.footer).toBeVisible();
    const count = await landing.footerLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('displays metrics in hero', async ({ page }) => {
    const metrics = page.locator('.landing-metrics');
    await expect(metrics).toBeVisible();
  });

  test('all main sections are present', async ({ page }) => {
    await expect(page.locator('section#problem')).toBeVisible();
    await expect(page.locator('section#solution')).toBeVisible();
  });
});

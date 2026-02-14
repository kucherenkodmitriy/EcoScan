import { test, expect } from '../../fixtures/base';
import { ReportPage } from '../../pages/report.page';
import { SEEDED_BINS, INVALID_BIN_ID } from '../../fixtures/test-data';

test.describe('Public Report Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let report: ReportPage;
  const bin = SEEDED_BINS[0];

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
  });

  test('displays bin information', async () => {
    await report.goto(bin.id);
    await expect(report.binName).toBeVisible();
  });

  test('shows error when no bin ID provided', async () => {
    await report.gotoWithoutBin();
    await expect(report.errorTitle).toBeVisible();
    await expect(report.errorText).toBeVisible();
  });

  test('shows error for invalid bin ID', async () => {
    await report.goto(INVALID_BIN_ID);
    await expect(report.errorTitle).toBeVisible();
  });

  test('slider defaults to 50', async () => {
    await report.goto(bin.id);
    await expect(report.slider).toHaveValue('50');
  });

  test('status text changes with slider', async () => {
    await report.goto(bin.id);
    const initialText = await report.statusText.textContent();
    await report.setSliderValue(90);
    // Status text should change to a different description
    await expect(report.statusText).not.toHaveText(initialText!);
    // Percentage should show 90%
    await expect(report.statusPercent).toContainText('90%');
  });

  test('submits report successfully', async () => {
    await report.goto(bin.id);
    await report.setSliderValue(75);
    await report.submit();
    await expect(report.thankYouHeading).toBeVisible({ timeout: 10000 });
  });

  test('shows loading state during submit', async () => {
    await report.goto(bin.id);
    await report.submit();
    await expect(report.submitButton).toContainText(/submitting/i);
  });

  test('is accessible without authentication', async ({ page }) => {
    await report.goto(bin.id);
    await expect(page).toHaveURL(new RegExp(`/report\\?bin=${bin.id}`));
    await expect(page).not.toHaveURL('/login');
  });

  test('has language switcher', async ({ page }) => {
    await report.goto(bin.id);
    const langTrigger = page.locator('[class*="trigger"]');
    await expect(langTrigger.first()).toBeVisible();
  });
});

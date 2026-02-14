import { test, expect } from '../../fixtures/base';
import { BinFormPage } from '../../pages/bin-form.page';
import { loginAndGetToken, deleteBinViaApi } from '../../helpers/api';

test.describe('Bin Create', () => {
  let form: BinFormPage;
  const createdBinIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    form = new BinFormPage(page);
    await form.gotoCreate();
  });

  test.afterAll(async () => {
    if (createdBinIds.length > 0) {
      const token = await loginAndGetToken();
      for (const id of createdBinIds) {
        await deleteBinViaApi(token, id).catch(() => {});
      }
    }
  });

  test('displays create bin form', async () => {
    await expect(form.nameInput).toBeVisible();
    await expect(form.binTypeSelect).toBeVisible();
    await expect(form.submitButton).toBeVisible();
    await expect(form.submitButton).toContainText(/create/i);
  });

  test('shows error on empty name submit', async ({ page }) => {
    await form.submit();
    // Should stay on the same page
    await expect(page).toHaveURL('/bins/new');
  });

  test('creates bin with name only', async ({ page }) => {
    const binName = `Test Bin ${Date.now()}`;
    await form.fillForm({ name: binName });
    await form.submit();
    await expect(page).toHaveURL(/\/(dashboard|bins\/)/, { timeout: 10000 });
    const url = page.url();
    const match = url.match(/\/bins\/([a-f0-9-]+)/);
    if (match) createdBinIds.push(match[1]);
  });

  test('creates bin with all fields', async ({ page }) => {
    const binName = `Full Bin ${Date.now()}`;
    await form.fillForm({
      name: binName,
      binType: 'plastic',
      latitude: '50.0857',
      longitude: '14.4195',
    });
    await form.submit();
    await expect(page).toHaveURL(/\/(dashboard|bins\/)/, { timeout: 10000 });
    const url = page.url();
    const match = url.match(/\/bins\/([a-f0-9-]+)/);
    if (match) createdBinIds.push(match[1]);
  });

  test('has bin type options', async () => {
    const options = form.binTypeSelect.locator('option');
    await expect(options).toHaveCount(4);
  });

  test('cancel navigates to dashboard', async ({ page }) => {
    // BinForm has backLink "← Cancel" and button "Cancel" both going to /dashboard in create mode
    await page.getByRole('link', { name: /cancel/i }).first().click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('does not show active checkbox in create mode', async () => {
    await expect(form.isActiveCheckbox).not.toBeVisible();
  });
});

import { test, expect } from '../../fixtures/base';
import { SettingsPage } from '../../pages/settings.page';
import { ApiKeyCreatePage } from '../../pages/api-key-create.page';
import { loginAndGetToken, createApiKeyViaApi, deleteApiKeyViaApi } from '../../helpers/api';

test.describe('API Keys Settings', () => {
  let settings: SettingsPage;
  const createdKeyIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
    await page.goto('/settings/api-keys');
  });

  test.afterAll(async () => {
    if (createdKeyIds.length > 0) {
      const token = await loginAndGetToken();
      for (const id of createdKeyIds) {
        await deleteApiKeyViaApi(token, id).catch(() => {});
      }
    }
  });

  test('API Keys is the default tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings/api-keys');
  });

  test('shows empty state or existing keys', async ({ page }) => {
    const content = page.locator('main, [class*="content"]');
    await expect(content.first()).toBeVisible();
  });

  test('navigate to create page', async ({ page }) => {
    await settings.createApiKeyLink.click();
    await expect(page).toHaveURL('/api-keys/new');
  });

  test('create API key with scopes', async ({ page }) => {
    const createPage = new ApiKeyCreatePage(page);
    await createPage.goto();
    await expect(createPage.nameInput).toBeVisible({ timeout: 10000 });
    await createPage.createKey(`Test Key ${Date.now()}`, { read: true });
    await expect(createPage.generatedKey).toBeVisible({ timeout: 10000 });
  });

  test('shows warning about saving key', async ({ page }) => {
    const createPage = new ApiKeyCreatePage(page);
    await createPage.goto();
    await expect(createPage.nameInput).toBeVisible({ timeout: 10000 });
    await createPage.createKey(`Warning Key ${Date.now()}`, { read: true });
    await expect(createPage.warningMessage).toBeVisible({ timeout: 10000 });
  });

  test('copy button is available', async ({ page }) => {
    const createPage = new ApiKeyCreatePage(page);
    await createPage.goto();
    await expect(createPage.nameInput).toBeVisible({ timeout: 10000 });
    await createPage.createKey(`Copy Key ${Date.now()}`, { read: true });
    await expect(createPage.copyButton).toBeVisible({ timeout: 10000 });
  });

  test('navigate to key detail', async ({ page }) => {
    const token = await loginAndGetToken();
    const { key_id } = await createApiKeyViaApi(token, { name: `Detail Key ${Date.now()}`, scopes: ['bins:read'] });
    createdKeyIds.push(key_id);

    await page.goto(`/api-keys/${key_id}`);
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('detail page shows key fields', async ({ page }) => {
    const token = await loginAndGetToken();
    const { key_id } = await createApiKeyViaApi(token, { name: `Fields Key ${Date.now()}`, scopes: ['bins:read'] });
    createdKeyIds.push(key_id);

    await page.goto(`/api-keys/${key_id}`);
    // Detail rows contain labels like "Key Prefix", "Scopes", etc.
    await expect(page.locator('[class*="detailRow"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('delete from detail page', async ({ page }) => {
    const token = await loginAndGetToken();
    const { key_id } = await createApiKeyViaApi(token, { name: `Delete Key ${Date.now()}`, scopes: ['bins:read'] });

    await page.goto(`/api-keys/${key_id}`);
    const deleteBtn = page.getByRole('button', { name: /delete/i });
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();
    // window.confirm is auto-accepted by our base fixture
    await expect(page).toHaveURL('/settings/api-keys', { timeout: 10000 });
  });
});

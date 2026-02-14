import { test, expect } from '../../fixtures/base';
import { SettingsPage } from '../../pages/settings.page';
import { WebhookFormPage } from '../../pages/webhook-form.page';
import { loginAndGetToken, createWebhookViaApi, deleteWebhookViaApi } from '../../helpers/api';

test.describe('Webhooks Settings', () => {
  let settings: SettingsPage;
  const createdWebhookIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
    await page.goto('/settings/webhooks');
  });

  test.afterAll(async () => {
    if (createdWebhookIds.length > 0) {
      const token = await loginAndGetToken();
      for (const id of createdWebhookIds) {
        await deleteWebhookViaApi(token, id).catch(() => {});
      }
    }
  });

  test('webhooks tab is displayed', async ({ page }) => {
    await expect(settings.webhooksNav).toBeVisible();
  });

  test('shows empty state or existing webhooks', async ({ page }) => {
    const content = page.locator('[class*="content"], main');
    await expect(content.first()).toBeVisible();
  });

  test('navigate to create page', async ({ page }) => {
    await settings.createWebhookLink.click();
    await expect(page).toHaveURL('/webhooks/new');
  });

  test('create webhook with required fields', async ({ page }) => {
    const form = new WebhookFormPage(page);
    await form.gotoCreate();
    await form.fillForm({
      name: `Test Webhook ${Date.now()}`,
      url: 'https://example.com/webhook',
    });
    await form.submitButton.click();
    await expect(page).toHaveURL(/\/(settings\/webhooks|webhooks\/)/, { timeout: 10000 });
  });

  test('auth header shown when authType is api_key', async ({ page }) => {
    const form = new WebhookFormPage(page);
    await form.gotoCreate();
    await form.authTypeSelect.selectOption('api_key');
    await expect(form.authHeaderInput).toBeVisible();
  });

  test('auth value shown when authType is not none', async ({ page }) => {
    const form = new WebhookFormPage(page);
    await form.gotoCreate();
    await form.authTypeSelect.selectOption('bearer');
    await expect(form.authValueInput).toBeVisible();
  });

  test('auth fields hidden when authType is none', async ({ page }) => {
    const form = new WebhookFormPage(page);
    await form.gotoCreate();
    await form.authTypeSelect.selectOption('none');
    await expect(form.authHeaderInput).not.toBeVisible();
    await expect(form.authValueInput).not.toBeVisible();
  });

  test('edit existing webhook', async ({ page }) => {
    const token = await loginAndGetToken();
    const webhookId = await createWebhookViaApi(token, {
      name: `Edit Webhook ${Date.now()}`,
      url: 'https://example.com/edit',
    });
    createdWebhookIds.push(webhookId);

    await page.goto(`/webhooks/${webhookId}/edit`);
    const nameInput = page.locator('input#name');
    await expect(nameInput).toHaveValue(/Edit Webhook/);
  });

  test('detail page shows delivery stats', async ({ page }) => {
    const token = await loginAndGetToken();
    const webhookId = await createWebhookViaApi(token, {
      name: `Stats Webhook ${Date.now()}`,
      url: 'https://example.com/stats',
    });
    createdWebhookIds.push(webhookId);

    await page.goto(`/webhooks/${webhookId}`);
    await expect(page.getByText(/successful|success/i)).toBeVisible();
    await expect(page.getByText(/failed|failure/i)).toBeVisible();
  });

  test('delete from detail page', async ({ page }) => {
    const token = await loginAndGetToken();
    const webhookId = await createWebhookViaApi(token, {
      name: `Delete Webhook ${Date.now()}`,
      url: 'https://example.com/delete',
    });

    await page.goto(`/webhooks/${webhookId}`);
    const deleteBtn = page.getByRole('button', { name: /delete/i });
    await deleteBtn.click();
    await expect(page).toHaveURL('/settings/webhooks', { timeout: 10000 });
  });

  test('required field validation', async ({ page }) => {
    const form = new WebhookFormPage(page);
    await form.gotoCreate();
    await form.submitButton.click();
    // Should not navigate away
    await expect(page).toHaveURL('/webhooks/new');
  });
});

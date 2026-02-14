import { test as base } from '@playwright/test';
import { mockGoogleApis } from '../helpers/google-mock';

export const test = base.extend<{ autoMock: void }>({
  autoMock: [async ({ page }, use) => {
    await mockGoogleApis(page);
    // Stub window.print to prevent actual print dialogs
    await page.addInitScript(() => {
      window.print = () => {};
    });
    // Auto-accept confirm dialogs (e.g., delete confirmations via window.confirm)
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      }
    });
    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';

import { test as base } from '@playwright/test';
import { mockGoogleApis } from '../helpers/google-mock';

export const test = base.extend<{ autoMock: void }>({
  autoMock: [async ({ page }, use) => {
    await mockGoogleApis(page);
    // Stub window.print to prevent actual print dialogs
    // and set English locale for consistent test selectors
    await page.addInitScript(() => {
      window.print = () => {};
      // Set English as default test language, but don't overwrite if a test
      // explicitly set a different language (e.g., i18n switching tests)
      if (!localStorage.getItem('ecoscan-language')) {
        localStorage.setItem('ecoscan-language', 'en');
      }
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

import { test as setup } from '@playwright/test';
import { TEST_CREDENTIALS } from './fixtures/test-data';
import { login, STORAGE_STATE_PATH } from './helpers/auth';
import { mockGoogleApis } from './helpers/google-mock';

setup('authenticate', async ({ page }) => {
  await mockGoogleApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('ecoscan-language', 'en');
  });
  await login(page, TEST_CREDENTIALS.email, TEST_CREDENTIALS.password);
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});

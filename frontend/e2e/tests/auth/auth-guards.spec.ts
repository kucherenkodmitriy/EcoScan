import { test, expect } from '../../fixtures/base';

test.describe('Auth Guards', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects /dashboard to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /bins/new to /login when unauthenticated', async ({ page }) => {
    await page.goto('/bins/new');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /bins/:id to /login when unauthenticated', async ({ page }) => {
    await page.goto('/bins/00000000-0000-0000-0000-000000000001');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /settings/api-keys to /login when unauthenticated', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /print to /login when unauthenticated', async ({ page }) => {
    await page.goto('/print');
    await expect(page).toHaveURL('/login');
  });

  test('/report is accessible without auth', async ({ page }) => {
    await page.goto('/report?bin=00000000-0000-0000-0000-000000000001');
    await expect(page).toHaveURL(/\/report/);
    await expect(page).not.toHaveURL('/login');
  });

  test('redirects to /login on 401 API response', async ({ page }) => {
    // Mock API to return 401 for admin endpoints
    await page.route('**/api/admin/**', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) }),
    );
    // Set a token so PrivateRoute allows rendering, then the API 401 triggers redirect
    await page.addInitScript(() => {
      localStorage.setItem('ecoscan_token', 'invalid-expired-token');
      localStorage.setItem('ecoscan_user', JSON.stringify({ email: 'test@test.com', name: 'Test', role: 'admin' }));
    });
    await page.goto('/dashboard');
    // After receiving 401 from API, client clears token and redirects to login
    await expect(page).toHaveURL('/login', { timeout: 15000 });
  });
});

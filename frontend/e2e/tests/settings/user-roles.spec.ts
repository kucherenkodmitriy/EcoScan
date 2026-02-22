import { test, expect } from '../../fixtures/base';
import {
  loginAndGetToken,
  loginAs,
  createUserViaApi,
  deleteUserViaApi,
} from '../../helpers/api';
import { API_BASE } from '../../fixtures/test-data';

const BASE_URL = 'http://localhost:3000';
const ts = Date.now();

const OPERATOR = {
  email: `operator-test-${ts}@ecoscan.local`,
  name: 'Test Operator',
  role: 'operator',
};

const VIEWER = {
  email: `viewer-test-${ts}@ecoscan.local`,
  name: 'Test Viewer',
  role: 'viewer',
};

let adminToken: string;
let operatorToken: string;
let operatorPassword: string;
let viewerToken: string;
let viewerPassword: string;

test.beforeAll(async () => {
  adminToken = await loginAndGetToken();

  const opResult = await createUserViaApi(adminToken, OPERATOR);
  operatorPassword = opResult.initial_password;
  operatorToken = await loginAs(OPERATOR.email, operatorPassword);

  const viewerResult = await createUserViaApi(adminToken, VIEWER);
  viewerPassword = viewerResult.initial_password;
  viewerToken = await loginAs(VIEWER.email, viewerPassword);
});

test.afterAll(async () => {
  const token = await loginAndGetToken();
  await deleteUserViaApi(token, OPERATOR.email).catch(() => {});
  await deleteUserViaApi(token, VIEWER.email).catch(() => {});
});

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

test.describe('Role-Based Access Control — API', () => {
  test('admin can list users', async () => {
    const res = await fetch(`${BASE_URL}${API_BASE}/admin/users`, {
      headers: authHeaders(adminToken),
    });
    expect(res.status).toBe(200);
  });

  test('admin can create and delete a user', async () => {
    const email = `admin-crud-${ts}@ecoscan.local`;
    const createRes = await fetch(`${BASE_URL}${API_BASE}/admin/users`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ email, name: 'CRUD Test', role: 'viewer' }),
    });
    expect(createRes.status).toBe(201);

    const deleteRes = await fetch(
      `${BASE_URL}${API_BASE}/admin/users/${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: authHeaders(adminToken) },
    );
    expect(deleteRes.status).toBe(200);
  });

  test('operator gets 403 on list users', async () => {
    const res = await fetch(`${BASE_URL}${API_BASE}/admin/users`, {
      headers: authHeaders(operatorToken),
    });
    expect(res.status).toBe(403);
  });

  test('operator gets 403 on create API key', async () => {
    const res = await fetch(`${BASE_URL}${API_BASE}/admin/api-keys`, {
      method: 'POST',
      headers: authHeaders(operatorToken),
      body: JSON.stringify({ name: 'blocked', scopes: ['bins:read'] }),
    });
    expect(res.status).toBe(403);
  });

  test('operator gets 403 on create webhook', async () => {
    const res = await fetch(`${BASE_URL}${API_BASE}/admin/webhooks`, {
      method: 'POST',
      headers: authHeaders(operatorToken),
      body: JSON.stringify({
        name: 'blocked',
        url: 'https://example.com/hook',
        events: ['bin.status_updated'],
      }),
    });
    expect(res.status).toBe(403);
  });

  test('viewer gets 403 on list users', async () => {
    const res = await fetch(`${BASE_URL}${API_BASE}/admin/users`, {
      headers: authHeaders(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  test('viewer gets 403 on create API key', async () => {
    const res = await fetch(`${BASE_URL}${API_BASE}/admin/api-keys`, {
      method: 'POST',
      headers: authHeaders(viewerToken),
      body: JSON.stringify({ name: 'blocked', scopes: ['bins:read'] }),
    });
    expect(res.status).toBe(403);
  });
});

test.describe('Role-Based Access Control — Browser', () => {
  test('operator can login and see dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('input#email').fill(OPERATOR.email);
    await page.locator('input#password').fill(operatorPassword);
    await page.locator('button[type=submit]').click();

    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('h1, h2, [class*="title"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('viewer can login and see dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('input#email').fill(VIEWER.email);
    await page.locator('input#password').fill(viewerPassword);
    await page.locator('button[type=submit]').click();

    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('h1, h2, [class*="title"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('operator sees error on users settings page', async ({ page }) => {
    // Navigate first to establish origin, then inject operator token
    await page.goto('/login');
    await page.evaluate((token) => {
      localStorage.setItem('ecoscan_token', token);
    }, operatorToken);
    await page.goto('/settings/users');

    await expect(
      page.getByText(/forbidden|error|denied|not authorized/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

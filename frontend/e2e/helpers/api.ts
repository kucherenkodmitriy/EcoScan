import { TEST_CREDENTIALS, API_BASE } from '../fixtures/test-data';

const BASE_URL = 'http://localhost:3000';

export async function loginAndGetToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
    }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

export async function createBinViaApi(
  token: string,
  bin: { name: string; bin_type?: string; address?: string },
): Promise<string> {
  const res = await fetch(`${BASE_URL}${API_BASE}/admin/bins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bin),
  });
  if (!res.ok) throw new Error(`Create bin failed: ${res.status}`);
  const data = await res.json();
  return data.bin_id;
}

export async function deleteBinViaApi(token: string, binId: string): Promise<void> {
  await fetch(`${BASE_URL}${API_BASE}/admin/bins/${binId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createApiKeyViaApi(
  token: string,
  apiKey: { name: string; scopes?: string[] },
): Promise<{ key_id: string; key: string }> {
  const res = await fetch(`${BASE_URL}${API_BASE}/admin/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(apiKey),
  });
  if (!res.ok) throw new Error(`Create API key failed: ${res.status}`);
  return res.json();
}

export async function deleteApiKeyViaApi(token: string, keyId: string): Promise<void> {
  await fetch(`${BASE_URL}${API_BASE}/admin/api-keys/${keyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createWebhookViaApi(
  token: string,
  webhook: { name: string; url: string; events?: string[] },
): Promise<string> {
  const res = await fetch(`${BASE_URL}${API_BASE}/admin/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(webhook),
  });
  if (!res.ok) throw new Error(`Create webhook failed: ${res.status}`);
  const data = await res.json();
  return data.webhook_id;
}

export async function deleteWebhookViaApi(token: string, webhookId: string): Promise<void> {
  await fetch(`${BASE_URL}${API_BASE}/admin/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

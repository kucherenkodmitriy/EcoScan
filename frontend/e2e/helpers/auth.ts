import { type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_STATE_PATH = path.join(__dirname, '..', '.auth', 'user.json');

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input#email').fill(email);
  await page.locator('input#password').fill(password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('/dashboard');
}

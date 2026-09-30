import { expect, test, type Page } from '@playwright/test';

const DEMO_EMAIL = 'sarah.chen@acme-bio.example';
const DEMO_PASSWORD = 'cytolab-demo';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('#email', DEMO_EMAIL);
  await page.fill('#password', DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
}

test('unauthenticated users are redirected to sign in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});

test('a scientist can sign in and see the R&D overview', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText(/R&D programs/i)).toBeVisible();
  // Metric tiles render numbers.
  await expect(page.getByText('Active projects')).toBeVisible();
});

test('navigating to projects and opening one shows the workspace', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.waitForURL('**/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  await page.getByText('CAR-T Cell Engineering').first().click();
  await expect(page).toHaveURL(/\/projects\/CART-001/);
  await expect(page.getByRole('tab', { name: /Milestones/ })).toBeVisible();
});

test('opening an experiment shows its tabbed workspace', async ({ page }) => {
  await signIn(page);
  await page.goto('/experiments');
  await expect(page.getByRole('heading', { name: 'Experiments' })).toBeVisible();

  // Open the first experiment row.
  await page.locator('table tbody tr a').first().click();
  await expect(page).toHaveURL(/\/experiments\/EXP-\d+/);
  await expect(page.getByRole('tab', { name: /Overview/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Protocol/ })).toBeVisible();
});

test('global search returns results', async ({ page }) => {
  await signIn(page);
  await page.goto('/search?q=transduction');
  await expect(page.getByText(/results for/i)).toBeVisible();
});

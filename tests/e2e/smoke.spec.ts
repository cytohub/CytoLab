import { expect, test, type Page } from '@playwright/test';

// The demo workspace starts empty, so tests that need records create them.
const DEMO_EMAIL = 'demo-scientist@cytohub.example';
const DEMO_PASSWORD = 'cytolab-demo';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('#email', DEMO_EMAIL);
  await page.fill('#password', DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
}

/** A project with one experiment, created through the API the UI uses. */
async function createRecords(page: Page): Promise<{ code: string; projectName: string; displayId: string; experimentName: string }> {
  const headers = { origin: new URL(page.url()).origin };
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const userId: string = session.data.session.user.id;
  const types = await (await page.request.get('/api/v1/experiment-types')).json();
  const stamp = Date.now().toString(36).toUpperCase();

  const projectName = `Smoke project ${stamp}`;
  const project = await page.request.post('/api/v1/projects', {
    headers,
    data: { name: projectName, code: `SMOKE-${stamp}`, ownerId: userId, status: 'active', priority: 'medium' },
  });
  expect(project.status()).toBe(201);
  const { data: createdProject } = await project.json();

  const experimentName = `Transduction run ${stamp}`;
  const experiment = await page.request.post('/api/v1/experiments', {
    headers,
    data: { projectId: createdProject.id, experimentTypeId: types.data[0].id, name: experimentName, researcherId: userId, status: 'planned', priority: 'medium' },
  });
  expect(experiment.status()).toBe(201);
  const { data: createdExperiment } = await experiment.json();
  return { code: createdProject.code, projectName, displayId: createdExperiment.displayId, experimentName };
}

test('unauthenticated users are redirected to sign in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});

test('the sign-in page offers only the demo accounts', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Demo Scientist').first()).toBeVisible();
  await expect(page.getByText('Rajib Biswas')).toHaveCount(0);
});

test('a visitor can sign in and see the R&D overview', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText(/R&D programs/i)).toBeVisible();
});

test('a created project opens in its workspace', async ({ page }) => {
  await signIn(page);
  const { code, projectName } = await createRecords(page);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.waitForURL('**/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  await page.getByText(projectName).first().click();
  await expect(page).toHaveURL(new RegExp(`/projects/${code}`));
  await expect(page.getByRole('tab', { name: /Milestones/ })).toBeVisible();
});

test('a created experiment opens in its tabbed workspace', async ({ page }) => {
  await signIn(page);
  const { displayId } = await createRecords(page);
  await page.goto(`/experiments/${displayId}`);
  await expect(page.getByRole('tab', { name: /Overview/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Protocol/ })).toBeVisible();
});

test('global search finds a created experiment', async ({ page }) => {
  await signIn(page);
  const { experimentName, displayId } = await createRecords(page);
  await page.goto(`/search?q=${encodeURIComponent(experimentName)}`);
  await expect(page.getByText(/results for/i)).toBeVisible();
  await expect(page.getByText(displayId).first()).toBeVisible();
});

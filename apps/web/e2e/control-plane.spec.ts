import { test, expect } from '@playwright/test';

test.describe('Nexus control plane', () => {
  test('loads overview and core navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /deploy the application/i })).toBeVisible();

    for (const label of ['Projects', 'Services', 'Deployments', 'Domains', 'Observability']) {
      const button = page.getByRole('button', { name: label, exact: true });
      await expect(button).toBeVisible();
      await button.click();
      await expect(button).toHaveClass(/active/);
      await expect(page.locator('h1')).toContainText(label);
    }
  });

  test('opens deployment workflow and exposes service choices', async ({ page }) => {
    await page.goto('/deploy');
    await expect(page).toHaveURL(/\/deploy$/);
    await expect(page.getByRole('heading', { name: /deploy a repository service/i })).toBeVisible();
    await expect(page.getByLabel('Git repository')).toBeVisible();

    const serviceType = page.getByLabel('Service type');
    await expect(serviceType).toHaveValue('web');
    await expect(serviceType.locator('option')).toHaveText([
      'Web / API',
      'Worker',
      'Private service',
      'Cron / job',
    ]);

    await serviceType.selectOption('worker');
    await expect(page.getByLabel('Health path')).toBeDisabled();
  });

  test('login page renders without a startup API health gate', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveAttribute('minlength', '8');

    // The login page must render the form even when the API gateway is unavailable.
    await expect(page.getByText(/nexus api is temporarily unavailable/i)).toHaveCount(0);

    await page.getByRole('button', { name: /create one/i }).click();
    await expect(page.getByRole('heading', { name: /create your nexus account/i })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
  });
});

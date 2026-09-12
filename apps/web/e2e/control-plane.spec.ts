import { test, expect } from '@playwright/test';

test.describe('Nexus control plane', () => {
  test('loads overview and core navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /deploy the application/i })).toBeVisible();

    for (const label of ['Projects', 'Services', 'Deployments', 'Domains', 'Observability']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }
  });

  test('opens deployment workflow and exposes service choices', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new deployment/i }).click();
    await expect(page.getByRole('heading', { name: /deploy any application/i })).toBeVisible();
    await expect(page.getByLabel('Project name')).toBeVisible();
    await expect(page.getByLabel('Git repository URL')).toBeVisible();

    const serviceType = page.getByLabel('Service type');
    await expect(serviceType).toHaveValue('web');
    await expect(serviceType.locator('option')).toHaveText([
      'Web / frontend / API',
      'Worker',
      'Private service',
      'Cron / job',
    ]);

    await serviceType.selectOption('worker');
    await expect(page.getByLabel('Host port')).toBeDisabled();
    await expect(page.getByLabel('Health path')).toBeDisabled();
    await page.getByRole('button', { name: /close/i }).click();
  });

  test('login page renders safe OAuth state and email authentication form', async ({ page }) => {
    const providerResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/providers'));
    await page.goto('/login');
    await providerResponse;

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with github|github sign-in unavailable/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google|google sign-in unavailable/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveAttribute('minlength', '8');

    await page.getByRole('button', { name: /create one/i }).click();
    await expect(page.getByRole('heading', { name: /create your nexus account/i })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
  });
});

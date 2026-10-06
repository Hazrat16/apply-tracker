import { expect, test } from '@playwright/test';
import { startDemo } from './helpers';

test('try the demo and check a resume match', async ({ page }) => {
  await startDemo(page);
  await expect(
    page.getByRole('link', { name: 'Senior Backend Engineer at Northwind Labs' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Senior Backend Engineer' }).first().click();
  await page.getByRole('tab', { name: 'AI assistant' }).click();
  await expect(page.getByText(/free built-in matcher/)).toBeVisible();

  await page.getByRole('button', { name: 'Check match' }).click();
  await expect(page.getByText('out of 100')).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Missing' })).toBeVisible();

  await page.getByRole('button', { name: 'Draft cover letter' }).click();
  await expect(page.getByLabel('Cover letter text')).toHaveValue(/Dear Hiring Manager/);
});

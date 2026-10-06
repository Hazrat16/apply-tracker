import { expect, test } from '@playwright/test';
import { expectAccessible, startDemo } from './helpers';

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const path of ['/', '/login', '/register', '/forgot-password']) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`signed-in pages (${colorScheme} theme)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await startDemo(page);
      for (const path of ['/board', '/applications', '/dashboard', '/calendar', '/settings']) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        await page.waitForLoadState('networkidle');
        await test.step(path, () => expectAccessible(page));
      }

      await page.goto('/board');
      await page
        .getByRole('link', { name: /^Senior Backend Engineer at/ })
        .first()
        .click();
      await page.waitForLoadState('networkidle');
      await test.step('application detail', () => expectAccessible(page));
      await page.getByRole('tab', { name: 'AI assistant' }).click();
      await page.getByRole('button', { name: 'Check match' }).click();
      await expect(page.getByText('out of 100')).toBeAttached();
      await test.step('AI assistant', () => expectAccessible(page));
    });
  }
});

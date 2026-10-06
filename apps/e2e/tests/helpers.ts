import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

export async function signUp(page: Page, email = uniqueEmail()) {
  await page.goto('/register');
  await page.getByLabel('Name').fill('Playwright User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-1');
  await page.getByLabel('Confirm password').fill('correct-horse-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/board$/);
  return email;
}

export async function startDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(
    page
      .getByText('You’re exploring a demo account')
      .or(page.getByText("You're exploring a demo account")),
  ).toBeVisible();
}

/** Fails on WCAG 2.2 A/AA violations that axe can detect automatically. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

import { expect, type Page, test } from '@playwright/test';
import { startDemo } from './helpers';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('pages fit a phone screen', async ({ page }) => {
  await page.goto('/');
  expect(await noHorizontalScroll(page)).toBe(true);

  await startDemo(page);
  // The board scrolls sideways inside its own container, not the whole page.
  for (const path of ['/board', '/applications', '/dashboard', '/calendar', '/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await noHorizontalScroll(page), `${path} scrolls horizontally`).toBe(true);
  }
});

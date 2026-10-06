import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test('sign up, add an application and move it on the board', async ({ page }) => {
  await signUp(page);

  await page.getByRole('button', { name: 'Add application to Wishlist' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add application' });
  await dialog.getByLabel('Company').fill('Globex');
  await dialog.getByLabel('Role').fill('Platform Engineer');
  await dialog.getByRole('button', { name: 'Add application' }).click();
  await expect(dialog).toBeHidden();

  const wishlist = page.getByRole('region', { name: /^Wishlist/ });
  const applied = page.getByRole('region', { name: /^Applied/ });
  const card = page.getByRole('link', { name: 'Platform Engineer at Globex' });
  await expect(wishlist.getByRole('link', { name: 'Platform Engineer at Globex' })).toBeVisible();

  // Move it with the keyboard: pick up, one column right, drop.
  await card.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  // The card moves into the next column while it is still held.
  await expect(applied.getByRole('link', { name: 'Platform Engineer at Globex' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('Dropped Platform Engineer at Globex in Applied')).toBeAttached();
  await expect(applied.getByRole('link', { name: 'Platform Engineer at Globex' })).toBeVisible();

  // The move was saved.
  await page.reload();
  await expect(applied.getByRole('link', { name: 'Platform Engineer at Globex' })).toBeVisible();
  await expect(wishlist.getByRole('link', { name: 'Platform Engineer at Globex' })).toHaveCount(0);
});

test('signs out other devices', async ({ browser }) => {
  const laptop = await browser.newPage();
  const email = await signUp(laptop);

  const phone = await browser.newPage();
  await phone.goto('/login');
  await phone.getByLabel('Email').fill(email);
  await phone.getByLabel('Password', { exact: true }).fill('correct-horse-1');
  await phone.getByRole('button', { name: 'Sign in' }).click();
  await expect(phone).toHaveURL(/\/board$/);

  await laptop.goto('/settings');
  await laptop
    .getByRole('button', { name: /^Sign out .+ on / })
    .first()
    .click();
  await expect(laptop.getByText('Signed out that device')).toBeVisible();

  await phone.goto('/settings');
  await expect(phone).toHaveURL(/\/login/);
});

import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('names the shared elements for the cross-document locale transition', async ({
  page,
}) => {
  await page.goto('/en/');

  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveCSS('view-transition-name', 'hero-heading');
});

test('carries the visitor between locales with the content intact', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.getByRole('banner').getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('keeps the locale switch working without a View Transitions API', async ({
  browser,
}) => {
  // The transition is decoration on a plain link; a browser without the API
  // must still navigate.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, 'startViewTransition');
  });
  const page = await context.newPage();

  await page.goto('/en/');
  await page.getByRole('banner').getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await context.close();
});

import { expect, test } from '@playwright/test';

test.use({
  deviceScaleFactor: 1,
  viewport: { width: 600, height: 900 },
});

test('selects the 480px portrait candidate for the rendered mobile hero width', async ({
  page,
}) => {
  await page.goto('/en/');
  const portrait = page.locator('[data-hero="landing"] picture img');

  await expect(portrait).toBeVisible();
  await expect
    .poll(() => portrait.evaluate((image) => image.currentSrc))
    .toMatch(/\/assets\/portrait\/portrait-480\.avif$/u);

  const renderedWidth = await portrait.evaluate(
    (image) => image.getBoundingClientRect().width,
  );
  expect(renderedWidth).toBe(446);
});

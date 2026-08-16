import { expect, test } from '@playwright/test';

/*
 * Clicking a nav anchor writes a hash that then never changes: scrolling away
 * and reloading, or switching language, returned the visitor to the stale
 * anchor. The hash has to follow the section actually in view.
 */
test('the url hash follows the section in view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/', { waitUntil: 'networkidle' });

  await expect.poll(() => new URL(page.url()).hash).toBe('');

  for (const id of ['work', 'about', 'contact']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await expect
      .poll(() => new URL(page.url()).hash, { timeout: 4000 })
      .toBe(`#${id}`);
  }

  // Back at the top the hash must clear, so a reload lands at the top again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await expect.poll(() => new URL(page.url()).hash, { timeout: 4000 }).toBe('');
});

test('following the hash does not add history entries', async ({ page }) => {
  await page.goto('/en/', { waitUntil: 'networkidle' });
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).not.toBe('/en/');
});

import { expect, test } from '@playwright/test';

/*
 * A transform turns a `position: sticky` element into its own containing
 * block, so the sticky offset resolves against a moving reference. While the
 * enter animation translated the copy column it juddered on every scroll into
 * a project scene. The column may fade in, but it must never be moved.
 */
test('the sticky project column is never transformed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/', { waitUntil: 'networkidle' });

  const scene = page.locator('[data-project-slug="stoic"]');
  const copy = scene.locator('[data-motion-sticky]');
  await expect(copy).toHaveCSS('position', 'sticky');

  const transforms = await page.evaluate(async () => {
    const column = document.querySelector(
      '[data-project-slug="stoic"] [data-motion-sticky]',
    ) as HTMLElement;
    const seen: string[] = [];
    for (let i = 0; i < 45; i += 1) {
      window.scrollBy(0, 60);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      seen.push(getComputedStyle(column).transform);
    }
    return [...new Set(seen)];
  });

  expect(
    transforms.filter((value) => value !== 'none'),
    'the sticky column was transformed while scrolling',
  ).toEqual([]);
});

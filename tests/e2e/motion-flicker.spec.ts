import { expect, test } from '@playwright/test';

/*
 * The enter animation starts from `opacity: 0`, but nothing hid the scene
 * beforehand: a project scrolled into view was fully visible, then snapped to
 * transparent the moment it crossed the observer threshold and faded back in.
 * That flash is what reads as flicker while scrolling.
 */
test('project scenes never flash from visible to hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/', { waitUntil: 'networkidle' });

  const scene = page.locator('[data-project-slug="evercity"]');
  await expect(scene).toHaveAttribute('data-motion-project', 'true');

  // Far below the fold, so it has not been viewed yet.
  await expect(scene).not.toHaveAttribute('data-motion-viewed', 'true');

  const opacityBefore = await scene
    .locator('[data-motion-reveal="visual"]')
    .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(
    opacityBefore,
    'an unviewed scene must not be painted before its enter animation',
  ).toBe(0);

  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-motion-viewed', 'true');
  await page.waitForTimeout(1200);

  const opacityAfter = await scene
    .locator('[data-motion-reveal="visual"]')
    .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(opacityAfter).toBe(1);
});

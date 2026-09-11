import { expect, test } from '@playwright/test';

/**
 * The hero portrait used to be a large eager image whose rendered width tracked
 * the viewport, and this spec existed to prove the browser picked a candidate
 * that matched that width rather than the largest file on offer.
 *
 * The portrait is now a fixed 56x70 avatar beside the name (plan §3.2). The
 * question it answers is therefore the same one with different arithmetic: a
 * 56 CSS-pixel box must still be served the smallest generated candidate, at
 * 1x and at 2x, instead of the 1024px file — and the box has to be reserved
 * from the markup so nothing shifts when the image arrives.
 */
const portraitBox = { width: 56, height: 70 };

test.use({
  deviceScaleFactor: 1,
  viewport: { width: 600, height: 900 },
});

test('serves the smallest portrait candidate to the 56px hero avatar', async ({
  page,
}) => {
  await page.goto('/en/');
  const portrait = page.locator('[data-hero="landing"] picture img');

  await expect(portrait).toBeVisible();
  await expect
    .poll(() => portrait.evaluate((image) => image.currentSrc))
    .toMatch(/\/assets\/portrait\/portrait-480\.avif$/u);

  const box = await portrait.evaluate((image) => {
    const frame = image.closest('picture')!.getBoundingClientRect();
    const rect = image.getBoundingClientRect();
    return {
      frameWidth: frame.width,
      frameHeight: frame.height,
      width: rect.width,
      height: rect.height,
      intrinsicWidth: Number(image.getAttribute('width')),
      intrinsicHeight: Number(image.getAttribute('height')),
      sizes: image.getAttribute('sizes'),
      alt: image.getAttribute('alt'),
      decorative: Boolean(image.closest('[aria-hidden="true"]')),
    };
  });

  // Sub-pixel: the rendered box can land a rounding error away from the
  // declared one, which says nothing about whether the avatar kept its size.
  expect(box.frameWidth).toBeCloseTo(portraitBox.width, 1);
  expect(box.frameHeight).toBeCloseTo(portraitBox.height, 1);
  // The image fills the frame's content box, which is the frame less its 1px
  // rule on each side.
  expect(box.width).toBeCloseTo(portraitBox.width - 2, 1);
  expect(box.height).toBeCloseTo(portraitBox.height - 2, 1);
  expect(box.sizes).toBe('56px');

  /*
   * The declared intrinsic ratio has to match the box the CSS reserves, or the
   * browser reserves the wrong height before the image decodes and the whole
   * hero moves once it does.
   */
  expect(box.intrinsicWidth / box.intrinsicHeight).toBeCloseTo(
    portraitBox.width / portraitBox.height,
    3,
  );

  // Decorative: the name beside it is the content, so the avatar carries an
  // empty alt inside an aria-hidden container.
  expect(box.alt).toBe('');
  expect(box.decorative).toBe(true);
});

test('still serves the smallest candidate to a 2x avatar', async ({
  browser,
}) => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 600, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/en/');
  const portrait = page.locator('[data-hero="landing"] picture img');

  await expect(portrait).toBeVisible();
  // 56 CSS px at 2x is 112 device px; 480w is the smallest generated candidate
  // that covers it, so a retina phone must not be handed the 768 or 1024 file.
  await expect
    .poll(() => portrait.evaluate((image) => image.currentSrc))
    .toMatch(/\/assets\/portrait\/portrait-480\.avif$/u);

  await context.close();
});

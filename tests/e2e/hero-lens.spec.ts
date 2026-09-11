import { expect, test, type Page } from '@playwright/test';

/**
 * The hero's engineering lens (plan §5). These checks are about the things a
 * unit test cannot see: that the position really tracks the real pointer
 * against the real rect, that scrolling re-measures instead of reusing a
 * stale one, that touch and reduced motion leave the page static, and that
 * the decoration never gets between a visitor and the calls to action.
 */

const heroSelector = '[data-hero="landing"]';
const lensSelector = '[data-hero-blueprint="lens"]';
const baseSelector = '[data-hero-blueprint="base"]';

test.use({ viewport: { width: 1280, height: 900 } });

async function heroBox(page: Page) {
  const box = await page.locator(heroSelector).boundingBox();
  if (!box) throw new Error('the hero has no box');
  return box;
}

function readLensVariable(page: Page, property: string) {
  return page.$eval(
    heroSelector,
    (hero, name) => (hero as HTMLElement).style.getPropertyValue(name),
    property,
  );
}

async function lensNumber(page: Page, property: string) {
  return Number.parseFloat(await readLensVariable(page, property));
}

/** Waits for the damping loop to land on the point it was given. */
async function settledAt(page: Page, x: number, y: number) {
  await expect
    .poll(async () => {
      const lensX = await lensNumber(page, '--lens-x');
      const lensY = await lensNumber(page, '--lens-y');
      return Math.round(Math.max(Math.abs(lensX - x), Math.abs(lensY - y)));
    })
    .toBeLessThanOrEqual(1);
}

test('follows the mouse across the hero and reveals the drawing', async ({
  page,
}) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute(
    'data-motion-state',
    'enabled',
  );

  const box = await heroBox(page);
  // Resting: the drawing is there, the revealed copy is not.
  await expect(page.locator(baseSelector)).toHaveCSS('opacity', '0.1');
  await expect(page.locator(lensSelector)).toHaveCSS('opacity', '0');

  const first = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.5 };
  await page.mouse.move(first.x, first.y);
  await settledAt(page, first.x - box.x, first.y - box.y);
  await expect(page.locator(lensSelector)).toHaveCSS('opacity', '0.38');

  const afterFirst = await lensNumber(page, '--lens-x');

  const second = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.5 };
  await page.mouse.move(second.x, second.y, { steps: 12 });
  await settledAt(page, second.x - box.x, second.y - box.y);

  const afterSecond = await lensNumber(page, '--lens-x');
  expect(afterSecond - afterFirst).toBeGreaterThan(box.width * 0.4);

  // The revealed layer is the same drawing under a mask, not a bare circle:
  // it carries the same element count as the resting one.
  const [baseElements, lensElements] = await page.evaluate(
    ([base, lens]) => [
      document.querySelector(base)?.querySelectorAll('*').length ?? 0,
      document.querySelector(lens)?.querySelectorAll('*').length ?? 0,
    ],
    [baseSelector, lensSelector],
  );
  expect(lensElements).toBe(baseElements);
  expect(lensElements).toBeGreaterThan(20);
  await expect(page.locator(lensSelector)).toHaveCSS(
    'mask-image',
    /radial-gradient/,
  );
});

test('never moves the heading while the lens travels', async ({ page }) => {
  await page.goto('/en/');
  // The hero's own one-shot entry animation is unrelated to the lens; let it
  // finish so this measures the lens and nothing else.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== 'running'),
  );
  const heading = page.getByRole('heading', { level: 1 });
  const before = await heading.boundingBox();
  const box = await heroBox(page);

  for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
    await page.mouse.move(
      box.x + box.width * fraction,
      box.y + box.height * 0.55,
      { steps: 8 },
    );
  }
  await settledAt(page, box.width * 0.8, box.height * 0.55);

  const after = await heading.boundingBox();
  expect(after).toEqual(before);
});

test('lands where the pointer is instead of sliding in from a corner', async ({
  page,
}) => {
  await page.goto('/en/');
  const box = await heroBox(page);
  const entry = { x: box.x + 4, y: box.y + box.height / 2 };

  await page.mouse.move(entry.x, entry.y);

  // The very first sample is already at the pointer: no interpolation from a
  // corner, so the position is correct before the fade has finished.
  expect(await lensNumber(page, '--lens-x')).toBeCloseTo(entry.x - box.x, 0);
  expect(await lensNumber(page, '--lens-y')).toBeCloseTo(entry.y - box.y, 0);
});

test('re-measures the hero after a scroll instead of reusing a stale rect', async ({
  page,
}) => {
  await page.goto('/en/');
  const box = await heroBox(page);
  const point = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };

  await page.mouse.move(point.x, point.y);
  await settledAt(page, point.x - box.x, point.y - box.y);
  const before = await lensNumber(page, '--lens-y');

  const scrollBy = 120;
  await page.evaluate((distance) => window.scrollBy(0, distance), scrollBy);
  // Scrolling drops the cached rect and hides the lens until a fresh event.
  await expect.poll(() => readLensVariable(page, '--lens-opacity')).toBe('0');

  await page.mouse.move(point.x + 24, point.y, { steps: 4 });
  await expect
    .poll(() => readLensVariable(page, '--lens-opacity'))
    .toBe('0.38');
  const after = await lensNumber(page, '--lens-y');

  // Same client point, hero 120px higher: the offset inside the hero grows by
  // exactly the scroll distance. A stale rect would report the old value.
  expect(after - before).toBeCloseTo(scrollBy, 0);
});

test('hides the lens and stops the loop when the pointer leaves the hero', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const win = window as unknown as { __frames: number };
    win.__frames = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      win.__frames += 1;
      return original(callback);
    };
  });
  await page.goto('/en/');
  const box = await heroBox(page);

  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await settledAt(page, box.width * 0.5, box.height * 0.5);

  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height + 320, {
    steps: 6,
  });
  await expect.poll(() => readLensVariable(page, '--lens-opacity')).toBe('0');

  const idleFrames = await page.evaluate(
    () => (window as unknown as { __frames: number }).__frames,
  );
  await page.waitForTimeout(700);
  const laterFrames = await page.evaluate(
    () => (window as unknown as { __frames: number }).__frames,
  );

  // Nothing may keep a frame loop running once the pointer is gone.
  expect(laterFrames).toBe(idleFrames);
});

test('leaves the layer inert for touch pointers', async ({ page }) => {
  await page.goto('/en/');
  const box = await heroBox(page);
  const hero = page.locator(heroSelector);

  for (const type of ['pointerenter', 'pointermove'] as const) {
    await hero.dispatchEvent(type, {
      pointerType: 'touch',
      clientX: box.x + box.width * 0.5,
      clientY: box.y + box.height * 0.5,
      bubbles: type === 'pointermove',
    });
  }

  expect(await readLensVariable(page, '--lens-opacity')).toBe('');
  expect(await readLensVariable(page, '--lens-x')).toBe('');
  await expect(page.locator(lensSelector)).toHaveCSS('opacity', '0');
  // The resting drawing is still there on touch.
  await expect(page.locator(baseSelector)).toHaveCSS('opacity', '0.1');
});

test('leaves the layer inert under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/');
  const box = await heroBox(page);

  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
    steps: 8,
  });
  await page.waitForTimeout(300);

  expect(await readLensVariable(page, '--lens-opacity')).toBe('');
  await expect(page.locator(lensSelector)).toHaveCSS('opacity', '0');
  await expect(page.locator(baseSelector)).toHaveCSS('opacity', '0.1');
  // Navigation still works with the enhancement off.
  await page.getByRole('link', { name: 'View selected work' }).click();
  await expect(page).toHaveURL(/#work$/u);
});

test('keeps both calls to action clickable through the decoration', async ({
  page,
}) => {
  await page.goto('/en/');
  const primary = page.getByRole('link', { name: 'View selected work' });
  const box = await primary.boundingBox();
  if (!box) throw new Error('the primary action has no box');

  // The decoration takes no pointer events, so the topmost element at the
  // button's centre is the link itself.
  const topmostIsTheLink = await page.evaluate(
    (point) => {
      const element = document.elementFromPoint(point.x, point.y);
      return element?.closest('a[href="#work"]') !== null;
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(topmostIsTheLink).toBe(true);

  await primary.click();
  await expect(page).toHaveURL(/#work$/u);

  const secondary = page.getByRole('link', { name: 'Get in touch' });
  await secondary.click();
  await expect(page).toHaveURL(/#contact$/u);
});

import { expect, test } from '@playwright/test';
import { assertCoreContent, assertNoHorizontalOverflow } from './quality';

test.describe('desktop with motion allowed', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('runs the conductor and publishes the shared properties', async ({
    page,
  }) => {
    await page.goto('/en/');

    await expect
      .poll(() => page.locator('html').getAttribute('data-conductor'))
      .toBe('live');

    await page.mouse.move(200, 200);
    await page.mouse.move(900, 600);

    const properties = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        energy: style.getPropertyValue('--c-energy').trim(),
        sectionProgress: style.getPropertyValue('--c-section-progress').trim(),
        // Not published: writing a root custom property per frame invalidates
        // style for the whole document, and no rule reads this one.
        pointerX: style.getPropertyValue('--c-pointer-x').trim(),
      };
    });

    expect(properties.energy).not.toBe('');
    expect(properties.sectionProgress).not.toBe('');
    expect(properties.pointerX).toBe('');
    await assertCoreContent(page, 'en');
  });

  test('adds a decorative cursor that assistive technology never meets', async ({
    page,
  }) => {
    await page.goto('/en/');

    const cursor = page.locator('[data-conductor-cursor]');
    await expect(cursor).toHaveCount(1);
    await expect(cursor).toHaveAttribute('aria-hidden', 'true');
  });

  test('keeps the focus ring where the magnetic control will settle', async ({
    page,
  }) => {
    await page.goto('/en/');

    const cta = page.getByRole('link', { name: 'View selected work' });
    await cta.hover();
    await cta.focus();

    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS('outline-style', 'solid');
  });

  test('reveals every principle line rather than leaving copy hidden', async ({
    page,
  }) => {
    await page.goto('/en/');

    const principles = page.locator('[data-scene="principles"]');
    await principles.scrollIntoViewIfNeeded();

    // Opacity rather than toBeVisible, which counts a fully transparent
    // element as visible and so cannot see this failure.
    const lines = page.locator('[data-scene-line]');
    const count = await lines.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(lines.nth(index)).toHaveCSS('opacity', '1');
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('loads no motion runtime at all', async ({ page }) => {
    const scriptRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') {
        scriptRequests.push(request.url());
      }
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en/', { waitUntil: 'networkidle' });

    // Not merely idle: these visitors must never pay for gsap or lenis.
    expect(scriptRequests.filter((url) => url.includes('runtime'))).toEqual([]);
    await expect(page.locator('html')).not.toHaveAttribute('data-conductor');
    await expect(page.locator('[data-conductor-cursor]')).toHaveCount(0);
    await assertCoreContent(page, 'en');
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('keeps every hover-dependent enhancement off and the content whole', async ({
    page,
  }) => {
    await page.goto('/en/');

    await expect(page.locator('[data-conductor-cursor]')).toHaveCount(0);
    await assertCoreContent(page, 'en');
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('failure paths', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('leaves the page whole when the motion chunk cannot load', async ({
    page,
  }) => {
    // The chunk is the one file whose absence could plausibly break the page.
    // In particular the principle lines must not stay hidden: the CSS that
    // hides them is gated on an attribute only this chunk sets.
    await page.route('**/assets/runtime-*.js', (route) => route.abort());
    await page.goto('/en/', { waitUntil: 'networkidle' });

    await assertCoreContent(page, 'en');
    await assertNoHorizontalOverflow(page);

    /*
     * Opacity, not toBeVisible: Playwright treats a fully transparent element
     * as visible, so toBeVisible cannot detect this failure at all. The lines
     * are hidden with opacity, so that is what has to be asserted.
     */
    const lines = page.locator('[data-scene-line]');
    const count = await lines.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(lines.nth(index)).toHaveCSS('opacity', '1');
    }
  });

  test('throws nothing and requests nothing missing while scrolling the whole page', async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) =>
      failures.push(`pageerror: ${error.message}`),
    );
    page.on('response', (response) => {
      /*
       * Own-origin responses only. The Playwright build injects a placeholder
       * analytics key, so PostHog's asset host answers 404 for a project that
       * does not exist — a property of the test key, present long before this
       * layer, and nothing the page can do about it. A generic console-error
       * listener cannot tell the two apart: the message is just "Failed to
       * load resource" with no URL attached.
       */
      const url = new URL(response.url());
      if (url.origin !== new URL(page.url()).origin) return;
      if (response.status() >= 400) {
        failures.push(`${response.status()} ${url.pathname}`);
      }
    });

    await page.goto('/en/');
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });
    // Let anything the scroll started actually arrive, so this does not pass
    // by finishing before the failure it is looking for.
    await page.waitForLoadState('networkidle');

    expect(failures).toEqual([]);
  });
});

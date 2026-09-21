import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('reduced motion presents final states while preserving focus and hover feedback', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/');

  const heroLayer = page
    .locator('[data-motion-hero] [data-motion-enter]')
    .first();
  const projectLayer = page
    .locator('[data-motion-project] [data-motion-reveal]')
    .first();
  const stickyCopy = page
    .locator('[data-motion-project] [data-motion-sticky]')
    .first();

  await expect(heroLayer).toBeVisible();
  await expect(projectLayer).toBeVisible();
  await expect(heroLayer).toHaveCSS('animation-name', 'none');
  await expect(heroLayer).toHaveCSS('opacity', '1');
  await expect(heroLayer).toHaveCSS('transform', 'none');
  await expect(heroLayer).toHaveCSS('filter', 'none');
  await expect(projectLayer).toHaveCSS('animation-name', 'none');
  await expect(projectLayer).toHaveCSS('opacity', '1');
  await expect(projectLayer).toHaveCSS('transform', 'none');
  await expect(projectLayer).toHaveCSS('filter', 'none');
  await expect(stickyCopy).toHaveCSS('position', 'static');

  const primaryAction = page.getByRole('link', { name: 'View selected work' });
  const restingBackground = await primaryAction.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await primaryAction.hover();
  await expect
    .poll(() =>
      primaryAction.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(restingBackground);
  await primaryAction.focus();
  await expect(primaryAction).toHaveCSS('outline-style', 'solid');
});

// The reveal has to leave nothing behind. A filter or a transform that outlives
// the animation keeps the block on its own layer, and the text inside it is then
// rasterised from that layer rather than by the ordinary text path — which is
// the difference between crisp subpixel glyphs and slightly soft ones.
test('a scene that has finished revealing carries no filter, transform or layer', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute(
    'data-motion-state',
    'enabled',
  );

  const scene = page.locator('[data-motion-project]').first();
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-motion-viewed', 'true');

  const layers = scene.locator('[data-motion-reveal]');
  await expect(layers.first()).toBeVisible();
  // Longer than the reveal plus its widest stagger step, so every layer in the
  // scene has run to the end by the time this reads their styles.
  await page.waitForTimeout(900);

  for (const layer of await layers.all()) {
    await expect(layer).toHaveCSS('filter', 'none');
    await expect(layer).toHaveCSS('transform', 'none');
    await expect(layer).toHaveCSS('opacity', '1');
    await expect(layer).toHaveCSS('will-change', 'auto');
  }
});

// A staggered layer waits for its turn, and the rule that hides an unviewed
// scene stops applying the instant the scene is marked viewed. Without a
// backwards fill covering the delay the layer would paint one full-strength,
// unblurred frame in that gap and only then jump to the start of its animation.
test('a staggered layer holds the first frame of the reveal while its delay runs', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/');

  const scene = page.locator('[data-motion-project]').first();
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-motion-viewed', 'true');

  const visual = scene.locator('[data-motion-reveal="visual"]').first();
  const duringDelay = await visual.evaluate((element) => {
    const [reveal] = element.getAnimations();
    if (!reveal) throw new Error('The visual layer is running no reveal');
    reveal.pause();
    // Anywhere inside the delay: the animation has not started, so only a
    // backwards fill can put the element in its starting state here.
    reveal.currentTime = 10;
    const style = getComputedStyle(element);
    return { filter: style.filter, opacity: style.opacity };
  });

  expect(duringDelay.filter).toMatch(/^blur\(/);
  expect(duringDelay.opacity).toBe('0');
});

test('sustained pointer motion stays responsive under four-times CPU throttling', async ({
  page,
}) => {
  const browserErrors: Error[] = [];
  page.on('pageerror', (error) => browserErrors.push(error));
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto('/en/');
  // Only the side-by-side scenes have a copy column to make sticky.
  const stickyProject = page
    .locator('[data-motion-project]:has([data-motion-sticky])')
    .first();
  const projectVisual = stickyProject.locator('[data-motion-parallax]');
  await stickyProject.scrollIntoViewIfNeeded();

  await expect(stickyProject).toBeVisible();
  await expect(stickyProject.locator('[data-motion-sticky]')).toHaveCSS(
    'position',
    'sticky',
  );
  const bounds = await projectVisual.boundingBox();
  if (!bounds) throw new Error('Project visual did not produce layout bounds');
  const frameGaps = await projectVisual.evaluate(async (element) => {
    const bounds = element.getBoundingClientRect();
    const gaps: number[] = [];
    let previousFrame = performance.now();

    for (let frame = 0; frame < 120; frame += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame((now) => {
          gaps.push(now - previousFrame);
          previousFrame = now;
          const progress = frame / 119;
          element.dispatchEvent(
            new PointerEvent('pointermove', {
              bubbles: true,
              clientX: bounds.left + bounds.width * progress,
              clientY:
                bounds.top + bounds.height * (0.5 + Math.sin(frame / 8) * 0.4),
            }),
          );
          resolve();
        });
      });
    }

    return gaps;
  });
  await expect
    .poll(() =>
      projectVisual.evaluate((element) =>
        Number.parseFloat(
          element.style.getPropertyValue('--motion-parallax-x'),
        ),
      ),
    )
    .toBeGreaterThan(3);
  const parallaxOffset = await projectVisual.evaluate((element) =>
    Number.parseFloat(element.style.getPropertyValue('--motion-parallax-x')),
  );
  expect(parallaxOffset).toBeLessThanOrEqual(4);
  const sortedFrameGaps = [...frameGaps].sort((a, b) => a - b);
  const percentile95 =
    sortedFrameGaps[Math.floor((sortedFrameGaps.length - 1) * 0.95)];
  const maximumFrameGap = Math.max(...frameGaps);
  expect(percentile95).toBeLessThan(50);
  expect(maximumFrameGap).toBeLessThan(150);
  expect(browserErrors).toEqual([]);
});

test('sticky storytelling stays off at tablet width and never captures scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 700 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/');

  const stickyProject = page
    .locator('[data-motion-project]:has([data-motion-sticky])')
    .first();
  await stickyProject.scrollIntoViewIfNeeded();
  await expect(stickyProject.locator('[data-motion-sticky]')).toHaveCSS(
    'position',
    'static',
  );

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 420);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrollBefore);
});

test('missing observers never hide project content', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/en/');

  const projects = page.locator('[data-motion-project]');
  await expect(projects).toHaveCount(4);
  for (const project of await projects.all()) {
    await expect(project).toBeVisible();
    await expect(project.locator('h3')).toBeVisible();
  }
});

test('missing matchMedia leaves every enhancement in its complete final state', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/en/');

  await expect(page.locator('html')).not.toHaveAttribute(
    'data-motion-state',
    'enabled',
  );
  const heroLayer = page
    .locator('[data-motion-hero] [data-motion-enter]')
    .first();
  const projectLayer = page
    .locator('[data-motion-project] [data-motion-reveal]')
    .first();
  const stickyCopy = page
    .locator('[data-motion-project] [data-motion-sticky]')
    .first();
  const parallaxLayer = page.locator('[data-motion-parallax-layer]').first();

  for (const layer of [heroLayer, projectLayer, parallaxLayer]) {
    await expect(layer).toBeVisible();
    await expect(layer).toHaveCSS('animation-name', 'none');
    await expect(layer).toHaveCSS('opacity', '1');
    await expect(layer).toHaveCSS('transform', 'none');
  }
  await expect(stickyCopy).toHaveCSS('position', 'static');
});

// Nothing on the page loops forever: ambient motion costs battery and reads as
// a page that never settles.
test('runs no endlessly looping animation anywhere on the page', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute(
    'data-motion-state',
    'enabled',
  );

  const looping = await page.evaluate(() => {
    const offenders: string[] = [];
    const describe = (element: Element, pseudo: string) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${pseudo}`;

    for (const element of document.querySelectorAll('*')) {
      for (const pseudo of ['', '::before', '::after']) {
        const style = getComputedStyle(element, pseudo || null);
        if (style.animationName === 'none') continue;
        const counts = style.animationIterationCount.split(',');
        if (counts.some((count) => count.trim() === 'infinite')) {
          offenders.push(
            `${describe(element, pseudo)} runs ${style.animationName}`,
          );
        }
      }
    }

    return offenders;
  });

  expect(looping).toEqual([]);
});

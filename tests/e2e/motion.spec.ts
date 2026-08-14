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
  await expect(projectLayer).toHaveCSS('animation-name', 'none');
  await expect(projectLayer).toHaveCSS('opacity', '1');
  await expect(projectLayer).toHaveCSS('transform', 'none');
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

test('motion APIs remain progressive under four-times CPU throttling', async ({
  page,
}) => {
  const browserErrors: Error[] = [];
  page.on('pageerror', (error) => browserErrors.push(error));
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto('/en/');
  const firstProject = page.locator('[data-motion-project]').first();
  const projectVisual = firstProject.locator('[data-motion-parallax]');
  await firstProject.scrollIntoViewIfNeeded();

  await expect(firstProject).toBeVisible();
  await expect(firstProject.locator('[data-motion-sticky]')).toHaveCSS(
    'position',
    'sticky',
  );
  const bounds = await projectVisual.boundingBox();
  if (!bounds) throw new Error('Project visual did not produce layout bounds');
  await page.mouse.move(
    bounds.x + bounds.width - 1,
    bounds.y + bounds.height / 2,
  );
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

  const frameDelay = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const startedAt = performance.now();
        requestAnimationFrame(() => resolve(performance.now() - startedAt));
      }),
  );
  expect(frameDelay).toBeLessThan(1000);
  expect(browserErrors).toEqual([]);
});

test('sticky storytelling stays off at tablet width and never captures scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 700 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/');

  const firstProject = page.locator('[data-motion-project]').first();
  await firstProject.scrollIntoViewIfNeeded();
  await expect(firstProject.locator('[data-motion-sticky]')).toHaveCSS(
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

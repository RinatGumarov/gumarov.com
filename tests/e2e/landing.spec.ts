import { expect, test, type Page } from '@playwright/test';
import { getContent, type Locale } from '../../src/content';
import {
  assertCoreContent,
  assertNoHorizontalOverflow,
  assertVisibleFocus,
  localePath,
  qualityLocales,
  qualityViewports,
} from './quality';

for (const locale of qualityLocales) {
  for (const viewport of qualityViewports) {
    test.describe(`${locale} ${viewport.name} landing`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      test('navigates sections, exposes contacts, and stays within the viewport', async ({
        page,
      }) => {
        const content = getContent(locale);
        await page.goto(localePath(locale));

        await assertCoreContent(page, locale);
        await assertNoHorizontalOverflow(page);

        const primaryNav = page.getByRole('navigation', {
          name: locale === 'ru' ? 'Основная навигация' : 'Primary navigation',
        });
        await primaryNav.getByRole('link', { name: content.nav.work }).click();
        await expect(page).toHaveURL(/#work$/u);
        await expect(page.locator('#work')).toBeInViewport();

        await primaryNav.getByRole('link', { name: content.nav.about }).click();
        await expect(page).toHaveURL(/#about$/u);
        await expect(page.locator('#about')).toBeInViewport();

        await primaryNav
          .getByRole('link', { name: content.nav.contact })
          .click();
        await expect(page).toHaveURL(/#contact$/u);
        await expect(page.locator('#contact')).toBeInViewport();
      });

      test('keeps reduced-motion content in its final visible state', async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(localePath(locale));

        await assertCoreContent(page, locale);
        await expect(page.locator('html')).not.toHaveAttribute(
          'data-motion-state',
          'enabled',
        );
        await expect(page.getByRole('heading', { level: 1 })).toHaveCSS(
          'opacity',
          '1',
        );
      });
    });
  }
}

test('persists an explicit language choice from the root', async ({ page }) => {
  await page.goto('/en/');
  await page.getByRole('banner').getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-locale', 'ru');

  await page.goto('/');
  await expect(page).toHaveURL(/\/ru\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-locale', 'ru');
});

test('preserves the current hash when switching locales', async ({ page }) => {
  await page.goto('/en/#contact');
  await page.getByRole('banner').getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/#contact$/u);
  await expect(page.locator('#contact')).toBeInViewport();
});

test('exposes official project destinations in both locales', async ({
  page,
}) => {
  for (const locale of qualityLocales) {
    await page.goto(localePath(locale));
    const content = getContent(locale);

    for (const project of content.projects) {
      await expect(
        page.getByRole('link', { name: project.name }),
      ).toHaveAttribute('href', project.href);
      await expect(
        page.getByRole('link', { name: project.name }),
      ).toHaveAttribute('target', '_blank');
      await expect(
        page.getByRole('link', { name: project.name }),
      ).toHaveAttribute('rel', /noopener/u);
    }
  }
});

test('uses a stacked header on the phone and a single-row header on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');
  const phoneLayout = await readHeaderLayout(page, 'en');
  expect(phoneLayout.primaryTop).toBeGreaterThan(
    phoneLayout.identityBottom - 4,
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/');
  const desktopLayout = await readHeaderLayout(page, 'en');
  expect(
    Math.abs(desktopLayout.primaryTop - desktopLayout.identityTop),
  ).toBeLessThan(12);
});

test('completes a keyboard traversal with visible focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  await assertVisibleFocus(page);

  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'View selected work' }),
  ).toBeFocused();
  await assertVisibleFocus(page);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Get in touch' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#contact$/u);
  await expect(page.locator('#contact')).toBeInViewport();
});

async function readHeaderLayout(page: Page, locale: Locale) {
  const identity = page.getByRole('link', { name: 'Rinat Gumarov — home' });
  const primary = page.getByRole('navigation', {
    name: locale === 'ru' ? 'Основная навигация' : 'Primary navigation',
  });
  const identityBox = await identity.boundingBox();
  const primaryBox = await primary.boundingBox();

  if (!identityBox || !primaryBox) {
    throw new Error('Header landmarks did not produce layout bounds');
  }

  return {
    identityTop: identityBox.y,
    identityBottom: identityBox.y + identityBox.height,
    primaryTop: primaryBox.y,
  };
}

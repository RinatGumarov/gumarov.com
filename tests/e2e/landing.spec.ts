import { expect, test, type Page } from '@playwright/test';
import { getContent } from '../../src/content';
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
        for (const [label, id] of [
          [content.nav.work, 'work'],
          [content.nav.about, 'about'],
          [content.nav.contact, 'contact'],
        ]) {
          await primaryNav.getByRole('link', { name: label }).click();
          await expect(page).toHaveURL(new RegExp(`#${id}$`, 'u'));
          await expect(page.locator(`#${id}`)).toBeInViewport();
        }
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
});

test('sends a Russian-language browser from the root to the Russian page', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();

  await page.goto('/');

  await expect(page).toHaveURL(/\/ru\/$/u);
  await context.close();
});

test('preserves the current hash when switching locales', async ({ page }) => {
  await page.goto('/en/#contact');
  await page.getByRole('banner').getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/#contact$/u);
  await expect(page.locator('#contact')).toBeInViewport();
});

test('requests both font subsets with the document', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.woff2')) {
      fontRequests.push(request.url());
    }
  });

  await page.goto('/en/', { waitUntil: 'commit' });
  for (const subset of ['/Onest-Subset.woff2', '/IBMPlexMono-Subset.woff2']) {
    await expect
      .poll(() => fontRequests.some((url) => url.endsWith(subset)))
      .toBe(true);
  }

  // The full variable faces are 82 KB each and still in the repository for the
  // social cards. Shipping one to a visitor would undo what the subsets buy.
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  expect(fontRequests.filter((url) => url.includes('-Variable'))).toEqual([]);
});

test.describe('keyboard traversal', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('reaches the skip link, the nav, the language switch and a project', async ({
    page,
  }) => {
    await page.goto('/en/');

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to content' }),
    ).toBeFocused();
    await assertVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await page.goto('/en/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Rinat Gumarov — home' }),
    ).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page
        .getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'Work' }),
    ).toBeFocused();

    const languageNav = page
      .locator('header')
      .getByRole('navigation', { name: 'Language selection' });
    for (let press = 0; press < 3; press += 1) await page.keyboard.press('Tab');
    await expect(
      languageNav.getByRole('link', { name: 'English' }),
    ).toBeFocused();

    const projectLink = page.getByRole('link', {
      name: 'TradingView',
      exact: true,
    });
    await tabUntilFocused(page, projectLink);
    await assertVisibleFocus(page);
  });

  test('moves focus to main content from the Russian skip link', async ({
    page,
  }) => {
    await page.goto('/ru/');

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Перейти к содержанию' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});

async function tabUntilFocused(
  page: Page,
  locator: ReturnType<Page['getByRole']>,
  maximumTabs = 24,
) {
  for (let attempt = 0; attempt < maximumTabs; attempt += 1) {
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press('Tab');
  }

  throw new Error('Keyboard traversal never reached the expected control');
}

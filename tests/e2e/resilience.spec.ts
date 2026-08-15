import { test, type Page } from '@playwright/test';
import {
  assertCoreContent,
  localePath,
  projectHosts,
  qualityLocales,
} from './quality';

for (const locale of qualityLocales) {
  test.describe(`${locale} resilience`, () => {
    test('blocked images still expose core text and contact links', async ({
      page,
    }) => {
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() === 'image') {
          await route.abort();
          return;
        }
        await route.continue();
      });
      await page.goto(localePath(locale));
      await assertCoreContent(page, locale);
    });

    test('blocked PostHog still exposes core text and contact links', async ({
      page,
    }) => {
      await page.route('https://eu.i.posthog.com/**', (route) =>
        route.abort('blockedbyclient'),
      );
      await page.goto(localePath(locale));
      await assertCoreContent(page, locale);
    });

    test('storage access failures still expose core text and contact links', async ({
      page,
    }) => {
      await installThrowingStorage(page);
      await page.goto(localePath(locale));
      await assertCoreContent(page, locale);
    });

    test('a missing IntersectionObserver still exposes core text and contact links', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'IntersectionObserver', {
          configurable: true,
          value: undefined,
        });
      });
      await page.goto(localePath(locale));
      await assertCoreContent(page, locale);
    });

    test('offline project hosts still expose core text and contact links', async ({
      page,
    }) => {
      for (const host of projectHosts) {
        await page.route(host, (route) => route.abort('internetdisconnected'));
      }
      await page.goto(localePath(locale));
      await assertCoreContent(page, locale);
    });
  });

  test.describe(`${locale} without JavaScript`, () => {
    test.use({ javaScriptEnabled: false });

    test('prerendered markup still exposes core text and contact links', async ({
      page,
    }) => {
      await page.goto(localePath(locale), { waitUntil: 'domcontentloaded' });
      await assertCoreContent(page, locale);
    });
  });
}

async function installThrowingStorage(page: Page) {
  await page.addInitScript(() => {
    const unavailable = () => {
      throw new Error('Storage is unavailable');
    };
    const storage = {
      get length() {
        return unavailable();
      },
      key: unavailable,
      getItem: unavailable,
      setItem: unavailable,
      removeItem: unavailable,
      clear: unavailable,
    };

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => storage,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => storage,
    });
  });
}

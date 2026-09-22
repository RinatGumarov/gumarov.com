import { expect, test } from '@playwright/test';
import { localePath, qualityLocales, qualityViewports } from './quality';

for (const locale of qualityLocales) {
  for (const viewport of qualityViewports) {
    test.describe(`${locale} ${viewport.name} visual`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
      });

      test.skip(
        process.platform !== 'darwin',
        'Full-page visual baselines are recorded on Darwin; Linux snapshots are not in this commit.',
      );

      test('matches the reviewed full-page snapshot', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(localePath(locale), { waitUntil: 'networkidle' });
        // Both faces are preloaded, so on this machine they are always in hand
        // — but a baseline recorded while one was still in flight would record
        // the fallback and diff against every later run.
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                document.fonts.check('650 64px Onest') &&
                document.fonts.check('700 12px "IBM Plex Mono"'),
            ),
          )
          .toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        /*
         * A full-page screenshot does not scroll, so every lazy image below the
         * fold stays unrequested and the baseline records empty frames — which
         * is exactly how six blank photo frames ended up in the reviewed
         * snapshots. Walk the page once to trigger the loads, wait for them to
         * decode, then return to the top before capturing.
         */
        await page.evaluate(async () => {
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          window.scrollTo(0, 0);
          await Promise.all(
            [...document.images]
              .filter((image) => !image.complete)
              .map(
                (image) =>
                  new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                  }),
              ),
          );
          await new Promise((resolve) => setTimeout(resolve, 120));
        });

        await expect(page).toHaveScreenshot(
          `landing-${locale}-${viewport.name}.png`,
          {
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
          },
        );
      });
    });
  }
}

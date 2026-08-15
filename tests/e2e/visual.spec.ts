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
        await expect(
          page.locator('link[href="/assets/fonts/faces.css"]'),
        ).toHaveCount(1);
        await page.evaluate(async () => {
          const faces = document.querySelector(
            'link[href="/assets/fonts/faces.css"]',
          );
          if (faces instanceof HTMLLinkElement && !faces.sheet) {
            await new Promise((resolve, reject) => {
              faces.addEventListener('load', resolve, { once: true });
              faces.addEventListener('error', reject, { once: true });
            });
          }
          await document.fonts.ready;
        });
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

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

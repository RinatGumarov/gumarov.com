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

      test('matches the reviewed full-page snapshot', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(localePath(locale), { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
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

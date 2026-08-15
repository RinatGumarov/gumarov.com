import { expect, test } from '@playwright/test';
import { localePath, qualityLocales } from './quality';

/**
 * Below the stacked breakpoint the portrait sits under the copy instead of
 * beside it, so the desktop right-edge composition no longer applies. These
 * widths span narrow phones, large phones, phones in landscape, and small
 * tablets, because the portrait only started drifting once the content column
 * grew past the portrait's own maximum width.
 */
const stackedWidths = [320, 360, 390, 430, 480, 540, 600, 700, 736] as const;

// Sub-pixel rounding and scrollbar reservation can differ by a pixel.
const centeringTolerance = 2;

for (const locale of qualityLocales) {
  for (const width of stackedWidths) {
    test(`centres the ${locale} hero portrait at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(localePath(locale), { waitUntil: 'domcontentloaded' });

      const measurements = await page.evaluate(() => {
        const figure = document.querySelector(
          'section[data-hero] figure',
        ) as HTMLElement | null;
        if (!figure) return null;
        const rect = figure.getBoundingClientRect();
        return {
          viewport: document.documentElement.clientWidth,
          left: rect.left,
          right: rect.right,
        };
      });

      expect(measurements).not.toBeNull();
      const { viewport, left, right } = measurements!;
      const leadingGap = left;
      const trailingGap = viewport - right;

      expect(
        Math.abs(leadingGap - trailingGap),
        `portrait is off-centre at ${width}px: ${Math.round(leadingGap)}px before, ${Math.round(trailingGap)}px after`,
      ).toBeLessThanOrEqual(centeringTolerance);
    });
  }
}

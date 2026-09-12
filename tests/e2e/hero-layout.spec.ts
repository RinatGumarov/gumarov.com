import { expect, test } from '@playwright/test';
import { localePath, qualityLocales } from './quality';

/**
 * The hero no longer opens with a large portrait figure that the copy sits
 * under. The portrait is now the page's single 44px avatar beside the name,
 * so "is the figure centred in the viewport" has no subject any more. What
 * replaced it is a single content column: the avatar, the name and the heading
 * all start on the same edge, and the column itself is what the page gutter
 * centres.
 *
 * These are the same widths the centring test used — narrow phones, large
 * phones, phones in landscape and small tablets — because that range is where
 * the hero's gutter arithmetic changes (16px at 320, 20px below 768, 32px
 * above) and where a Russian heading is most likely to push the column wide.
 */
const stackedWidths = [320, 360, 390, 430, 480, 540, 600, 700, 736] as const;

// Sub-pixel rounding and scrollbar reservation can differ by a pixel.
const alignmentTolerance = 2;

// The avatar's reserved box. Fixed at every breakpoint, and declared in CSS
// rather than left to the image, so the hero's layout is settled before the
// portrait decodes — or fails.
const portraitBox = { width: 44, height: 44 };

for (const locale of qualityLocales) {
  for (const width of stackedWidths) {
    test(`seats the ${locale} hero on one centred column at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(localePath(locale), { waitUntil: 'domcontentloaded' });

      const measurements = await page.evaluate(() => {
        const hero = document.querySelector(
          'section[data-hero]',
        ) as HTMLElement | null;
        const portrait = document.querySelector(
          'section[data-hero] picture',
        ) as HTMLElement | null;
        const heading = document.querySelector(
          'section[data-hero] h1',
        ) as HTMLElement | null;
        if (!hero || !portrait || !heading) return null;

        const root = document.documentElement;
        const heroRect = hero.getBoundingClientRect();
        const portraitRect = portrait.getBoundingClientRect();
        return {
          viewport: root.clientWidth,
          scrollWidth: root.scrollWidth,
          heroLeft: heroRect.left,
          heroRight: heroRect.right,
          portraitLeft: portraitRect.left,
          portraitWidth: portraitRect.width,
          portraitHeight: portraitRect.height,
          headingLeft: heading.getBoundingClientRect().left,
          // The avatar is decoration: the identity row's accessible content is
          // the name, never a description of the photograph.
          portraitHiddenFromAssistiveTech: Boolean(
            portrait.closest('[aria-hidden="true"]'),
          ),
        };
      });

      expect(measurements).not.toBeNull();
      const m = measurements!;

      const leadingGap = m.heroLeft;
      const trailingGap = m.viewport - m.heroRight;
      expect(
        Math.abs(leadingGap - trailingGap),
        `hero column is off-centre at ${width}px: ${Math.round(leadingGap)}px before, ${Math.round(trailingGap)}px after`,
      ).toBeLessThanOrEqual(alignmentTolerance);

      expect(
        Math.abs(m.portraitLeft - m.headingLeft),
        `the avatar and the heading start on different edges at ${width}px: ${Math.round(m.portraitLeft)}px against ${Math.round(m.headingLeft)}px`,
      ).toBeLessThanOrEqual(alignmentTolerance);

      // The reserved box is what keeps the portrait out of the CLS budget: it
      // must not grow with the viewport and must not wait for the image.
      expect(
        Math.round(m.portraitWidth),
        `avatar width drifted at ${width}px`,
      ).toBe(portraitBox.width);
      expect(
        Math.round(m.portraitHeight),
        `avatar height drifted at ${width}px`,
      ).toBe(portraitBox.height);

      expect(m.portraitHiddenFromAssistiveTech).toBe(true);

      expect(
        m.scrollWidth,
        `horizontal overflow of ${m.scrollWidth - m.viewport}px at ${width}px`,
      ).toBeLessThanOrEqual(m.viewport);
    });
  }
}
